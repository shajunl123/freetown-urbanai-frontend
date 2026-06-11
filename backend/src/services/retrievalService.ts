import db from '../db.js';
import type { PolicySource, RetrievalDebug, RetrievalResult } from '../types.js';
import { vectorSearch, isEmbeddingReady } from './embeddingService.js';

export interface RetrievalFilters {
  approvalStatuses?: Array<'draft' | 'approved' | 'archived'>;
  includeDrafts?: boolean;
  sensitivityLevels?: string[];
  documentIds?: string[];
  limit?: number;
  maxPerDocument?: number;
}

interface RetrievalRow {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  documentType: string | null;
  chunkIndex: number;
  content: string;
  section: string | null;
  page: number | null;
  approvalStatus: string;
  sensitivityLevel: string;
  score: number;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function normalizeQuery(query: string): {
  normalizedQuery: string;
  terms: string[];
  ftsQuery: string;
} {
  const normalizedQuery = normalizeWhitespace(query.toLowerCase());
  const terms = Array.from(
    new Set(normalizedQuery.match(/[a-z0-9]+/g)?.filter((term) => term.length > 2) ?? [])
  ).slice(0, 10);

  return {
    normalizedQuery,
    terms,
    ftsQuery: terms.map((term) => `"${term}"`).join(' OR '),
  };
}

function snippetFor(content: string, terms: string[]): string {
  const lower = content.toLowerCase();
  const firstHit = terms
    .map((term) => lower.indexOf(term))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  const start = Math.max(0, (firstHit ?? 0) - 140);
  const end = Math.min(content.length, start + 360);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < content.length ? '...' : '';
  return `${prefix}${content.slice(start, end).trim()}${suffix}`;
}

function heuristicBoost(row: RetrievalRow, terms: string[]): { adjustedScore: number; rankReason: string } {
  let adjustedScore = row.score;
  const reasons: string[] = [`fts=${row.score.toFixed(3)}`];
  const title = row.documentTitle.toLowerCase();
  const section = row.section?.toLowerCase() ?? '';
  const content = row.content.toLowerCase();

  for (const term of terms) {
    if (title.includes(term)) {
      adjustedScore -= 0.4;
      reasons.push(`title:${term}`);
    }
    if (section.includes(term)) {
      adjustedScore -= 0.2;
      reasons.push(`section:${term}`);
    }
    if (content.includes(term)) {
      adjustedScore -= 0.05;
    }
  }

  if (row.approvalStatus === 'approved') {
    adjustedScore -= 0.25;
    reasons.push('approved');
  }

  if (row.chunkIndex === 0) {
    adjustedScore -= 0.1;
    reasons.push('opening_chunk');
  }

  return {
    adjustedScore,
    rankReason: reasons.join(', '),
  };
}

function buildWhereClause(filters: Required<Pick<RetrievalFilters, 'approvalStatuses' | 'sensitivityLevels' | 'documentIds'>>) {
  const clauses = [`d.ingestion_status = 'indexed'`];
  const values: unknown[] = [];

  if (filters.approvalStatuses.length > 0) {
    clauses.push(`d.approval_status IN (${filters.approvalStatuses.map(() => '?').join(', ')})`);
    values.push(...filters.approvalStatuses);
  }

  if (filters.sensitivityLevels.length > 0) {
    clauses.push(`d.sensitivity_level IN (${filters.sensitivityLevels.map(() => '?').join(', ')})`);
    values.push(...filters.sensitivityLevels);
  }

  if (filters.documentIds.length > 0) {
    clauses.push(`d.id IN (${filters.documentIds.map(() => '?').join(', ')})`);
    values.push(...filters.documentIds);
  }

  return { whereSql: clauses.join(' AND '), values };
}

function dedupeResults(results: RetrievalResult[], maxPerDocument: number): RetrievalResult[] {
  const perDocument = new Map<string, number>();
  const snippets = new Set<string>();
  const deduped: RetrievalResult[] = [];

  for (const result of results) {
    const used = perDocument.get(result.documentId) ?? 0;
    const snippetKey = result.snippet.toLowerCase();
    if (used >= maxPerDocument || snippets.has(snippetKey)) {
      continue;
    }

    perDocument.set(result.documentId, used + 1);
    snippets.add(snippetKey);
    deduped.push(result);
  }

  return deduped;
}

// FTS5-only retrieval (sync, fallback)
export function retrieveEvidence(
  query: string,
  filters: RetrievalFilters = {}
): RetrievalResult[] {
  const { terms, ftsQuery } = normalizeQuery(query);
  if (!ftsQuery) return [];

  const approvalStatuses =
    filters.approvalStatuses ?? (filters.includeDrafts ? ['approved', 'draft'] : ['approved']);
  const sensitivityLevels = filters.sensitivityLevels ?? ['public', 'internal'];
  const documentIds = filters.documentIds ?? [];
  const limit = filters.limit ?? 6;
  const maxPerDocument = filters.maxPerDocument ?? 2;
  const { whereSql, values } = buildWhereClause({
    approvalStatuses,
    sensitivityLevels,
    documentIds,
  });

  const rawRows = db
    .prepare(
      `SELECT
         c.id AS chunkId,
         c.document_id AS documentId,
         d.title AS documentTitle,
         d.type AS documentType,
         c.chunk_index AS chunkIndex,
         c.content AS content,
         c.section AS section,
         c.page AS page,
         d.approval_status AS approvalStatus,
         d.sensitivity_level AS sensitivityLevel,
         bm25(chunks_fts, 1.5, 1.0) AS score
       FROM chunks_fts
       JOIN chunks c ON c.rowid = chunks_fts.rowid
       JOIN documents d ON d.id = c.document_id
       WHERE chunks_fts MATCH ?
         AND ${whereSql}
       ORDER BY score ASC
       LIMIT ?`
    )
    .all(ftsQuery, ...values, Math.max(limit * 4, 12)) as RetrievalRow[];

  const rescored = rawRows
    .map((row) => {
      const { adjustedScore, rankReason } = heuristicBoost(row, terms);
      return {
        chunkId: row.chunkId,
        documentId: row.documentId,
        documentTitle: row.documentTitle,
        documentType: row.documentType,
        chunkIndex: row.chunkIndex,
        content: row.content,
        section: row.section ?? undefined,
        page: typeof row.page === 'number' ? row.page : undefined,
        approvalStatus: row.approvalStatus,
        sensitivityLevel: row.sensitivityLevel,
        snippet: snippetFor(row.content, terms),
        score: adjustedScore,
        rankReason,
      } satisfies RetrievalResult;
    })
    .sort((a, b) => a.score - b.score || a.chunkIndex - b.chunkIndex);

  return dedupeResults(rescored, maxPerDocument).slice(0, limit);
}

// Hybrid retrieval: FTS5 + vector (async)
export async function retrieveEvidenceHybrid(
  query: string,
  filters: RetrievalFilters = {}
): Promise<RetrievalResult[]> {
  const { terms, ftsQuery } = normalizeQuery(query);
  if (!ftsQuery) return [];

  const approvalStatuses =
    filters.approvalStatuses ?? (filters.includeDrafts ? ['approved', 'draft'] : ['approved']);
  const sensitivityLevels = filters.sensitivityLevels ?? ['public', 'internal'];
  const documentIds = filters.documentIds ?? [];
  const limit = filters.limit ?? 6;
  const maxPerDocument = filters.maxPerDocument ?? 2;

  // Run FTS5 search (existing)
  const ftsResults = retrieveEvidence(query, filters);

  // Run vector search if vocabulary is built
  let vectorResults: RetrievalResult[] = [];
  if (isEmbeddingReady()) {
    try {
      const rawVectorResults = vectorSearch(query, {
        approvalStatuses: approvalStatuses as string[],
        sensitivityLevels,
        limit: limit * 3,
      });

      vectorResults = rawVectorResults.map(vr => ({
        chunkId: vr.chunkId,
        documentId: vr.documentId,
        documentTitle: vr.documentTitle,
        documentType: vr.documentType,
        chunkIndex: vr.chunkIndex,
        content: vr.content,
        section: vr.section ?? undefined,
        page: typeof vr.page === 'number' ? vr.page : undefined,
        approvalStatus: vr.approvalStatus,
        sensitivityLevel: vr.sensitivityLevel,
        snippet: snippetFor(vr.content, terms),
        score: -vr.score, // Negate so lower = better (matches FTS5 convention)
        rankReason: `tfidf=${vr.score.toFixed(3)}`,
      }));
    } catch (err) {
      console.warn('[retrieval] Vector search failed, falling back to FTS5 only:', err);
    }
  }

  // Merge: combine scores from both sources
  const allResults = new Map<string, RetrievalResult>();

  // Add FTS5 results (score is negative BM25, lower = better)
  for (const r of ftsResults) {
    allResults.set(r.chunkId, { ...r, rankReason: r.rankReason });
  }

  // Merge vector results (score is negated TF-IDF similarity, lower = better)
  for (const vr of vectorResults) {
    const existing = allResults.get(vr.chunkId);
    if (existing) {
      // Both found this chunk — combine scores
      // FTS5 score: negative, typically -10 to 0 (lower = better)
      // Vector score: negative, typically -1 to 0 (lower = better)
      // Normalize both to 0-1 range and combine
      const ftsNorm = 1 / (1 + Math.abs(existing.score));
      const vecNorm = 1 / (1 + Math.abs(vr.score));
      const combined = 0.4 * ftsNorm + 0.6 * vecNorm;
      existing.score = -combined;
      existing.rankReason = `${existing.rankReason} + tfidf=${(-vr.score).toFixed(3)} → hybrid`;
    } else {
      // Only vector found this chunk
      allResults.set(vr.chunkId, vr);
    }
  }

  // Sort by combined score (lower = better) and dedupe
  const merged = Array.from(allResults.values())
    .sort((a, b) => a.score - b.score || a.chunkIndex - b.chunkIndex);

  return dedupeResults(merged, maxPerDocument).slice(0, limit);
}

export function retrievalSources(results: RetrievalResult[]): PolicySource[] {
  return results.map((result) => ({
    title: result.documentTitle,
    type: result.documentType || undefined,
    section: result.section,
    page: result.page,
    confidence: result.approvalStatus === 'approved' ? 'high' : 'medium',
    documentId: result.documentId,
    chunkId: result.chunkId,
    chunkIndex: result.chunkIndex,
    snippet: result.snippet,
    approvalStatus: result.approvalStatus,
    sensitivityLevel: result.sensitivityLevel,
    retrievalScore: Number(result.score.toFixed(3)),
  }));
}

export function debugRetrieval(query: string, filters: RetrievalFilters = {}): RetrievalDebug {
  const normalized = normalizeQuery(query);
  const results = retrieveEvidence(query, filters);

  return {
    originalQuery: query,
    normalizedQuery: normalized.normalizedQuery,
    terms: normalized.terms,
    ftsQuery: normalized.ftsQuery,
    filters: {
      approvalStatuses:
        filters.approvalStatuses ?? (filters.includeDrafts ? ['approved', 'draft'] : ['approved']),
      includeDrafts: filters.includeDrafts ?? false,
      sensitivityLevels: filters.sensitivityLevels ?? ['public', 'internal'],
      documentIds: filters.documentIds ?? [],
      limit: filters.limit ?? 6,
      maxPerDocument: filters.maxPerDocument ?? 2,
    },
    results,
  };
}
