import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ChunkRow, DocumentRow, MessageRow, SessionRow } from '../types.js';

interface SupabaseStatus {
  configured: boolean;
  url?: string;
  missing: string[];
}

let client: SupabaseClient | null | undefined;
let warnedDisabled = false;
let warnedRpc = false;

function resolveSupabaseStatus(): SupabaseStatus {
  const url = process.env.SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim();
  const missing = [];
  if (!url) missing.push('SUPABASE_URL');
  if (!key) missing.push('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY');
  return { configured: missing.length === 0, url, missing };
}

function getClient(): SupabaseClient | null {
  if (client !== undefined) return client;

  const url = process.env.SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim();

  if (!url || !key) {
    client = null;
    return client;
  }

  client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return client;
}

function warnSupabaseDisabled(): void {
  if (warnedDisabled) return;
  warnedDisabled = true;
  const status = resolveSupabaseStatus();
  console.warn(`[supabase] Disabled; missing ${status.missing.join(', ')}.`);
}

async function safeSupabaseWrite(
  label: string,
  fn: (client: SupabaseClient) => Promise<{ error?: { message?: string } | null } | unknown>
): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;

  try {
    const result = await fn(supabase);
    const error = result &&
      typeof result === 'object' &&
      'error' in result
      ? (result as { error?: { message?: string } | null }).error
      : null;
    if (error) throw new Error(error.message || 'Supabase request failed');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.warn(`[supabase] ${label} failed: ${message}`);
  }
}

function pgvectorLiteral(vector: number[]): string {
  return `[${vector.map((value) => Number(value).toFixed(8)).join(',')}]`;
}

function chunkEmbeddingValue(chunk: ChunkRow): string | null {
  if (!chunk.embedding) return null;
  const vector = Array.from(new Float32Array(
    chunk.embedding.buffer,
    chunk.embedding.byteOffset,
    chunk.embedding.byteLength / Float32Array.BYTES_PER_ELEMENT
  ));
  return pgvectorLiteral(vector);
}

export function getSupabaseStatus(): SupabaseStatus {
  return resolveSupabaseStatus();
}

export async function syncDocumentToSupabase(document: DocumentRow): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;

  await safeSupabaseWrite('document sync', async (client) =>
    client.from('documents').upsert({
      id: document.id,
      title: document.title,
      type: document.type,
      source_type: document.source_type,
      file_name: document.file_name,
      mime_type: document.mime_type,
      source_url: document.source_url,
      sensitivity_level: document.sensitivity_level,
      approval_status: document.approval_status,
      ingestion_status: document.ingestion_status,
      indexed_at: document.indexed_at,
      last_error: document.last_error,
      uploaded_by: document.uploaded_by,
      chunk_count: document.chunk_count,
      ingested_at: document.ingested_at,
      created_at: document.created_at,
      updated_at: document.updated_at,
    })
  );
}

export async function syncChunksToSupabase(document: DocumentRow, chunks: ChunkRow[]): Promise<void> {
  const supabase = getClient();
  if (!supabase) {
    warnSupabaseDisabled();
    return;
  }

  if (chunks.length === 0) return;

  await syncDocumentToSupabase(document);
  await safeSupabaseWrite('chunk sync', async (client) =>
    client.from('chunks').upsert(
      chunks.map((chunk) => ({
        id: chunk.id,
        document_id: chunk.document_id,
        chunk_index: chunk.chunk_index,
        content: chunk.content,
        page: chunk.page,
        section: chunk.section,
        char_start: chunk.char_start,
        char_end: chunk.char_end,
        token_estimate: chunk.token_estimate,
        indexed_at: chunk.indexed_at,
        embedding: chunkEmbeddingValue(chunk),
        created_at: chunk.created_at,
        embedding_provider: (chunk as { embedding_provider?: string | null }).embedding_provider ?? null,
        embedding_model: (chunk as { embedding_model?: string | null }).embedding_model ?? null,
        embedding_dim: (chunk as { embedding_dim?: number | null }).embedding_dim ?? null,
      }))
    )
  );
}

export async function syncSessionToSupabase(session: SessionRow): Promise<void> {
  await safeSupabaseWrite('session sync', async (client) =>
    client.from('sessions').upsert({
      id: session.id,
      user_id: session.user_id,
      created_at: session.created_at,
      last_active: session.last_active,
    })
  );
}

export async function syncMessageToSupabase(message: MessageRow): Promise<void> {
  await safeSupabaseWrite('message sync', async (client) =>
    client.from('messages').upsert({
      id: message.id,
      session_id: message.session_id,
      role: message.role,
      text: message.text,
      mode: message.mode,
      sources_json: message.sources_json,
      claim_safety: message.claim_safety,
      created_at: message.created_at,
      created_at_ms: message.created_at_ms,
      message_order: message.message_order,
    })
  );
}

export interface SupabaseVectorRow {
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
}

export async function searchSupabaseVectors(params: {
  queryEmbedding: number[];
  approvalStatuses: string[];
  sensitivityLevels: string[];
  documentIds: string[];
  limit: number;
}): Promise<SupabaseVectorRow[]> {
  const supabase = getClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase.rpc('match_chunks', {
      query_embedding: pgvectorLiteral(params.queryEmbedding),
      match_count: params.limit,
      approval_statuses: params.approvalStatuses,
      sensitivity_levels: params.sensitivityLevels,
      document_ids: params.documentIds,
    });

    if (error) throw error;
    if (!Array.isArray(data)) return [];

    return data.map((row: Record<string, unknown>) => ({
      chunkId: String(row.chunk_id ?? row.chunkId ?? row.id),
      documentId: String(row.document_id ?? row.documentId),
      documentTitle: String(row.document_title ?? row.documentTitle ?? 'Untitled source'),
      documentType:
        typeof (row.document_type ?? row.documentType) === 'string'
          ? String(row.document_type ?? row.documentType)
          : null,
      chunkIndex: Number(row.chunk_index ?? row.chunkIndex ?? 0),
      content: String(row.content ?? ''),
      section:
        typeof row.section === 'string' ? row.section : null,
      page:
        typeof row.page === 'number' ? row.page : null,
      score: Number(row.similarity ?? row.score ?? 0),
      approvalStatus: String(row.approval_status ?? row.approvalStatus ?? 'approved'),
      sensitivityLevel: String(row.sensitivity_level ?? row.sensitivityLevel ?? 'internal'),
    }));
  } catch (error) {
    if (!warnedRpc) {
      warnedRpc = true;
      const message = error instanceof Error ? error.message : 'unknown error';
      console.warn(`[supabase] Vector RPC match_chunks unavailable: ${message}`);
    }
    return [];
  }
}
