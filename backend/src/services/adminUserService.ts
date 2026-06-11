import { v4 as uuidv4 } from 'uuid';
import { randomBytes, scryptSync } from 'node:crypto';
import db from '../db.js';

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex');
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface UserListItem {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  disabledAt: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  totalQueries: number;
  todayQueries: number;
  activeSessions: number;
}

export interface UserDetail extends UserListItem {
  totalTokens: number;
  avgLatencyMs: number;
  errorCount: number;
  lastActivityAt: string | null;
  sessionHistory: Array<{
    id: string;
    createdAt: string;
    lastActiveAt: string | null;
    expiresAt: string;
    revokedAt: string | null;
  }>;
}

export interface UserUsageStats {
  userId: string;
  userName: string;
  userEmail: string;
  totalQueries: number;
  todayQueries: number;
  weekQueries: number;
  monthQueries: number;
  totalTokens: number;
  avgLatencyMs: number;
  errorRate: number;
  queriesByMode: Array<{ mode: string; count: number }>;
  queriesByDay: Array<{ date: string; count: number }>;
  recentErrors: Array<{
    action: string;
    query: string;
    createdAt: string;
    latencyMs: number;
  }>;
}

export interface UserActivityLog {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  ipAddress: string | null;
  success: boolean;
  severity: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface SystemOverview {
  totalUsers: number;
  activeUsers: number;
  disabledUsers: number;
  usersByRole: Array<{ role: string; count: number }>;
  totalSessions: number;
  activeSessions: number;
  totalDocuments: number;
  indexedDocuments: number;
  totalChunks: number;
  totalProjects: number;
  totalQueries: number;
  todayQueries: number;
  weekQueries: number;
  apiStatus: {
    status: string;
    providerType: string;
    model: string;
    lastTestedAt: string | null;
    lastStatus: string | null;
  };
  recentAuditSummary: Array<{
    action: string;
    severity: string;
    count: number;
  }>;
  systemUptime: string;
}

export function listAllUsers(): UserListItem[] {
  const users = db.prepare(`
    SELECT u.id, u.email, u.name, u.role, u.created_at, u.updated_at, u.disabled_at
    FROM users u
    ORDER BY u.created_at DESC
  `).all() as Array<{
    id: string;
    email: string;
    name: string;
    role: string;
    created_at: string;
    updated_at: string;
    disabled_at: string | null;
  }>;

  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();

  return users.map((user) => {
    const lastLogin = db.prepare(`
      SELECT created_at FROM audit_log
      WHERE user_id = ? AND action = 'login_success'
      ORDER BY created_at_ms DESC LIMIT 1
    `).get(user.id) as { created_at: string } | undefined;

    const totalQueries = (db.prepare(`
      SELECT COUNT(*) as count FROM request_log WHERE user_id = ?
    `).get(user.id) as { count: number }).count;

    const todayQueries = (db.prepare(`
      SELECT COUNT(*) as count FROM request_log
      WHERE user_id = ? AND created_at_ms >= ?
    `).get(user.id, todayMs) as { count: number }).count;

    const activeSessions = (db.prepare(`
      SELECT COUNT(*) as count FROM auth_sessions
      WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?
    `).get(user.id, new Date().toISOString()) as { count: number }).count;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      disabledAt: user.disabled_at,
      isActive: !user.disabled_at,
      lastLoginAt: lastLogin?.created_at ?? null,
      totalQueries,
      todayQueries,
      activeSessions,
    };
  });
}

