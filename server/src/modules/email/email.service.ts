import nodemailer from 'nodemailer';
import { query } from '../../database/connection';
import { tryDecryptSecret } from '../../utils/crypto';

const STALWART_HOST = process.env.STALWART_SMTP_HOST || '';
const STALWART_PORT = parseInt(process.env.STALWART_SMTP_PORT || '587');
const STALWART_SECURE = process.env.STALWART_SMTP_SECURE === 'true';

// Per-user Stalwart SMTP — each user authenticates with their own mail_password
function createUserStalwartTransport(userLoginName: string, mailPassword: string): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: STALWART_HOST,
    port: STALWART_PORT,
    secure: STALWART_SECURE,
    auth: { user: userLoginName, pass: mailPassword },
    tls: { rejectUnauthorized: false },
  });
}

if (STALWART_HOST) {
  console.log('[EMAIL] Stalwart SMTP configured at', STALWART_HOST + ':' + STALWART_PORT);
}

/**
 * Resolves a user's Stalwart credential, preferring the AES-encrypted column.
 * Falls back to the legacy plaintext `mail_password` column (during migration window).
 *
 * Returns { email, displayName, mailPassword } — mailPassword is plaintext (decrypted)
 * suitable for passing to SMTP/IMAP auth. Returns empty string if no credential.
 */
export async function resolveUserMailCredential(userId: string): Promise<{
  email: string;
  displayName: string;
  mailPassword: string;
  loginName: string;
}> {
  const result = await query(
    `SELECT email, display_name, mail_password, mail_password_encrypted
       FROM users WHERE id = $1`,
    [userId],
  );
  const row = result.rows[0] || {};
  const email: string = row.email || '';
  const displayName: string = row.display_name || 'BAL Connect';

  let mailPassword = '';
  if (row.mail_password_encrypted) {
    const decrypted = tryDecryptSecret(row.mail_password_encrypted);
    if (decrypted !== null) {
      mailPassword = decrypted;
    }
  }
  // Backward-compat: plaintext column for users not yet migrated
  if (!mailPassword && row.mail_password) {
    mailPassword = row.mail_password;
  }

  const loginName = email ? email.split('@')[0] : '';
  return { email, displayName, mailPassword, loginName };
}

export interface SendEmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  fromEmail?: string;
  fromName?: string;
  mailPassword?: string;
  attachments?: Array<{ filename: string; path?: string; content?: Buffer; contentType?: string }>;
}

export async function sendEmail(options: SendEmailOptions): Promise<{ messageId: string; accepted: string[] }> {
  const senderEmail = options.fromEmail || '';
  const senderName = options.fromName || 'BAL Connect';
  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  const mailPass = options.mailPassword || '';
  const userLogin = senderEmail ? senderEmail.split('@')[0] : '';

  if (!STALWART_HOST || !userLogin || !mailPass) {
    throw new Error('Stalwart SMTP not configured or user has no mail_password');
  }

  // ALL mail routed through Stalwart — user authenticates as themselves
  const transport = createUserStalwartTransport(userLogin, mailPass);
  const fromAddress = `"${senderName}" <${senderEmail}>`;

  const result = await transport.sendMail({
    from: fromAddress,
    to: recipients.join(', '),
    cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
    bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
    subject: options.subject,
    text: options.text,
    html: options.html,
    replyTo: options.replyTo,
    attachments: options.attachments,
  });

  console.log(`[EMAIL] Sent via Stalwart as ${senderEmail} to ${recipients.join(', ')}`);
  return { messageId: result.messageId, accepted: result.accepted as string[] };
}

export function getTransporter() {
  return createUserStalwartTransport('admin', process.env.STALWART_SMTP_PASSWORD || '');
}
