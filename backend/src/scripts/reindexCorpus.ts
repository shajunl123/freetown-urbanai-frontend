import { listDocuments } from '../services/documentRegistry.js';
import { ingestDocument } from '../services/corpusIngestionService.js';
import { isSupportedForLocalExtraction } from '../services/textExtractionService.js';

const docs = listDocuments();
const results = [];

for (const doc of docs) {
  if (!doc.file_path || !isSupportedForLocalExtraction(doc.file_name || doc.file_path)) {
    results.push({ id: doc.id, title: doc.title, status: 'skipped' });
    continue;
  }

  try {
    const ingested = await ingestDocument(doc.id);
    results.push({
      id: doc.id,
      title: doc.title,
      status: ingested.document.ingestion_status,
      chunkCount: ingested.chunks.length,
    });
  } catch (error) {
    results.push({
      id: doc.id,
      title: doc.title,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Reindex failed',
    });
  }
}

console.log(JSON.stringify({ results }, null, 2));
