import type { AnthropicProviderConfig, ProviderOutput, ProviderRequest } from './types.js';

function buildSystemPrompt() {
  return [
    'You are the model layer for a Mayor\'s Office Policy Intelligence Pilot.',
    'Use the supplied retrieved evidence carefully and do not invent citations.',
    'Return JSON only.',
    'The JSON object should follow this shape:',
    '{"answer":"string","mode":"briefing|qa|claim_check|evidence_lookup","caveats":["string"],"claimSafety":{"level":"firm|careful|not_ready","explanation":"string"}}',
    'Do not include markdown fences.',
  ].join(' ');
}

function buildUserPrompt(request: ProviderRequest): string {
  const evidenceBlock =
    request.evidence.length > 0
      ? request.evidence
          .slice(0, 5)
          .map((item, index) => {
            const section = item.section ? ` | section: ${item.section}` : '';
            return `${index + 1}. ${item.documentTitle}${section}\nSnippet: ${item.snippet}\nApproval: ${item.approvalStatus}; Sensitivity: ${item.sensitivityLevel}`;
          })
          .join('\n\n')
      : 'No local evidence matched this request.';

  return [
    `Mode: ${request.mode}`,
    `User request: ${request.prompt}`,
    'Retrieved evidence:',
    evidenceBlock,
    'Write a bounded, source-grounded response. If evidence is insufficient, say so clearly and set claimSafety to careful or not_ready as appropriate.',
  ].join('\n\n');
}

function extractAnthropicText(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return value
    .map((item) => {
      if (
        typeof item === 'object' &&
        item !== null &&
        (item as { type?: unknown }).type === 'text' &&
        typeof (item as { text?: unknown }).text === 'string'
      ) {
        return (item as { text: string }).text;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

export async function invokeAnthropicProvider(
  config: AnthropicProviderConfig,
  request: ProviderRequest
): Promise<ProviderOutput> {
  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': config.anthropicVersion,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens ?? 800,
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: buildUserPrompt(request) }],
    }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  const bodyText = await response.text().catch(() => '');
  if (!response.ok) {
    throw new Error(`Anthropic provider failed (${response.status}): ${bodyText}`);
  }

  if (!bodyText.trim()) {
    return {
      providerType: 'anthropic',
      model: config.model,
      raw: null,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new Error('Anthropic provider returned non-JSON output.');
  }

  const raw = extractAnthropicText((parsed as { content?: unknown }).content);

  return {
    providerType: 'anthropic',
    model: config.model,
    raw: raw || bodyText,
  };
}
