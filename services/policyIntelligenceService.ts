import {
  AuthSession,
  AuthUser,
  CorpusStats,
  EvidenceDocument,
  PolicyIntelligenceMode,
  PolicyIntelligenceResponse,
} from '../types';

const SESSION_STORAGE_KEY = 'freetown-urbanai.policy-session-id';
const AUTH_STORAGE_KEY = 'freetown-urbanai.auth-token';
const DEFAULT_API_BASE_URL = 'http://localhost:3001/api';

function notifyAuthExpired(): void {
  try {
    window.dispatchEvent(new Event('policy-auth-expired'));
  } catch {
    // Event dispatch can fail in non-browser test contexts.
  }
}

function getApiBaseUrl(): string {
  return (import.meta.env.VITE_POLICY_API_BASE_URL || DEFAULT_API_BASE_URL)
    .replace(/\/$/, '');
}

function getAuthToken(): string | null {
  try {
    return window.localStorage.getItem(AUTH_STORAGE_KEY);
  } catch {
    return null;
  }
}

function setAuthToken(token: string | null): void {
  try {
    if (token) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {
    // localStorage may be unavailable in restricted browser contexts.
  }
}

function clearPolicySessionId(): void {
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // sessionStorage may be unavailable in restricted browser contexts.
  }
}

async function policyFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getAuthToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(input, { ...init, headers });
  if (res.status === 401) {
    setAuthToken(null);
    clearPolicySessionId();
    notifyAuthExpired();
  }
  return res;
}

function getPolicySessionId(): string {
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;

    const sessionId = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    return sessionId;
  } catch {
    return crypto.randomUUID();
  }
}

function ensurePolicyResponse(
  value: unknown,
  mode: PolicyIntelligenceMode
): PolicyIntelligenceResponse {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {
      answer: 'Backend returned an invalid policy response.',
      mode,
      claimSafety: {
        level: 'not_ready',
        explanation: 'The frontend expected the backend-owned response contract.',
      },
    };
  }

  const response = value as PolicyIntelligenceResponse;
  return {
    answer:
      typeof response.answer === 'string' && response.answer.trim().length > 0
        ? response.answer
        : 'Backend returned no answer text.',
    mode: response.mode || mode,
    sources: Array.isArray(response.sources) ? response.sources : undefined,
    caveats: Array.isArray(response.caveats) ? response.caveats : undefined,
    claimSafety: response.claimSafety,
  };
}

export async function queryPolicyIntelligence(
  prompt: string,
  mode: PolicyIntelligenceMode
): Promise<PolicyIntelligenceResponse> {
  const res = await policyFetch(`${getApiBaseUrl()}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: getPolicySessionId(),
      prompt,
      mode,
    }),
  });

  const text = await res.text();

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Your access session has expired. Please sign in again.');
    }
    if (res.status === 403) {
      throw new Error('This account is not permitted to perform that action.');
    }
    throw new Error(text || `Policy backend request failed (${res.status})`);
  }

  try {
    return ensurePolicyResponse(JSON.parse(text), mode);
  } catch {
    return {
      answer: 'Backend returned a non-JSON response.',
      mode,
      claimSafety: {
        level: 'not_ready',
        explanation: 'The backend API should return the structured policy response contract.',
      },
    };
  }
}

export async function uploadEvidenceDocument(file: File): Promise<EvidenceDocument> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('sessionId', getPolicySessionId());
  formData.append('purpose', 'policy-evidence-ingestion');

  const res = await policyFetch(`${getApiBaseUrl()}/documents/upload`, {
    method: 'POST',
    body: formData,
  });

  const text = await res.text();

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Your access session has expired. Please sign in again.');
    }
    if (res.status === 403) {
      throw new Error('This account is not permitted to upload evidence.');
    }
    throw new Error(text || `Evidence upload failed (${res.status})`);
  }

  return JSON.parse(text) as EvidenceDocument;
}

export async function fetchEvidenceDocuments(): Promise<EvidenceDocument[]> {
  const res = await policyFetch(`${getApiBaseUrl()}/documents`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 401) {
      throw new Error('Your access session has expired. Please sign in again.');
    }
    if (res.status === 403) {
      throw new Error('This account cannot view the document registry.');
    }
    throw new Error(text || `Document registry request failed (${res.status})`);
  }

  return (await res.json()) as EvidenceDocument[];
}

export async function ingestEvidenceDocument(documentId: string): Promise<any> {
  const res = await policyFetch(`${getApiBaseUrl()}/documents/${documentId}/ingest`, {
    method: 'POST',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Ingestion failed (${res.status})`);
  }

  return res.json();
}

export async function fetchCorpusStats(): Promise<CorpusStats> {
  const res = await policyFetch(`${getApiBaseUrl()}/corpus/stats`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 401) {
      throw new Error('Your access session has expired. Please sign in again.');
    }
    if (res.status === 403) {
      throw new Error('This account cannot view corpus status.');
    }
    throw new Error(text || `Corpus stats request failed (${res.status})`);
  }

  return (await res.json()) as CorpusStats;
}

export async function fetchRetrievalDebug(query: string): Promise<unknown> {
  const res = await policyFetch(
    `${getApiBaseUrl()}/retrieval/debug?q=${encodeURIComponent(query)}`
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 401) {
      throw new Error('Your access session has expired. Please sign in again.');
    }
    if (res.status === 403) {
      throw new Error('Retrieval debug is limited to the platform owner.');
    }
    throw new Error(text || `Retrieval debug request failed (${res.status})`);
  }

  return res.json();
}

export async function checkPolicyBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function loginPolicyUser(email: string, password: string): Promise<AuthSession> {
  const res = await fetch(`${getApiBaseUrl()}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `Login failed (${res.status})`);
  }

  const session = JSON.parse(text) as AuthSession;
  clearPolicySessionId();
  setAuthToken(session.token);
  return session;
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  if (!getAuthToken()) return null;

  const res = await policyFetch(`${getApiBaseUrl()}/auth/me`);
  if (!res.ok) return null;
  const data = (await res.json()) as { user?: AuthUser };
  return data.user ?? null;
}

export async function logoutPolicyUser(): Promise<void> {
  const token = getAuthToken();
  setAuthToken(null);
  clearPolicySessionId();
  if (!token) return;

  await fetch(`${getApiBaseUrl()}/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}
