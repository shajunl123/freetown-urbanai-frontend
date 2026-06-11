import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { SECURITY_REPORT_DIR } from '../paths.js';
import { describeProviderConfig } from '../providers/config.js';
import { decryptWithEnvKey, encryptWithEnvKey, maskSecret } from './cryptoService.js';
import { auditSummarySince, logAuditEvent } from './auditService.js';

const API_CONFIG_KEY_ENV = 'API_CONFIG_ENCRYPTION_KEY';

export function getApiUsageStatus() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startMs = startOfDay.getTime();

  const row = db.prepare(
    `SELECT
       COUNT(*) AS todayQueries,
       AVG(latency_ms) AS avgLatencyMs,
       SUM(CASE WHEN action LIKE '%model_error%' OR response_json LIKE '%provider%' THEN 1 ELSE 0 END) AS errorCount
     FROM request_log
     WHERE created_at_ms >= ?`
  ).get(startMs) as { todayQueries: number; avgLatencyMs: number | null; errorCount: number | null };

  const recentErrors = db.prepare(
    `SELECT created_at, action, mode, query, response_json, latency_ms
     FROM request_log
     WHERE action LIKE '%model_error%' OR response_json LIKE '%provider%'
     ORDER BY created_at_ms DESC, rowid DESC
     LIMIT 5`
  ).all();

  const errorRate = row.todayQueries > 0 ? ((row.errorCount ?? 0) / row.todayQueries) * 100 : 0;
  const avgLatencyMs = Math.round(row.avgLatencyMs ?? 0);
  const status =
    avgLatencyMs > 15000 || errorRate > 15 ? 'red' :
    avgLatencyMs > 5000 || errorRate >= 5 ? 'yellow' :
    'green';

  return {
    status,
    provider: describeProviderConfig(),
    todayQueries: row.todayQueries,
    todayTokenUsage: 0,
    avgLatencyMs,
    errorRate,
    recentErrors,
  };
}

function activeConfigRow() {
  return db.prepare(
    'SELECT * FROM api_provider_configs WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 1'
  ).get() as any | undefined;
}

export function getActiveApiConfig() {
  const row = activeConfigRow();
  if (!row) return null;
  const apiKey = row.api_key_ciphertext && row.api_key_iv && row.api_key_tag
    ? decryptWithEnvKey({
        ciphertext: row.api_key_ciphertext,
        iv: row.api_key_iv,
        tag: row.api_key_tag,
      }, API_CONFIG_KEY_ENV)
    : null;

  return {
    id: row.id,
    name: row.name,
    providerType: row.provider_type,
    baseUrl: row.base_url,
    model: row.model,
    apiKeyMasked: maskSecret(apiKey),
    timeoutMs: row.timeout_ms,
    maxTokens: row.max_tokens,
    isActive: Boolean(row.is_active),
    lastUsedAt: row.last_used_at,
    lastTestedAt: row.last_tested_at,
    lastStatus: row.last_status,
  };
}

export function listApiConfigs() {
  return db.prepare(
    `SELECT id, name, provider_type AS providerType, base_url AS baseUrl, model,
            timeout_ms AS timeoutMs, max_tokens AS maxTokens, is_active AS isActive,
            last_used_at AS lastUsedAt, last_tested_at AS lastTestedAt,
            last_status AS lastStatus
     FROM api_provider_configs
     ORDER BY is_active DESC, updated_at DESC`
  ).all();
}

export function getActiveApiProviderOverride() {
  const row = activeConfigRow();
  if (!row) return null;
  const apiKey = row.api_key_ciphertext && row.api_key_iv && row.api_key_tag
    ? decryptWithEnvKey({
        ciphertext: row.api_key_ciphertext,
        iv: row.api_key_iv,
        tag: row.api_key_tag,
      }, API_CONFIG_KEY_ENV)
    : '';

  return {
    type: row.provider_type,
    model: row.model || '',
    baseUrl: row.base_url || '',
    apiKey: apiKey || '',
    timeoutMs: row.timeout_ms || 30000,
    maxTokens: row.max_tokens || 800,
  };
}

