import { readdir } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createDocument,
  getDocumentByFilePath,
  updateDocumentMetadata,
} from '../services/documentRegistry.js';
import {
  inferDocumentType,
  inferSourceTitle,
  ingestDocument,
} from '../services/corpusIngestionService.js';
import { isSupportedForLocalExtraction } from '../services/textExtractionService.js';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const defaultFixtureDir = resolve(scriptDir, '../../fixtures/demo-corpus');
const targetDir = resolve(process.argv[2] || defaultFixtureDir);

const files = (await readdir(targetDir))
  .filter((name) => isSupportedForLocalExtraction(name))
  .sort();

if (files.length === 0) {
  console.error(`No supported demo corpus files found in ${targetDir}`);
  process.exit(1);
}

const results = [];

for (const fileName of files) {
  const filePath = join(targetDir, fileName);
  const existing = getDocumentByFilePath(filePath);
  const title = inferSourceTitle(fileName);

  const doc =
    existing ??
    createDocument({
      title,
      type: inferDocumentType(fileName),
      sourceType: 'demo_seed',
      fileName,
      filePath,
      mimeType: extname(fileName) === '.html' ? 'text/html' : 'text/plain',
      sensitivity: 'internal',
      approval: 'approved',
    });

  if (existing) {
    updateDocumentMetadata(existing.id, {
      title,
      type: inferDocumentType(fileName),
      approval: 'approved',
      sensitivity: 'internal',
    });
  }

  const ingested = await ingestDocument(doc.id);
  results.push({
    id: ingested.document.id,
    title: basename(fileName),
    status: ingested.document.ingestion_status,
    chunks: ingested.chunks.length,
    indexedAt: ingested.document.indexed_at,
  });
}

console.log(JSON.stringify({ targetDir, results }, null, 2));
