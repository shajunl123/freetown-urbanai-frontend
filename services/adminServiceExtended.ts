const DEFAULT_API_BASE_URL = '/api';

function getApiBaseUrl(): string {
  return (import.meta.env.VITE_POLICY_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');
}

function getAuthToken(): string | null {
  try {
    return window.localStorage.getItem('freetown-urbanai.auth-token');
  } catch {
    return null;
  }
}

async function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getAuthToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

export async function fetchAdminOverview() {
  const res = await adminFetch(`${getApiBaseUrl()}/admin/users/overview`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchAdminUsers() {
  const res = await adminFetch(`${getApiBaseUrl()}/admin/users/users`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchAdminUserDetail(userId: string) {
  const res = await adminFetch(`${getApiBaseUrl()}/admin/users/users/${userId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchAdminUserUsage(userId: string) {
  const res = await adminFetch(`${getApiBaseUrl()}/admin/users/users/${userId}/usage`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchAdminUserActivity(userId: string, limit = 50) {
  const res = await adminFetch(`${getApiBaseUrl()}/admin/users/users/${userId}/activity?limit=${limit}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchAdminAuditLog(limit = 100) {
  const res = await adminFetch(`${getApiBaseUrl()}/admin/audit-log?limit=${limit}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createAdminUser(params: {
  email: string;
  name: string;
  password: string;
  role: string;
}) {
  const res = await adminFetch(`${getApiBaseUrl()}/admin/users/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateAdminUser(userId: string, params: {
  name?: string;
  role?: string;
  password?: string;
}) {
  const res = await adminFetch(`${getApiBaseUrl()}/admin/users/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function disableAdminUser(userId: string) {
  const res = await adminFetch(`${getApiBaseUrl()}/admin/users/users/${userId}/disable`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function enableAdminUser(userId: string) {
  const res = await adminFetch(`${getApiBaseUrl()}/admin/users/users/${userId}/enable`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteAdminUser(userId: string) {
  const res = await adminFetch(`${getApiBaseUrl()}/admin/users/users/${userId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchAdminSessions() {
  const res = await adminFetch(`${getApiBaseUrl()}/admin/users/sessions`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchAdminSessionMessages(sessionId: string) {
  const res = await adminFetch(`${getApiBaseUrl()}/admin/users/sessions/${sessionId}/messages`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchAdminDocuments() {
  const res = await adminFetch(`${getApiBaseUrl()}/admin/users/documents`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchAdminDocumentChunks(documentId: string) {
  const res = await adminFetch(`${getApiBaseUrl()}/admin/users/documents/${documentId}/chunks`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateAdminDocumentApproval(documentId: string, approvalStatus: string) {
  const res = await adminFetch(`${getApiBaseUrl()}/admin/users/documents/${documentId}/approval`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approvalStatus }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchAdminProjectsOverview() {
  const res = await adminFetch(`${getApiBaseUrl()}/admin/users/projects`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
