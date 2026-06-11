export function envFlag(name: string, defaultValue = false): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (value === undefined || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value);
}

export function envInt(name: string, defaultValue: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : defaultValue;
}

export function securitySettings() {
  return {
    documentEncryptionEnabled: envFlag('ENABLE_DOCUMENT_ENCRYPTION', false),
    auditEnabled: envFlag('ENABLE_AUDIT_LOG', false),
    promptGuardEnabled: envFlag('ENABLE_PROMPT_GUARD', false),
    outputGuardEnabled: envFlag('ENABLE_OUTPUT_GUARD', false),
    contentFilterEnabled: envFlag('ENABLE_CONTENT_FILTER', false),
    rateLimitEnabled: envFlag('ENABLE_RATE_LIMIT', false),
    loginLockoutEnabled: envFlag('ENABLE_LOGIN_LOCKOUT', false),
    sessionInactivityEnabled: envFlag('ENABLE_SESSION_INACTIVITY_TIMEOUT', false),
    retentionEnabled: envFlag('ENABLE_DATA_RETENTION', false),
    queryLimitPerHour: envInt('QUERY_RATE_LIMIT_PER_HOUR', 100),
    sessionInactivityMinutes: envInt('SESSION_INACTIVITY_MINUTES', 30),
    loginLockoutThreshold: envInt('LOGIN_LOCKOUT_THRESHOLD', 5),
    loginLockoutMinutes: envInt('LOGIN_LOCKOUT_MINUTES', 15),
    providerRetryCount: envInt('MODEL_PROVIDER_RETRY_COUNT', 3),
  };
}
