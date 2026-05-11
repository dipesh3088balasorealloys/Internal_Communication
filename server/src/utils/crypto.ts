/**
 * AES-256-GCM helpers for encrypting sensitive data at rest.
 *
 * Used by:
 *   - users.mail_password_encrypted (Stalwart mail credentials)
 *
 * Format of encrypted blob:
 *   [12-byte IV][16-byte auth tag][ciphertext]
 *
 * Key is read from process.env.MAIL_PASSWORD_ENCRYPTION_KEY at module load
 * and validated to be exactly 32 bytes (64 hex chars).
 */

import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const hex = process.env.MAIL_PASSWORD_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      'MAIL_PASSWORD_ENCRYPTION_KEY is not set. ' +
      'Generate one with: openssl rand -hex 32'
    );
  }

  // Strip whitespace, validate hex format
  const cleaned = hex.trim();
  if (!/^[0-9a-fA-F]{64}$/.test(cleaned)) {
    throw new Error(
      `MAIL_PASSWORD_ENCRYPTION_KEY must be exactly 64 hex chars (32 bytes). Got ${cleaned.length} chars.`
    );
  }

  cachedKey = Buffer.from(cleaned, 'hex');
  return cachedKey;
}

/**
 * Encrypts a UTF-8 string. Returns a Buffer suitable for storing in a BYTEA column.
 * Throws if key is not configured.
 */
export function encryptSecret(plain: string): Buffer {
  if (typeof plain !== 'string') {
    throw new Error('encryptSecret: plain must be a string');
  }
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Layout: IV | authTag | ciphertext
  return Buffer.concat([iv, authTag, ciphertext]);
}

/**
 * Decrypts a Buffer previously produced by encryptSecret.
 * Returns the original UTF-8 string.
 * Throws if data is malformed, key is wrong, or auth tag fails.
 */
export function decryptSecret(blob: Buffer | Uint8Array | null | undefined): string {
  if (!blob || blob.length === 0) {
    throw new Error('decryptSecret: empty blob');
  }
  const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  if (buf.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error('decryptSecret: blob too short');
  }
  const key = getKey();
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString('utf8');
}

/**
 * Tries to decrypt; returns null if anything fails (auth tag mismatch, malformed, etc).
 * Useful when reading possibly-stale data and wanting to fall back gracefully.
 */
export function tryDecryptSecret(blob: Buffer | Uint8Array | null | undefined): string | null {
  if (!blob || (Buffer.isBuffer(blob) ? blob.length === 0 : blob.length === 0)) {
    return null;
  }
  try {
    return decryptSecret(blob);
  } catch {
    return null;
  }
}

/**
 * Generates a strong random password suitable for a user mail account.
 * Returns a URL-safe base64 string (no padding) of the requested byte length.
 *
 * @param byteLength entropy in bytes (default 12 → 16-char base64 password)
 */
export function generateMailPassword(byteLength = 12): string {
  return crypto
    .randomBytes(byteLength)
    .toString('base64')
    .replace(/\+/g, 'A')
    .replace(/\//g, 'B')
    .replace(/=+$/, '');
}
