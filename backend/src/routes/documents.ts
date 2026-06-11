import { Router } from 'express';
import { createReadStream } from 'node:fs';
import multer from 'multer';
import { ensureDir, UPLOAD_DIR } from '../paths.js';
import {
  corpusStats,
  createDocument,
  getDocument,
  getDocumentText,
  listDocumentChunks,
  listDocuments,
  softDeleteDocument,
  updateDocumentApproval,
  updateDocumentMetadata,
} from '../services/documentRegistry.js';
import {
  getIngestionPreview,
  ingestDocument,
  inferDocumentType,
} from '../services/corpusIngestionService.js';
import { isSupportedForLocalExtraction } from '../services/textExtractionService.js';
import { requireCorpusOperator } from '../middleware/auth.js';
import { logAuditEvent } from '../services/auditService.js';

ensureDir(UPLOAD_DIR);

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.md', '.txt', '.json', '.html', '.htm', '.pdf', '.docx', '.xlsx', '.xls'];
    const ext = '.' + file.originalname.split('.').pop()?.toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${ext}`));
    }
  },
});

const router = Router();

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function serializeDocument(d: ReturnType<typeof listDocuments>[number]) {
  return {
    id: d.id,
    title: d.title,
    type: d.type,
    sensitivity: d.sensitivity,
    approval: d.approval,
    chunkCount: d.chunk_count,
    sourceUrl: d.source_url,
    sourceType: d.source_type,
    fileName: d.file_name,
    mimeType: d.mime_type,
    ingestionStatus: d.ingestion_status,
    approvalStatus: d.approval_status,
    sensitivityLevel: d.sensitivity_level,
    retentionExpiresAt: d.retention_expires_at,
    retentionAction: d.retention_action,
    archivedAt: d.archived_at,
    deletedAt: d.deleted_at,
    uploadedAt: d.created_at,
    updatedAt: d.updated_at,
    ingestedAt: d.ingested_at,
    indexedAt: d.indexed_at,
    lastError: d.last_error,
  };
}

function canViewDocument(req: any, doc: ReturnType<typeof listDocuments>[number]): boolean {
  return req.user?.role === 'admin' || doc.sensitivity_level !== 'confidential';
}

router.get('/', (req, res) => {
  res.json(listDocuments().filter((doc) => canViewDocument(req, doc)).map(serializeDocument));
});

router.get('/stats', (_req, res) => {
  res.json(corpusStats());
});

router.post('/', requireCorpusOperator, (req, res) => {
  const {
    title,
    type,
    sourceType,
    fileName,
    filePath,
    mimeType,
    sourceUrl,
    sensitivity,
    approval,
    uploadedBy,
  } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    res.status(400).json({ error: 'title is required' });
    return;
  }

  const doc = createDocument({
    title: title.trim(),
    type: typeof type === 'string' ? type.trim().toUpperCase() : undefined,
    sourceType: typeof sourceType === 'string' ? sourceType : 'manual',
    fileName: typeof fileName === 'string' ? fileName : undefined,
    filePath: typeof filePath === 'string' ? filePath : undefined,
    mimeType: typeof mimeType === 'string' ? mimeType : undefined,
    sourceUrl: typeof sourceUrl === 'string' ? sourceUrl.trim() : undefined,
    sensitivity: typeof sensitivity === 'string' ? sensitivity : 'internal',
    approval: ['draft', 'approved', 'archived'].includes(approval) ? approval : 'draft',
    uploadedBy: typeof uploadedBy === 'string' ? uploadedBy : undefined,
  });

  logAuditEvent({
    userId: req.user?.id,
    action: 'document_create',
    resourceType: 'document',
    resourceId: doc.id,
    ipAddress: req.ip,
    success: true,
    details: { sensitivity: doc.sensitivity_level, approval: doc.approval_status },
  });

  res.status(201).json(serializeDocument(doc));
});

router.post('/upload', requireCorpusOperator, upload.single('file'), (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const title = req.body?.title || file.originalname.replace(/\.[^.]+$/, '');
    const doc = createDocument({
      title,
      type: inferDocumentType(file.originalname),
      sourceType: 'upload',
      fileName: file.originalname,
      filePath: file.path,
      mimeType: file.mimetype,
      sensitivity: req.body?.sensitivity || 'internal',
      approval: req.body?.approval === 'approved' ? 'approved' : 'draft',
    });

    logAuditEvent({
      userId: req.user?.id,
      action: 'document_upload',
      resourceType: 'document',
      resourceId: doc.id,
      ipAddress: req.ip,
      success: true,
      details: {
        fileName: file.originalname,
        mimeType: file.mimetype,
        sensitivity: doc.sensitivity_level,
      },
    });

    res.status(201).json({
      ...serializeDocument(doc),
      canIngest: isSupportedForLocalExtraction(file.originalname),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    console.error('[documents] upload error:', message);
    logAuditEvent({
      userId: req.user?.id,
      action: 'document_upload',
      resourceType: 'document',
      ipAddress: req.ip,
      success: false,
      severity: 'error',
      details: { message },
    });
    res.status(500).json({ error: message });
  }
});

router.post('/reindex', requireCorpusOperator, async (_req, res) => {
  const docs = listDocuments().filter((doc) => doc.file_path);
  const results = [];

  for (const doc of docs) {
    if (!doc.file_path || !isSupportedForLocalExtraction(doc.file_name || doc.file_path)) {
      results.push({ id: doc.id, title: doc.title, status: 'skipped' });
      continue;
    }

    try {
      const ingested = await ingestDocument(doc.id);
      results.push({
        id: doc.id,
        title: doc.title,
        status: ingested.document.ingestion_status,
        chunkCount: ingested.chunks.length,
      });
    } catch (err) {
      results.push({
        id: doc.id,
        title: doc.title,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Ingestion failed',
      });
    }
  }

  res.json({ results, stats: corpusStats() });
});

router.get('/:id', (req, res) => {
  const documentId = paramId(req.params.id);
  const doc = getDocument(documentId);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  if (!canViewDocument(req, doc)) {
    res.status(403).json({ error: 'Confidential documents require admin access' });
    return;
  }

  const preview = getIngestionPreview(documentId);
  res.json({
    ...serializeDocument(doc),
    text: preview.text
      ? {
          charCount: preview.text.char_count,
          extractedAt: preview.text.extracted_at,
        }
      : null,
    chunkPreviewCount: preview.chunks.length,
  });
});

router.get('/:id/preview', (req, res) => {
  const documentId = paramId(req.params.id);
  const doc = getDocument(documentId);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  if (!canViewDocument(req, doc)) {
    res.status(403).json({ error: 'Confidential documents require admin access' });
    return;
  }

  const text = getDocumentText(documentId);
  const isPdf = doc.mime_type === 'application/pdf' || Boolean(doc.file_name?.toLowerCase().endsWith('.pdf'));
  res.json({
    document: serializeDocument(doc),
    preview: text?.content ? text.content.slice(0, 500) : '',
    canPreviewPdf: isPdf,
    pdfUrl: isPdf ? `/api/documents/${doc.id}/file` : null,
  });
});

router.get('/:id/file', (req, res) => {
  const documentId = paramId(req.params.id);
  const doc = getDocument(documentId);
  if (!doc?.file_path) {
    res.status(404).json({ error: 'Document file not found' });
    return;
  }
  if (!canViewDocument(req, doc)) {
    res.status(403).json({ error: 'Confidential documents require admin access' });
    return;
  }

  res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${doc.file_name || doc.title}"`);
  createReadStream(doc.file_path).pipe(res);
});

