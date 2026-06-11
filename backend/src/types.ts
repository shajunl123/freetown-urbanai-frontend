// Backend types — mirrors the frontend PolicyIntelligenceResponse
// for contract enforcement.

export type PolicyIntelligenceMode =
  | 'briefing'
  | 'qa'
  | 'claim_check'
  | 'evidence_lookup';

export type ClaimSafetyLevel = 'firm' | 'careful' | 'not_ready';
export type UserRole = 'admin' | 'operator' | 'briefing_user';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface PolicySource {
  title: string;
  type?: string;
  page?: string | number;
  section?: string;
  url?: string;
  confidence?: 'high' | 'medium' | 'low';
  documentId?: string;
  chunkId?: string;
  chunkIndex?: number;
  snippet?: string;
  approvalStatus?: string;
  sensitivityLevel?: string;
  retrievalScore?: number;
}

export interface ClaimSafety {
  level: ClaimSafetyLevel;
  explanation?: string;
}

export interface PolicyIntelligenceResponse {
  answer: string;
  mode: PolicyIntelligenceMode;
  sources?: PolicySource[];
  caveats?: string[];
  claimSafety?: ClaimSafety;
}

// Database row types

export interface DocumentRow {
  id: string;
  title: string;
  type: string | null;
  source_type: string | null;
  file_name: string | null;
  file_path: string | null;
  mime_type: string | null;
  source_url: string | null;
  sensitivity: string;
  approval: string;
  sensitivity_level: string;
  approval_status: string;
  ingestion_status: 'registered' | 'extracting' | 'extracted' | 'chunking' | 'chunked' | 'indexing' | 'indexed' | 'failed';
  indexed_at: string | null;
  last_error: string | null;
  uploaded_by: string | null;
  chunk_count: number;
  ingested_at: string | null;
  retention_expires_at: string | null;
  retention_action: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface ProjectRow {
  id: string;
  slug: string;
  name: string;
  display_name: string;
  status: string;
  risk_level: string;
  progress: number;
  overview: string;
  key_metrics_json: string | null;
  keywords_json: string | null;
  created_at: string;
  updated_at: string | null;
  archived_at: string | null;
  document_count?: number;
}

export interface DocumentTextRow {
  document_id: string;
  content: string;
  content_encrypted?: number | null;
  encryption_iv?: string | null;
  encryption_tag?: string | null;
  char_count: number;
  extracted_at: string;
}

export interface ChunkRow {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  page: number | null;
  section: string | null;
  char_start: number | null;
  char_end: number | null;
  token_estimate: number;
  indexed_at: string | null;
  embedding: Buffer | null;
  embedding_provider: string | null;
  embedding_model: string | null;
  embedding_dim: number | null;
  created_at: string;
}

export interface RetrievalResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  documentType: string | null;
  chunkIndex: number;
  content: string;
  snippet: string;
  section?: string;
  page?: number;
  score: number;
  rankReason: string;
  approvalStatus: string;
  sensitivityLevel: string;
}

export interface RetrievalDebug {
  originalQuery: string;
  normalizedQuery: string;
  terms: string[];
  ftsQuery: string;
  filters: {
    approvalStatuses: string[];
    includeDrafts: boolean;
    sensitivityLevels: string[];
    documentIds: string[];
    limit: number;
    maxPerDocument: number;
  };
  results: RetrievalResult[];
}

export interface SessionRow {
  id: string;
  user_id: string | null;
  created_at: string;
  last_active: string;
}

export interface MessageRow {
  id: string;
  session_id: string;
  role: 'user' | 'model';
  text: string;
  mode: string | null;
  sources_json: string | null;
  claim_safety: string | null;
  created_at: string;
  created_at_ms: number | null;
  message_order: number;
}

export interface RequestLogRow {
  id: string;
  session_id: string | null;
  user_id: string | null;
  action: string | null;
  mode: string | null;
  query: string | null;
  response_json: string | null;
  sources_json: string | null;
  claim_safety: string | null;
  latency_ms: number | null;
  created_at: string;
  created_at_ms: number | null;
}

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password_hash: string;
  password_salt: string;
  created_at: string;
  updated_at: string | null;
  disabled_at: string | null;
}

export interface AuthSessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  last_active_at: string | null;
  revoked_at: string | null;
}