export function getUserDetail(userId: string): UserDetail | null {
  const user = db.prepare(`
    SELECT * FROM users WHERE id = ?
  `).get(userId) as any;
  if (!user) return null;

  const totalQueries = (db.prepare(`
    SELECT COUNT(*) as count FROM request_log WHERE user_id = ?
  `).get(userId) as { count: number }).count;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayQueries = (db.prepare(`
    SELECT COUNT(*) as count FROM request_log
    WHERE user_id = ? AND created_at_ms >= ?
  `).get(userId, todayStart.getTime()) as { count: number }).count;

  const activeSessions = (db.prepare(`
    SELECT COUNT(*) as count FROM auth_sessions
    WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?
  `).get(userId, new Date().toISOString()) as { count: number }).count;

  const totalTokens = (db.prepare(`
    SELECT COALESCE(SUM(LENGTH(response_json)), 0) as total FROM request_log WHERE user_id = ?
  `).get(userId) as { total: number }).total;

  const avgLatency = db.prepare(`
    SELECT AVG(latency_ms) as avg FROM request_log WHERE user_id = ?
  `).get(userId) as { avg: number | null };

  const errorCount = (db.prepare(`
    SELECT COUNT(*) as count FROM request_log
    WHERE user_id = ? AND (action LIKE '%model_error%' OR response_json LIKE '%provider%')
  `).get(userId) as { count: number }).count;

  const lastActivity = db.prepare(`
    SELECT created_at FROM request_log WHERE user_id = ?
    ORDER BY created_at_ms DESC LIMIT 1
  `).get(userId) as { created_at: string } | undefined;

  const sessionHistory = db.prepare(`
    SELECT id, created_at, last_active_at, expires_at, revoked_at
    FROM auth_sessions
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 10
  `).all(userId) as Array<{
    id: string;
    created_at: string;
    last_active_at: string | null;
    expires_at: string;
    revoked_at: string | null;
  }>;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    disabledAt: user.disabled_at,
    isActive: !user.disabled_at,
    lastLoginAt: (db.prepare(`
      SELECT created_at FROM audit_log
      WHERE user_id = ? AND action = 'login_success'
      ORDER BY created_at_ms DESC LIMIT 1
    `).get(userId) as { created_at: string } | undefined)?.created_at ?? null,
    totalQueries,
    todayQueries,
    activeSessions,
    totalTokens,
    avgLatencyMs: Math.round(avgLatency?.avg ?? 0),
    errorCount,
    lastActivityAt: lastActivity?.created_at ?? null,
    sessionHistory: sessionHistory.map((s) => ({
      id: s.id,
      createdAt: s.created_at,
      lastActiveAt: s.last_active_at,
      expiresAt: s.expires_at,
      revokedAt: s.revoked_at,
    })),
  };
}

