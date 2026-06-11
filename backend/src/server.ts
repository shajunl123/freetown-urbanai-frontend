import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import db from './db.js';
import authRouter from './routes/auth.js';
import chatRouter from './routes/chat.js';
import documentsRouter from './routes/documents.js';
import adminRouter from './routes/admin.js';
import adminUsersRouter from './routes/admin-users.js';
import projectsRouter from './routes/projects.js';
import { DATA_DIR, DB_PATH, UPLOAD_DIR } from './paths.js';
import { corpusStats } from './services/documentRegistry.js';
import { debugRetrieval } from './services/retrievalService.js';
import { requireAuth, requirePlatformOwner } from './middleware/auth.js';
import { logRequest } from './services/requestLogger.js';
import { getModelProviderStatus } from './services/upstreamPolicyService.js';
import { isEmbeddingReady, embeddingStats } from './services/embeddingService.js';
import { canInspectSessionHistory } from './permissions.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ── Middleware ──────────────────────────────────────────────────────────

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', authRouter);

// ── Health check ───────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/ready', (_req, res) => {
  const stats = corpusStats();
  const provider = getModelProviderStatus();
  const corpusReady = stats.indexedDocuments > 0;

  res.json({
    status: corpusReady ? 'ready' : 'needs_corpus',
    timestamp: new Date().toISOString(),
    backend: {
      status: 'ok',
      storage: 'configured',
    },
    corpus: {
      ready: corpusReady,
      totalDocuments: stats.totalDocuments,
      indexedDocuments: stats.indexedDocuments,
      totalChunks: stats.totalChunks,
      statusCounts: stats.statusCounts,
    },
    provider: {
      type: provider.type,
      configured: provider.configured,
      model: provider.model,
      legacy: provider.legacy,
      missing: provider.missing,
    },
    embeddings: (() => { const s = embeddingStats(); return { ready: isEmbeddingReady(), ...s }; })(),
    notes: corpusReady
      ? ['Backend is usable for local retrieval-backed briefing support.']
      : ['Seed or ingest approved corpus documents before expecting source-grounded answers.'],
  });
});

// ── Routes ─────────────────────────────────────────────────────────────

app.use('/api/chat', requireAuth, chatRouter);
app.use('/api/documents', requireAuth, documentsRouter);
app.use('/api/admin', requireAuth, adminRouter);
app.use('/api/admin/users', requireAuth, adminUsersRouter);
app.use('/api/projects', requireAuth, projectsRouter);

app.get('/api/corpus/stats', requireAuth, (_req, res) => {
  res.json(corpusStats());
});

app.post('/api/corpus/reembed', requireAuth, requirePlatformOwner, async (_req, res) => {
  try {
    const { rebuildEmbeddings, embeddingStats } = await import('./services/embeddingService.js');
    await rebuildEmbeddings();
    const stats = embeddingStats();
    res.json({
      message: `Embedding index rebuilt: ${stats.embeddedChunks} chunks, ${stats.terms} local terms`,
      ...stats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Re-embedding failed';
    console.error('[reembed] error:', message);
    res.status(500).json({ error: message });
  }
});

app.get('/api/retrieval/debug', requireAuth, requirePlatformOwner, (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  if (!query.trim()) {
    res.status(400).json({ error: 'q query parameter is required' });
    return;
  }

  const approvals =
    typeof req.query.approvals === 'string' && req.query.approvals.trim()
      ? req.query.approvals.split(',').map((item) => item.trim()).filter(Boolean)
      : undefined;
  const sensitivities =
    typeof req.query.sensitivities === 'string' && req.query.sensitivities.trim()
      ? req.query.sensitivities.split(',').map((item) => item.trim()).filter(Boolean)
      : undefined;
  const includeDrafts = req.query.includeDrafts === 'true';

  const debug = debugRetrieval(query, {
      approvalStatuses: approvals as Array<'draft' | 'approved' | 'archived'> | undefined,
      includeDrafts,
      sensitivityLevels: sensitivities,
      limit: typeof req.query.limit === 'string' ? Number(req.query.limit) || 6 : 6,
      maxPerDocument:
        typeof req.query.maxPerDocument === 'string'
          ? Number(req.query.maxPerDocument) || 2
          : 2,
    });

  logRequest({
    userId: req.user?.id,
    action: 'retrieval_debug',
    query,
    responseJson: JSON.stringify({
      filters: debug.filters,
      resultCount: debug.results.length,
    }),
  });

  res.json(debug);
});

// ── Sessions endpoint ──────────────────────────────────────────────────

import { getSessionHistory } from './services/sessionManager.js';
import { getSession } from './services/sessionManager.js';

app.get('/api/sessions/:id/history', requireAuth, (req, res) => {
  const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const session = getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  if (!req.user || !canInspectSessionHistory(req.user, session.user_id)) {
    res.status(403).json({ error: 'Session does not belong to this user' });
    return;
  }

  const messages = getSessionHistory(sessionId);
  res.json({
    sessionId,
    messages: messages.map((m) => ({
      role: m.role,
      text: m.text,
      mode: m.mode,
      sources: m.sources_json ? JSON.parse(m.sources_json) : undefined,
      claimSafety: m.claim_safety ? JSON.parse(m.claim_safety) : undefined,
      timestamp: m.created_at,
    })),
  });
});

// ── Error handler ──────────────────────────────────────────────────────

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('[server] unhandled error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
);

// ── Start ──────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Freetown UrbanAI backend running on http://localhost:${PORT}`);
  console.log(`  POST /api/chat`);
  console.log(`  GET  /api/documents`);
  console.log(`  GET  /api/projects`);
  console.log(`  POST /api/documents/upload`);
  console.log(`  GET  /api/corpus/stats`);
  console.log(`  GET  /api/retrieval/debug?q=...`);
  console.log(`  GET  /api/sessions/:id/history`);
  console.log(`  GET  /api/health`);
  console.log(`  GET  /api/ready`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`SQLite DB: ${DB_PATH}`);
  console.log(`Uploads: ${UPLOAD_DIR}`);
  const provider = getModelProviderStatus();
  console.log(
    `Model provider: ${provider.type} (${provider.configured ? 'configured' : `missing ${provider.missing.join(', ')}`})`
  );
});
