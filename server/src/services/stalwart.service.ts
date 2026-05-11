/**
 * Stalwart Mail Server — Management API wrapper.
 *
 * Talks to the Stalwart admin REST API (default http://stalwart:8080) to
 * create/update/delete principals (mail accounts) and to verify credentials
 * via IMAP login.
 *
 * Configured via env:
 *   STALWART_ADMIN_API_URL   e.g. http://192.168.10.15:8080
 *   STALWART_ADMIN_USER      e.g. admin
 *   STALWART_ADMIN_PASSWORD  e.g. <admin pwd from docker logs / fallback file>
 *
 * NOTE: Stalwart's API has evolved across versions. Endpoint names and request
 * shapes can shift. This wrapper centralises that surface so one place needs
 * tweaking if the upstream API changes. All methods return typed results and
 * throw `StalwartApiError` on non-2xx responses with the body included.
 */

import { ImapFlow } from 'imapflow';

const API_URL = (process.env.STALWART_ADMIN_API_URL || 'http://192.168.10.15:8080').replace(/\/$/, '');
const ADMIN_USER = process.env.STALWART_ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.STALWART_ADMIN_PASSWORD || '';
const DOMAIN = process.env.STALWART_DOMAIN || 'balasorealloys.in';

export class StalwartApiError extends Error {
  status: number;
  body: any;
  constructor(message: string, status: number, body: any) {
    super(message);
    this.name = 'StalwartApiError';
    this.status = status;
    this.body = body;
  }
}

export interface PrincipalSummary {
  name: string;       // login name (e.g. dipesh.mondal)
  emails?: string[];  // mail addresses (e.g. dipesh.mondal@balasorealloys.in)
  description?: string;
  type?: string;      // 'individual' | 'group' | etc
  quota?: number;
  enabled?: boolean;
}

function authHeader(): string {
  const creds = Buffer.from(`${ADMIN_USER}:${ADMIN_PASSWORD}`).toString('base64');
  return `Basic ${creds}`;
}

async function apiRequest<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: any
): Promise<T> {
  const url = `${API_URL}${path}`;
  const headers: Record<string, string> = {
    'Authorization': authHeader(),
    'Accept': 'application/json',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err: any) {
    throw new StalwartApiError(
      `Failed to reach Stalwart admin API at ${url}: ${err.message}`,
      0,
      null
    );
  }

  const text = await response.text();
  let parsed: any = null;
  if (text) {
    try { parsed = JSON.parse(text); } catch { parsed = text; }
  }

  if (!response.ok) {
    throw new StalwartApiError(
      `Stalwart API ${method} ${path} returned ${response.status}: ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`,
      response.status,
      parsed
    );
  }

  // Stalwart sometimes returns HTTP 200 with body `{"error": "...", ...}` for
  // logical errors like notFound. Translate these to thrown StalwartApiErrors
  // so callers can use `.status` to distinguish.
  if (parsed && typeof parsed === 'object' && 'error' in parsed && !('data' in parsed)) {
    const errorCode = String(parsed.error || '').toLowerCase();
    // Map common error codes to HTTP-like statuses for caller convenience
    let mappedStatus = 500;
    if (errorCode === 'notfound' || errorCode === 'not_found') mappedStatus = 404;
    else if (errorCode === 'alreadyexists' || errorCode === 'already_exists' || errorCode === 'duplicate') mappedStatus = 409;
    else if (errorCode === 'unauthorized') mappedStatus = 401;
    else if (errorCode === 'forbidden') mappedStatus = 403;
    else if (errorCode === 'invalidrequest' || errorCode === 'invalid_request') mappedStatus = 400;
    throw new StalwartApiError(
      `Stalwart returned logical error: ${JSON.stringify(parsed)}`,
      mappedStatus,
      parsed,
    );
  }

  // Stalwart wraps successful responses as { data: ... }
  if (parsed && typeof parsed === 'object' && 'data' in parsed && Object.keys(parsed).length === 1) {
    return parsed.data as T;
  }
  return parsed as T;
}

/**
 * Returns the mail address for a given username (e.g. "dipesh.mondal" → "dipesh.mondal@balasorealloys.in").
 */
export function emailForUsername(username: string, customDomain?: string): string {
  const domain = customDomain || DOMAIN;
  return `${username}@${domain}`;
}

/**
 * Fetch a principal by its login name. Returns null if not found.
 *
 * Stalwart's GET /api/principal/{name} behavior varies across versions:
 *   - Some versions return 404 if not found.
 *   - Some return 200 with `{ data: null }`.
 *   - Some return 200 with an empty object or a different principal.
 * We treat all of those as "not found" by verifying the returned object
 * actually has a matching `name` field.
 */
