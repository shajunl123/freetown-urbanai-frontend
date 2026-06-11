import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import type { ChunkRow, DocumentRow, DocumentTextRow } from '../types.js';

export type IngestionStatus =
  | 'registered'
  | 'extracting'
  | 'extracted'
  | 'chunking'
  | 'chunked'
  | 'indexing'
  | 'indexed'
  | 'failed';

export function listDocuments(): DocumentRow[] {
  return db
    .prepare('SELECT * FROM documents ORDER BY created_at DESC, rowid DESC')
    .all() as DocumentRow[];
}

export function getDocument(id: string): DocumentRow | undefined {
  return db
    .prepare('SELECT * FROM documents WHERE id = ?')
    .get(id) as DocumentRow | undefined;
}

export function getDocumentByFilePath(filePath: string): DocumentRow | undefined {
  return db
    .prepare('SELECT * FROM documents WHERE file_path = ?')
    .get(filePath) as DocumentRow | undefined;
}

export function createDocument(params: {
  title: string;
  type?: string;
  sourceType?: string;
  fileName?: string;
  filePath?: string;
  mimeType?: string;
  sourceUrl?: string;
  sensitivity?: string;
  approval?: 'draft' | 'approved' | 'archived';
  ingestionStatus?: IngestionStatus;
  uploadedBy?: string;
}): DocumentRow {
  const id = uuidv4();
  const now = new Date().toISOString();
  const sensitivity = params.sensitivity ?? 'internal';
  const approval = params.approval ?? 'draft';
  db.prepare(
    `INSERT INTO documents (
       id, title, type, source_type, file_name, file_path, mime_type,
       source_url, sensitivity, approval, sensitivity_level, approval_status,
       ingestion_status, uploaded_by, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.title,
    params.type ?? null,
    params.sourceType ?? 'manual',
    params.fileName ?? null,
    params.filePath ?? null,
    params.mimeType ?? null,
    params.sourceUrl ?? null,
    sensitivity,
    approval,
    sensitivity,
    approval,
    params.ingestionStatus ?? 'registered',
    params.uploadedBy ?? null,
    now,
    now
  );

  return db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as DocumentRow;
}

export function updateDocumentApproval(
  id: string,
  approval: 'draft' | 'approved' | 'archived'
): boolean {
  const result = db
    .prepare('UPDATE documents SET approval = ?, approval_status = ?, updated_at = ? WHERE id = ?')
    .run(approval, approval, new Date().toISOString(), id);
  return result.changes > 0;
}

export function updateDocumentIngestionStatus(
  id: string,
  status: IngestionStatus
): void {
  db.prepare(
    `UPDATE documents
     SET ingestion_status = ?,
         updated_at = ?,
         ingested_at = CASE WHEN ? = 'indexed' THEN COALESCE(ingested_at, ?) ELSE ingested_at END,
         indexed_at = CASE WHEN ? = 'indexed' THEN ? ELSE indexed_at END,
         last_error = CASE WHEN ? = 'failed' THEN last_error ELSE NULL END
     WHERE id = ?`
  ).run(status, new Date().toISOString(), status, new Date().toISOString(), status, new Date().toISOString(), status, id);
}

export function updateDocumentMetadata(
  id: string,
  params: {
    title?: string;
    type?: string | null;
    approval?: 'draft' | 'approved' | 'archived';
    sensitivity?: string;
    sourceUrl?: string | null;
  }
): boolean {
  const updates: string[] = [];
  const values: unknown[] = [];

  if (typeof params.title === 'string') {
    updates.push('title = ?');
    values.push(params.title.trim());
  }

  if (params.type !== undefined) {
    updates.push('type = ?');
    values.push(params.type ? params.type.trim().toUpperCase() : null);
  }

  if (params.approval !== undefined) {
    updates.push('approval = ?', 'approval_status = ?');
    values.push(params.approval, params.approval);
  }

  if (params.sensitivity !== undefined) {
    updates.push('sensitivity = ?', 'sensitivity_level = ?');
    values.push(params.sensitivity, params.sensitivity);
  }

  if (params.sourceUrl !== undefined) {
    updates.push('source_url = ?');
    values.push(params.sourceUrl ? params.sourceUrl.trim() : null);
  }

  if (updates.length === 0) return false;

  updates.push('updated_at = ?');
  values.push(new Date().toISOString(), id);

  const result = db
    .prepare(`UPDATE documents SET ${updates.join(', ')} WHERE id = ?`)
    .run(...values);
  return result.changes > 0;
}

export function storeDocumentText(documentId: string, content: string): DocumentTextRow {
  const extractedAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO document_texts (document_id, content, char_count, extracted_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(document_id) DO UPDATE SET
       content = excluded.content,
       char_count = excluded.char_count,
       extracted_at = excluded.extracted_at`
  ).run(documentId, content, content.length, extractedAt);

  db.prepare(
    `UPDATE documents
     SET ingestion_status = 'extracted',
         updated_at = ?,
         ingested_at = COALESCE(ingested_at, ?),
         last_error = NULL
     WHERE id = ?`
  ).run(extractedAt, extractedAt, documentId);

  return db
    .prepare('SELECT * FROM document_texts WHERE document_id = ?')
    .get(documentId) as DocumentTextRow;
}

