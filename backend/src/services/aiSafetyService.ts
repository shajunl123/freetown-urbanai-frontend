import type { PolicyIntelligenceResponse, RetrievalResult } from '../types.js';
import { securitySettings } from './securityConfig.js';

const injectionPatterns = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /system\s+prompt/i,
  /developer\s+message/i,
  /reveal\s+(the\s+)?prompt/i,
  /bypass\s+(policy|safety|guardrails?)/i,
  /act\s+as\s+(an?\s+)?unrestricted/i,
];

export function inspectPrompt(prompt: string): { suspicious: boolean; reasons: string[]; sanitized: string } {
  const reasons = injectionPatterns
    .filter((pattern) => pattern.test(prompt))
    .map((pattern) => pattern.source);

  let sanitized = prompt;
  if (securitySettings().promptGuardEnabled) {
    sanitized = sanitized
      .replace(/ignore\s+(all\s+)?previous\s+instructions/gi, '[filtered instruction override]')
      .replace(/reveal\s+(the\s+)?prompt/gi, '[filtered prompt extraction]');
  }

  return { suspicious: reasons.length > 0, reasons, sanitized };
}

export function inspectContent(text: string): { blocked: boolean; hits: string[] } {
  const raw = process.env.CONTENT_FILTER_BLACKLIST?.trim();
  const terms = raw ? raw.split(',').map((term) => term.trim()).filter(Boolean) : [];
  const lower = text.toLowerCase();
  const hits = terms.filter((term) => lower.includes(term.toLowerCase()));
  return { blocked: securitySettings().contentFilterEnabled && hits.length > 0, hits };
}

export function validateModelOutput(
  response: PolicyIntelligenceResponse,
  evidence: RetrievalResult[]
): PolicyIntelligenceResponse {
  if (!securitySettings().outputGuardEnabled) return response;

  const caveats = [...(response.caveats ?? [])];
  let claimSafety = response.claimSafety;

  const hasSources = evidence.length > 0 || (response.sources?.length ?? 0) > 0;
  if (!hasSources) {
    caveats.push('Output is unverified because no source citation was attached.');
    claimSafety = {
      level: 'not_ready',
      explanation: 'The response did not include retrievable source support.',
    };
  }

  const confidentialLeak = /confidential|do not distribute|restricted/i.test(response.answer);
  if (confidentialLeak) {
    caveats.push('Potential sensitive-language exposure detected; review before use.');
    claimSafety = {
      level: 'careful',
      explanation: 'Sensitive language was detected in the generated output.',
    };
  }

  return {
    ...response,
    caveats: caveats.length > 0 ? Array.from(new Set(caveats)) : response.caveats,
    claimSafety,
  };
}
