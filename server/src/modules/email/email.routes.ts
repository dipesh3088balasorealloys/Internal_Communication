import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { query } from '../../database/connection';
import { sendEmail } from './email.service';
import { fetchEmails, testImapConnection, fetchImapAttachment } from './imap.service';

const EMAIL_ATTACH_DIR = path.resolve(process.env.UPLOAD_DIR || '../data', 'email-attachments');

const router = Router();
router.use(authMiddleware);

// Multer for email attachments (in-memory, max 25MB total)
const emailUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// ─── SEND ────────────────────────────────────────────────

// POST /api/email/send — Send email via SMTP (supports JSON or multipart with attachments)
router.post('/send', emailUpload.array('attachments', 10), async (req: AuthRequest, res: Response) => {
  try {
    // Handle both JSON body and FormData (multipart)
    const isMultipart = req.is('multipart/form-data');
    const to = isMultipart ? JSON.parse(req.body.to || '[]') : req.body.to;
    const cc = isMultipart ? (req.body.cc ? JSON.parse(req.body.cc) : undefined) : req.body.cc;
    const bcc = isMultipart ? (req.body.bcc ? JSON.parse(req.body.bcc) : undefined) : req.body.bcc;
    const subject = req.body.subject;
    const html = req.body.html;
    const text = req.body.text;
    const replyTo = req.body.replyTo;
    const draftId = req.body.draftId;

    // Process file attachments from multer
    const files = (req.files as Express.Multer.File[]) || [];
    const emailAttachments = files.map(f => ({
      filename: f.originalname,
      content: f.buffer,
      contentType: f.mimetype,
    }));

    if (!to || (Array.isArray(to) && to.length === 0)) {
      return res.status(400).json({ error: 'At least one recipient (to) is required' });
    }
    if (!subject?.trim()) {
      return res.status(400).json({ error: 'Subject is required' });
    }

    // Get sender's email, name, and mail_password from DB
    const senderResult = await query('SELECT email, display_name, mail_password FROM users WHERE id = $1', [req.user!.userId]);
    const senderEmail = senderResult.rows[0]?.email || '';
    const senderName = senderResult.rows[0]?.display_name || 'BAL Connect';
    const mailPassword = senderResult.rows[0]?.mail_password || '';

    // All emails sent directly through Stalwart as the actual sender
    let finalHtml = html || undefined;
    if (false) {
      // Banner removed — no longer using Office 365 relay
    }

    const result = await sendEmail({
      to, cc: cc || undefined, bcc: bcc || undefined, subject,
      html: finalHtml,
      text: text || html?.replace(/<[^>]*>/g, '') || '',
      replyTo: replyTo || undefined,
      fromEmail: senderEmail,
      fromName: senderName,
      mailPassword,
      attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
    });

    // Save attachments to disk and build metadata
    const attachmentMeta: Array<{ id: string; name: string; size: number; contentType: string }> = [];
    if (files.length > 0) {
      if (!fs.existsSync(EMAIL_ATTACH_DIR)) fs.mkdirSync(EMAIL_ATTACH_DIR, { recursive: true });
      for (const file of files) {
        const fileId = randomUUID();
        const ext = path.extname(file.originalname) || '';
        const savedName = `${fileId}${ext}`;
        fs.writeFileSync(path.join(EMAIL_ATTACH_DIR, savedName), file.buffer);
        attachmentMeta.push({ id: fileId, name: file.originalname, size: file.size, contentType: file.mimetype });
      }
    }
    const attachJson = JSON.stringify(attachmentMeta);

    // If sending a draft, update it to 'sent'; otherwise insert new
    if (draftId) {
      await query(
        `UPDATE sent_emails SET to_addresses=$1, cc_addresses=$2, bcc_addresses=$3, subject=$4, html_body=$5, text_body=$6, message_id=$7, status='sent', attachments=$10, created_at=NOW()
         WHERE id=$8 AND user_id=$9`,
        [
          JSON.stringify(Array.isArray(to) ? to : [to]),
          JSON.stringify(cc || []),
          JSON.stringify(bcc || []),
          subject, html || null, text || html?.replace(/<[^>]*>/g, '') || null,
          result.messageId, draftId, req.user!.userId, attachJson,
        ]
      );
    } else {
      await query(
        `INSERT INTO sent_emails (user_id, to_addresses, cc_addresses, bcc_addresses, subject, html_body, text_body, message_id, status, attachments)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'sent', $9)`,
        [
          req.user!.userId,
          JSON.stringify(Array.isArray(to) ? to : [to]),
          JSON.stringify(cc || []), JSON.stringify(bcc || []),
          subject, html || null, text || html?.replace(/<[^>]*>/g, '') || null,
          result.messageId, attachJson,
        ]
      );
    }

    res.json({ success: true, messageId: result.messageId, accepted: result.accepted });
  } catch (err: any) {
    console.error('[EMAIL] Send failed:', err.message);
    res.status(500).json({ error: 'Failed to send email: ' + err.message });
  }
});

