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

export default router;
