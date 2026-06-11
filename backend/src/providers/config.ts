import type { ProviderStatus, ProviderType, ResolvedProviderConfig } from './types.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';
const DEFAULT_ANTHROPIC_VERSION = '2023-06-01';

function normalizeProviderType(value: string | undefined): ProviderType {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized === 'openai_compatible' ||
    normalized === 'anthropic' ||
    normalized === 'legacy_n8n' ||
    normalized === 'none'
  ) {
    return normalized;
  }

  if (process.env.LEGACY_N8N_CHAT_WEBHOOK_URL || process.env.N8N_CHAT_WEBHOOK_URL) {
    return 'legacy_n8n';
  }

  return 'none';
}

function parseTimeoutMs(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function resolveApiKey(apiKeyEnvVar: string | undefined): string | undefined {
  if (!apiKeyEnvVar) return undefined;
  const apiKey = process.env[apiKeyEnvVar];
  return typeof apiKey === 'string' && apiKey.trim().length > 0 ? apiKey.trim() : undefined;
}

function resolveApiKeyEnvVar(type: ProviderType): string | undefined {
  if (process.env.MODEL_PROVIDER_API_KEY_ENV_VAR?.trim()) {
    return process.env.MODEL_PROVIDER_API_KEY_ENV_VAR.trim();
  }

  if (type === 'openai_compatible') return 'OPENAI_API_KEY';
  if (type === 'anthropic') return 'ANTHROPIC_API_KEY';
  return undefined;
}

export function resolveProviderConfig(): ResolvedProviderConfig {
  const type = normalizeProviderType(process.env.MODEL_PROVIDER_TYPE);
  const timeoutMs = parseTimeoutMs(process.env.MODEL_PROVIDER_TIMEOUT_MS);

  if (type === 'none') {
    return { type: 'none', timeoutMs };
  }

  if (type === 'legacy_n8n') {
    const webhookUrl =
      process.env.LEGACY_N8N_CHAT_WEBHOOK_URL?.trim() ||
      process.env.N8N_CHAT_WEBHOOK_URL?.trim();

    if (!webhookUrl) {
      return { type: 'none', timeoutMs };
    }

    return {
      type: 'legacy_n8n',
      webhookUrl,
      timeoutMs,
    };
  }

  const model = process.env.MODEL_PROVIDER_MODEL?.trim();
  const apiKeyEnvVar = resolveApiKeyEnvVar(type);
  const apiKey =
    process.env.MODEL_PROVIDER_API_KEY?.trim() || resolveApiKey(apiKeyEnvVar);

  if (type === 'openai_compatible') {
    return {
      type,
      model: model || '',
      baseUrl:
        process.env.MODEL_PROVIDER_BASE_URL?.trim() || DEFAULT_OPENAI_BASE_URL,
      apiKey: apiKey || '',
      apiKeyEnvVar,
      timeoutMs,
    };
  }

  return {
    type: 'anthropic',
    model: model || '',
    baseUrl:
      process.env.MODEL_PROVIDER_BASE_URL?.trim() || DEFAULT_ANTHROPIC_BASE_URL,
    apiKey: apiKey || '',
    apiKeyEnvVar,
    timeoutMs,
    anthropicVersion:
      process.env.ANTHROPIC_VERSION?.trim() || DEFAULT_ANTHROPIC_VERSION,
  };
}

export function describeProviderConfig(): ProviderStatus {
  const config = resolveProviderConfig();

  if (config.type === 'none') {
    return {
      type: 'none',
      configured: false,
      legacy: false,
      missing: ['provider'],
    };
  }

  if (config.type === 'legacy_n8n') {
    return {
      type: 'legacy_n8n',
      configured: Boolean(config.webhookUrl),
      legacy: true,
      missing: config.webhookUrl ? [] : ['LEGACY_N8N_CHAT_WEBHOOK_URL'],
    };
  }

  const missing = [];
  if (!config.model) missing.push('MODEL_PROVIDER_MODEL');
  if (!config.apiKey) {
    missing.push(config.apiKeyEnvVar || 'MODEL_PROVIDER_API_KEY');
  }

  return {
    type: config.type,
    configured: missing.length === 0,
    model: config.model,
    baseUrl: config.baseUrl,
    apiKeyEnvVar: config.apiKeyEnvVar,
    legacy: false,
    missing,
  };
}
