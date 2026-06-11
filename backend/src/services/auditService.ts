import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { securitySettings } from './securityConfig.js';

export interface AuditEvent {
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  success?: boolean;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  details?: Record<string, unknown>;
}

export function logAuditEvent(event: AuditEvent): void {
  if (!securitySettings().auditEnabled && event.severity !== 'critical') return;

  const nowMs = Date.now();
  db.prepare(
    `INSERT INTO audit_log (
       id, created_at, created_at_ms, user_id, action, resource_type, resource_id,
       ip_address, success, severity, details_json
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    uuidv4(),
    new Date(nowMs).toISOString(),
    nowMs,
    event.userId ?? null,
    event.action,
    event.resourceType ?? null,
    event.resourceId ?? null,
    event.ipAddress ?? null,
    event.success === false ? 0 : 1,
    event.severity ?? 'info',
    event.details ? JSON.stringify(event.details) : null
  );
}

export function listAuditLog(limit = 100) {
  return db
    .prepare('SELECT * FROM audit_log ORDER BY created_at_ms DESC, rowid DESC LIMIT ?')
    .all(limit);
}

export function auditSummarySince(startMs: number) {
  const rows = db
    .prepare(
      `SELECT action, severity, success, COUNT(*) AS count
       FROM audit_log
       WHERE created_at_ms >= ?
       GROUP BY action, severity, success`
    )
    .all(startMs) as Array<{ action: string; severity: string; success: number; count: number }>;
  return rows;
}
