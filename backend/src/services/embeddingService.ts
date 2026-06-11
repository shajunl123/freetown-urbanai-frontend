import db from '../db.js';
import type { ChunkRow } from '../types.js';
import {
  embedTexts,
  getEmbeddingProviderStatus,
  resolveEmbeddingConfig,
} from './embeddingProviders.js';
import { getDocument, listDocumentChunks } from './documentRegistry.js';
import { getSupabaseStatus, searchSupabaseVectors, syncChunksToSupabase } from './supabaseService.js';

const idfCache = new Map<string, number>();
const chunkVectors = new Map<string, Map<string, number>>();
let vocabularyBuilt = false;
let totalDocuments = 0;

export interface VectorSearchResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  documentType: string | null;
  chunkIndex: number;
  content: string;
  section: string | null;
  page: number | null;
  score: number;
  approvalStatus: string;
  sensitivityLevel: string;
  rankReason: string;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function vectorToBuffer(vector: number[]): Buffer {
  const array = new Float32Array(vector);
  return Buffer.from(array.buffer);
}

function buildVocabulary(): void {
  if (vocabularyBuilt) return;

  const rows = db.prepare(`
    SELECT c.id, c.content
    FROM chunks c
    JOIN documents d ON c.document_id = d.id
    WHERE d.ingestion_status = 'indexed'
  `).all() as { id: string; content: string }[];

  totalDocuments = rows.length;
  if (totalDocuments === 0) {
    vocabularyBuilt = true;
    return;
  }

  const docFreq = new Map<string, number>();
  for (const row of rows) {
    const tokens = new Set(tokenize(row.content));
    for (const token of tokens) {
      docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
    }
  }

  for (const [term, df] of docFreq) {
    idfCache.set(term, Math.log(totalDocuments / df));
  }

  for (const row of rows) {
    const tokens = tokenize(row.content);
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) ?? 0) + 1);
    }

    const vector = new Map<string, number>();
    let norm = 0;
    for (const [term, count] of tf) {
      const idf = idfCache.get(term) ?? 0;
      const tfidf = (count / Math.max(tokens.length, 1)) * idf;
      if (tfidf > 0) {
        vector.set(term, tfidf);
        norm += tfidf * tfidf;
      }
    }

    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (const [term, val] of vector) {
        vector.set(term, val / norm);
      }
    }

    chunkVectors.set(row.id, vector);
  }

  vocabularyBuilt = true;
  console.log(`[tfidf] Built vocabulary: ${idfCache.size} terms, ${totalDocuments} chunks`);
}

function embedQueryLocal(query: string): Map<string, number> {
  buildVocabulary();

  const tokens = tokenize(query);
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }

  const vector = new Map<string, number>();
  let norm = 0;
  for (const [term, count] of tf) {
    const idf = idfCache.get(term) ?? 0;
    const tfidf = (count / Math.max(tokens.length, 1)) * idf;
    if (tfidf > 0) {
      vector.set(term, tfidf);
      norm += tfidf * tfidf;
    }
  }

  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (const [term, val] of vector) {
      vector.set(term, val / norm);
    }
  }

  return vector;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const [term, val] of smaller) {
    const otherVal = larger.get(term);
    if (otherVal !== undefined) {
      dot += val * otherVal;
    }
  }
  return dot;
}

