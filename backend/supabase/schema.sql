-- Freetown UrbanAI optional Supabase schema.
-- Run this in Supabase SQL editor when enabling pgvector retrieval.

create extension if not exists vector;

create table if not exists documents (
  id text primary key,
  title text not null,
  type text,
  source_type text,
  file_name text,
  mime_type text,
  source_url text,
  sensitivity_level text default 'internal',
  approval_status text default 'draft',
  ingestion_status text default 'registered',
  indexed_at timestamptz,
  last_error text,
  uploaded_by text,
  chunk_count integer default 0,
  ingested_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz
);

create table if not exists chunks (
  id text primary key,
  document_id text not null references documents(id) on delete cascade,
  chunk_index integer default 0,
  content text not null,
  page integer,
  section text,
  char_start integer,
  char_end integer,
  token_estimate integer default 0,
  indexed_at timestamptz,
  embedding vector,
  embedding_provider text,
  embedding_model text,
  embedding_dim integer,
  created_at timestamptz default now()
);

create table if not exists sessions (
  id text primary key,
  user_id text,
  created_at timestamptz default now(),
  last_active timestamptz default now()
);

create table if not exists messages (
  id text primary key,
  session_id text not null references sessions(id) on delete cascade,
  role text not null,
  text text not null,
  mode text,
  sources_json text,
  claim_safety text,
  created_at timestamptz default now(),
  created_at_ms bigint,
  message_order integer default 0
);

create index if not exists idx_supabase_documents_status
  on documents (ingestion_status, approval_status, sensitivity_level);

create index if not exists idx_supabase_chunks_document_index
  on chunks (document_id, chunk_index);

create index if not exists idx_supabase_sessions_user
  on sessions (user_id, last_active);

create index if not exists idx_supabase_messages_session_order
  on messages (session_id, message_order, created_at_ms);

create or replace function match_chunks(
  query_embedding vector,
  match_count integer default 10,
  approval_statuses text[] default array['approved'],
  sensitivity_levels text[] default array['public', 'internal'],
  document_ids text[] default array[]::text[]
)
returns table (
  chunk_id text,
  document_id text,
  document_title text,
  document_type text,
  chunk_index integer,
  content text,
  section text,
  page integer,
  similarity double precision,
  approval_status text,
  sensitivity_level text
)
language sql
stable
as $$
  select
    c.id as chunk_id,
    c.document_id,
    d.title as document_title,
    d.type as document_type,
    c.chunk_index,
    c.content,
    c.section,
    c.page,
    1 - (c.embedding <=> query_embedding) as similarity,
    d.approval_status,
    d.sensitivity_level
  from chunks c
  join documents d on d.id = c.document_id
  where c.embedding is not null
    and vector_dims(c.embedding) = vector_dims(query_embedding)
    and d.ingestion_status = 'indexed'
    and d.approval_status = any(approval_statuses)
    and d.sensitivity_level = any(sensitivity_levels)
    and (
      coalesce(array_length(document_ids, 1), 0) = 0
      or d.id = any(document_ids)
    )
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
