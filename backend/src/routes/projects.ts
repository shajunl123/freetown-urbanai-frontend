import { Router } from 'express';
import { requireCorpusOperator } from '../middleware/auth.js';
import { logAuditEvent } from '../services/auditService.js';
import {
  archiveProject,
  createProject,
  getProject,
  listProjectDocuments,
  listProjects,
  syncProjectDocumentLinks,
  updateProject,
} from '../services/projectService.js';

const router = Router();

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function serializeProjectDocument(doc: ReturnType<typeof listProjectDocuments>[number]) {
  return {
    id: doc.id,
    title: doc.title,
    type: doc.type,
    sensitivity: doc.sensitivity,
    approval: doc.approval,
    sensitivityLevel: doc.sensitivity_level,
    approvalStatus: doc.approval_status,
    ingestionStatus: doc.ingestion_status,
    chunkCount: doc.chunk_count,
    sourceUrl: doc.source_url,
    fileName: doc.file_name,
    updatedAt: doc.updated_at,
    indexedAt: doc.indexed_at,
  };
}

router.get('/', (_req, res) => {
  syncProjectDocumentLinks();
  res.json(listProjects());
});

router.get('/:id', (req, res) => {
  const project = getProject(paramId(req.params.id));
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  res.json(project);
});

router.post('/', requireCorpusOperator, (req, res) => {
  if (!req.body?.name || typeof req.body.name !== 'string') {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const project = createProject(req.body);
  logAuditEvent({
    userId: req.user?.id,
    action: 'project_create',
    resourceType: 'project',
    resourceId: project.id,
    ipAddress: req.ip,
    success: true,
    details: { slug: project.slug, status: project.status },
  });
  res.status(201).json(project);
});

router.patch('/:id', requireCorpusOperator, (req, res) => {
  const project = updateProject(paramId(req.params.id), req.body ?? {});
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  logAuditEvent({
    userId: req.user?.id,
    action: 'project_update',
    resourceType: 'project',
    resourceId: project.id,
    ipAddress: req.ip,
    success: true,
    details: { slug: project.slug, status: project.status },
  });
  res.json(project);
});

router.delete('/:id', requireCorpusOperator, (req, res) => {
  const success = archiveProject(paramId(req.params.id));
  logAuditEvent({
    userId: req.user?.id,
    action: 'project_archive',
    resourceType: 'project',
    resourceId: paramId(req.params.id),
    ipAddress: req.ip,
    success,
    severity: success ? 'warning' : 'error',
  });
  if (!success) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  res.json({ archived: true });
});

router.get('/:id/documents', (req, res) => {
  const project = getProject(paramId(req.params.id));
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  const docs = listProjectDocuments(project.id);
  res.json({
    project,
    documents: docs.map(serializeProjectDocument),
  });
});

export default router;
