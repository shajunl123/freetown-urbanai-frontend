import type { LegacyN8nProviderConfig, ProviderOutput, ProviderRequest } from './types.js';

export async function invokeLegacyN8nProvider(
  config: LegacyN8nProviderConfig,
  request: ProviderRequest
): Promise<ProviderOutput> {
  const response = await fetch(config.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: request.sessionId,
      action: 'sendMessage',
      chatInput: request.prompt,
      prompt: request.prompt,
      mode: request.mode,
      retrievedEvidence: request.evidence.map((item) => ({
        documentTitle: item.documentTitle,
        chunkIndex: item.chunkIndex,
        section: item.section,
        snippet: item.snippet,
      })),
    }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  const bodyText = await response.text().catch(() => '');
  if (!response.ok) {
    throw new Error(`Legacy n8n provider failed (${response.status}): ${bodyText}`);
  }

  return {
    providerType: 'legacy_n8n',
    raw: bodyText.trim() ? bodyText : null,
  };
}
