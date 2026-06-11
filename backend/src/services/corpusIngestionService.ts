import { basename, extname } from 'node:path';
import {
  getDocument,
  getDocumentText,
  listDocumentChunks,
  markDocumentFailed,
  replaceDocumentChunks,
  storeDocumentText,
  updateDocumentIngestionStatus,
} from './documentRegistry.js';
import { chunkText } from './chunkingService.js';
import { extractTextFromFile } from './textExtractionService.js';
import { rebuildVocabulary } from './embeddingService.js';
import type { ChunkRow, DocumentRow, DocumentTextRow } from '../types.js';

export interface IngestionResult {
  document: DocumentRow;
  text: DocumentTextRow;
  chunks: ChunkRow[];
}

export async function ingestDocument(documentId: string): Promise<IngestionResult> {
  const document = getDocument(documentId);
  if (!document) throw new Error('Document not found');
  if (!document.file_path) {
    throw new Error('Document has no local file path to ingest');
  }

  updateDocumentIngestionStatus(documentId, 'extracting');

  try {
    const extracted = await extractTextFromFile(
      document.file_path,
      document.file_name || document.title
    );
    const text = storeDocumentText(documentId, extracted.content);
    updateDocumentIngestionStatus(documentId, 'chunking');
    const chunks = replaceDocumentChunks(documentId, chunkText(extracted.content));

    // Rebuild TF-IDF vocabulary with new chunks
    try {
      rebuildVocabulary();
      console.log(`[ingestion] TF-IDF vocabulary rebuilt after ingesting document ${documentId}`);
    } catch (vocabErr) {
      console.warn(`[ingestion] Vocabulary rebuild failed (non-fatal):`, vocabErr);
    }

    const updated = getDocument(documentId);
    if (!updated) throw new Error('Document disappeared during ingestion');
    return { document: updated, text, chunks };
  } catch (err) {
    markDocumentFailed(documentId, err instanceof Error ? err.message : 'Unknown ingestion error');
    throw err;
  }
}

export function getIngestionPreview(documentId: string): {
  text?: DocumentTextRow;
  chunks: ChunkRow[];
} {
  return {
    text: getDocumentText(documentId),
    chunks: listDocumentChunks(documentId),
  };
}

export function inferDocumentType(fileName: string): string {
  const ext = extname(fileName).replace('.', '').toUpperCase();
  return ext || 'DOC';
}

export function inferSourceTitle(fileName: string): string {
  return basename(fileName).replace(/\.[^.]+$/, '');
}
