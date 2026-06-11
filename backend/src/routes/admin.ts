import { Router } from 'express';
import db from '../db.js';
import { requirePlatformOwner } from '../middleware/auth.js';
import { listAuditLog, logAuditEvent } from '../services/auditService.js';
import {
  generateSecurityReport,
  getActiveApiConfig,
  getApiUsageStatus,
  getSecurityDashboard,
  listApiConfigs,
  upsertApiConfig,
} from '../services/adminService.js';
import { resolveProviderConfig } from '../providers/config.js';

const router = Router();

router.use(requirePlatformOwner);

router.get('/audit-log', (req, res) => {
  const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) || 100 : 100;
  res.json({ logs: listAuditLog(Math.min(limit, 500)) });
});

router.get('/security-dashboard', (_req, res) => {
  res.json(getSecurityDashboard());
});

router.get('/api-usage', (_req, res) => {
  res.json(getApiUsageStatus());
});

router.get('/api-config', (_req, res) => {
  res.json({
    active: getActiveApiConfig(),
    configs: listApiConfigs(),
    envProvider: resolveProviderConfig(),
  });
});

router.post('/api-config', (req, res) => {
  try {
    const {
      name,
      providerType,
      baseUrl,
      model,
      apiKey,
      timeoutMs,
      maxTokens,
      activate,
      confirm,
    } = req.body;

    if (confirm !== true) {
      res.status(400).json({ error: 'Configuration changes require confirm=true.' });
      return;
    }
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    if (!['openai_compatible', 'anthropic', 'nvidia'].includes(providerType)) {
      res.status(400).json({ error: 'Unsupported providerType' });
      return;
    }

    const active = upsertApiConfig({
      name: name.trim(),
      providerType,
      baseUrl: typeof baseUrl === 'string' ? baseUrl.trim() : undefined,
      model: typeof model === 'string' ? model.trim() : undefined,
      apiKey: typeof apiKey === 'string' && apiKey.trim() ? apiKey.trim() : undefined,
      timeoutMs: Number(timeoutMs) || 30000,
      maxTokens: Number(maxTokens) || 800,
      activate: activate !== false,
      userId: req.user?.id,
      ipAddress: req.ip,
    });

    res.json({ active, reloaded: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'API config update failed';
    logAuditEvent({
      userId: req.user?.id,
      action: 'api_config_change',
      resourceType: 'api_provider_config',
      ipAddress: req.ip,
      success: false,
      severity: 'error',
      details: { message },
    });
    res.status(400).json({ error: message });
  }
});

router.post('/api-config/test', async (req, res) => {
  const config = resolveProviderConfig();
  const startedAt = Date.now();
  try {
    if (config.type === 'none' || config.type === 'legacy_n8n') {
      res.status(400).json({ ok: false, error: 'No direct provider configured.' });
      return;
    }

    const endpoint =
      config.type === 'anthropic'
        ? `${config.baseUrl.replace(/\/$/, '')}/messages`
        : `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers:
        config.type === 'anthropic'
          ? {
              'Content-Type': 'application/json',
              'x-api-key': config.apiKey,
              'anthropic-version': config.anthropicVersion,
            }
          : {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${config.apiKey}`,
            },
      body:
        config.type === 'anthropic'
          ? JSON.stringify({
              model: config.model,
              max_tokens: 32,
              messages: [{ role: 'user', content: 'Reply with ok.' }],
            })
          : JSON.stringify({
              model: config.model,
              max_tokens: 32,
              messages: [{ role: 'user', content: 'Reply with ok.' }],
            }),
      signal: AbortSignal.timeout(Math.min(config.timeoutMs, 15000)),
    });

    const body = await response.text().catch(() => '');
    db.prepare(
      `UPDATE api_provider_configs
       SET last_tested_at = ?, last_status = ?
       WHERE is_active = 1`
    ).run(new Date().toISOString(), response.ok ? 'available' : `failed:${response.status}`);

    res.json({
      ok: response.ok,
      status: response.status,
      latencyMs: Date.now() - startedAt,
      detail: response.ok ? 'Provider responded.' : body.slice(0, 300),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Provider test failed';
    db.prepare(
      `UPDATE api_provider_configs
       SET last_tested_at = ?, last_status = ?
       WHERE is_active = 1`
    ).run(new Date().toISOString(), 'unavailable');
    res.status(500).json({ ok: false, latencyMs: Date.now() - startedAt, error: message });
  }
});

router.post('/security-report', async (req, res) => {
  const report = await generateSecurityReport();
  logAuditEvent({
    userId: req.user?.id,
    action: 'security_report_generate',
    resourceType: 'security_report',
    ipAddress: req.ip,
    success: true,
    details: { path: report.path },
  });
  res.json(report);
});

router.post('/retention/run', (req, res) => {
  const now = new Date().toISOString();
  const expired = db.prepare(
    `SELECT id, retention_action AS retentionAction
     FROM documents
     WHERE deleted_at IS NULL
       AND retention_expires_at IS NOT NULL
       AND retention_expires_at <= ?`
  ).all(now) as Array<{ id: string; retentionAction: string | null }>;

  const tx = db.transaction(() => {
    for (const doc of expired) {
      if (doc.retentionAction === 'delete') {
        db.prepare('UPDATE documents SET deleted_at = ?, updated_at = ? WHERE id = ?')
          .run(now, now, doc.id);
      } else {
        db.prepare(
          `UPDATE documents
           SET archived_at = ?, approval_status = 'archived', approval = 'archived',
               ingestion_status = 'archived', updated_at = ?
           WHERE id = ?`
        ).run(now, now, doc.id);
      }
      logAuditEvent({
        userId: req.user?.id,
        action: 'retention_apply',
        resourceType: 'document',
        resourceId: doc.id,
        ipAddress: req.ip,
        success: true,
        severity: 'warning',
        details: { action: doc.retentionAction || 'archive' },
      });
    }
  });
  tx();
  res.json({ processed: expired.length });
});

export default router;