router.patch('/:id', requireCorpusOperator, (req, res) => {
  const documentId = paramId(req.params.id);
  const { title, type, approval, sensitivity, sourceUrl } = req.body;
  if (approval && !['draft', 'approved', 'archived'].includes(approval)) {
    res.status(400).json({ error: 'approval must be draft, approved, or archived' });
    return;
  }

  const updated = updateDocumentMetadata(documentId, {
    title: typeof title === 'string' ? title : undefined,
    type: typeof type === 'string' ? type : undefined,
    approval,
    sensitivity: typeof sensitivity === 'string' ? sensitivity : undefined,
    sourceUrl: typeof sourceUrl === 'string' ? sourceUrl : undefined,
  });

  if (!updated) {
    res.status(404).json({ error: 'Document not found or no fields provided' });
    return;
  }

  logAuditEvent({
    userId: req.user?.id,
    action: 'document_permission_change',
    resourceType: 'document',
    resourceId: documentId,
    ipAddress: req.ip,
    success: true,
    details: { approval, sensitivity },
  });

  res.json(serializeDocument(getDocument(documentId)!));
});

router.delete('/:id', requireCorpusOperator, (req, res) => {
  const documentId = paramId(req.params.id);
  const updated = softDeleteDocument(documentId);
  logAuditEvent({
    userId: req.user?.id,
    action: 'document_delete',
    resourceType: 'document',
    resourceId: documentId,
    ipAddress: req.ip,
    success: updated,
    severity: updated ? 'warning' : 'error',
  });
  if (!updated) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.json({ id: documentId, deleted: true });
});