export function createUser(params: {
  email: string;
  name: string;
  password: string;
  role: string;
}): { id: string; email: string; name: string; role: string } {
  const email = normalizeEmail(params.email);
  if (!email || !email.includes('@')) throw new Error('A valid email is required');
  if (!params.name.trim()) throw new Error('A display name is required');
  if (params.password.length < 10) throw new Error('Password must be at least 10 characters');

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) throw new Error('A user with this email already exists');

  const now = new Date().toISOString();
  const salt = randomBytes(16).toString('hex');
  const passwordHash = hashPassword(params.password, salt);
  const id = uuidv4();

  db.prepare(`
    INSERT INTO users (id, email, name, role, password_hash, password_salt, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, email, params.name.trim(), params.role, passwordHash, salt, now, now);

  return { id, email, name: params.name.trim(), role: params.role };
}

export function updateUser(
  userId: string,
  params: { name?: string; role?: string; password?: string }
): { id: string; email: string; name: string; role: string } | null {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!user) return null;

  const now = new Date().toISOString();
  const updates: string[] = [];
  const values: unknown[] = [];

  if (params.name) {
    updates.push('name = ?');
    values.push(params.name.trim());
  }
  if (params.role) {
    updates.push('role = ?');
    values.push(params.role);
  }
  if (params.password) {
    if (params.password.length < 10) throw new Error('Password must be at least 10 characters');
    const salt = randomBytes(16).toString('hex');
    const passwordHash = hashPassword(params.password, salt);
    updates.push('password_hash = ?', 'password_salt = ?');
    values.push(passwordHash, salt);
  }

  if (updates.length === 0) return { id: user.id, email: user.email, name: user.name, role: user.role };

  updates.push('updated_at = ?');
  values.push(now);
  values.push(userId);

  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  return { id: updated.id, email: updated.email, name: updated.name, role: updated.role };
}

export function disableUser(userId: string): boolean {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!user) return false;
  db.prepare('UPDATE users SET disabled_at = ?, updated_at = ? WHERE id = ?')
    .run(new Date().toISOString(), new Date().toISOString(), userId);
  return true;
}

export function enableUser(userId: string): boolean {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!user) return false;
  db.prepare('UPDATE users SET disabled_at = NULL, updated_at = ? WHERE id = ?')
    .run(new Date().toISOString(), userId);
  return true;
}

export function deleteUser(userId: string): boolean {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!user) return false;
  db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  return true;
}

export function getUserUsageStats(userId: string): UserUsageStats | null {
  const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId) as any;
  if (!user) return null;

  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(todayStart);
  monthStart.setMonth(monthStart.getMonth() - 1);

  const totalQueries = (db.prepare(`
    SELECT COUNT(*) as count FROM request_log WHERE user_id = ?
  `).get(userId) as { count: number }).count;

  const todayQueries = (db.prepare(`
    SELECT COUNT(*) as count FROM request_log
    WHERE user_id = ? AND created_at_ms >= ?
  `).get(userId, todayStart.getTime()) as { count: number }).count;

  const weekQueries = (db.prepare(`
    SELECT COUNT(*) as count FROM request_log
    WHERE user_id = ? AND created_at_ms >= ?
  `).get(userId, weekStart.getTime()) as { count: number }).count;

  const monthQueries = (db.prepare(`
    SELECT COUNT(*) as count FROM request_log
    WHERE user_id = ? AND created_at_ms >= ?
  `).get(userId, monthStart.getTime()) as { count: number }).count;

  const totalTokens = (db.prepare(`
    SELECT COALESCE(SUM(LENGTH(response_json)), 0) as total FROM request_log WHERE user_id = ?
  `).get(userId) as { total: number }).total;

  const avgLatency = db.prepare(`
    SELECT AVG(latency_ms) as avg FROM request_log WHERE user_id = ?
  `).get(userId) as { avg: number | null };

  const errorCount = (db.prepare(`
    SELECT COUNT(*) as count FROM request_log
    WHERE user_id = ? AND (action LIKE '%model_error%' OR response_json LIKE '%provider%')
  `).get(userId) as { count: number }).count;

  const queriesByMode = db.prepare(`
    SELECT COALESCE(mode, 'unknown') as mode, COUNT(*) as count
    FROM request_log WHERE user_id = ?
    GROUP BY mode ORDER BY count DESC
  `).all(userId) as Array<{ mode: string; count: number }>;

  const queriesByDay = db.prepare(`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM request_log WHERE user_id = ? AND created_at_ms >= ?
    GROUP BY date ORDER BY date DESC
  `).all(userId, monthStart.getTime()) as Array<{ date: string; count: number }>;

  const recentErrors = db.prepare(`
    SELECT action, query, created_at, latency_ms
    FROM request_log
    WHERE user_id = ? AND (action LIKE '%model_error%' OR response_json LIKE '%provider%')
    ORDER BY created_at_ms DESC LIMIT 10
  `).all(userId).map((row: any) => ({
    action: row.action,
    query: row.query,
    createdAt: row.created_at,
    latencyMs: row.latency_ms,
  }));

  return {
    userId,
    userName: user.name,
    userEmail: user.email,
    totalQueries,
    todayQueries,
    weekQueries,
    monthQueries,
    totalTokens,
    avgLatencyMs: Math.round(avgLatency?.avg ?? 0),
    errorRate: totalQueries > 0 ? (errorCount / totalQueries) * 100 : 0,
    queriesByMode,
    queriesByDay,
    recentErrors,
  };
}

export function getUserActivityLog(userId: string, limit = 50): UserActivityLog[] {
  return db.prepare(`
    SELECT id, action, resource_type, resource_id, ip_address, success, severity, details_json, created_at
    FROM audit_log
    WHERE user_id = ?
    ORDER BY created_at_ms DESC, rowid DESC
    LIMIT ?
  `).all(userId, limit).map((row: any) => ({
    id: row.id,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    ipAddress: row.ip_address,
    success: row.success === 1,
    severity: row.severity,
    details: row.details_json ? JSON.parse(row.details_json) : null,
    createdAt: row.created_at,
  }));
}

export function getSystemOverview(): SystemOverview {
  const totalUsers = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  const activeUsers = (db.prepare('SELECT COUNT(*) as count FROM users WHERE disabled_at IS NULL').get() as { count: number }).count;
  const disabledUsers = totalUsers - activeUsers;

  const usersByRole = db.prepare(`
    SELECT role, COUNT(*) as count FROM users GROUP BY role
  `).all() as Array<{ role: string; count: number }>;

  const totalSessions = (db.prepare('SELECT COUNT(*) as count FROM auth_sessions').get() as { count: number }).count;
  const activeSessions = (db.prepare(`
    SELECT COUNT(*) as count FROM auth_sessions
    WHERE revoked_at IS NULL AND expires_at > ?
  `).get(new Date().toISOString()) as { count: number }).count;

  const totalDocuments = (db.prepare('SELECT COUNT(*) as count FROM documents WHERE deleted_at IS NULL').get() as { count: number }).count;
  const indexedDocuments = (db.prepare(`
    SELECT COUNT(*) as count FROM documents WHERE deleted_at IS NULL AND ingestion_status = 'indexed'
  `).get() as { count: number }).count;
  const totalChunks = (db.prepare('SELECT COUNT(*) as count FROM chunks').get() as { count: number }).count;
  const totalProjects = (db.prepare('SELECT COUNT(*) as count FROM projects WHERE archived_at IS NULL').get() as { count: number }).count;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const totalQueries = (db.prepare('SELECT COUNT(*) as count FROM request_log').get() as { count: number }).count;
  const todayQueries = (db.prepare(`
    SELECT COUNT(*) as count FROM request_log WHERE created_at_ms >= ?
  `).get(todayStart.getTime()) as { count: number }).count;
  const weekQueries = (db.prepare(`
    SELECT COUNT(*) as count FROM request_log WHERE created_at_ms >= ?
  `).get(weekStart.getTime()) as { count: number }).count;

  const apiConfig = db.prepare(`
    SELECT provider_type, model, last_tested_at, last_status
    FROM api_provider_configs WHERE is_active = 1 LIMIT 1
  `).get() as any;

  const recentAuditSummary = db.prepare(`
    SELECT action, severity, COUNT(*) as count
    FROM audit_log
    WHERE created_at_ms >= ?
    GROUP BY action, severity
    ORDER BY count DESC
    LIMIT 10
  `).all(todayStart.getTime()) as Array<{
    action: string;
    severity: string;
    count: number;
  }>;

  return {
    totalUsers,
    activeUsers,
    disabledUsers,
    usersByRole,
    totalSessions,
    activeSessions,
    totalDocuments,
    indexedDocuments,
    totalChunks,
    totalProjects,
    totalQueries,
    todayQueries,
    weekQueries,
    apiStatus: {
      status: apiConfig?.last_status ?? 'unknown',
      providerType: apiConfig?.provider_type ?? 'none',
      model: apiConfig?.model ?? 'none',
      lastTestedAt: apiConfig?.last_tested_at ?? null,
      lastStatus: apiConfig?.last_status ?? null,
    },
    recentAuditSummary,
    systemUptime: process.uptime().toFixed(0),
  };
}
