import type { OpenAICompatibleProviderConfig, ProviderOutput, ProviderRequest } from './types.js';

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

function extractMessageContent(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (
          typeof item === 'object' &&
          item !== null &&
          'text' in item &&
          typeof (item as { text?: unknown }).text === 'string'
        ) {
          return (item as { text: string }).text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

export async function invokeOpenAICompatibleProvider(
  config: OpenAICompatibleProviderConfig,
  request: ProviderRequest
): Promise<ProviderOutput> {
  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(request) },
      ],
    }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  const bodyText = await response.text().catch(() => '');
  if (!response.ok) {
    throw new Error(`OpenAI-compatible provider failed (${response.status}): ${bodyText}`);
  }

  if (!bodyText.trim()) {
    return {
      providerType: 'openai_compatible',
      model: config.model,
      raw: null,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new Error('OpenAI-compatible provider returned non-JSON output.');
  }

  const choice = Array.isArray((parsed as { choices?: unknown[] }).choices)
    ? (parsed as { choices: Array<{ message?: { content?: unknown } }> }).choices[0]
    : undefined;
  const raw = extractMessageContent(choice?.message?.content);

  return {
    providerType: 'openai_compatible',
    model: config.model,
    raw: raw || bodyText,
  };
}
