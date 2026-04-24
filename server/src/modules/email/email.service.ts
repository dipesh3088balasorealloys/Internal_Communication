import nodemailer from 'nodemailer';

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
