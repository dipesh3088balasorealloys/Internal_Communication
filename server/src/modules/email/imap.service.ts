import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

export interface ParsedEmail {
  id: string;
  uid: number;
  from: string;
  fromEmail: string;
  to: string[];
  cc: string[];
  subject: string;
  preview: string;
  body: string;
  date: string;
  isRead: boolean;
  isStarred: boolean;
  attachments: Array<{ name: string; size: number; contentType: string }>;
}

function createClient(userLoginName?: string, mailPassword?: string): ImapFlow {
  // Per-user IMAP: each user authenticates with their own mail_password (NOT login password)
  const imapUser = userLoginName || process.env.IMAP_USER || '';
  const imapPass = mailPassword || process.env.IMAP_PASSWORD || '';

  return new ImapFlow({
    host: process.env.IMAP_HOST || 'outlook.office365.com',
    port: parseInt(process.env.IMAP_PORT || '993'),
    secure: process.env.IMAP_SECURE !== 'false',
    auth: {
      user: imapUser,
      pass: imapPass,
    },
    logger: false,
    tls: {
      rejectUnauthorized: false,
    },
  });
}

export async function fetchEmails(folder: string = 'INBOX', limit: number = 30, userLoginName?: string, mailPassword?: string): Promise<ParsedEmail[]> {
  const client = createClient(userLoginName, mailPassword);
  const emails: ParsedEmail[] = [];

  try {
    await client.connect();

    const lock = await client.getMailboxLock(folder);
    try {
      // Fetch latest emails (newest first)
      const mb = client.mailbox;
      const totalMessages = mb && typeof mb === 'object' && 'exists' in mb ? (mb as any).exists : 0;
      if (totalMessages === 0) return [];

      const startSeq = Math.max(1, totalMessages - limit + 1);
      const range = `${startSeq}:${totalMessages}`;

      for await (const message of client.fetch(range, {
        envelope: true,
        flags: true,
        bodyStructure: true,
        source: true,
      })) {
        try {
          if (!message.source) continue;
          const parsed = await simpleParser(message.source) as any;

          const fromAddr = parsed.from?.value?.[0];
          const toAddrs = parsed.to ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]).flatMap((a: any) => a.value?.map((v: any) => v.address || '') || []) : [];
          const ccAddrs = parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]).flatMap((a: any) => a.value?.map((v: any) => v.address || '') || []) : [];

          const textBody = parsed.text || '';
          const htmlBody = parsed.html || `<p>${textBody.replace(/\n/g, '<br/>')}</p>`;

          emails.push({
            id: message.uid.toString(),
            uid: message.uid,
            from: fromAddr?.name || fromAddr?.address || 'Unknown',
            fromEmail: fromAddr?.address || '',
            to: toAddrs.filter(Boolean) as string[],
            cc: ccAddrs.filter(Boolean) as string[],
            subject: parsed.subject || '(No subject)',
            preview: textBody.substring(0, 120).replace(/\n/g, ' '),
            body: htmlBody as string,
            date: (parsed.date || new Date()).toISOString(),
            isRead: message.flags?.has('\\Seen') || false,
            isStarred: message.flags?.has('\\Flagged') || false,
            attachments: (parsed.attachments || []).map((att: any, idx: number) => ({
              name: att.filename || 'attachment',
              size: att.size || 0,
              contentType: att.contentType || 'application/octet-stream',
              index: idx,
              uid: message.uid,
              source: 'imap',
            })),
          });
        } catch (parseErr) {
          // Skip emails that fail to parse
          console.warn('[IMAP] Failed to parse message UID', message.uid);
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err: any) {
    console.error('[IMAP] Fetch error:', err.message);
    throw err;
  }

  // Return newest first
  return emails.reverse();
}

export async function fetchFolders(): Promise<Array<{ id: string; name: string; count: number }>> {
  const client = createClient();
  const folders: Array<{ id: string; name: string; count: number }> = [];

  try {
    await client.connect();
    const mailboxes = await client.list();

    for (const mb of mailboxes) {
      if (mb.specialUse || !mb.flags?.has('\\Noselect')) {
        folders.push({
          id: mb.path,
          name: mb.name,
          count: 0, // Would need to open each to get count
        });
      }
    }

    await client.logout();
  } catch (err: any) {
    console.error('[IMAP] Folder list error:', err.message);
    throw err;
  }

  return folders;
}

export async function testImapConnection(): Promise<boolean> {
  const client = createClient();
  try {
    await client.connect();
    await client.logout();
    return true;
  } catch {
    return false;
  }
}

export async function fetchImapAttachment(
  uid: number, attachIndex: number, userLoginName?: string, mailPassword?: string
): Promise<{ content: Buffer; filename: string; contentType: string } | null> {
  const client = createClient(userLoginName, mailPassword);
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      for await (const message of client.fetch(String(uid), { source: true }, { uid: true })) {
        if (!message.source) continue;
        const parsed = await simpleParser(message.source) as any;
        const att = parsed.attachments?.[attachIndex];
        if (att) {
          return {
            content: att.content,
            filename: att.filename || 'attachment',
            contentType: att.contentType || 'application/octet-stream',
          };
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err: any) {
    console.error('[IMAP] Attachment fetch error:', err.message);
  }
  return null;
}
