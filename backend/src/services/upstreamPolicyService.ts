import { invokeAnthropicProvider } from '../providers/anthropicProvider.js';
import { describeProviderConfig, resolveProviderConfig } from '../providers/config.js';
import { invokeLegacyN8nProvider } from '../providers/legacyN8nProvider.js';
import { invokeOpenAICompatibleProvider } from '../providers/openaiCompatibleProvider.js';
import { logRequest } from './requestLogger.js';
import { securitySettings } from './securityConfig.js';
import type {
  ProviderOutput,
  ProviderRequest,
  ProviderStatus,
} from '../providers/types.js';
import type {
  ClaimSafety,
  PolicyIntelligenceMode,
  PolicyIntelligenceResponse,
  PolicySource,
} from '../types.js';

const VALID_MODES: PolicyIntelligenceMode[] = [
  'briefing',
  'qa',
  'claim_check',
  'evidence_lookup',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeSources(value: unknown): PolicySource[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const sources = value.filter(isRecord).map((source) => {
    const confidence: PolicySource['confidence'] =
      source.confidence === 'high' ||
      source.confidence === 'medium' ||
      source.confidence === 'low'
        ? source.confidence
        : undefined;

    return {
      title: typeof source.title === 'string' ? source.title : 'Untitled source',
      type: typeof source.type === 'string' ? source.type : undefined,
      page:
        typeof source.page === 'string' || typeof source.page === 'number'
          ? source.page
          : undefined,
      section: typeof source.section === 'string' ? source.section : undefined,
      url: typeof source.url === 'string' ? source.url : undefined,
      confidence,
      documentId: typeof source.documentId === 'string' ? source.documentId : undefined,
      chunkId: typeof source.chunkId === 'string' ? source.chunkId : undefined,
      chunkIndex: typeof source.chunkIndex === 'number' ? source.chunkIndex : undefined,
      snippet: typeof source.snippet === 'string' ? source.snippet : undefined,
      approvalStatus:
        typeof source.approvalStatus === 'string' ? source.approvalStatus : undefined,
      sensitivityLevel:
        typeof source.sensitivityLevel === 'string' ? source.sensitivityLevel : undefined,
      retrievalScore:
        typeof source.retrievalScore === 'number' ? source.retrievalScore : undefined,
    };
  });

  return sources.length > 0 ? sources : undefined;
}

function normalizeCaveats(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const caveats = value.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0
  );
  return caveats.length > 0 ? caveats : undefined;
}

function normalizeClaimSafety(value: unknown): ClaimSafety | undefined {
  if (!isRecord(value)) return undefined;
  if (
    value.level !== 'firm' &&
    value.level !== 'careful' &&
    value.level !== 'not_ready'
  ) {
    return undefined;
  }

  return {
    level: value.level,
    explanation:
      typeof value.explanation === 'string' ? value.explanation : undefined,
  };
}

function stripCodeFence(text: string): string {
  const fenced = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : text.trim();
}

function maybeParseStructuredPayload(raw: string): unknown {
  const candidate = stripCodeFence(raw);
  try {
    return JSON.parse(candidate);
  } catch {
    return raw;
  }
}

export function normalizePolicyResponse(
  data: unknown,
  fallbackMode: PolicyIntelligenceMode
): PolicyIntelligenceResponse {
  if (typeof data === 'string') {
    return {
      answer: data.trim() || 'No answer text returned.',
      mode: fallbackMode,
    };
  }

  if (!isRecord(data)) {
    return {
      answer: 'No response from configured model provider.',
      mode: fallbackMode,
      claimSafety: {
        level: 'not_ready',
        explanation: 'The configured provider returned no usable data.',
      },
    };
  }

  const nested =
    isRecord(data.data) ? data.data :
    isRecord(data.result) ? data.result :
    isRecord(data.output) ? data.output :
    data;

  const answer =
    (typeof nested.answer === 'string' && nested.answer.trim()) ||
    (typeof nested.text === 'string' && nested.text.trim()) ||
    (typeof nested.response === 'string' && nested.response.trim()) ||
    (typeof nested.output === 'string' && nested.output.trim()) ||
    (typeof nested.result === 'string' && nested.result.trim()) ||
    (typeof nested.message === 'string' && nested.message.trim()) ||
    'No answer text returned.';

  const mode = VALID_MODES.includes(nested.mode as PolicyIntelligenceMode)
    ? (nested.mode as PolicyIntelligenceMode)
    : fallbackMode;

  return {
    answer,
    mode,
    sources: normalizeSources(nested.sources ?? nested.citations),
    caveats: normalizeCaveats(nested.caveats),
    claimSafety: normalizeClaimSafety(nested.claimSafety ?? nested.claim_safety),
  };
}

function providerUnavailableResponse(
  mode: PolicyIntelligenceMode,
  status: ProviderStatus,
  errorMessage?: string
): PolicyIntelligenceResponse {
  const missingDetail =
    status.missing.length > 0 ? ` Missing: ${status.missing.join(', ')}.` : '';
  const errorDetail = errorMessage ? ` ${errorMessage}` : '';

  return {
    answer:
      `The direct model provider is not currently available for this ${mode.replace('_', ' ')} request. ` +
      'The backend will continue with retrieval-backed support only.',
    mode,
    caveats: [
      `Provider status: ${status.type}.${missingDetail}${errorDetail}`.trim(),
      'No direct model synthesis was attached to this response.',
    ],
    claimSafety: {
      level: 'careful',
      explanation:
        'The provider layer is unavailable or incomplete, so only backend retrieval support should be relied on.',
    },
  };
}

async function invokeConfiguredProvider(
  request: ProviderRequest
): Promise<ProviderOutput | null> {
  const config = resolveProviderConfig();

  switch (config.type) {
    case 'none':
      return null;
    case 'openai_compatible':
    case 'nvidia':
      if (!config.model || !config.apiKey) return null;
      return invokeOpenAICompatibleProvider(config, request);
    case 'anthropic':
      if (!config.model || !config.apiKey) return null;
      return invokeAnthropicProvider(config, request);
    case 'legacy_n8n':
      return invokeLegacyN8nProvider(config, request);
    default:
      return null;
  }
}

async function invokeConfiguredProviderWithRetry(
  request: ProviderRequest
): Promise<ProviderOutput | null> {
  const attempts = Math.max(1, securitySettings().providerRetryCount);
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await invokeConfiguredProvider(request);
    } catch (error) {
      lastError = error;
      logRequest({
        sessionId: request.sessionId,
        action: 'model_error',
        mode: request.mode,
        query: request.prompt,
        responseJson: JSON.stringify({
          attempt,
          message: error instanceof Error ? error.message : 'Provider request failed.',
        }),
      });
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Provider request failed.');
}

export async function getPolicyAnswerFromUpstream(
  request: ProviderRequest
): Promise<PolicyIntelligenceResponse | null> {
  const providerStatus = getModelProviderStatus();
  if (providerStatus.type === 'none') return null;
  if (!providerStatus.configured) {
    return providerUnavailableResponse(request.mode, providerStatus);
  }

  let providerOutput: ProviderOutput | null;
  try {
    providerOutput = await invokeConfiguredProviderWithRetry(request);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Provider request failed.';
    return providerUnavailableResponse(request.mode, providerStatus, message);
  }

  if (!providerOutput) return null;
  if (!providerOutput.raw?.trim()) {
    return normalizePolicyResponse(null, request.mode);
  }

  return normalizePolicyResponse(
    maybeParseStructuredPayload(providerOutput.raw),
    request.mode
  );
}

export function getModelProviderStatus(): ProviderStatus {
  return describeProviderConfig();
}