export function getDocumentText(documentId: string): DocumentTextRow | undefined {
  return db
    .prepare('SELECT * FROM document_texts WHERE document_id = ?')
    .get(documentId) as DocumentTextRow | undefined;
}

export function replaceDocumentChunks(
  documentId: string,
  chunks: Array<{
    content: string;
    chunkIndex: number;
    section?: string;
    charStart: number;
    charEnd: number;
    tokenEstimate: number;
  }>
): ChunkRow[] {
  const createdAt = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE documents
       SET ingestion_status = 'chunking', updated_at = ?, last_error = NULL
       WHERE id = ?`
    ).run(createdAt, documentId);

    db.prepare('DELETE FROM chunks WHERE document_id = ?').run(documentId);

    const insertChunk = db.prepare(
      `INSERT INTO chunks (
         id, document_id, chunk_index, content, section, char_start,
         char_end, token_estimate, created_at, indexed_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const chunk of chunks) {
      const id = uuidv4();
      insertChunk.run(
        id,
        documentId,
        chunk.chunkIndex,
        chunk.content,
        chunk.section ?? null,
        chunk.charStart,
        chunk.charEnd,
        chunk.tokenEstimate,
        createdAt,
        createdAt
      );
    }

    db.prepare(
      `UPDATE documents
       SET chunk_count = ?, ingestion_status = 'chunked', updated_at = ?, last_error = NULL
       WHERE id = ?`
    ).run(chunks.length, createdAt, documentId);

    db.prepare(
      `UPDATE documents
       SET ingestion_status = 'indexing', updated_at = ?
       WHERE id = ?`
    ).run(createdAt, documentId);

    db.prepare("INSERT INTO chunks_fts(chunks_fts) VALUES('rebuild')").run();

    db.prepare(
      `UPDATE documents
       SET ingested_at = COALESCE(ingested_at, ?),
           indexed_at = ?,
           ingestion_status = 'indexed',
           updated_at = ?,
           last_error = NULL
       WHERE id = ?`
    ).run(createdAt, createdAt, createdAt, documentId);
  });

  tx();
  return listDocumentChunks(documentId);
}

export function listDocumentChunks(documentId: string): ChunkRow[] {
  return db
    .prepare('SELECT * FROM chunks WHERE document_id = ? ORDER BY chunk_index ASC, rowid ASC')
    .all(documentId) as ChunkRow[];
}

export function listIngestedDocuments(): DocumentRow[] {
  return db
    .prepare("SELECT * FROM documents WHERE ingestion_status = 'indexed' ORDER BY updated_at DESC, rowid DESC")
    .all() as DocumentRow[];
}

export function markDocumentFailed(documentId: string, error?: string): void {
  db.prepare(
    "UPDATE documents SET ingestion_status = 'failed', last_error = ?, updated_at = ? WHERE id = ?"
  ).run(error ?? null, new Date().toISOString(), documentId);
}

export function corpusStats(): {
  totalDocuments: number;
  indexedDocuments: number;
  failedDocuments: number;
  totalChunks: number;
  statusCounts: Record<string, number>;
  approvalCounts: Record<string, number>;
} {
  const statusRows = db
    .prepare(
      `SELECT ingestion_status AS status, COUNT(*) AS count
       FROM documents
       GROUP BY ingestion_status`
    )
    .all() as Array<{ status: string; count: number }>;

  const approvalRows = db
    .prepare(
      `SELECT approval_status AS status, COUNT(*) AS count
       FROM documents
       GROUP BY approval_status`
    )
    .all() as Array<{ status: string; count: number }>;

  const totals = db
    .prepare(
      `SELECT
         COUNT(*) AS totalDocuments,
         SUM(CASE WHEN ingestion_status = 'indexed' THEN 1 ELSE 0 END) AS indexedDocuments,
         SUM(CASE WHEN ingestion_status = 'failed' THEN 1 ELSE 0 END) AS failedDocuments,
         COALESCE(SUM(chunk_count), 0) AS totalChunks
       FROM documents`
    )
    .get() as {
    totalDocuments: number;
    indexedDocuments: number;
    failedDocuments: number;
    totalChunks: number;
  };

  return {
    ...totals,
    statusCounts: Object.fromEntries(statusRows.map((row) => [row.status, row.count])),
    approvalCounts: Object.fromEntries(approvalRows.map((row) => [row.status, row.count])),
  };
}
