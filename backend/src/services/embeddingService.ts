import db from '../db.js';

// TF-IDF based local embedding service
// No model download required — pure computation

const idfCache = new Map<string, number>();
const chunkVectors = new Map<string, Map<string, number>>();
let vocabularyBuilt = false;
let totalDocuments = 0;

// Tokenize: lowercase, split on non-alphanumeric, filter short tokens
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

// Build IDF from all indexed chunks
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

  // Count document frequency for each term
  const docFreq = new Map<string, number>();

  for (const row of rows) {
    const tokens = new Set(tokenize(row.content));
    for (const token of tokens) {
      docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
    }
  }

  // Compute IDF: log(N / df)
  for (const [term, df] of docFreq) {
    idfCache.set(term, Math.log(totalDocuments / df));
  }

  // Build TF-IDF vectors for each chunk
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
      const tfidf = (count / tokens.length) * idf;
      if (tfidf > 0) {
        vector.set(term, tfidf);
        norm += tfidf * tfidf;
      }
    }

    // Normalize
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

// Embed a query into TF-IDF vector space
function embedQuery(query: string): Map<string, number> {
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
    const tfidf = (count / tokens.length) * idf;
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

// Cosine similarity between two sparse vectors
function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  // Iterate over the smaller map
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const [term, val] of smaller) {
    const otherVal = larger.get(term);
    if (otherVal !== undefined) {
      dot += val * otherVal;
    }
  }
  return dot; // Vectors are already normalized
}

export function isEmbeddingReady(): boolean {
  return vocabularyBuilt;
}

// Rebuild vocabulary (call after new documents are ingested)
export function rebuildVocabulary(): void {
  vocabularyBuilt = false;
  idfCache.clear();
  chunkVectors.clear();
  buildVocabulary();
}

// Vector search using TF-IDF
interface VectorSearchResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  documentType: string;
  chunkIndex: number;
  content: string;
  section: string | null;
  page: string | null;
  score: number;
  approvalStatus: string;
  sensitivityLevel: string;
}

export function vectorSearch(
  query: string,
  options?: {
    approvalStatuses?: string[];
    sensitivityLevels?: string[];
    limit?: number;
  }
): VectorSearchResult[] {
  buildVocabulary();

  const approvalStatuses = options?.approvalStatuses || ['approved'];
  const sensitivityLevels = options?.sensitivityLevels || ['public', 'internal'];
  const limit = options?.limit || 10;

  const queryVector = embedQuery(query);
  if (queryVector.size === 0) return [];

  const placeholders = approvalStatuses.map(() => '?').join(',');
  const sensPlaceholders = sensitivityLevels.map(() => '?').join(',');

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
    WHERE d.ingestion_status = 'indexed'
      AND d.approval_status IN (${placeholders})
      AND d.sensitivity_level IN (${sensPlaceholders})
  `).all(...approvalStatuses, ...sensitivityLevels) as any[];

  const scored: VectorSearchResult[] = [];
  for (const row of rows) {
    const chunkVec = chunkVectors.get(row.chunkId);
    if (!chunkVec) continue;

    const similarity = cosineSimilarity(queryVector, chunkVec);
    if (similarity > 0) {
      scored.push({
        chunkId: row.chunkId,
        documentId: row.documentId,
        documentTitle: row.documentTitle,
        documentType: row.documentType,
        chunkIndex: row.chunkIndex,
        content: row.content,
        section: row.section,
        page: row.page,
        score: similarity,
        approvalStatus: row.approvalStatus,
        sensitivityLevel: row.sensitivityLevel,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

export function embeddingStats(): { totalChunks: number; embeddedChunks: number; terms: number } {
  buildVocabulary();
  return {
    totalChunks: totalDocuments,
    embeddedChunks: chunkVectors.size,
    terms: idfCache.size,
  };
}
