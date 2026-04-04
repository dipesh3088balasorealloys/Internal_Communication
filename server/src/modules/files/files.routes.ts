import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuid } from 'uuid';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { query } from '../../database/connection';
import { config } from '../../config';
import { getIO } from '../../services/socket.service';

const router = Router();

// Ensure upload directories exist
const uploadDir = path.resolve(config.upload.dir);
const avatarDir = path.resolve(config.upload.avatarDir);
[uploadDir, avatarDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Multer config for general file uploads
const fileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dateDir = new Date().toISOString().slice(0, 10);
    const fullDir = path.join(uploadDir, dateDir);
    if (!fs.existsSync(fullDir)) {
      fs.mkdirSync(fullDir, { recursive: true });
    }
    cb(null, fullDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${uuid()}${ext}`;
    cb(null, name);
  },
});

const uploadFile = multer({
  storage: fileStorage,
  limits: { fileSize: config.upload.maxFileSize },
  fileFilter: (_req, file, cb) => {
    const blocked = ['.exe', '.bat', '.cmd', '.scr', '.com', '.pif', '.vbs', '.ws'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (blocked.includes(ext)) {
      cb(new Error(`File type ${ext} is not allowed`));
      return;
    }
    cb(null, true);
  },
});

// Multer config for avatar uploads
const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, avatarDir);
  },
  filename: (req: any, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user?.userId || 'unknown'}${ext}`);
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      cb(new Error('Only image files are allowed for avatars'));
      return;
    }
    cb(null, true);
  },
});

function getFileCategory(mimetype: string): string {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.includes('pdf')) return 'pdf';
  if (mimetype.includes('word') || mimetype.includes('document')) return 'document';
  if (mimetype.includes('spreadsheet') || mimetype.includes('excel')) return 'spreadsheet';
  if (mimetype.includes('presentation') || mimetype.includes('powerpoint')) return 'presentation';
  if (mimetype.includes('zip') || mimetype.includes('compressed') || mimetype.includes('archive')) return 'archive';
  return 'other';
}

// ============================================
// FILE UPLOAD (in a conversation)
// ============================================

// POST /api/files/conversations/:conversationId/files
router.post(
  '/conversations/:conversationId/files',
  authMiddleware,
  uploadFile.single('file'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { conversationId } = req.params;
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const userId = req.user!.userId;

      // Fix multer encoding: decode latin1-encoded UTF-8 filenames
      try {
        file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
      } catch (_) { /* keep original if decode fails */ }

      // Verify membership
      const memberCheck = await query(
        'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
        [conversationId, userId]
      );
      if (memberCheck.rows.length === 0) {
        fs.unlinkSync(file.path);
        return res.status(403).json({ error: 'Not a member of this conversation' });
      }

      // Build file URL from relative path
      const relativePath = path.relative(uploadDir, file.path).replace(/\\/g, '/');
      const fileUrl = `/uploads/${relativePath}`;
      const storedName = path.basename(file.path);

      // Insert file record (matches 001_initial_schema.sql)
      const fileResult = await query(
        `INSERT INTO files (original_name, stored_name, stored_path, mime_type, size_bytes, uploaded_by, conversation_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, original_name, stored_name, stored_path, mime_type, size_bytes, created_at`,
        [file.originalname, storedName, file.path, file.mimetype, file.size, userId, conversationId]
      );

      const fileRecord = fileResult.rows[0];
      const category = getFileCategory(file.mimetype);
      const messageType = category === 'image' ? 'image' : 'file';
      const content = req.body.content || file.originalname;

      // Create message with file reference
      const msgResult = await query(
        `INSERT INTO messages (conversation_id, sender_id, type, content, metadata, sequence_number)
         VALUES ($1, $2, $3, $4, $5, allocate_sequence_number($1))
         RETURNING id, conversation_id, sender_id, type, content, metadata, created_at, sequence_number`,
        [
          conversationId,
          userId,
          messageType,
          content,
          JSON.stringify({
            fileId: fileRecord.id,
            fileName: file.originalname,
            fileUrl,
            fileSize: file.size,
            mimeType: file.mimetype,
            category,
          }),
        ]
      );

      // Link file to message
      await query('UPDATE files SET message_id = $1 WHERE id = $2', [msgResult.rows[0].id, fileRecord.id]);

      // Update conversation timestamp
      await query('UPDATE conversations SET last_message_at = NOW() WHERE id = $1', [conversationId]);

      // Get sender info for broadcast
      const senderResult = await query(
        'SELECT id, username, display_name, avatar_url FROM users WHERE id = $1',
        [userId]
      );
      const sender = senderResult.rows[0];

      // Broadcast file message to conversation via socket
      const fullMessage = {
        ...msgResult.rows[0],
        sender,
        file_url: fileUrl,
        file_name: file.originalname,
        file_size: file.size,
      };
      try {
        getIO().to(`conv:${conversationId}`).emit('message:new', {
          conversationId,
          message: fullMessage,
        });
      } catch (_) { /* socket not ready */ }

      res.status(201).json({
        file: {
          ...fileRecord,
          fileUrl,
          category,
        },
        message: msgResult.rows[0],
      });
    } catch (err: any) {
      console.error('[FILES] Upload error:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

// GET /api/files/conversations/:conversationId/files
router.get(
  '/conversations/:conversationId/files',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { conversationId } = req.params;
      const { type, limit = '50', offset = '0' } = req.query;

      if (req.user!.role !== 'admin') {
        const memberCheck = await query(
          'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
          [conversationId, req.user!.userId]
        );
        if (memberCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Not a member' });
        }
      }

      let sql = `
        SELECT f.id, f.original_name, f.stored_name, f.mime_type, f.size_bytes, f.created_at,
               json_build_object('id', u.id, 'displayName', u.display_name) as uploader
        FROM files f
        LEFT JOIN users u ON f.uploaded_by = u.id
        WHERE f.conversation_id = $1
      `;
      const params: any[] = [conversationId];
      let idx = 2;

      if (type) {
        sql += ` AND f.mime_type LIKE $${idx}`;
        params.push(`${type}%`);
        idx++;
      }

      sql += ` ORDER BY f.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
      params.push(parseInt(limit as string), parseInt(offset as string));

      const result = await query(sql, params);
      const countResult = await query(
        'SELECT COUNT(*) as total FROM files WHERE conversation_id = $1',
        [conversationId]
      );

      res.json({
        files: result.rows,
        total: parseInt(countResult.rows[0].total),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// DELETE /api/files/:id
router.delete(
  '/:id',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await query(
        `DELETE FROM files
         WHERE id = $1 AND (uploaded_by = $2 OR $3 = 'admin')
         RETURNING id, stored_path`,
        [req.params.id, req.user!.userId, req.user!.role]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'File not found or not yours' });
      }

      // Delete physical file
      try {
        fs.unlinkSync(result.rows[0].stored_path);
      } catch { /* ignore if file already gone */ }

      res.json({ deleted: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ============================================
// AVATAR UPLOAD
// ============================================

router.post(
  '/avatar',
  authMiddleware,
  uploadAvatar.single('avatar'),
  async (req: AuthRequest, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const relativePath = path.relative(avatarDir, file.path).replace(/\\/g, '/');
      const avatarUrl = `/avatars/${relativePath}`;

      await query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, req.user!.userId]);

      res.json({ avatarUrl });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

export default router;
