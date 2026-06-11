import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import type { AuthSessionRow, AuthUser, UserRole, UserRow } from '../types.js';

const TOKEN_BYTES = 32;
const DEFAULT_SESSION_HOURS = 12;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function publicUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
  };
}

export function createOrUpdateUser(params: {
  email: string;
  name: string;
  password: string;
  role: UserRole;
}): AuthUser {
  const email = normalizeEmail(params.email);
  if (!email || !email.includes('@')) throw new Error('A valid email is required');
  if (!params.name.trim()) throw new Error('A display name is required');
  if (params.password.length < 10) throw new Error('Password must be at least 10 characters');

  const now = new Date().toISOString();
  const salt = randomBytes(16).toString('hex');
  const passwordHash = hashPassword(params.password, salt);
  const existing = getUserByEmail(email);

  if (existing) {
    db.prepare(
      `UPDATE users
       SET name = ?, role = ?, password_hash = ?, password_salt = ?,
           disabled_at = NULL, updated_at = ?
       WHERE id = ?`
    ).run(params.name.trim(), params.role, passwordHash, salt, now, existing.id);
    return publicUser(getUserById(existing.id)!);
  }

  const id = uuidv4();
  db.prepare(
    `INSERT INTO users (
       id, email, name, role, password_hash, password_salt, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, email, params.name.trim(), params.role, passwordHash, salt, now, now);

  return publicUser(getUserById(id)!);
}

export function getUserByEmail(email: string): UserRow | undefined {
  return db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(normalizeEmail(email)) as UserRow | undefined;
}

export function getUserById(id: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

export function verifyPassword(user: UserRow, password: string): boolean {
  const expected = Buffer.from(user.password_hash, 'hex');
  const actual = Buffer.from(hashPassword(password, user.password_salt), 'hex');
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function loginWithPassword(email: string, password: string): {
  token: string;
  user: AuthUser;
  expiresAt: string;
} | null {
  const user = getUserByEmail(email);
  if (!user || user.disabled_at) return null;
  if (!verifyPassword(user, password)) return null;

  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + DEFAULT_SESSION_HOURS * 60 * 60 * 1000
  ).toISOString();

  db.prepare(
    `INSERT INTO auth_sessions (id, user_id, token_hash, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(uuidv4(), user.id, tokenHash, now.toISOString(), expiresAt);

  return { token, user: publicUser(user), expiresAt };
}

export function authenticateToken(token: string): AuthUser | null {
  const tokenHash = hashToken(token);
  const session = db
    .prepare(
      `SELECT * FROM auth_sessions
       WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`
    )
    .get(tokenHash, new Date().toISOString()) as AuthSessionRow | undefined;

  if (!session) return null;
  const user = getUserById(session.user_id);
  if (!user || user.disabled_at) return null;
  return publicUser(user);
}

export function revokeToken(token: string): void {
  db.prepare(
    `UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL`
  ).run(new Date().toISOString(), hashToken(token));
}

export function countUsers(): number {
  return (db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count;
}
