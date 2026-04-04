import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { query } from '../../database/connection';

const router = Router();

// GET /api/calls/history — Get user's call history from system messages
router.get('/history', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '50', offset = '0' } = req.query;
    const userId = req.user!.userId;

    // Call records are stored as system messages with call metadata
    // Query messages where the user is a participant in the conversation
    const result = await query(
      `SELECT m.id, m.sender_id, m.conversation_id, m.content, m.metadata, m.created_at,
              u.display_name as sender_name,
              (SELECT cm.user_id FROM conversation_members cm
               WHERE cm.conversation_id = m.conversation_id
               AND cm.user_id != $1 LIMIT 1) as remote_user_id,
              (SELECT ru.display_name FROM conversation_members cm2
               JOIN users ru ON ru.id = cm2.user_id
               WHERE cm2.conversation_id = m.conversation_id
               AND cm2.user_id != $1 LIMIT 1) as remote_display_name
       FROM messages m
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.type = 'system'
         AND m.metadata IS NOT NULL
         AND m.metadata->>'callType' IS NOT NULL
         AND m.conversation_id IN (
           SELECT conversation_id FROM conversation_members WHERE user_id = $1
         )
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit as string), parseInt(offset as string)]
    );

    // Transform to call history format
    const calls = result.rows.map((row: any) => {
      const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
      return {
        id: row.id,
        sender_id: row.sender_id,
        sender_name: row.sender_name,
        conversation_id: row.conversation_id,
        call_type: meta.callType || 'audio',
        status: meta.status || 'completed',
        duration_seconds: meta.duration || 0,
        direction: meta.direction || 'outgoing',
        remote_name: meta.remoteName || row.remote_display_name || 'Unknown',
        remote_user_id: row.remote_user_id || null,
        content: row.content,
        started_at: row.created_at,
      };
    });

    // Deduplicate — calls from both sides appear; keep only one per ~5 second window per conversation
    const seen = new Map<string, boolean>();
    const deduplicated = calls.filter((call: any) => {
      const timeKey = Math.floor(new Date(call.started_at).getTime() / 5000);
      const key = `${call.conversation_id}-${timeKey}`;
      if (seen.has(key)) return false;
      seen.set(key, true);
      return true;
    });

    res.json({ calls: deduplicated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/calls — Log a new call
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { calleeId, callType, sipCallId, conversationId } = req.body;
    const callerId = req.user!.userId;

    const result = await query(
      `INSERT INTO call_history (caller_id, callee_id, call_type, sip_call_id, conversation_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, caller_id, callee_id, call_type, status, started_at`,
      [callerId, calleeId, callType || 'audio', sipCallId || null, conversationId || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/calls/:id — Update call status (end call, etc.)
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { status, endedAt } = req.body;

    const result = await query(
      `UPDATE call_history
       SET status = $1, ended_at = COALESCE($2, NOW()),
           duration_seconds = EXTRACT(EPOCH FROM (COALESCE($2, NOW()) - started_at))::int
       WHERE id = $3 AND (caller_id = $4 OR callee_id = $4)
       RETURNING id, status, ended_at, duration_seconds`,
      [status || 'completed', endedAt || null, req.params.id, req.user!.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Call not found' });
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
