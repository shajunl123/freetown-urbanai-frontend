import type { NextFunction, Request, Response } from 'express';
import db from '../db.js';
import { logAuditEvent } from '../services/auditService.js';
import { securitySettings } from '../services/securityConfig.js';

export function requireQueryRateLimit(req: Request, res: Response, next: NextFunction): void {
  const settings = securitySettings();
  if (!settings.rateLimitEnabled || !req.user) {
    next();
    return;
  }

  const sinceMs = Date.now() - 60 * 60 * 1000;
  const row = db.prepare(
    `SELECT COUNT(*) AS count
     FROM request_log
     WHERE user_id = ? AND action = 'chat' AND created_at_ms >= ?`
  ).get(req.user.id, sinceMs) as { count: number };

  if (row.count >= settings.queryLimitPerHour) {
    logAuditEvent({
      userId: req.user.id,
      action: 'rate_limit_block',
      resourceType: 'chat',
      ipAddress: req.ip,
      success: false,
      severity: 'warning',
      details: { limit: settings.queryLimitPerHour, window: '1h' },
    });
    res.status(429).json({ error: 'Query rate limit exceeded. Try again later.' });
    return;
  }

  next();
}