// ─── SENT ITEMS ──────────────────────────────────────────

router.get('/sent', async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '50', offset = '0' } = req.query;
    const result = await query(
      `SELECT id, to_addresses, cc_addresses, bcc_addresses, subject, html_body, text_body, message_id, status, created_at, attachments
       FROM sent_emails WHERE user_id = $1 AND status = 'sent'
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [req.user!.userId, parseInt(limit as string), parseInt(offset as string)]
    );
    const count = await query(`SELECT COUNT(*) FROM sent_emails WHERE user_id = $1 AND status = 'sent'`, [req.user!.userId]);
    res.json({ emails: result.rows, total: parseInt(count.rows[0].count) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DRAFTS ──────────────────────────────────────────────

router.post('/draft', async (req: AuthRequest, res: Response) => {
  try {
    const { to, cc, bcc, subject, html } = req.body;
    const result = await query(
      `INSERT INTO sent_emails (user_id, to_addresses, cc_addresses, bcc_addresses, subject, html_body, text_body, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft') RETURNING id, created_at`,
      [
        req.user!.userId,
        JSON.stringify(to || []), JSON.stringify(cc || []), JSON.stringify(bcc || []),
        subject || '(No subject)', html || null, html?.replace(/<[^>]*>/g, '') || null,
      ]
    );
    res.json({ success: true, draft: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/draft/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { to, cc, bcc, subject, html } = req.body;
    await query(
      `UPDATE sent_emails SET to_addresses=$1, cc_addresses=$2, bcc_addresses=$3, subject=$4, html_body=$5, text_body=$6
       WHERE id=$7 AND user_id=$8 AND status='draft'`,
      [
        JSON.stringify(to || []), JSON.stringify(cc || []), JSON.stringify(bcc || []),
        subject || '(No subject)', html || null, html?.replace(/<[^>]*>/g, '') || null,
        req.params.id, req.user!.userId,
      ]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/drafts', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, to_addresses, cc_addresses, bcc_addresses, subject, html_body, text_body, created_at
       FROM sent_emails WHERE user_id = $1 AND status = 'draft'
       ORDER BY created_at DESC`,
      [req.user!.userId]
    );
    res.json({ emails: result.rows, total: result.rows.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE / RESTORE ────────────────────────────────────

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await query(
      `UPDATE sent_emails SET status = 'deleted' WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user!.userId]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/restore', async (req: AuthRequest, res: Response) => {
  try {
    await query(
      `UPDATE sent_emails SET status = 'sent' WHERE id = $1 AND user_id = $2 AND status = 'deleted'`,
      [req.params.id, req.user!.userId]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/deleted', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, to_addresses, cc_addresses, bcc_addresses, subject, html_body, text_body, created_at
       FROM sent_emails WHERE user_id = $1 AND status = 'deleted'
       ORDER BY created_at DESC`,
      [req.user!.userId]
    );
    res.json({ emails: result.rows, total: result.rows.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── FOLDER COUNTS ───────────────────────────────────────

router.get('/counts', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT status, COUNT(*) as count FROM sent_emails WHERE user_id = $1 GROUP BY status`,
      [req.user!.userId]
    );
    const counts: Record<string, number> = { sent: 0, draft: 0, deleted: 0 };
    result.rows.forEach((r: any) => { counts[r.status] = parseInt(r.count); });
    res.json(counts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ATTACHMENT DOWNLOAD ─────────────────────────────────

router.get('/attachment/:fileId', async (req: AuthRequest, res: Response) => {
  try {
    const { fileId } = req.params;
    const { name } = req.query;

    // Find the file on disk
    const files = fs.readdirSync(EMAIL_ATTACH_DIR);
    const match = files.find(f => f.startsWith(fileId as string));
    if (!match) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const filePath = path.join(EMAIL_ATTACH_DIR, match);
    const fileName = (name as string) || match;
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.sendFile(filePath);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── IMAP ATTACHMENT DOWNLOAD ─────────────────────────────

router.get('/imap-attachment/:uid/:index', async (req: AuthRequest, res: Response) => {
  try {
    const uid = parseInt(req.params.uid as string);
    const index = parseInt(req.params.index as string);
    const userResult = await query('SELECT email, mail_password FROM users WHERE id = $1', [req.user!.userId]);
    const userLogin = (userResult.rows[0]?.email || '').split('@')[0];
    const mailPass = userResult.rows[0]?.mail_password || '';

    const att = await fetchImapAttachment(uid, index, userLogin, mailPass);
    if (!att) return res.status(404).json({ error: 'Attachment not found' });

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(att.filename)}"`);
    res.setHeader('Content-Type', att.contentType);
    res.send(att.content);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CONTACTS (company directory for autocomplete) ───────

router.get('/contacts', async (req: AuthRequest, res: Response) => {
  try {
    const { q = '' } = req.query;
    const search = `%${(q as string).toLowerCase()}%`;
    const result = await query(
      `SELECT id, display_name, email, department, designation, avatar_url
       FROM users
       WHERE is_active = true
         AND ($1 = '%%' OR LOWER(display_name) LIKE $1 OR LOWER(email) LIKE $1)
       ORDER BY display_name ASC
       LIMIT 20`,
      [search]
    );
    res.json({ contacts: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SMTP TEST ───────────────────────────────────────────

router.get('/test', async (_req: AuthRequest, res: Response) => {
  try {
    const { getTransporter } = require('./email.service');
    await getTransporter().verify();
    res.json({ status: 'ok', host: process.env.SMTP_HOST, user: process.env.SMTP_USER });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// ─── IMAP (per-user inbox from Stalwart) ─────────────────

router.get('/inbox', async (req: AuthRequest, res: Response) => {
  try {
    const { folder = 'INBOX', limit = '30' } = req.query;
    // Get the logged-in user's email + mail_password for per-user IMAP login
    const userResult = await query('SELECT email, mail_password FROM users WHERE id = $1', [req.user!.userId]);
    const userEmail = userResult.rows[0]?.email || '';
    const userMailPass = userResult.rows[0]?.mail_password || '';
    const userLogin = userEmail.split('@')[0];
    const emails = await fetchEmails(folder as string, parseInt(limit as string), userLogin, userMailPass);
    res.json({ emails, total: emails.length, folder, account: userEmail });
  } catch (err: any) {
    console.error('[EMAIL] Inbox fetch error:', err.message);
    res.status(500).json({ error: 'Inbox not available — ' + err.message });
  }
});

router.get('/imap-test', async (_req: AuthRequest, res: Response) => {
  try {
    const ok = await testImapConnection();
    res.json({ status: ok ? 'ok' : 'error', host: process.env.IMAP_HOST, user: process.env.IMAP_USER });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

export default router;
