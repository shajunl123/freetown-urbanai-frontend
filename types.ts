export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export type PolicyIntelligenceMode = 'briefing' | 'qa' | 'claim_check' | 'evidence_lookup';
export type UserRole = 'admin' | 'operator' | 'briefing_user';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  expiresAt: string;
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
  level: 'firm' | 'careful' | 'not_ready';
  explanation?: string;
}

export interface PolicyIntelligenceResponse {
  answer: string;
  mode?: PolicyIntelligenceMode;
  sources?: PolicySource[];
  caveats?: string[];
  claimSafety?: ClaimSafety;
}

export interface EvidenceDocument {
  id: string;
  title: string;
  type?: string | null;
  sensitivity?: string;
  approval?: string;
  sensitivityLevel?: string;
  approvalStatus?: string;
  ingestionStatus?: 'registered' | 'extracting' | 'extracted' | 'chunking' | 'chunked' | 'indexing' | 'indexed' | 'failed';
  chunkCount?: number;
  sourceUrl?: string | null;
  sourceType?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  uploadedAt?: string;
  updatedAt?: string | null;
  ingestedAt?: string | null;
  indexedAt?: string | null;
  lastError?: string | null;
  preview?: string;
  canPreviewPdf?: boolean;
  pdfUrl?: string | null;
}

export type ProjectStatus = 'on_track' | 'delayed' | 'at_risk';
export type ProjectRiskLevel = 'low' | 'medium' | 'high';

export interface PortfolioProject {
  id: string;
  slug: string;
  name: string;
  displayName: string;
  status: ProjectStatus;
  riskLevel: ProjectRiskLevel;
  progress: number;
  overview: string;
  keyMetrics: string[];
  keywords: string[];
  documentCount: number;
  createdAt: string;
  updatedAt?: string | null;
}

export interface CorpusStats {
  totalDocuments: number;
  indexedDocuments: number;
  failedDocuments: number;
  totalChunks: number;
  statusCounts: Record<string, number>;
  approvalCounts: Record<string, number>;
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  isThinking?: boolean;
  groundingChunks?: GroundingChunk[];
  policyResponse?: PolicyIntelligenceResponse;
  mode?: PolicyIntelligenceMode;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
}

export interface FreetownStats {
  population: string;
  area: string;
  wards: number;
  activeProjects: number;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  status: 'online' | 'busy' | 'offline';
  initials: string;
}

export interface WeatherData {
  temp: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  aqi: number;
}

export interface UploadedDoc {
  id: string;
  name: string;
  type: string;
  size: string;
  progress: number;
  status?: 'uploading' | 'done' | 'failed';
  approval?: string;
  ingestionStatus?: string;
  source?: 'backend' | 'static' | 'local';
  preview?: string;
  canPreviewPdf?: boolean;
  pdfObjectUrl?: string;
}

export interface ApiUsageStatus {
  status: 'green' | 'yellow' | 'red';
  provider: {
    type: string;
    configured: boolean;
    model?: string;
    baseUrl?: string;
    missing?: string[];
  };
  todayQueries: number;
  todayTokenUsage: number;
  avgLatencyMs: number;
  errorRate: number;
  recentErrors: Array<Record<string, unknown>>;
}

export interface SecurityDashboard {
  activeSessions: number;
  todayQueries: number;
  suspiciousActivity: number;
  modelErrorRate: number;
  classifications: Array<{ level: string; count: number }>;
  auditSummary: Array<Record<string, unknown>>;
}