router.post('/:id/ingest', requireCorpusOperator, async (req, res) => {
  const documentId = paramId(req.params.id);
  try {
    const result = await ingestDocument(documentId);
    res.json({
      document: serializeDocument(result.document),
      text: {
        charCount: result.text.char_count,
        extractedAt: result.text.extracted_at,
      },
      chunks: result.chunks.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ingestion failed';
    res.status(400).json({ error: message });
  }
});

router.post('/:id/reindex', requireCorpusOperator, async (req, res) => {
  const documentId = paramId(req.params.id);
  try {
    const result = await ingestDocument(documentId);
    res.json({
      document: serializeDocument(result.document),
      chunks: result.chunks.length,
      indexedAt: result.document.indexed_at,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Reindex failed';
    res.status(400).json({ error: message });
  }
});

router.get('/:id/chunks', requireCorpusOperator, (req, res) => {
  const documentId = paramId(req.params.id);
  const doc = getDocument(documentId);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  if (!canViewDocument(req, doc)) {
    res.status(403).json({ error: 'Confidential documents require admin access' });
    return;
  }

  const text = getDocumentText(documentId);
  res.json({
    document: serializeDocument(doc),
    text: text
      ? {
          charCount: text.char_count,
          extractedAt: text.extracted_at,
        }
      : null,
    chunks: listDocumentChunks(documentId).map((chunk) => ({
      id: chunk.id,
      documentId: chunk.document_id,
      chunkIndex: chunk.chunk_index,
      content: chunk.content,
      section: chunk.section,
      charStart: chunk.char_start,
      charEnd: chunk.char_end,
      tokenEstimate: chunk.token_estimate,
      indexedAt: chunk.indexed_at,
      createdAt: chunk.created_at,
    })),
  });
});

router.patch('/:id/approval', requireCorpusOperator, (req, res) => {
  const documentId = paramId(req.params.id);
  const { approval } = req.body;
  if (!['draft', 'approved', 'archived'].includes(approval)) {
    res.status(400).json({ error: 'approval must be draft, approved, or archived' });
    return;
  }

  const updated = updateDocumentApproval(documentId, approval);
  if (!updated) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  logAuditEvent({
    userId: req.user?.id,
    action: 'document_permission_change',
    resourceType: 'document',
    resourceId: documentId,
    ipAddress: req.ip,
    success: true,
    details: { approval },
  });

  res.json({ id: documentId, approval });
});

export default router;
