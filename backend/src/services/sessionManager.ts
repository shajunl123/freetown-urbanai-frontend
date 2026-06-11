import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import type { SessionRow, MessageRow } from '../types.js';
import { syncMessageToSupabase, syncSessionToSupabase } from './supabaseService.js';

export function ensureSession(sessionId: string, userId: string): SessionRow {
  const existing = db
    .prepare('SELECT * FROM sessions WHERE id = ?')
    .get(sessionId) as SessionRow | undefined;

  if (existing) {
    if (existing.user_id && existing.user_id !== userId) {
      throw new Error('Session belongs to another user');
    }
    db.prepare('UPDATE sessions SET last_active = ? WHERE id = ?')
      .run(new Date().toISOString(), sessionId);

    if (!existing.user_id) {
      db.prepare('UPDATE sessions SET user_id = ? WHERE id = ?').run(userId, sessionId);
    }

    const session = db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .get(sessionId) as SessionRow;
    void syncSessionToSupabase(session);
    return session;
  }

  const createdAt = new Date().toISOString();
  db.prepare('INSERT INTO sessions (id, user_id, created_at, last_active) VALUES (?, ?, ?, ?)')
    .run(sessionId, userId, createdAt, createdAt);
  const session = db
    .prepare('SELECT * FROM sessions WHERE id = ?')
    .get(sessionId) as SessionRow;
  void syncSessionToSupabase(session);
  return session;
}

export function saveMessage(
  sessionId: string,
  role: 'user' | 'model',
  text: string,
  mode?: string,
  sourcesJson?: string,
  claimSafety?: string
): MessageRow {
  const id = uuidv4();
  const createdAtMs = Date.now();
  const createdAt = new Date(createdAtMs).toISOString();
  const nextOrder =
    (db
      .prepare('SELECT COALESCE(MAX(message_order), 0) + 1 AS nextOrder FROM messages WHERE session_id = ?')
      .get(sessionId) as { nextOrder: number }).nextOrder;

  db.prepare(
    `INSERT INTO messages (
       id, session_id, role, text, mode, sources_json, claim_safety,
       created_at, created_at_ms, message_order
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    sessionId,
    role,
    text,
    mode ?? null,
    sourcesJson ?? null,
    claimSafety ?? null,
    createdAt,
    createdAtMs,
    nextOrder
  );

  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as MessageRow;
  void syncMessageToSupabase(message);
  return message;
}

export function getSessionHistory(sessionId: string): MessageRow[] {
  return db
    .prepare(
      'SELECT * FROM messages WHERE session_id = ? ORDER BY message_order ASC, created_at_ms ASC, rowid ASC'
    )
    .all(sessionId) as MessageRow[];
}

export function getSession(sessionId: string): SessionRow | undefined {
  return db
    .prepare('SELECT * FROM sessions WHERE id = ?')
    .get(sessionId) as SessionRow | undefined;
}
