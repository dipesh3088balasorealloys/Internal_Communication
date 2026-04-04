/**
 * UCM6304 REST API Service
 * Enterprise-grade client for Grandstream UCM6304 PBX
 *
 * Authentication: MD5 challenge/response
 * API: New HTTPS API (not legacy CDR API)
 * Actions: listAccount, getSIPAccount, etc.
 */

import https from 'https';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UCMConfig {
  host: string;
  port: number;
  apiUser: string;
  apiPassword: string;
}

export interface UCMExtension {
  extension: string;
  fullname: string;
  status: 'Idle' | 'Unavailable' | 'Ringing' | 'InUse' | 'Busy' | string;
  accountType: string;
  addr: string;
  presenceStatus: string;
}

export interface UCMExtensionDetail {
  extension: string;
  fullname: string;
  secret: string;
  enableWebrtc: boolean;
  useAvpf: boolean;
  iceSupport: boolean;
  mediaEncryption: string;
  accountType: string;
  encryption: string;
  nat: string;
  allow: string;
}

// ---------------------------------------------------------------------------
// UCM API Client
// ---------------------------------------------------------------------------

class UCMService {
  private config: UCMConfig;
  private cookie: string | null = null;
  private cookieTimestamp: number = 0;
  private readonly COOKIE_TTL_MS = 25 * 60 * 1000; // 25 min (UCM expires at ~30 min)
  private loginInProgress: Promise<void> | null = null;

  // In-memory cache for extension list (avoids 10-page API pagination on every request)
  private extensionCache: UCMExtension[] | null = null;
  private extensionCacheTimestamp: number = 0;
  private readonly EXTENSION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private extensionFetchInProgress: Promise<UCMExtension[]> | null = null;

  constructor() {
    this.config = {
      host: process.env.UCM_HOST || '192.168.7.2',
      port: parseInt(process.env.UCM_API_PORT || '8089', 10),
      apiUser: process.env.UCM_ADMIN_USER || '',
      apiPassword: process.env.UCM_ADMIN_PASSWORD || '',
    };
  }

  // -------------------------------------------------------------------------
  // Low-level HTTP
  // -------------------------------------------------------------------------

