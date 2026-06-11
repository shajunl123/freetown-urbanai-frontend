import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import type { RequestLogRow } from '../types.js';

export function logRequest(params: {
  sessionId?: string;
  userId?: string;
  action?: string;
  mode?: string;
  query?: string;
  responseJson?: string;
  sourcesJson?: string;
  claimSafety?: string;
  latencyMs?: number;
}): RequestLogRow {
  const id = uuidv4();
  const createdAtMs = Date.now();
  const createdAt = new Date(createdAtMs).toISOString();
  db.prepare(
    `INSERT INTO request_log (
       id, session_id, user_id, action, mode, query, response_json, sources_json,
       claim_safety, latency_ms, created_at, created_at_ms
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.sessionId ?? null,
    params.userId ?? null,
    params.action ?? null,
    params.mode ?? null,
    params.query ?? null,
    params.responseJson ?? null,
    params.sourcesJson ?? null,
    params.claimSafety ?? null,
    params.latencyMs ?? null,
    createdAt,
    createdAtMs
  );

  return db.prepare('SELECT * FROM request_log WHERE id = ?').get(id) as RequestLogRow;
}

export function getRecentLogs(limit = 50): RequestLogRow[] {
  return db
    .prepare('SELECT * FROM request_log ORDER BY created_at_ms DESC, rowid DESC LIMIT ?')
    .all(limit) as RequestLogRow[];
}