export function upsertApiConfig(params: {
  name: string;
  providerType: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  timeoutMs?: number;
  maxTokens?: number;
  activate?: boolean;
  userId?: string;
  ipAddress?: string;
}) {
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT * FROM api_provider_configs WHERE name = ?').get(params.name) as any | undefined;
  const encrypted = params.apiKey ? encryptWithEnvKey(params.apiKey, API_CONFIG_KEY_ENV) : null;
  if (params.apiKey && !encrypted) {
    throw new Error('API_CONFIG_ENCRYPTION_KEY is required before storing API keys.');
  }

  const id = existing?.id ?? uuidv4();
  const tx = db.transaction(() => {
    if (params.activate) {
      db.prepare('UPDATE api_provider_configs SET is_active = 0, updated_at = ?').run(now);
    }

    db.prepare(
      `INSERT INTO api_provider_configs (
         id, name, provider_type, base_url, model, api_key_ciphertext, api_key_iv,
         api_key_tag, timeout_ms, max_tokens, is_active, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET
         provider_type = excluded.provider_type,
         base_url = excluded.base_url,
         model = excluded.model,
         api_key_ciphertext = COALESCE(excluded.api_key_ciphertext, api_provider_configs.api_key_ciphertext),
         api_key_iv = COALESCE(excluded.api_key_iv, api_provider_configs.api_key_iv),
         api_key_tag = COALESCE(excluded.api_key_tag, api_provider_configs.api_key_tag),
         timeout_ms = excluded.timeout_ms,
         max_tokens = excluded.max_tokens,
         is_active = excluded.is_active,
         updated_at = excluded.updated_at`
    ).run(
      id,
      params.name,
      params.providerType,
      params.baseUrl ?? null,
      params.model ?? null,
      encrypted?.ciphertext ?? null,
      encrypted?.iv ?? null,
      encrypted?.tag ?? null,
      params.timeoutMs ?? 30000,
      params.maxTokens ?? 800,
      params.activate ? 1 : existing?.is_active ?? 0,
      now,
      now
    );
  });

  tx();
  logAuditEvent({
    userId: params.userId,
    action: 'api_config_change',
    resourceType: 'api_provider_config',
    resourceId: id,
    ipAddress: params.ipAddress,
    success: true,
    severity: 'warning',
    details: { name: params.name, providerType: params.providerType, activated: params.activate },
  });
  return getActiveApiConfig();
}

export function getSecurityDashboard() {
  const now = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const activeSessions = db.prepare(
    `SELECT COUNT(*) AS count FROM auth_sessions
     WHERE revoked_at IS NULL AND expires_at > ?`
  ).get(new Date().toISOString()) as { count: number };
  const todayQueries = db.prepare(
    `SELECT COUNT(*) AS count FROM request_log
     WHERE action = 'chat' AND created_at_ms >= ?`
  ).get(today.getTime()) as { count: number };
  const suspicious = db.prepare(
    `SELECT COUNT(*) AS count FROM audit_log
     WHERE severity IN ('warning', 'critical') AND created_at_ms >= ?`
  ).get(today.getTime()) as { count: number };
  const modelErrors = db.prepare(
    `SELECT COUNT(*) AS count FROM request_log
     WHERE action LIKE '%model_error%' AND created_at_ms >= ?`
  ).get(today.getTime()) as { count: number };
  const classifications = db.prepare(
    `SELECT sensitivity_level AS level, COUNT(*) AS count
     FROM documents
     WHERE deleted_at IS NULL
     GROUP BY sensitivity_level`
  ).all();

  return {
    activeSessions: activeSessions.count,
    todayQueries: todayQueries.count,
    suspiciousActivity: suspicious.count,
    modelErrorRate: todayQueries.count > 0 ? modelErrors.count / todayQueries.count : 0,
    classifications,
    auditSummary: auditSummarySince(now - 24 * 60 * 60 * 1000),
  };
}

export async function generateSecurityReport() {
  await mkdir(SECURITY_REPORT_DIR, { recursive: true });
  const dashboard = getSecurityDashboard();
  const api = getApiUsageStatus();
  const date = new Date().toISOString().slice(0, 10);
  const path = join(SECURITY_REPORT_DIR, `security-report-${date}.md`);
  const content = [
    `# Freetown UrbanAI Security Report - ${date}`,
    '',
    `- Active sessions: ${dashboard.activeSessions}`,
    `- Today's queries: ${dashboard.todayQueries}`,
    `- Suspicious activity events: ${dashboard.suspiciousActivity}`,
    `- Model error rate: ${(dashboard.modelErrorRate * 100).toFixed(1)}%`,
    `- API status: ${api.status}`,
    `- Average API latency: ${api.avgLatencyMs} ms`,
    '',
    '## Data Classification',
    ...dashboard.classifications.map((row: any) => `- ${row.level || 'unknown'}: ${row.count}`),
    '',
    '## Recommendations',
    '- Review warning/critical audit events before external demonstrations.',
    '- Keep provider keys rotated and stored through encrypted admin configuration.',
    '- Reindex corpus after major document permission changes.',
    '',
  ].join('\n');

  await writeFile(path, content, 'utf8');
  return { path, content };
}
