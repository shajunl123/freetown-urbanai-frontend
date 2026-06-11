import type {
  PolicyIntelligenceMode,
  PolicyIntelligenceResponse,
  PolicySource,
  RetrievalResult,
} from '../types.js';
import { retrievalSources } from './retrievalService.js';

function dedupeSources(sources: PolicySource[]): PolicySource[] {
  const seen = new Set<string>();
  const deduped: PolicySource[] = [];

  for (const source of sources) {
    const key = `${source.documentId ?? source.title}:${source.chunkId ?? source.chunkIndex ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(source);
  }

  return deduped;
}

function retrievalSummary(mode: PolicyIntelligenceMode, evidence: RetrievalResult[]): string {
  const label = mode.replace('_', ' ');
  const lines = evidence.slice(0, 3).map((item, index) => {
    const heading = item.section ? ` (${item.section})` : '';
    return `${index + 1}. ${item.documentTitle}${heading}: ${item.snippet}`;
  });

  return [
    `Local corpus evidence was retrieved for this ${label} request.`,
    'Relevant excerpts:',
    lines.join('\n'),
  ].join('\n\n');
}

export function composePolicyAnswer(params: {
  mode: PolicyIntelligenceMode;
  evidence: RetrievalResult[];
  upstreamResponse?: PolicyIntelligenceResponse | null;
}): PolicyIntelligenceResponse {
  const { mode, evidence, upstreamResponse } = params;
  const evidenceSources = retrievalSources(evidence);

  if (upstreamResponse) {
    const sources = dedupeSources([...(upstreamResponse.sources ?? []), ...evidenceSources]);
    const caveats = [
      ...(upstreamResponse.caveats ?? []),
      ...(evidence.length > 0
        ? ['Retrieved corpus excerpts were attached by the backend and should be checked before external use.']
        : ['No local corpus evidence was attached to this answer.']),
    ];

    return {
      ...upstreamResponse,
      mode,
      sources,
      caveats: Array.from(new Set(caveats)),
      claimSafety: upstreamResponse.claimSafety ?? {
        level: evidence.length > 0 ? 'careful' : 'not_ready',
        explanation:
          evidence.length > 0
            ? 'The answer includes retrieved evidence, but wording should still be checked against source material.'
            : 'No local evidence was attached to support this answer.',
      },
    };
  }

  if (evidence.length > 0) {
    return {
      answer: retrievalSummary(mode, evidence),
      mode,
      sources: evidenceSources,
      caveats: [
        'This response is based on locally retrieved excerpts, not a generated synthesis.',
        'Use the attached snippets as briefing support and confirm wording before any external claim.',
      ],
      claimSafety: {
        level: 'careful',
        explanation:
          'Relevant approved corpus evidence was found, but no upstream synthesis was applied.',
      },
    };
  }

  return {
    answer:
      'Backend policy boundary is active, but no local corpus evidence matched this request and no upstream answer source is configured.',
    mode,
    sources: [],
    caveats: [
      'No local evidence was retrieved for this query.',
      'Add or ingest approved pilot documents before relying on the system for source-grounded briefing support.',
    ],
    claimSafety: {
      level: 'not_ready',
      explanation: 'There is no retrieval-backed evidence attached to this response.',
    },
  };
}
