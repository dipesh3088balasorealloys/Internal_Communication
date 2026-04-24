import nodemailer from 'nodemailer';

const STALWART_HOST = process.env.STALWART_SMTP_HOST || '';
const STALWART_PORT = parseInt(process.env.STALWART_SMTP_PORT || '587');
const STALWART_SECURE = process.env.STALWART_SMTP_SECURE === 'true';
const INTERNAL_DOMAIN = process.env.STALWART_DOMAIN || 'balasorealloys.in';

// Office 365 SMTP — only used for outbound to external domains (@balasorealloys.com, @gmail.com, etc.)
// Because ISP (BSNL) blocks outbound port 25, Stalwart cannot deliver externally
// Office 365 on port 587 bypasses the ISP block
const OFFICE365_HOST = process.env.SMTP_HOST || '';
const OFFICE365_PORT = parseInt(process.env.SMTP_PORT || '587');
const OFFICE365_USER = process.env.SMTP_USER || '';
const OFFICE365_PASS = process.env.SMTP_PASSWORD || '';

let office365Transport: nodemailer.Transporter | null = null;
if (OFFICE365_HOST && OFFICE365_USER && OFFICE365_PASS) {
  office365Transport = nodemailer.createTransport({
    host: OFFICE365_HOST,
    port: OFFICE365_PORT,
    secure: false,
    auth: { user: OFFICE365_USER, pass: OFFICE365_PASS },
    tls: { ciphers: 'SSLv3', rejectUnauthorized: false },
  });
  office365Transport.verify().then(() => {
    console.log('[EMAIL] Office 365 SMTP relay connected (for external outbound)');
  }).catch((err) => {
    console.warn('[EMAIL] Office 365 SMTP relay failed:', err.message);
  });
}

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

  // Check if all recipients are internal (@balasorealloys.in)
  const allInternal = recipients.every(r => r.toLowerCase().endsWith(`@${INTERNAL_DOMAIN}`));

  let transport: nodemailer.Transporter;
  let fromAddress: string;

  if (allInternal && STALWART_HOST && userLogin && mailPass) {
    // INTERNAL: Send through Stalwart as the actual user
    transport = createUserStalwartTransport(userLogin, mailPass);
    fromAddress = `"${senderName}" <${senderEmail}>`;
    console.log(`[EMAIL] Routing internal: ${senderEmail} → Stalwart`);
  } else if (office365Transport) {
    // EXTERNAL: Send through Office 365 relay (ISP blocks port 25 outbound)
    // O365 only owns @balasorealloys.com — it cannot send AS @balasorealloys.in
    // Until M365 accepted domain is configured for balasorealloys.in, we must:
    //   - Set From to the authenticated O365 account (it.helpdesk@balasorealloys.com)
    //   - Put the real sender in Reply-To so replies go back to them
    transport = office365Transport;
    const senderDomain = senderEmail.split('@')[1]?.toLowerCase() || '';
    const office365Domain = OFFICE365_USER.split('@')[1]?.toLowerCase() || '';

    if (senderDomain === office365Domain) {
      // Sender is @balasorealloys.com — O365 can send as them directly
      fromAddress = `"${senderName}" <${senderEmail}>`;
    } else {
      // Sender is @balasorealloys.in — use O365 account as From, real sender as Reply-To
      fromAddress = `"${senderName} via BAL Connect" <${OFFICE365_USER}>`;
      if (!options.replyTo) {
        options.replyTo = senderEmail;
      }
    }
    console.log(`[EMAIL] Routing external: ${senderEmail} → Office 365 relay (from: ${fromAddress})`);
  } else if (STALWART_HOST && userLogin && mailPass) {
    // Fallback: try Stalwart anyway (will queue if port 25 blocked)
    transport = createUserStalwartTransport(userLogin, mailPass);
    fromAddress = `"${senderName}" <${senderEmail}>`;
    console.log(`[EMAIL] Routing fallback: ${senderEmail} → Stalwart`);
  } else {
    throw new Error('No email transport available');
  }

  // When sending via O365 as a different identity (e.g. .in sender via it.helpdesk@.com),
  // O365 forces its own display name. Inject a sender banner into the body so recipients
  // always see who actually sent the email. This is removed once M365 accepted domain is set up.
  const senderDomain = senderEmail.split('@')[1]?.toLowerCase() || '';
  const office365Domain = OFFICE365_USER.split('@')[1]?.toLowerCase() || '';
  const needsSenderBanner =
    transport === office365Transport &&
    senderDomain &&
    office365Domain &&
    senderDomain !== office365Domain;

  let finalHtml = options.html;
  let finalText = options.text;

  if (needsSenderBanner) {
    const banner = `
<div style="background:#f4f6f9;border-left:4px solid #0066cc;padding:10px 14px;margin-bottom:16px;font-family:Arial,sans-serif;font-size:13px;color:#333;">
  <div><strong>From:</strong> ${senderName} &lt;${senderEmail}&gt;</div>
  <div><strong>Sent via:</strong> BAL Connect</div>
  <div style="color:#777;font-size:11px;margin-top:4px;">Reply directly to this email — it will reach ${senderEmail}</div>
</div>`.trim();

    const textBanner =
      `From: ${senderName} <${senderEmail}>\n` +
      `Sent via: BAL Connect\n` +
      `Reply directly to this email — it will reach ${senderEmail}\n` +
      `${'-'.repeat(60)}\n\n`;

    if (finalHtml) {
      finalHtml = banner + finalHtml;
    } else if (finalText) {
      finalText = textBanner + finalText;
    } else {
      finalHtml = banner;
    }
  }

  const result = await transport.sendMail({
    from: fromAddress,
    to: recipients.join(', '),
    cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
    bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
    subject: options.subject,
    text: finalText,
    html: finalHtml,
    replyTo: options.replyTo,
    attachments: options.attachments,
  });

  console.log(`[EMAIL] Sent as ${senderEmail} to ${recipients.join(', ')}`);
  return { messageId: result.messageId, accepted: result.accepted as string[] };
}

export function getTransporter() {
  return office365Transport || createUserStalwartTransport('admin', process.env.STALWART_SMTP_PASSWORD || '');
}
