import { resolve, basename } from 'node:path';
import { createDocument } from '../services/documentRegistry.js';
import {
  inferDocumentType,
  inferSourceTitle,
  ingestDocument,
} from '../services/corpusIngestionService.js';
import { isSupportedForLocalExtraction } from '../services/textExtractionService.js';

const filePathArg = process.argv[2];
const titleArg = process.argv.slice(3).join(' ').trim();

if (!filePathArg) {
  console.error('Usage: npm run ingest -- /path/to/source.md "Optional title"');
  process.exit(1);
}

const filePath = resolve(filePathArg);
const fileName = basename(filePath);

if (!isSupportedForLocalExtraction(fileName)) {
  console.error('Supported local ingestion formats: .md, .txt, .json, .html');
  process.exit(1);
}

const doc = createDocument({
  title: titleArg || inferSourceTitle(fileName),
  type: inferDocumentType(fileName),
  sourceType: 'local_file',
  fileName,
  filePath,
  mimeType: 'text/plain',
  sensitivity: 'internal',
});

const result = await ingestDocument(doc.id);

console.log(JSON.stringify({
  id: result.document.id,
  title: result.document.title,
  ingestionStatus: result.document.ingestion_status,
  chunkCount: result.chunks.length,
  charCount: result.text.char_count,
}, null, 2));
