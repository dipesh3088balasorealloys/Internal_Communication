/**
 * Group call (Teams-style multi-party) routes — all routed through LiveKit SFU.
 *
 * Flow:
 *   POST /api/calls/group/start         → host creates room, gets token, members get notified
 *   POST /api/calls/group/:id/join      → late joiner gets a fresh token for the room
 *   POST /api/calls/group/:id/end       → host force-ends the room for everyone
 *   POST /api/calls/group/:id/kick      → host removes a single participant
 *   POST /api/calls/group/:id/mute-user → host server-mutes a participant's audio
 *
 * These are SEPARATE from the existing 1:1 webrtc flow (socket.service.ts). The
 * existing Socket.IO 'group-call:*' events stay in place but become advisory —
 * actual media routing is handled by LiveKit.
 */

import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { query } from '../../database/connection';
import { randomUUID } from 'crypto';
import * as livekit from '../../services/livekit.service';
import { getIO } from '../../services/socket.service';

const router = Router();
router.use(authMiddleware);

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

async function isConversationMember(conversationId: string, userId: string): Promise<boolean> {
  const r = await query(
    'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2 LIMIT 1',
    [conversationId, userId],
  );
  return r.rows.length > 0;
}

async function isCallHost(callId: string, userId: string): Promise<boolean> {
  const r = await query(
    'SELECT 1 FROM call_history WHERE id = $1 AND host_user_id = $2 LIMIT 1',
    [callId, userId],
  );
  return r.rows.length > 0;
}

async function getDisplayName(userId: string): Promise<string> {
  const r = await query('SELECT display_name, username FROM users WHERE id = $1', [userId]);
  return r.rows[0]?.display_name || r.rows[0]?.username || 'User';
}

