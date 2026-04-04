import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { query, pool } from '../../database/connection';
import { getIO } from '../../services/socket.service';

const router = Router();
router.use(authMiddleware);

// ─── GET EVENTS (date range) ─────────────────────────────

router.get('/events', async (req: AuthRequest, res: Response) => {
  try {
    const { start, end } = req.query;
    const userId = req.user!.userId;

    if (!start || !end) {
      return res.status(400).json({ error: 'start and end query params required' });
    }

    const result = await query(
      `SELECT e.*,
              u.display_name as creator_name,
              (
                SELECT json_agg(json_build_object(
                  'user_id', ea2.user_id,
                  'display_name', au.display_name,
                  'status', ea2.status
                ))
                FROM event_attendees ea2
                JOIN users au ON au.id = ea2.user_id
                WHERE ea2.event_id = e.id
              ) as attendees
       FROM calendar_events e
       LEFT JOIN users u ON u.id = e.created_by
       WHERE (e.created_by = $1 OR EXISTS (SELECT 1 FROM event_attendees ea WHERE ea.event_id = e.id AND ea.user_id = $1))
         AND e.start_time < $3
         AND e.end_time > $2
       ORDER BY e.start_time ASC`,
      [userId, start, end]
    );

    res.json({ events: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET SINGLE EVENT ────────────────────────────────────

router.get('/events/:eventId', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT e.*,
              u.display_name as creator_name,
              (
                SELECT json_agg(json_build_object(
                  'user_id', ea.user_id,
                  'display_name', au.display_name,
                  'status', ea.status
                ))
                FROM event_attendees ea
                JOIN users au ON au.id = ea.user_id
                WHERE ea.event_id = e.id
              ) as attendees
       FROM calendar_events e
       LEFT JOIN users u ON u.id = e.created_by
       WHERE e.id = $1`,
      [req.params.eventId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ event: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CREATE EVENT ────────────────────────────────────────

router.post('/events', async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const userId = req.user!.userId;
    const { title, description, start_time, end_time, is_all_day, location, color, attendee_ids } = req.body;

    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    if (!start_time || !end_time) return res.status(400).json({ error: 'Start and end time required' });

    await client.query('BEGIN');

    // Create event
    const eventResult = await client.query(
      `INSERT INTO calendar_events (title, description, start_time, end_time, is_all_day, location, color, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [title.trim(), description || null, start_time, end_time, is_all_day || false, location || null, color || '#5B5FC7', userId]
    );

    const event = eventResult.rows[0];

    // Add creator as accepted attendee
    await client.query(
      `INSERT INTO event_attendees (event_id, user_id, status, responded_at)
       VALUES ($1, $2, 'accepted', NOW())`,
      [event.id, userId]
    );

    // Add other attendees as pending
    const allAttendeeIds = [userId];
    if (attendee_ids && Array.isArray(attendee_ids)) {
      for (const attendeeId of attendee_ids) {
        if (attendeeId === userId) continue;
        await client.query(
          `INSERT INTO event_attendees (event_id, user_id, status)
           VALUES ($1, $2, 'pending')
           ON CONFLICT (event_id, user_id) DO NOTHING`,
          [event.id, attendeeId]
        );
        allAttendeeIds.push(attendeeId);
      }
    }

    await client.query('COMMIT');

    // Fetch full event with attendees
    const fullResult = await query(
      `SELECT e.*,
              u.display_name as creator_name,
              (
                SELECT json_agg(json_build_object(
                  'user_id', ea.user_id,
                  'display_name', au.display_name,
                  'status', ea.status
                ))
                FROM event_attendees ea
                JOIN users au ON au.id = ea.user_id
                WHERE ea.event_id = e.id
              ) as attendees
       FROM calendar_events e
       LEFT JOIN users u ON u.id = e.created_by
       WHERE e.id = $1`,
      [event.id]
    );

    const fullEvent = fullResult.rows[0];

    // Notify attendees via socket
    const creatorName = fullEvent.creator_name || 'Someone';
    if (attendee_ids && Array.isArray(attendee_ids)) {
      const io = getIO();
      for (const attendeeId of attendee_ids) {
        if (attendeeId === userId) continue;
        io.to(`user:${attendeeId}`).emit('calendar:invitation', {
          event: fullEvent,
          invitedBy: { id: userId, display_name: creatorName },
        });
      }
    }

    res.status(201).json({ event: fullEvent });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── UPDATE EVENT ────────────────────────────────────────

router.put('/events/:eventId', async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const userId = req.user!.userId;
    const eventId = req.params.eventId;

    // Verify creator
    const existing = await client.query(
      'SELECT * FROM calendar_events WHERE id = $1 AND created_by = $2',
      [eventId, userId]
    );
    if (existing.rows.length === 0) {
      return res.status(403).json({ error: 'Only the event creator can edit' });
    }

    const { title, description, start_time, end_time, is_all_day, location, color, attendee_ids } = req.body;

    await client.query('BEGIN');

    await client.query(
      `UPDATE calendar_events
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           start_time = COALESCE($3, start_time),
           end_time = COALESCE($4, end_time),
           is_all_day = COALESCE($5, is_all_day),
           location = COALESCE($6, location),
           color = COALESCE($7, color),
           updated_at = NOW()
       WHERE id = $8`,
      [title, description, start_time, end_time, is_all_day, location, color, eventId]
    );

    // Update attendees if provided
    if (attendee_ids && Array.isArray(attendee_ids)) {
      // Remove attendees not in new list (except creator)
      await client.query(
        `DELETE FROM event_attendees WHERE event_id = $1 AND user_id != $2 AND user_id != ALL($3::uuid[])`,
        [eventId, userId, attendee_ids]
      );
      // Add new attendees
      for (const attendeeId of attendee_ids) {
        if (attendeeId === userId) continue;
        await client.query(
          `INSERT INTO event_attendees (event_id, user_id, status)
           VALUES ($1, $2, 'pending')
           ON CONFLICT (event_id, user_id) DO NOTHING`,
          [eventId, attendeeId]
        );
      }
    }

    await client.query('COMMIT');

    // Fetch updated event
    const fullResult = await query(
      `SELECT e.*, u.display_name as creator_name,
              (SELECT json_agg(json_build_object('user_id', ea.user_id, 'display_name', au.display_name, 'status', ea.status))
               FROM event_attendees ea JOIN users au ON au.id = ea.user_id WHERE ea.event_id = e.id) as attendees
       FROM calendar_events e LEFT JOIN users u ON u.id = e.created_by WHERE e.id = $1`,
      [eventId]
    );

    // Notify attendees
    const io = getIO();
    const attendees = fullResult.rows[0]?.attendees || [];
    for (const att of attendees) {
      if (att.user_id !== userId) {
        io.to(`user:${att.user_id}`).emit('calendar:event-updated', { event: fullResult.rows[0] });
      }
    }

    res.json({ event: fullResult.rows[0] });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── DELETE EVENT ─────────────────────────────────────────

router.delete('/events/:eventId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const eventId = req.params.eventId;

    // Get attendees before delete for notification
    const attendeesResult = await query(
      'SELECT user_id FROM event_attendees WHERE event_id = $1 AND user_id != $2',
      [eventId, userId]
    );

    const result = await query(
      'DELETE FROM calendar_events WHERE id = $1 AND created_by = $2 RETURNING id',
      [eventId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Only the event creator can delete' });
    }

    // Notify attendees
    const io = getIO();
    for (const att of attendeesResult.rows) {
      io.to(`user:${att.user_id}`).emit('calendar:event-deleted', { eventId });
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── RESPOND TO INVITATION ───────────────────────────────

router.patch('/events/:eventId/respond', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { status } = req.body;

    if (!['accepted', 'declined', 'tentative'].includes(status)) {
      return res.status(400).json({ error: 'Status must be accepted, declined, or tentative' });
    }

    const result = await query(
      `UPDATE event_attendees SET status = $1, responded_at = NOW()
       WHERE event_id = $2 AND user_id = $3
       RETURNING *`,
      [status, req.params.eventId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'You are not an attendee of this event' });
    }

    // Notify event creator
    const eventResult = await query('SELECT created_by FROM calendar_events WHERE id = $1', [req.params.eventId]);
    if (eventResult.rows.length > 0) {
      const creatorId = eventResult.rows[0].created_by;
      const io = getIO();
      const userName = await query('SELECT display_name FROM users WHERE id = $1', [userId]);
      io.to(`user:${creatorId}`).emit('calendar:rsvp-updated', {
        eventId: req.params.eventId,
        userId,
        userName: userName.rows[0]?.display_name || 'Someone',
        status,
      });
    }

    res.json({ success: true, status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