  private rawRequest(body: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const req = https.request(
        {
          hostname: this.config.host,
          port: this.config.port,
          path: '/api',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
          },
          rejectUnauthorized: false, // UCM uses self-signed cert
          timeout: 10000,
        },
        (res) => {
          let buf = '';
          res.on('data', (chunk) => (buf += chunk));
          res.on('end', () => {
            try {
              resolve(JSON.parse(buf));
            } catch {
              reject(new Error(`UCM returned non-JSON: ${buf.substring(0, 200)}`));
            }
          });
        },
      );
      req.on('error', (err) => reject(new Error(`UCM connection error: ${err.message}`)));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('UCM request timeout'));
      });
      req.write(data);
      req.end();
    });
  }

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  private isCookieValid(): boolean {
    return !!this.cookie && Date.now() - this.cookieTimestamp < this.COOKIE_TTL_MS;
  }

  private async authenticate(): Promise<void> {
    // Deduplicate concurrent login attempts
    if (this.loginInProgress) {
      await this.loginInProgress;
      return;
    }

    this.loginInProgress = (async () => {
      try {
        // Step 1: Challenge
        const challengeRes = await this.rawRequest({
          request: { action: 'challenge', user: this.config.apiUser, version: '1.2' },
        });

        if (challengeRes.status !== 0 || !challengeRes.response?.challenge) {
          throw new Error(`UCM challenge failed (status: ${challengeRes.status})`);
        }

        // Step 2: Login with MD5(challenge + password)
        const token = crypto
          .createHash('md5')
          .update(challengeRes.response.challenge + this.config.apiPassword)
          .digest('hex');

        const loginRes = await this.rawRequest({
          request: { action: 'login', token, user: this.config.apiUser },
        });

        if (loginRes.status !== 0 || !loginRes.response?.cookie) {
          throw new Error(`UCM login failed (status: ${loginRes.status})`);
        }

        this.cookie = loginRes.response.cookie;
        this.cookieTimestamp = Date.now();
        console.log('[UCM] Authenticated successfully');
      } finally {
        this.loginInProgress = null;
      }
    })();

    await this.loginInProgress;
  }

  // -------------------------------------------------------------------------
  // Authenticated API call with auto-relogin
  // -------------------------------------------------------------------------

  private async apiCall(requestBody: Record<string, any>, retried = false): Promise<any> {
    if (!this.isCookieValid()) {
      await this.authenticate();
    }

    const res = await this.rawRequest({
      request: { ...requestBody, cookie: this.cookie },
    });

    // Status -6 = session expired, re-authenticate once
    if (res.status === -6 && !retried) {
      this.cookie = null;
      await this.authenticate();
      return this.apiCall(requestBody, true);
    }

    return res;
  }

  // -------------------------------------------------------------------------
  // Public API Methods
  // -------------------------------------------------------------------------

  /**
   * Check if UCM is reachable and credentials work
   */
  async healthCheck(): Promise<{ connected: boolean; totalExtensions: number; latencyMs: number }> {
    const start = Date.now();
    try {
      await this.authenticate();
      const res = await this.apiCall({ action: 'listAccount', page: 1, item_num: 1 });
      return {
        connected: res.status === 0,
        totalExtensions: res.response?.total_item || 0,
        latencyMs: Date.now() - start,
      };
    } catch {
      return { connected: false, totalExtensions: 0, latencyMs: Date.now() - start };
    }
  }

  /**
   * List all SIP extensions from UCM with live status (cached for 5 min)
   */
  async listExtensions(forceRefresh = false): Promise<UCMExtension[]> {
    // Return cached if valid
    if (
      !forceRefresh &&
      this.extensionCache &&
      Date.now() - this.extensionCacheTimestamp < this.EXTENSION_CACHE_TTL_MS
    ) {
      return this.extensionCache;
    }

    // Deduplicate concurrent fetches
    if (this.extensionFetchInProgress) {
      return this.extensionFetchInProgress;
    }

    this.extensionFetchInProgress = (async () => {
      try {
        const allExtensions: UCMExtension[] = [];
        let page = 1;
        const itemsPerPage = 100;

        while (true) {
          const res = await this.apiCall({ action: 'listAccount', page, item_num: itemsPerPage });

          if (res.status !== 0 || !res.response?.account) break;

          for (const acc of res.response.account) {
            allExtensions.push({
              extension: acc.extension,
              fullname: acc.fullname || '',
              status: acc.status || 'Unavailable',
              accountType: acc.account_type || '',
              addr: acc.addr || '-',
              presenceStatus: acc.presence_status || 'available',
            });
          }

          if (page >= (res.response.total_page || 1)) break;
          page++;
        }

        // Update cache
        this.extensionCache = allExtensions;
        this.extensionCacheTimestamp = Date.now();
        console.log(`[UCM] Cached ${allExtensions.length} extensions`);

        return allExtensions;
      } finally {
        this.extensionFetchInProgress = null;
      }
    })();

    return this.extensionFetchInProgress;
  }

  /**
   * Invalidate extension cache (e.g., after assignment changes)
   */
  invalidateExtensionCache(): void {
    this.extensionCache = null;
    this.extensionCacheTimestamp = 0;
  }

  /**
   * List extensions within a specific range
   */
  async listExtensionsInRange(start: number, end: number): Promise<UCMExtension[]> {
    const all = await this.listExtensions();
    return all.filter((e) => {
      const num = parseInt(e.extension, 10);
      return !isNaN(num) && num >= start && num <= end;
    });
  }

  /**
   * Get detailed info for a single extension (includes SIP password)
   */
  async getExtensionDetail(extension: string): Promise<UCMExtensionDetail | null> {
    const res = await this.apiCall({ action: 'getSIPAccount', extension });

    if (res.status !== 0 || !res.response?.extension) return null;

    const ext = res.response.extension;
    return {
      extension: ext.extension,
      fullname: ext.fullname || '',
      secret: ext.secret || '',
      enableWebrtc: ext.enable_webrtc === 'yes',
      useAvpf: ext.use_avpf === 'yes',
      iceSupport: ext.ice_support === 'yes',
      mediaEncryption: ext.media_encryption || '',
      accountType: ext.account_type || 'SIP(WebRTC)',
      encryption: ext.encryption || 'no',
      nat: ext.nat || 'yes',
      allow: ext.allow || '',
    };
  }

  /**
   * Check live registration status of an extension
   */
  async getExtensionStatus(extension: string): Promise<{ registered: boolean; addr: string; status: string }> {
    // listAccount gives us live status
    const all = await this.listExtensions();
    const found = all.find((e) => e.extension === extension);

    if (!found) return { registered: false, addr: '-', status: 'Not Found' };

    return {
      registered: found.status !== 'Unavailable',
      addr: found.addr,
      status: found.status,
    };
  }

  /**
   * Logout / cleanup
   */
  async logout(): Promise<void> {
    if (this.cookie) {
      try {
        await this.rawRequest({ request: { action: 'logout', cookie: this.cookie } });
      } catch {
        // ignore
      }
      this.cookie = null;
    }
  }
}

// Singleton
export const ucmService = new UCMService();
export default ucmService;
