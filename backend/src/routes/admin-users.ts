import { Router } from 'express';
import { requirePlatformOwner } from '../middleware/auth.js';
import {
  listAllUsers,
  getUserDetail,
  createUser,
  updateUser,
  disableUser,
  enableUser,
  deleteUser,
  getUserUsageStats,
  getUserActivityLog,
  getSystemOverview,
} from '../services/adminUserService.js';
import db from '../db.js';
import { listProjects, listProjectDocuments } from '../services/projectService.js';
import { logAuditEvent } from '../services/auditService.js';

const router = Router();
router.use(requirePlatformOwner);

router.get('/users', (_req, res) => {
  res.json({ users: listAllUsers() });
});

router.get('/users/:id', (req, res) => {
  const user = getUserDetail(req.params.id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(user);
});

router.post('/users', (req, res) => {
  try {
    const { email, name, password, role } = req.body;
    if (!email || !name || !password || !role) {
      res.status(400).json({ error: 'email, name, password, and role are required' });
      return;
    }
    if (!['admin', 'operator', 'briefing_user'].includes(role)) {
      res.status(400).json({ error: 'role must be admin, operator, or briefing_user' });
      return;
    }
    const user = createUser({ email, name, password, role });
    logAuditEvent({
      userId: req.user?.id,
      action: 'user_created',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: req.ip,
      success: true,
      severity: 'warning',
      details: { email, name, role },
    });
    res.json(user);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'User creation failed';
    res.status(400).json({ error: message });
  }
});

router.patch('/users/:id', (req, res) => {
  try {
    const { name, role, password } = req.body;
    const user = updateUser(req.params.id, { name, role, password });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    logAuditEvent({
      userId: req.user?.id,
      action: 'user_updated',
      resourceType: 'user',
      resourceId: req.params.id,
      ipAddress: req.ip,
      success: true,
      severity: 'warning',
      details: { name, role },
    });
    res.json(user);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'User update failed';
    res.status(400).json({ error: message });
  }
});

router.post('/users/:id/disable', (req, res) => {
  const success = disableUser(req.params.id);
  if (!success) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  logAuditEvent({
    userId: req.user?.id,
    action: 'user_disabled',
    resourceType: 'user',
    resourceId: req.params.id,
    ipAddress: req.ip,
    success: true,
    severity: 'warning',
  });
  res.json({ ok: true });
});

router.post('/users/:id/enable', (req, res) => {
  const success = enableUser(req.params.id);
  if (!success) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  logAuditEvent({
    userId: req.user?.id,
    action: 'user_enabled',
    resourceType: 'user',
    resourceId: req.params.id,
    ipAddress: req.ip,
    success: true,
    severity: 'warning',
  });
  res.json({ ok: true });
});

router.delete('/users/:id', (req, res) => {
  const success = deleteUser(req.params.id);
  if (!success) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  logAuditEvent({
    userId: req.user?.id,
    action: 'user_deleted',
    resourceType: 'user',
    resourceId: req.params.id,
    ipAddress: req.ip,
    success: true,
    severity: 'critical',
  });
  res.json({ ok: true });
});

router.get('/users/:id/usage', (req, res) => {
  const stats = getUserUsageStats(req.params.id);
  if (!stats) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(stats);
});

router.get('/users/:id/activity', (req, res) => {
  const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) || 50 : 50;
  const activity = getUserActivityLog(req.params.id, Math.min(limit, 200));
  res.json({ activity });
});

router.get('/overview', (_req, res) => {
  res.json(getSystemOverview());
});

// Sessions: list all sessions with user info and message count
router.get('/sessions', (_req, res) => {
  const sessions = db.prepare(`
    SELECT s.id, s.user_id, s.created_at, s.last_active,
           u.name AS user_name, u.email AS user_email, u.role AS user_role,
           COUNT(m.id) AS message_count,
           MAX(m.created_at) AS last_message_at
    FROM sessions s
    LEFT JOIN users u ON u.id = s.user_id
    LEFT JOIN messages m ON m.session_id = s.id
    GROUP BY s.id
    ORDER BY s.last_active DESC
    LIMIT 200
  `).all();
  res.json({ sessions });
});

// Sessions: get messages for a session (admin can see all)
router.get('/sessions/:id/messages', (req, res) => {
  const sessionId = req.params.id;
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  const messages = db.prepare(`
    SELECT m.*, u.name AS user_name, u.email AS user_email, u.role AS user_role
    FROM messages m
    LEFT JOIN sessions s ON s.id = m.session_id
    LEFT JOIN users u ON u.id = s.user_id
    WHERE m.session_id = ?
    ORDER BY m.message_order ASC, m.created_at_ms ASC
  `).all(sessionId);
  res.json({ session, messages });
});

// Documents: list all with approval/sensitivity status
router.get('/documents', (_req, res) => {
  const docs = db.prepare(`
    SELECT d.*,
           COUNT(c.id) AS chunk_count
    FROM documents d
    LEFT JOIN chunks c ON c.document_id = d.id
    WHERE d.deleted_at IS NULL
    GROUP BY d.id
    ORDER BY d.created_at DESC
  `).all();
  res.json({ documents: docs });
});

// Documents: get chunks for a document
router.get('/documents/:id/chunks', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  const chunks = db.prepare(`
    SELECT id, chunk_index, content, page, section, token_estimate, indexed_at
    FROM chunks WHERE document_id = ?
    ORDER BY chunk_index ASC
  `).all(req.params.id);
  res.json({ document: doc, chunks });
});

// Documents: update approval status
router.patch('/documents/:id/approval', (req, res) => {
  const { approvalStatus } = req.body;
  if (!['draft', 'approved', 'archived'].includes(approvalStatus)) {
    res.status(400).json({ error: 'approvalStatus must be draft, approved, or archived' });
    return;
  }
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  const now = new Date().toISOString();
  db.prepare(`UPDATE documents SET approval_status = ?, approval = ?, updated_at = ? WHERE id = ?`)
    .run(approvalStatus, approvalStatus, now, req.params.id);
  logAuditEvent({
    userId: req.user?.id,
    action: 'document_approval_change',
    resourceType: 'document',
    resourceId: req.params.id,
    ipAddress: req.ip,
    success: true,
    severity: 'warning',
    details: { approvalStatus },
  });
  res.json({ ok: true, approvalStatus });
});

// Projects: overview with document counts and status
router.get('/projects', (_req, res) => {
  const projects = listProjects();
  const projectsWithDocs = projects.map((project) => ({
    ...project,
    documents: listProjectDocuments(project.id).map((d) => ({
      id: d.id,
      title: d.title,
      approvalStatus: d.approval_status,
      ingestionStatus: d.ingestion_status,
      chunkCount: d.chunk_count,
    })),
  }));
  res.json({ projects: projectsWithDocs });
});

export default router;
