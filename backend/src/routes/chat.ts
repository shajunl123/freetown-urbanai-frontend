import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ensureSession, saveMessage } from '../services/sessionManager.js';
import { logRequest } from '../services/requestLogger.js';
import { getPolicyAnswerFromUpstream } from '../services/upstreamPolicyService.js';
import { retrieveEvidenceHybrid } from '../services/retrievalService.js';
import { composePolicyAnswer } from '../services/answerComposerService.js';
import type { PolicyIntelligenceMode } from '../types.js';

const router = Router();

const VALID_MODES: PolicyIntelligenceMode[] = [
  'briefing',
  'qa',
  'claim_check',
  'evidence_lookup',
];

router.post('/', async (req, res) => {
  const startedAt = Date.now();

  try {
    const {
      sessionId: rawSessionId,
      prompt: rawPrompt,
      chatInput,
      mode: rawMode,
    } = req.body;
    const prompt = typeof rawPrompt === 'string' ? rawPrompt : chatInput;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }

    const sessionId = typeof rawSessionId === 'string' ? rawSessionId : uuidv4();
    const mode: PolicyIntelligenceMode =
      VALID_MODES.includes(rawMode) ? rawMode : 'briefing';
    const trimmedPrompt = prompt.trim();

    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    ensureSession(sessionId, req.user.id);
    saveMessage(sessionId, 'user', trimmedPrompt, mode);

    const retrievedEvidence = await retrieveEvidenceHybrid(trimmedPrompt, { limit: 5 });

    const upstreamResponse = await getPolicyAnswerFromUpstream({
        sessionId,
        prompt: trimmedPrompt,
        mode,
        evidence: retrievedEvidence,
      });
    const response = composePolicyAnswer({
      mode,
      evidence: retrievedEvidence,
      upstreamResponse,
    });

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

    res.json(response);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    console.error('[chat] error:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