function localVectorSearch(
  query: string,
  options?: {
    approvalStatuses?: string[];
    sensitivityLevels?: string[];
    documentIds?: string[];
    limit?: number;
  }
): VectorSearchResult[] {
  buildVocabulary();

  const approvalStatuses = options?.approvalStatuses || ['approved'];
  const sensitivityLevels = options?.sensitivityLevels || ['public', 'internal'];
  const documentIds = options?.documentIds || [];
  const limit = options?.limit || 10;
  const queryVector = embedQueryLocal(query);
  if (queryVector.size === 0) return [];

  const clauses = [
    `d.ingestion_status = 'indexed'`,
    `d.approval_status IN (${approvalStatuses.map(() => '?').join(',')})`,
    `d.sensitivity_level IN (${sensitivityLevels.map(() => '?').join(',')})`,
  ];
  const values: unknown[] = [...approvalStatuses, ...sensitivityLevels];

  if (documentIds.length > 0) {
    clauses.push(`d.id IN (${documentIds.map(() => '?').join(',')})`);
    values.push(...documentIds);
  }

  const rows = db.prepare(`
    SELECT
      c.id as chunkId,
      c.document_id as documentId,
      d.title as documentTitle,
      d.type as documentType,
      c.chunk_index as chunkIndex,
      c.content,
      c.section,
      c.page,
      d.approval_status as approvalStatus,
      d.sensitivity_level as sensitivityLevel
    FROM chunks c
    JOIN documents d ON c.document_id = d.id
    WHERE ${clauses.join(' AND ')}
  `).all(...values) as Array<Omit<VectorSearchResult, 'score' | 'rankReason'>>;

  const scored: VectorSearchResult[] = [];
  for (const row of rows) {
    const chunkVec = chunkVectors.get(row.chunkId);
    if (!chunkVec) continue;

    const similarity = cosineSimilarity(queryVector, chunkVec);
    if (similarity > 0) {
      scored.push({
        ...row,
        score: similarity,
        rankReason: `tfidf=${similarity.toFixed(3)}`,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

function countDenseEmbeddings(): number {
  const row = db
    .prepare('SELECT COUNT(*) AS count FROM chunks WHERE embedding IS NOT NULL')
    .get() as { count: number };
  return row.count;
}

export function isEmbeddingReady(): boolean {
  const provider = resolveEmbeddingConfig();
  if (provider.external) return countDenseEmbeddings() > 0 || getSupabaseStatus().configured;
  return vocabularyBuilt;
}

export function rebuildVocabulary(): void {
  vocabularyBuilt = false;
  idfCache.clear();
  chunkVectors.clear();
  buildVocabulary();
}

export async function rebuildEmbeddings(): Promise<void> {
  rebuildVocabulary();
  const config = resolveEmbeddingConfig();
  if (!config.external) return;

  const documentIds = db.prepare(`
    SELECT id
    FROM documents
    WHERE ingestion_status = 'indexed'
  `).all() as Array<{ id: string }>;

  for (const row of documentIds) {
    await indexDocumentEmbeddings(row.id);
  }
}

export async function indexDocumentEmbeddings(documentId: string): Promise<ChunkRow[]> {
  const document = getDocument(documentId);
  if (!document) throw new Error('Document not found');

  rebuildVocabulary();
  const chunks = listDocumentChunks(documentId);
  const config = resolveEmbeddingConfig();

  if (!config.external) {
    await syncChunksToSupabase(document, chunks);
    return chunks;
  }

  if (!config.configured) {
    console.warn(`[embedding] External provider disabled; missing ${config.missing.join(', ')}.`);
    await syncChunksToSupabase(document, chunks);
    return chunks;
  }

  const update = db.prepare(
    `UPDATE chunks
     SET embedding = ?,
         embedding_provider = ?,
         embedding_model = ?,
         embedding_dim = ?
     WHERE id = ?`
  );

  try {
    for (let start = 0; start < chunks.length; start += config.batchSize) {
      const batch = chunks.slice(start, start + config.batchSize);
      const embeddings = await embedTexts(batch.map((chunk) => chunk.content));

      embeddings.forEach((embedding, index) => {
        update.run(
          vectorToBuffer(embedding),
          config.provider,
          config.model ?? null,
          embedding.length,
          batch[index].id
        );
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.warn(`[embedding] Dense embedding indexing failed; local TF-IDF remains available: ${message}`);
    await syncChunksToSupabase(document, chunks);
    return chunks;
  }

  const refreshed = listDocumentChunks(documentId);
  await syncChunksToSupabase(document, refreshed);
  return refreshed;
}

export async function vectorSearch(
  query: string,
  options?: {
    approvalStatuses?: string[];
    sensitivityLevels?: string[];
    documentIds?: string[];
    limit?: number;
  }
): Promise<VectorSearchResult[]> {
  const config = resolveEmbeddingConfig();
  const limit = options?.limit || 10;

  if (!config.external || !config.configured) {
    return localVectorSearch(query, options);
  }

  try {
    const [queryEmbedding] = await embedTexts([query]);
    const supabaseResults = await searchSupabaseVectors({
      queryEmbedding,
      approvalStatuses: options?.approvalStatuses || ['approved'],
      sensitivityLevels: options?.sensitivityLevels || ['public', 'internal'],
      documentIds: options?.documentIds || [],
      limit,
    });

    if (supabaseResults.length > 0) {
      return supabaseResults.map((row) => ({
        ...row,
        rankReason: `${config.provider}_vector=${row.score.toFixed(3)}`,
      }));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.warn(`[embedding] External vector search failed, using local TF-IDF: ${message}`);
  }

  return localVectorSearch(query, options);
}

export function embeddingStats(): {
  provider: ReturnType<typeof getEmbeddingProviderStatus>;
  supabase: ReturnType<typeof getSupabaseStatus>;
  totalChunks: number;
  embeddedChunks: number;
  terms: number;
} {
  const row = db.prepare('SELECT COUNT(*) AS count FROM chunks').get() as { count: number };
  if (!resolveEmbeddingConfig().external) buildVocabulary();

  return {
    provider: getEmbeddingProviderStatus(),
    supabase: getSupabaseStatus(),
    totalChunks: row.count,
    embeddedChunks: resolveEmbeddingConfig().external ? countDenseEmbeddings() : chunkVectors.size,
    terms: idfCache.size,
  };
}
