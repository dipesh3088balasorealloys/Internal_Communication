import nodemailer from 'nodemailer';

// Office 365 SMTP — for @balasorealloys.com executives + external relay
const office365Transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.office365.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASSWORD || '',
  },
  tls: {
    ciphers: 'SSLv3',
    rejectUnauthorized: false,
  },
});

const STALWART_HOST = process.env.STALWART_SMTP_HOST || '';
const STALWART_PORT = parseInt(process.env.STALWART_SMTP_PORT || '587');
const STALWART_SECURE = process.env.STALWART_SMTP_SECURE === 'true';
const INTERNAL_DOMAIN = process.env.STALWART_DOMAIN || 'balasorealloys.in';
const STALWART_DEFAULT_PASS = process.env.STALWART_SMTP_PASSWORD || '';

// Verify Office 365 on startup
office365Transport.verify().then(() => {
  console.log('[EMAIL] Office 365 SMTP connected to', process.env.SMTP_HOST);
}).catch((err) => {
  console.warn('[EMAIL] Office 365 SMTP failed:', err.message);
});

// Per-user Stalwart SMTP — each user authenticates with their own mail_password
// mail_password is stored separately in users table, NOT the BAL Connect login password
function createUserStalwartTransport(userLoginName: string, mailPassword: string): nodemailer.Transporter | null {
  if (!STALWART_HOST) return null;
  return nodemailer.createTransport({
    host: STALWART_HOST,
    port: STALWART_PORT,
    secure: STALWART_SECURE,
    auth: {
      user: userLoginName,
      pass: mailPassword,
    },
    tls: { rejectUnauthorized: false },
  });
}

// Smart routing: internal recipients → Stalwart, external → Office 365
function isInternalRecipient(to: string | string[]): boolean {
  const recipients = Array.isArray(to) ? to : [to];
  return recipients.every(r => r.toLowerCase().endsWith(`@${INTERNAL_DOMAIN}`));
}

// Keep backward compat
const transporter = office365Transport;

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
  const senderName = options.fromName || process.env.SMTP_FROM_NAME || 'BAL Connect';
  const recipients = Array.isArray(options.to) ? options.to : [options.to];

  // Routing logic:
  // - @balasorealloys.in recipients → Stalwart (direct internal delivery)
  // - @balasorealloys.com or external → Office 365 SMTP relay (trusted by Microsoft)
  const allInternal = recipients.every(r => r.toLowerCase().endsWith(`@${INTERNAL_DOMAIN}`));
  const mailPass = options.mailPassword || '';
  const userLogin = senderEmail ? senderEmail.split('@')[0] : '';
  const useStalwart = allInternal && !!STALWART_HOST && !!senderEmail && !!mailPass;

  let transport: nodemailer.Transporter;
  let fromAddress: string;
  let replyTo: string | undefined = options.replyTo;

  if (useStalwart) {
    // Internal: each user authenticates as themselves — proper per-account tracking
    transport = createUserStalwartTransport(userLogin, mailPass)!;
    fromAddress = `"${senderName}" <${senderEmail}>`;
  } else {
    // External: send via Office 365 (it.helpdesk), but show sender's name
    // and set Reply-To so replies go back to the sender's @balasorealloys.in email
    transport = office365Transport;
    const o365Email = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '';
    fromAddress = `"${senderName} via BAL Connect" <${o365Email}>`;
    // In dev: Reply-To uses the Office 365 helpdesk (since @balasorealloys.in has no MX yet)
    // In production: change this to senderEmail once DNS MX record is configured
    if (!replyTo) {
      const o365Reply = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '';
      replyTo = `"${senderName}" <${o365Reply}>`;
    }
  }

  const result = await transport.sendMail({
    from: fromAddress,
    to: recipients.join(', '),
    cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
    bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
    subject: options.subject,
    text: options.text,
    html: options.html,
    replyTo,
    attachments: options.attachments,
  });

  console.log(`[EMAIL] Sent via ${useStalwart ? 'Stalwart' : 'Office 365'} from ${senderEmail || 'helpdesk'} to ${recipients.join(', ')}`);
  return { messageId: result.messageId, accepted: result.accepted as string[] };
}

export function getTransporter() {
  return transporter;
}