// ------------------------------------------------------------------
// POST /api/calls/group/start
// ------------------------------------------------------------------
// Body: { conversationId: string, callType: 'audio' | 'video' }
// Returns: { callId, livekit: { wsUrl, token, roomName } }
router.post('/start', async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId, callType } = req.body || {};
    if (!conversationId) return res.status(400).json({ error: 'conversationId required' });
    if (callType !== 'audio' && callType !== 'video') {
      return res.status(400).json({ error: 'callType must be "audio" or "video"' });
    }

    const hostId = req.user!.userId;

    // Verify caller is a member of the conversation
    if (!(await isConversationMember(conversationId, hostId))) {
      return res.status(403).json({ error: 'Not a member of this conversation' });
    }

    // Use a deterministic-ish room name so late joiners can find it
    const roomName = `gc-${conversationId.replace(/-/g, '').slice(0, 12)}-${Date.now().toString(36)}`;

    // Pre-create the LiveKit room (so max_participants = 30 takes effect immediately)
    try {
      await livekit.createRoom(roomName, 30);
    } catch (err: any) {
      // Room might already exist — that's OK. Other errors abort.
      if (!String(err.message || '').toLowerCase().includes('already exists')) {
        console.error('[GroupCall] createRoom error:', err.message);
        return res.status(502).json({ error: 'Failed to create LiveKit room: ' + err.message });
      }
    }

    // Get host display name
    const hostName = await getDisplayName(hostId);

    // Mint host's access token (with admin/host privileges)
    const token = await livekit.generateAccessToken({
      roomName,
      identity: hostId,
      name: hostName,
      isHost: true,
      ttlSeconds: 3600 * 4, // 4 hours
    });

    // Write call_history row
    const callId = randomUUID();
    await query(
      `INSERT INTO call_history (
         id, caller_id, conversation_id, call_type, is_group_call, status,
         participants, livekit_room_name, host_user_id, started_at
       ) VALUES ($1, $2, $3, $4, TRUE, 'ringing', $5, $6, $2, NOW())`,
      [
        callId,
        hostId,
        conversationId,
        callType,
        JSON.stringify([{ userId: hostId, displayName: hostName, joinedAt: new Date().toISOString() }]),
        roomName,
      ],
    );

    // Ring all other conversation members via Socket.IO
    const io = getIO();
    io.to(`conv:${conversationId}`).emit('group-call:incoming', {
      callId,
      conversationId,
      callType,
      hostId,
      hostName,
      roomName,
      startedAt: new Date().toISOString(),
    });

    console.log(`[GroupCall] ${hostName} started ${callType} call in ${conversationId} (room=${roomName})`);

    return res.json({
      callId,
      livekit: {
        wsUrl: livekit.getClientWsUrl(),
        token,
        roomName,
      },
    });
  } catch (err: any) {
    console.error('[GroupCall] start error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------
// POST /api/calls/group/:callId/join
// ------------------------------------------------------------------
// Returns: { livekit: { wsUrl, token, roomName } }
router.post('/:callId/join', async (req: AuthRequest, res: Response) => {
  try {
    const callId = String(req.params.callId);
    const userId = req.user!.userId;

    const callR = await query(
      `SELECT id, conversation_id, livekit_room_name, status, is_group_call, host_user_id, participants
         FROM call_history WHERE id = $1`,
      [callId],
    );
    if (callR.rows.length === 0) return res.status(404).json({ error: 'Call not found' });
    const call = callR.rows[0];

    if (!call.is_group_call || !call.livekit_room_name) {
      return res.status(400).json({ error: 'Not a group call' });
    }
    if (call.status === 'ended') {
      return res.status(410).json({ error: 'Call has ended' });
    }

    if (!(await isConversationMember(call.conversation_id, userId))) {
      return res.status(403).json({ error: 'Not a member of this conversation' });
    }

    const displayName = await getDisplayName(userId);

    // Mint token for joiner (non-host unless they ARE the host)
    const token = await livekit.generateAccessToken({
      roomName: call.livekit_room_name,
      identity: userId,
      name: displayName,
      isHost: call.host_user_id === userId,
      ttlSeconds: 3600 * 4,
    });

    // Append to participants if not already there
    try {
      const participants = Array.isArray(call.participants) ? call.participants : JSON.parse(call.participants || '[]');
      if (!participants.find((p: any) => p.userId === userId)) {
        participants.push({ userId, displayName, joinedAt: new Date().toISOString() });
        await query(
          `UPDATE call_history SET participants = $1, status = CASE WHEN status = 'ringing' THEN 'answered' ELSE status END
             WHERE id = $2`,
          [JSON.stringify(participants), callId],
        );
      }
    } catch (err) {
      // Non-fatal — participant tracking is best-effort
      console.warn('[GroupCall] participant update failed:', err);
    }

    // Broadcast participant joined
    const io = getIO();
    io.to(`conv:${call.conversation_id}`).emit('group-call:participant-joined', {
      callId,
      conversationId: call.conversation_id,
      userId,
      displayName,
    });

    return res.json({
      livekit: {
        wsUrl: livekit.getClientWsUrl(),
        token,
        roomName: call.livekit_room_name,
      },
    });
  } catch (err: any) {
    console.error('[GroupCall] join error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------
// POST /api/calls/group/:callId/end  (host only)
// ------------------------------------------------------------------
router.post('/:callId/end', async (req: AuthRequest, res: Response) => {
  try {
    const callId = String(req.params.callId);
    const userId = req.user!.userId;

    if (!(await isCallHost(callId, userId))) {
      return res.status(403).json({ error: 'Only the host can end the call' });
    }

    const callR = await query(
      'SELECT livekit_room_name, conversation_id, started_at FROM call_history WHERE id = $1',
      [callId],
    );
    if (callR.rows.length === 0) return res.status(404).json({ error: 'Call not found' });
    const call = callR.rows[0];

    // Tell LiveKit to disconnect everyone
    if (call.livekit_room_name) {
      try { await livekit.endRoom(call.livekit_room_name); } catch (err: any) {
        console.warn('[GroupCall] livekit endRoom warning:', err.message);
      }
    }

    // Update DB
    await query(
      `UPDATE call_history
          SET status = 'ended',
              ended_at = NOW(),
              duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::int
        WHERE id = $1`,
      [callId],
    );

    // Notify conversation
    const io = getIO();
    io.to(`conv:${call.conversation_id}`).emit('group-call:ended', {
      callId,
      conversationId: call.conversation_id,
      endedBy: userId,
    });

    res.json({ ok: true });
  } catch (err: any) {
    console.error('[GroupCall] end error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------
// POST /api/calls/group/:callId/kick  (host only)
// ------------------------------------------------------------------
// Body: { targetUserId: string }
router.post('/:callId/kick', async (req: AuthRequest, res: Response) => {
  try {
    const callId = String(req.params.callId);
    const userId = req.user!.userId;
    const targetUserId = String(req.body?.targetUserId || '');

    if (!targetUserId) return res.status(400).json({ error: 'targetUserId required' });
    if (!(await isCallHost(callId, userId))) {
      return res.status(403).json({ error: 'Only the host can remove participants' });
    }

    const r = await query('SELECT livekit_room_name, conversation_id FROM call_history WHERE id = $1', [callId]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Call not found' });
    const { livekit_room_name, conversation_id } = r.rows[0];

    if (livekit_room_name) {
      try { await livekit.kickParticipant(livekit_room_name, targetUserId); } catch (err: any) {
        console.warn('[GroupCall] kick warning:', err.message);
      }
    }

    const io = getIO();
    io.to(`conv:${conversation_id}`).emit('group-call:participant-kicked', {
      callId,
      userId: targetUserId,
      kickedBy: userId,
    });

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------
// POST /api/calls/group/:callId/mute-user  (host only)
// ------------------------------------------------------------------
// Body: { targetUserId: string, mute: boolean }
router.post('/:callId/mute-user', async (req: AuthRequest, res: Response) => {
  try {
    const callId = String(req.params.callId);
    const userId = req.user!.userId;
    const targetUserId = String(req.body?.targetUserId || '');
    const mute = req.body?.mute === true;

    if (!targetUserId) return res.status(400).json({ error: 'targetUserId required' });
    if (!(await isCallHost(callId, userId))) {
      return res.status(403).json({ error: 'Only the host can mute participants' });
    }

    const r = await query('SELECT livekit_room_name FROM call_history WHERE id = $1', [callId]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Call not found' });
    const { livekit_room_name } = r.rows[0];

    if (!livekit_room_name) return res.status(400).json({ error: 'Not a LiveKit room' });

    try {
      await livekit.muteParticipantAudio(livekit_room_name, targetUserId, mute);
    } catch (err: any) {
      return res.status(502).json({ error: 'Mute failed: ' + err.message });
    }

    res.json({ ok: true, muted: mute });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------
// POST /api/calls/group/:callId/decline  (callee declines incoming ring)
// ------------------------------------------------------------------
router.post('/:callId/decline', async (req: AuthRequest, res: Response) => {
  try {
    const callId = String(req.params.callId);
    const userId = req.user!.userId;

    const r = await query('SELECT conversation_id FROM call_history WHERE id = $1', [callId]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Call not found' });

    const io = getIO();
    io.to(`conv:${r.rows[0].conversation_id}`).emit('group-call:participant-declined', {
      callId,
      userId,
    });

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
