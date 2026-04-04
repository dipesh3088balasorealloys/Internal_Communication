import { Router, Response } from 'express';
import { authMiddleware, adminMiddleware, AuthRequest } from '../../middleware/auth';
import { query, pool } from '../../database/connection';
import { getOnlineUsers } from '../../services/redis.service';
import { config } from '../../config';
import https from 'https';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { ucmService } from '../../services/ucm.service';

const router = Router();

// All admin routes require auth + admin role
router.use(authMiddleware, adminMiddleware);

// ============================================
// DASHBOARD
// ============================================

// GET /api/admin/dashboard — Overview stats
router.get('/dashboard', async (_req: AuthRequest, res: Response) => {
  try {
    const [usersResult, convsResult, msgsResult, filesResult, callsResult, onlineUsers] =
      await Promise.all([
        query('SELECT COUNT(*) as total FROM users'),
        query('SELECT COUNT(*) as total FROM conversations'),
        query('SELECT COUNT(*) as total FROM messages WHERE deleted_at IS NULL'),
        query('SELECT COUNT(*) as total, COALESCE(SUM(size_bytes), 0) as total_size FROM files'),
        query("SELECT COUNT(*) as total FROM call_history WHERE started_at > NOW() - INTERVAL '24 hours'"),
        getOnlineUsers(),
      ]);

    // Resolve online user IDs to names and clean stale entries
    let onlineUserDetails: { id: string; username: string; display_name: string }[] = [];
    if (onlineUsers.length > 0) {
      // Filter to valid UUIDs only (Redis may contain stale/corrupt entries)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validIds = onlineUsers.filter(id => uuidRegex.test(id));
      if (validIds.length > 0) {
        const onlineResult = await query(
          `SELECT id, username, display_name FROM users WHERE id = ANY($1::uuid[])`,
          [validIds]
        );
        onlineUserDetails = onlineResult.rows;
      }
    }

    // Recent activity (last 24h messages)
    const recentActivity = await query(
      `SELECT DATE_TRUNC('hour', created_at) as hour, COUNT(*) as count
       FROM messages WHERE created_at > NOW() - INTERVAL '24 hours' AND deleted_at IS NULL
       GROUP BY hour ORDER BY hour`
    );

    res.json({
      users: {
        total: parseInt(usersResult.rows[0].total),
        online: onlineUserDetails.length,
      },
      conversations: parseInt(convsResult.rows[0].total),
      messages: parseInt(msgsResult.rows[0].total),
      files: {
        count: parseInt(filesResult.rows[0].total),
        totalSizeBytes: parseInt(filesResult.rows[0].total_size),
      },
      callsToday: parseInt(callsResult.rows[0].total),
      recentActivity: recentActivity.rows,
      onlineUsers: onlineUserDetails,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// USER MANAGEMENT
// ============================================

// GET /api/admin/users — List all users with details
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const { search, department, limit = '50', offset = '0' } = req.query;

    let sql = `
      SELECT id, username, email, display_name, avatar_url, role, department, designation,
             sip_extension, sip_password, status, status_message, is_active, last_seen, created_at,
             (SELECT COUNT(*) FROM messages WHERE sender_id = users.id AND deleted_at IS NULL) as message_count,
             (SELECT COUNT(*) FROM files WHERE uploaded_by = users.id) as file_count
      FROM users WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (search) {
      sql += ` AND (username ILIKE $${idx} OR display_name ILIKE $${idx} OR email ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }
    if (department) {
      sql += ` AND department = $${idx}`;
      params.push(department);
      idx++;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(parseInt(limit as string), parseInt(offset as string));

    const result = await query(sql, params);
    const countResult = await query('SELECT COUNT(*) as total FROM users');

    res.json({
      users: result.rows,
      total: parseInt(countResult.rows[0].total),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/users/:id — Update user (admin can change role, disable, etc.)
router.put('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { role, department, designation, display_name, status, is_active } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (role) { updates.push(`role = $${idx}`); params.push(role); idx++; }
    if (department !== undefined) { updates.push(`department = $${idx}`); params.push(department); idx++; }
    if (designation !== undefined) { updates.push(`designation = $${idx}`); params.push(designation); idx++; }
    if (display_name !== undefined) { updates.push(`display_name = $${idx}`); params.push(display_name); idx++; }
    if (status) { updates.push(`status = $${idx}`); params.push(status); idx++; }
    if (is_active !== undefined) { updates.push(`is_active = $${idx}`); params.push(is_active); idx++; }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    const result = await query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx}
       RETURNING id, username, display_name, role, department, designation, status, is_active, sip_extension`,
      [...params, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/users/:id/toggle-active — Enable/disable user
router.put('/users/:id/toggle-active', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `UPDATE users SET is_active = NOT is_active, updated_at = NOW()
       WHERE id = $1
       RETURNING id, username, display_name, is_active`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = result.rows[0];
    console.log(`[Admin] User ${user.username} ${user.is_active ? 'enabled' : 'disabled'}`);
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/users/:id/reset-password — Generate temp password
router.put('/users/:id/reset-password', async (req: AuthRequest, res: Response) => {
  try {
    const tempPassword = crypto.randomBytes(4).toString('hex'); // 8-char hex
    const hash = await bcrypt.hash(tempPassword, 12);
    const result = await query(
      `UPDATE users SET password_hash = $1, updated_at = NOW()
       WHERE id = $2 RETURNING id, username, display_name`,
      [hash, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    console.log(`[Admin] Password reset for user ${result.rows[0].username}`);
    res.json({ user: result.rows[0], tempPassword });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/dashboard/analytics — Extended stats with trends
router.get('/dashboard/analytics', async (_req: AuthRequest, res: Response) => {
  try {
    const [
      msgTodayRes, msgYesterdayRes, msg7dRes,
      topUsersRes, deptRes, recentUsersRes,
      recentCallsRes, storageRes,
    ] = await Promise.all([
      // Messages today
      query(`SELECT COUNT(*) as count FROM messages WHERE created_at >= CURRENT_DATE AND deleted_at IS NULL`),
      // Messages yesterday
      query(`SELECT COUNT(*) as count FROM messages WHERE created_at >= CURRENT_DATE - INTERVAL '1 day' AND created_at < CURRENT_DATE AND deleted_at IS NULL`),
      // Messages by day (last 7 days)
      query(`
        SELECT DATE(created_at) as day, COUNT(*) as count
        FROM messages WHERE created_at >= CURRENT_DATE - INTERVAL '7 days' AND deleted_at IS NULL
        GROUP BY DATE(created_at) ORDER BY day
      `),
      // Top 5 active users this week
      query(`
        SELECT u.id, u.username, u.display_name, u.avatar_url, u.department, COUNT(m.id) as message_count
        FROM users u LEFT JOIN messages m ON m.sender_id = u.id AND m.created_at >= CURRENT_DATE - INTERVAL '7 days' AND m.deleted_at IS NULL
        GROUP BY u.id ORDER BY message_count DESC LIMIT 5
      `),
      // Department distribution
      query(`
        SELECT COALESCE(department, 'Unassigned') as department, COUNT(*) as count
        FROM users GROUP BY department ORDER BY count DESC
      `),
      // Recent users (last 30 days)
      query(`SELECT id, username, display_name, created_at FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '30 days' ORDER BY created_at DESC LIMIT 10`),
      // Recent calls
      query(`SELECT id, call_type, is_group_call, status, started_at, duration_seconds FROM call_history ORDER BY started_at DESC LIMIT 10`),
      // Storage
      query(`SELECT COUNT(*) as count, COALESCE(SUM(size_bytes), 0) as total_size FROM files`),
    ]);

    res.json({
      messagesToday: parseInt(msgTodayRes.rows[0].count),
      messagesYesterday: parseInt(msgYesterdayRes.rows[0].count),
      messagesLast7Days: msg7dRes.rows.map((r: any) => ({ day: r.day, count: parseInt(r.count) })),
      topUsers: topUsersRes.rows.map((r: any) => ({ ...r, message_count: parseInt(r.message_count) })),
      departments: deptRes.rows.map((r: any) => ({ department: r.department, count: parseInt(r.count) })),
      recentUsers: recentUsersRes.rows,
      recentCalls: recentCallsRes.rows,
      storage: { count: parseInt(storageRes.rows[0].count), totalBytes: parseInt(storageRes.rows[0].total_size) },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// COMPLIANCE MONITORING
// ============================================

// GET /api/admin/conversations — View all conversations
router.get('/conversations', async (req: AuthRequest, res: Response) => {
  try {
    const { search, type, limit = '50', offset = '0' } = req.query;

    let sql = `
      SELECT c.id, c.type, c.name, c.created_at, c.last_message_at,
             (SELECT COUNT(*) FROM conversation_members WHERE conversation_id = c.id) as member_count,
             (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND deleted_at IS NULL) as message_count,
             json_build_object('id', u.id, 'displayName', u.display_name) as created_by_user,
             (SELECT string_agg(COALESCE(u2.display_name, u2.username), ' \u2194 ' ORDER BY COALESCE(u2.display_name, u2.username))
              FROM conversation_members cm2
              JOIN users u2 ON cm2.user_id = u2.id
              WHERE cm2.conversation_id = c.id
             ) as member_names
      FROM conversations c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.is_archived = false
    `;
    const params: any[] = [];
    let idx = 1;

    if (type) {
      sql += ` AND c.type = $${idx}`;
      params.push(type);
      idx++;
    }
    if (search) {
      sql += ` AND (c.name ILIKE $${idx} OR EXISTS (
        SELECT 1 FROM conversation_members cm3
        JOIN users u3 ON cm3.user_id = u3.id
        WHERE cm3.conversation_id = c.id
        AND (u3.display_name ILIKE $${idx} OR u3.username ILIKE $${idx})
      ))`;
      params.push(`%${search}%`);
      idx++;
    }

    sql += ` ORDER BY c.last_message_at DESC NULLS LAST LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(parseInt(limit as string), parseInt(offset as string));

    const result = await query(sql, params);
    res.json({ conversations: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/conversations/:id/messages — View all messages (compliance)
router.get('/conversations/:id/messages', async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '100', before } = req.query;

    let sql = `
      SELECT m.id, m.sender_id, m.type, m.content, m.metadata, m.is_edited,
             m.deleted_at, m.created_at,
             json_build_object('id', u.id, 'username', u.username, 'displayName', u.display_name) as sender
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
    `;
    const params: any[] = [req.params.id];
    let idx = 2;

    if (before) {
      sql += ` AND m.created_at < $${idx}`;
      params.push(before);
      idx++;
    }

    // Admin sees ALL messages including deleted
    sql += ` ORDER BY m.created_at DESC LIMIT $${idx}`;
    params.push(parseInt(limit as string));

    const result = await query(sql, params);
    res.json({ messages: result.rows.reverse() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/conversations/:id/export — Export ALL messages for compliance download
router.get('/conversations/:id/export', async (req: AuthRequest, res: Response) => {
  try {
    const sql = `
      SELECT m.id, m.sender_id, m.type, m.content, m.metadata, m.is_edited,
             m.deleted_at, m.created_at,
             json_build_object('id', u.id, 'username', u.username, 'displayName', u.display_name) as sender
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
    `;
    const result = await query(sql, [req.params.id]);

    // Also get conversation details + members
    const convSql = `
      SELECT c.id, c.type, c.name, c.created_at,
             (SELECT string_agg(COALESCE(u2.display_name, u2.username), ', ' ORDER BY COALESCE(u2.display_name, u2.username))
              FROM conversation_members cm2
              JOIN users u2 ON cm2.user_id = u2.id
              WHERE cm2.conversation_id = c.id
             ) as member_names,
             (SELECT COUNT(*) FROM conversation_members WHERE conversation_id = c.id) as member_count
      FROM conversations c
      WHERE c.id = $1
    `;
    const convResult = await query(convSql, [req.params.id]);
    const conv = convResult.rows[0] || {};

    res.json({
      conversation: conv,
      messages: result.rows,
      exportedAt: new Date().toISOString(),
      exportedBy: req.user?.username || 'admin',
      totalMessages: result.rows.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/messages/search — Global message search (compliance)
router.get('/messages/search', async (req: AuthRequest, res: Response) => {
  try {
    const { q, userId, limit = '50' } = req.query;
    if (!q) return res.status(400).json({ error: 'Search query required' });

    let sql = `
      SELECT m.id, m.conversation_id, m.content, m.type, m.created_at,
             json_build_object('id', u.id, 'displayName', u.display_name) as sender,
             c.name as conversation_name, c.type as conversation_type
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      LEFT JOIN conversations c ON m.conversation_id = c.id
      WHERE m.search_vector @@ plainto_tsquery('english', $1)
    `;
    const params: any[] = [q];
    let idx = 2;

    if (userId) {
      sql += ` AND m.sender_id = $${idx}`;
      params.push(userId);
      idx++;
    }

    sql += ` ORDER BY m.created_at DESC LIMIT $${idx}`;
    params.push(parseInt(limit as string));

    const result = await query(sql, params);
    res.json({ messages: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// UCM EXTENSION MANAGEMENT
// ============================================

// GET /api/admin/ucm/extensions — List all UCM extensions with live status
router.get('/ucm/extensions', async (_req: AuthRequest, res: Response) => {
  try {
    const extensions = await ucmService.listExtensions();

    // Also get current assignments from DB
    const assigned = await query(
      'SELECT sip_extension, id, username, display_name FROM users WHERE sip_extension IS NOT NULL'
    );
    const assignmentMap: Record<string, { userId: string; username: string; displayName: string }> = {};
    for (const row of assigned.rows) {
      assignmentMap[row.sip_extension] = {
        userId: row.id,
        username: row.username,
        displayName: row.display_name,
      };
    }

    const result = extensions.map((ext) => ({
      ...ext,
      assignedTo: assignmentMap[ext.extension] || null,
    }));

    res.json({ extensions: result, total: result.length });
  } catch (err: any) {
    console.error('[Admin] UCM list extensions error:', err);
    res.status(500).json({ error: 'Failed to fetch UCM extensions: ' + err.message });
  }
});

// GET /api/admin/ucm/extensions/available — Extensions not assigned to any user
router.get('/ucm/extensions/available', async (_req: AuthRequest, res: Response) => {
  try {
    const extensions = await ucmService.listExtensions();
    const assigned = await query(
      'SELECT sip_extension FROM users WHERE sip_extension IS NOT NULL'
    );
    const assignedSet = new Set(assigned.rows.map((r: any) => r.sip_extension));

    const available = extensions.filter((ext) => !assignedSet.has(ext.extension));
    res.json({ extensions: available, total: available.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch available extensions: ' + err.message });
  }
});

// GET /api/admin/ucm/health — UCM API health with full auth test
router.get('/ucm/health', async (_req: AuthRequest, res: Response) => {
  try {
    const health = await ucmService.healthCheck();
    res.json(health);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/users/:id/extension — Assign UCM extension to a BAL Connect user
router.put('/users/:id/extension', async (req: AuthRequest, res: Response) => {
  try {
    const { extension } = req.body;
    const userId = req.params.id;

    if (!extension) {
      return res.status(400).json({ error: 'Extension number required' });
    }

    // 1. Verify extension exists on UCM and get its SIP password
    const detail = await ucmService.getExtensionDetail(extension);
    if (!detail) {
      return res.status(404).json({ error: `Extension ${extension} not found on UCM6304` });
    }

    if (!detail.enableWebrtc) {
      return res.status(400).json({ error: `Extension ${extension} does not have WebRTC enabled on UCM` });
    }

    // 2. Check if extension is already assigned to another user
    const existingAssignment = await query(
      'SELECT id, username FROM users WHERE sip_extension = $1 AND id != $2',
      [extension, userId]
    );
    if (existingAssignment.rows.length > 0) {
      return res.status(409).json({
        error: `Extension ${extension} is already assigned to user "${existingAssignment.rows[0].username}"`,
      });
    }

    // 3. Update user with real UCM extension and SIP password
    const result = await query(
      `UPDATE users SET sip_extension = $1, sip_password = $2
       WHERE id = $3
       RETURNING id, username, display_name, sip_extension, department, role`,
      [extension, detail.secret, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`[Admin] Assigned extension ${extension} (${detail.fullname}) to user ${result.rows[0].username}`);

    res.json({
      user: result.rows[0],
      ucmDetail: {
        fullname: detail.fullname,
        webrtc: detail.enableWebrtc,
        mediaEncryption: detail.mediaEncryption,
      },
    });
  } catch (err: any) {
    console.error('[Admin] Extension assignment error:', err);
    res.status(500).json({ error: 'Failed to assign extension: ' + err.message });
  }
});

// DELETE /api/admin/users/:id/extension — Unassign extension from user
router.delete('/users/:id/extension', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `UPDATE users SET sip_extension = NULL, sip_password = NULL
       WHERE id = $1
       RETURNING id, username, display_name`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`[Admin] Unassigned extension from user ${result.rows[0].username}`);
    res.json({ user: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// SYSTEM HEALTH
// ============================================

// GET /api/admin/health — Full system health check
router.get('/health', async (_req: AuthRequest, res: Response) => {
  const checks: Record<string, any> = {};

  // Database
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    checks.database = { status: 'ok', latencyMs: Date.now() - start };
  } catch (err: any) {
    checks.database = { status: 'error', error: err.message };
  }

  // Redis
  try {
    const onlineUsers = await getOnlineUsers();
    checks.redis = { status: 'ok', onlineUsers: onlineUsers.length };
  } catch (err: any) {
    checks.redis = { status: 'error', error: err.message };
  }

  // UCM6304
  try {
    const ucmStatus = await checkUCMHealth();
    checks.ucm6304 = ucmStatus;
  } catch (err: any) {
    checks.ucm6304 = { status: 'error', error: err.message };
  }

  // Disk usage
  checks.uptime = process.uptime();
  checks.memory = process.memoryUsage();

  // Only check services that have a status property (skip uptime/memory which are raw values)
  const serviceChecks = ['database', 'redis', 'ucm6304'];
  const allOk = serviceChecks.every(
    (key) => checks[key] && checks[key].status === 'ok'
  );

  res.json({
    status: allOk ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});

// Helper: check UCM6304 API reachability
function checkUCMHealth(): Promise<{ status: string; latencyMs?: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = https.request(
      {
        hostname: config.ucm.host,
        port: config.ucm.apiPort,
        path: '/api',
        method: 'GET',
        timeout: 5000,
        rejectUnauthorized: false, // UCM uses self-signed cert
      },
      (res) => {
        resolve({ status: 'ok', latencyMs: Date.now() - start });
        res.resume(); // consume response
      }
    );
    req.on('error', () => {
      resolve({ status: 'unreachable' });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 'timeout' });
    });
    req.end();
  });
}

export default router;