export async function getPrincipal(name: string): Promise<PrincipalSummary | null> {
  let raw: any;
  try {
    raw = await apiRequest<any>('GET', `/api/principal/${encodeURIComponent(name)}`);
  } catch (err) {
    if (err instanceof StalwartApiError && err.status === 404) return null;
    // Some Stalwart versions return 4xx for unknown names; treat any 4xx as "not found".
    if (err instanceof StalwartApiError && err.status >= 400 && err.status < 500) {
      console.warn(`[Stalwart] getPrincipal(${name}) returned ${err.status} — treating as not found`);
      return null;
    }
    throw err;
  }

  // Defensive parsing — Stalwart sometimes returns wrapped or empty payloads
  if (!raw) return null;
  if (typeof raw !== 'object') return null;

  // If the response is an array (some endpoints return list), look for exact match
  if (Array.isArray(raw)) {
    const match = raw.find((p) => p && (p.name === name || p.id === name));
    return match ? (match as PrincipalSummary) : null;
  }

  // Verify it actually represents the principal we asked for
  const principal = raw as PrincipalSummary & { id?: string };
  const matchesName = principal.name === name;
  const matchesId = (principal as any).id === name;
  if (!matchesName && !matchesId) {
    // Returned data is for someone else (or generic) — treat as not found
    console.warn(
      `[Stalwart] getPrincipal(${name}) returned a different principal (name=${principal.name}, id=${(principal as any).id}). Treating as not found.`,
    );
    return null;
  }

  return principal;
}

/**
 * Create a new individual principal (mail account) in Stalwart.
 * Sends both `secret` (password) and `emails` (mail addresses) so the account is fully usable.
 */
export async function createPrincipal(opts: {
  name: string;          // login name e.g. "dipesh.mondal"
  password: string;      // plaintext, only sent over the API
  email: string;         // primary email e.g. "dipesh.mondal@balasorealloys.in"
  description?: string;  // optional display label
}): Promise<PrincipalSummary> {
  const body: any = {
    type: 'individual',
    name: opts.name,
    secrets: [opts.password],
    emails: [opts.email],
    description: opts.description || opts.email,
  };
  return await apiRequest<PrincipalSummary>('POST', '/api/principal', body);
}

/**
 * Update password (secret) for an existing principal.
 */
export async function setPrincipalPassword(name: string, newPassword: string): Promise<void> {
  // Stalwart accepts a JSON-patch-like body for partial updates.
  // We send a list of changes: replace the `secrets` array with the new password.
  const body = [
    { action: 'set', field: 'secrets', value: [newPassword] },
  ];
  await apiRequest('PATCH', `/api/principal/${encodeURIComponent(name)}`, body);
}

/**
 * Enable or disable a principal. Stalwart implements this via the `enabled` field
 * (or by removing access). We use a patch.
 */
export async function setPrincipalEnabled(name: string, enabled: boolean): Promise<void> {
  const body = [
    { action: 'set', field: 'enabled', value: enabled },
  ];
  // Some Stalwart versions don't have an 'enabled' flag and instead require deleting
  // the principal or clearing its secrets. We attempt the patch; on 4xx we fall
  // back to clearing secrets (effectively disabling auth) when disabling.
  try {
    await apiRequest('PATCH', `/api/principal/${encodeURIComponent(name)}`, body);
  } catch (err) {
    if (err instanceof StalwartApiError && err.status >= 400 && err.status < 500 && !enabled) {
      // Fallback: clear secrets to prevent login
      await apiRequest('PATCH', `/api/principal/${encodeURIComponent(name)}`, [
        { action: 'set', field: 'secrets', value: [] },
      ]);
      return;
    }
    throw err;
  }
}

/**
 * Delete a principal entirely. Use with caution — this removes the mailbox.
 */
export async function deletePrincipal(name: string): Promise<void> {
  await apiRequest('DELETE', `/api/principal/${encodeURIComponent(name)}`);
}

/**
 * Verify credentials by attempting an IMAP login. Cheap and authoritative.
 * Returns true on successful login, false otherwise. Never throws.
 */
export async function testCredentials(loginName: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const host = process.env.IMAP_HOST || '192.168.10.15';
  const port = parseInt(process.env.IMAP_PORT || '143');
  const secure = process.env.IMAP_SECURE === 'true';

  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: { user: loginName, pass: password },
    logger: false,
    tls: { rejectUnauthorized: false },
    socketTimeout: 8000,
  });

  try {
    await client.connect();
    await client.logout();
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || String(err) };
  }
}

/**
 * Quick health check — confirms admin credentials are valid by making a
 * harmless GET. Used by setup screens.
 */
export async function pingAdminApi(): Promise<{ ok: boolean; error?: string }> {
  try {
    await apiRequest('GET', '/api/principal?limit=1');
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
