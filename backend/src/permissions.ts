import type { AuthUser, UserRole } from './types.js';

export const PLATFORM_OWNER_ROLES: UserRole[] = ['admin'];
export const CORPUS_OPERATOR_ROLES: UserRole[] = ['admin', 'operator'];

export function isPlatformOwner(role: UserRole): boolean {
  return PLATFORM_OWNER_ROLES.includes(role);
}

export function isCorpusOperator(role: UserRole): boolean {
  return CORPUS_OPERATOR_ROLES.includes(role);
}

export function canInspectSessionHistory(
  requester: AuthUser,
  sessionOwnerId: string | null | undefined
): boolean {
  if (isPlatformOwner(requester.role)) return true;
  return Boolean(sessionOwnerId) && sessionOwnerId === requester.id;
}
