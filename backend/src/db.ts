import Database from 'better-sqlite3';
import { DB_PATH, ensureParentDir } from './paths.js';

ensureParentDir(DB_PATH);

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ──────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id            TEXT PRIMARY KEY,
    title         TEXT NOT NULL,
    type          TEXT,
    source_type   TEXT DEFAULT 'manual',
    file_name     TEXT,
    file_path     TEXT,
    mime_type     TEXT,
    source_url    TEXT,
    sensitivity   TEXT DEFAULT 'internal',
    approval      TEXT DEFAULT 'draft',
    sensitivity_level TEXT DEFAULT 'internal',
    approval_status   TEXT DEFAULT 'draft',
    ingestion_status  TEXT DEFAULT 'registered',
    indexed_at    TEXT,
    last_error    TEXT,
    uploaded_by   TEXT,
    chunk_count   INTEGER DEFAULT 0,
    ingested_at   TEXT,
    created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS document_texts (
    document_id   TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    content       TEXT NOT NULL,
    content_encrypted INTEGER DEFAULT 0,
    encryption_iv TEXT,
    encryption_tag TEXT,
    char_count    INTEGER DEFAULT 0,
    extracted_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS chunks (
    id            TEXT PRIMARY KEY,
    document_id   TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index   INTEGER DEFAULT 0,
    content       TEXT NOT NULL,
    page          INTEGER,
    section       TEXT,
    char_start    INTEGER,
    char_end      INTEGER,
    token_estimate INTEGER DEFAULT 0,
    indexed_at    TEXT,
    embedding     BLOB,
    embedding_provider TEXT,
    embedding_model TEXT,
    embedding_dim INTEGER,
    created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id            TEXT PRIMARY KEY,
    user_id       TEXT,
    created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    last_active   TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id            TEXT PRIMARY KEY,
    session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role          TEXT NOT NULL,
    text          TEXT NOT NULL,
    mode          TEXT,
    sources_json  TEXT,
    claim_safety  TEXT,
    created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    created_at_ms INTEGER,
    message_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS request_log (
    id            TEXT PRIMARY KEY,
    session_id    TEXT,
    user_id       TEXT,
    action        TEXT,
    mode          TEXT,
    query         TEXT,
    response_json TEXT,
    sources_json  TEXT,
    claim_safety  TEXT,
    latency_ms    INTEGER,
    created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    created_at_ms INTEGER
  );

  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    role          TEXT NOT NULL CHECK(role IN ('admin', 'operator', 'briefing_user')),
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    disabled_at   TEXT
  );

  CREATE TABLE IF NOT EXISTS auth_sessions (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash    TEXT NOT NULL UNIQUE,
    created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    expires_at    TEXT NOT NULL,
    last_active_at TEXT,
    revoked_at    TEXT
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id            TEXT PRIMARY KEY,
    created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    created_at_ms INTEGER,
    user_id       TEXT,
    action        TEXT NOT NULL,
    resource_type TEXT,
    resource_id   TEXT,
    ip_address    TEXT,
    success       INTEGER NOT NULL DEFAULT 1,
    severity      TEXT DEFAULT 'info',
    details_json  TEXT
  );

  CREATE TABLE IF NOT EXISTS login_attempts (
    email         TEXT PRIMARY KEY,
    failed_count  INTEGER DEFAULT 0,
    locked_until  TEXT,
    last_failed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS api_provider_configs (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE,
    provider_type TEXT NOT NULL,
    base_url      TEXT,
    model         TEXT,
    api_key_ciphertext TEXT,
    api_key_iv    TEXT,
    api_key_tag   TEXT,
    timeout_ms    INTEGER DEFAULT 30000,
    max_tokens    INTEGER DEFAULT 800,
    is_active     INTEGER DEFAULT 0,
    last_used_at  TEXT,
    last_tested_at TEXT,
    last_status   TEXT,
    quota_json    TEXT,
    created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id            TEXT PRIMARY KEY,
    slug          TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    display_name  TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'at_risk',
    risk_level    TEXT NOT NULL DEFAULT 'medium',
    progress      INTEGER DEFAULT 0,
    overview      TEXT NOT NULL DEFAULT '',
    key_metrics_json TEXT DEFAULT '[]',
    keywords_json TEXT DEFAULT '[]',
    created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    archived_at   TEXT
  );

  CREATE TABLE IF NOT EXISTS project_documents (
    project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    document_id   TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    relevance     REAL DEFAULT 0.5,
    match_reason  TEXT,
    created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (project_id, document_id)
  );
`);

const columns = (tableName: string) =>
  db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;

function ensureColumn(tableName: string, columnName: string, definition: string): void {
  if (!columns(tableName).some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

ensureColumn('messages', 'created_at_ms', 'INTEGER');
ensureColumn('messages', 'message_order', 'INTEGER DEFAULT 0');
ensureColumn('sessions', 'user_id', 'TEXT');
ensureColumn('request_log', 'created_at_ms', 'INTEGER');
ensureColumn('request_log', 'user_id', 'TEXT');
ensureColumn('request_log', 'action', 'TEXT');
ensureColumn('documents', 'source_type', "TEXT DEFAULT 'manual'");
ensureColumn('documents', 'file_name', 'TEXT');
ensureColumn('documents', 'mime_type', 'TEXT');
ensureColumn('documents', 'sensitivity_level', "TEXT DEFAULT 'internal'");
ensureColumn('documents', 'approval_status', "TEXT DEFAULT 'draft'");
ensureColumn('documents', 'ingestion_status', "TEXT DEFAULT 'registered'");
ensureColumn('documents', 'indexed_at', 'TEXT');
ensureColumn('documents', 'last_error', 'TEXT');
ensureColumn('documents', 'updated_at', 'TEXT');
ensureColumn('chunks', 'chunk_index', 'INTEGER DEFAULT 0');
ensureColumn('chunks', 'char_start', 'INTEGER');
ensureColumn('chunks', 'char_end', 'INTEGER');
ensureColumn('chunks', 'token_estimate', 'INTEGER DEFAULT 0');
ensureColumn('chunks', 'indexed_at', 'TEXT');
ensureColumn('chunks', 'embedding_provider', 'TEXT');
ensureColumn('chunks', 'embedding_model', 'TEXT');
ensureColumn('chunks', 'embedding_dim', 'INTEGER');
ensureColumn('documents', 'retention_expires_at', 'TEXT');
ensureColumn('documents', 'retention_action', "TEXT DEFAULT 'archive'");
ensureColumn('documents', 'archived_at', 'TEXT');
ensureColumn('documents', 'deleted_at', 'TEXT');
ensureColumn('auth_sessions', 'last_active_at', 'TEXT');
ensureColumn('document_texts', 'content_encrypted', 'INTEGER DEFAULT 0');
ensureColumn('document_texts', 'encryption_iv', 'TEXT');
ensureColumn('document_texts', 'encryption_tag', 'TEXT');
ensureColumn('projects', 'display_name', 'TEXT');
ensureColumn('projects', 'status', "TEXT DEFAULT 'at_risk'");
ensureColumn('projects', 'risk_level', "TEXT DEFAULT 'medium'");
ensureColumn('projects', 'progress', 'INTEGER DEFAULT 0');
ensureColumn('projects', 'overview', "TEXT DEFAULT ''");
ensureColumn('projects', 'key_metrics_json', "TEXT DEFAULT '[]'");
ensureColumn('projects', 'keywords_json', "TEXT DEFAULT '[]'");
ensureColumn('projects', 'archived_at', 'TEXT');

db.exec(`
  CREATE TABLE IF NOT EXISTS document_texts (
    document_id   TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    content       TEXT NOT NULL,
    content_encrypted INTEGER DEFAULT 0,
    encryption_iv TEXT,
    encryption_tag TEXT,
    char_count    INTEGER DEFAULT 0,
    extracted_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  UPDATE documents
  SET
    sensitivity_level = COALESCE(sensitivity_level, sensitivity, 'internal'),
    approval_status = COALESCE(approval_status, approval, 'draft'),
    ingestion_status = COALESCE(ingestion_status, CASE WHEN chunk_count > 0 THEN 'indexed' ELSE 'registered' END),
    updated_at = COALESCE(updated_at, created_at)
  WHERE sensitivity_level IS NULL
     OR approval_status IS NULL
     OR ingestion_status IS NULL
     OR updated_at IS NULL;

  UPDATE documents
  SET ingestion_status = CASE
    WHEN ingestion_status = 'ingested' THEN 'indexed'
    WHEN ingestion_status = 'ingesting' THEN 'extracting'
    ELSE ingestion_status
  END
  WHERE ingestion_status IN ('ingested', 'ingesting');

  UPDATE messages
  SET created_at_ms = CAST(strftime('%s', created_at) AS INTEGER) * 1000
  WHERE created_at_ms IS NULL;

  UPDATE request_log
  SET created_at_ms = CAST(strftime('%s', created_at) AS INTEGER) * 1000
  WHERE created_at_ms IS NULL;

  CREATE INDEX IF NOT EXISTS idx_messages_session_order
  ON messages (session_id, message_order, created_at_ms);

  CREATE INDEX IF NOT EXISTS idx_request_log_created_at_ms
  ON request_log (created_at_ms);

  CREATE INDEX IF NOT EXISTS idx_request_log_user_id
  ON request_log (user_id, created_at_ms);

  CREATE INDEX IF NOT EXISTS idx_sessions_user_id
  ON sessions (user_id, last_active);

  CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_hash
  ON auth_sessions (token_hash);

  CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id
  ON auth_sessions (user_id, expires_at);

  CREATE INDEX IF NOT EXISTS idx_auth_sessions_last_active
  ON auth_sessions (last_active_at);

  CREATE INDEX IF NOT EXISTS idx_audit_log_created_at_ms
  ON audit_log (created_at_ms);

  CREATE INDEX IF NOT EXISTS idx_audit_log_user_action
  ON audit_log (user_id, action, created_at_ms);

  CREATE INDEX IF NOT EXISTS idx_api_provider_configs_active
  ON api_provider_configs (is_active, updated_at);

  CREATE INDEX IF NOT EXISTS idx_documents_ingestion_status
  ON documents (ingestion_status);

  CREATE INDEX IF NOT EXISTS idx_documents_approval_status
  ON documents (approval_status);

  CREATE INDEX IF NOT EXISTS idx_documents_sensitivity_level
  ON documents (sensitivity_level);

  CREATE INDEX IF NOT EXISTS idx_chunks_document_index
  ON chunks (document_id, chunk_index);

  CREATE INDEX IF NOT EXISTS idx_projects_status
  ON projects (status, risk_level);

  CREATE INDEX IF NOT EXISTS idx_project_documents_document
  ON project_documents (document_id, project_id);

  CREATE TRIGGER IF NOT EXISTS audit_log_append_only_delete
  BEFORE DELETE ON audit_log
  BEGIN
    SELECT RAISE(ABORT, 'audit_log is append-only');
  END;

  CREATE TRIGGER IF NOT EXISTS audit_log_append_only_update
  BEFORE UPDATE ON audit_log
  BEGIN
    SELECT RAISE(ABORT, 'audit_log is append-only');
  END;
`);

// FTS index on chunks for Phase 1 text search
try {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
      content, page UNINDEXED, section, content=chunks, content_rowid=rowid
    );
  `);
} catch {
  // FTS table may already exist
}

export default db;
