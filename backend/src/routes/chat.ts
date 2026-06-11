import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ensureSession, saveMessage } from '../services/sessionManager.js';
import { logRequest } from '../services/requestLogger.js';
import { getPolicyAnswerFromUpstream } from '../services/upstreamPolicyService.js';
import { retrieveEvidenceHybrid } from '../services/retrievalService.js';
import { composePolicyAnswer } from '../services/answerComposerService.js';
import { inspectContent, inspectPrompt, validateModelOutput } from '../services/aiSafetyService.js';
import { logAuditEvent } from '../services/auditService.js';
import { requireQueryRateLimit } from '../middleware/rateLimit.js';
import { getProjectDocumentIds, getProjectsByIds } from '../services/projectService.js';
import type { PolicyIntelligenceMode } from '../types.js';

const router = Router();

const VALID_MODES: PolicyIntelligenceMode[] = [
  'briefing',
  'qa',
  'claim_check',
  'evidence_lookup',
];

router.post('/', requireQueryRateLimit, async (req, res) => {
  const startedAt = Date.now();

  try {
    const {
      sessionId: rawSessionId,
      prompt: rawPrompt,
      chatInput,
      mode: rawMode,
      projectIds: rawProjectIds,
    } = req.body;
    const prompt = typeof rawPrompt === 'string' ? rawPrompt : chatInput;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }

    const sessionId = typeof rawSessionId === 'string' ? rawSessionId : uuidv4();
    const mode: PolicyIntelligenceMode =
      VALID_MODES.includes(rawMode) ? rawMode : 'briefing';
    const promptInspection = inspectPrompt(prompt.trim());
    const contentInspection = inspectContent(promptInspection.sanitized);
    const trimmedPrompt = promptInspection.sanitized.trim();
    const projectIds = Array.isArray(rawProjectIds)
      ? rawProjectIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];
    const selectedProjects = getProjectsByIds(projectIds);
    const selectedProjectNames = selectedProjects.map((project) => project.name);
    const projectDocumentIds = getProjectDocumentIds(projectIds);
    const retrievalQuery =
      selectedProjectNames.length > 0
        ? `${selectedProjectNames.join(' ')} ${trimmedPrompt}`
        : trimmedPrompt;

    if (promptInspection.suspicious) {
      logAuditEvent({
        userId: req.user?.id,
        action: 'suspicious_prompt',
        resourceType: 'chat',
        ipAddress: req.ip,
        success: false,
        severity: 'warning',
        details: { reasons: promptInspection.reasons },
      });
    }

    if (contentInspection.blocked) {
      logAuditEvent({
        userId: req.user?.id,
        action: 'content_filter_block',
        resourceType: 'chat',
        ipAddress: req.ip,
        success: false,
        severity: 'warning',
        details: { hits: contentInspection.hits },
      });
      res.status(400).json({ error: 'Request blocked by configured content policy.' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    ensureSession(sessionId, req.user.id);
    saveMessage(sessionId, 'user', trimmedPrompt, mode);

    const sensitivityLevels =
      req.user.role === 'admin'
        ? ['public', 'internal', 'confidential']
        : ['public', 'internal'];

    const retrievedEvidence = await retrieveEvidenceHybrid(retrievalQuery, {
      limit: 5,
      sensitivityLevels,
      documentIds: projectDocumentIds.length > 0 ? projectDocumentIds : undefined,
    });

    const upstreamResponse = await getPolicyAnswerFromUpstream({
        sessionId,
        prompt:
          selectedProjectNames.length > 0
            ? `[Selected FCC portfolio project context: ${selectedProjectNames.join(', ')}]\n\n${trimmedPrompt}`
            : trimmedPrompt,
        mode,
        evidence: retrievedEvidence,
      });
    const response = validateModelOutput(composePolicyAnswer({
      mode,
      evidence: retrievedEvidence,
      upstreamResponse,
    }), retrievedEvidence);

    const latencyMs = Date.now() - startedAt;

    // Save the model response
    saveMessage(
      sessionId,
      'model',
      response.answer,
      response.mode,
      response.sources ? JSON.stringify(response.sources) : undefined,
      response.claimSafety ? JSON.stringify(response.claimSafety) : undefined
    );

    // Log the request
    logRequest({
      sessionId,
      userId: req.user.id,
      action: 'chat',
      mode,
      query: trimmedPrompt,
      responseJson: JSON.stringify(response),
      sourcesJson: response.sources ? JSON.stringify(response.sources) : undefined,
      claimSafety: response.claimSafety
        ? JSON.stringify(response.claimSafety)
        : undefined,
      latencyMs,
    });

    logAuditEvent({
      userId: req.user.id,
      action: 'query_history',
      resourceType: 'chat',
      resourceId: sessionId,
      ipAddress: req.ip,
      success: true,
      details: {
        mode,
        sourceCount: response.sources?.length ?? 0,
        projectIds,
        projectDocumentCount: projectDocumentIds.length,
      },
    });

    res.json(response);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    console.error('[chat] error:', message);
    logAuditEvent({
      userId: req.user?.id,
      action: 'chat_failed',
      resourceType: 'chat',
      ipAddress: req.ip,
      success: false,
      severity: 'error',
      details: { message },
    });
    res.status(500).json({ error: message });
  }
});

export default router;
