import type { ProviderStatus, ProviderType, ResolvedProviderConfig } from './types.js';
import db from '../db.js';
import { decryptWithEnvKey } from '../services/cryptoService.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_TOKENS = 800;
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';
const DEFAULT_ANTHROPIC_VERSION = '2023-06-01';

function normalizeProviderType(value: string | undefined): ProviderType {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized === 'openai_compatible' ||
    normalized === 'nvidia' ||
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

function parseMaxTokens(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_TOKENS;
}

function activeDbProviderConfig():
  | {
      type: 'openai_compatible' | 'nvidia' | 'anthropic';
      model: string;
      baseUrl: string;
      apiKey: string;
      timeoutMs: number;
      maxTokens: number;
    }
  | null {
  const row = db.prepare(
    'SELECT * FROM api_provider_configs WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 1'
  ).get() as any | undefined;

  if (!row) return null;
  const type = normalizeProviderType(row.provider_type);
  if (type === 'none' || type === 'legacy_n8n') return null;
  const apiKey = row.api_key_ciphertext && row.api_key_iv && row.api_key_tag
    ? decryptWithEnvKey(
        {
          ciphertext: row.api_key_ciphertext,
          iv: row.api_key_iv,
          tag: row.api_key_tag,
        },
        'API_CONFIG_ENCRYPTION_KEY'
      )
    : '';

  return {
    type,
    model: row.model || '',
    baseUrl: row.base_url || '',
    apiKey: apiKey || '',
    timeoutMs: row.timeout_ms || DEFAULT_TIMEOUT_MS,
    maxTokens: row.max_tokens || DEFAULT_MAX_TOKENS,
  };
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
  if (type === 'nvidia') return 'NVIDIA_API_KEY';
  if (type === 'anthropic') return 'ANTHROPIC_API_KEY';
  return undefined;
}

export function resolveProviderConfig(): ResolvedProviderConfig {
  const dbConfig = activeDbProviderConfig();
  if (dbConfig) {
    if (dbConfig.type === 'anthropic') {
      return {
        type: 'anthropic',
        model: dbConfig.model,
        baseUrl: dbConfig.baseUrl || DEFAULT_ANTHROPIC_BASE_URL,
        apiKey: dbConfig.apiKey,
        timeoutMs: dbConfig.timeoutMs,
        maxTokens: dbConfig.maxTokens,
        anthropicVersion:
          process.env.ANTHROPIC_VERSION?.trim() || DEFAULT_ANTHROPIC_VERSION,
      };
    }

    return {
      type: dbConfig.type,
      model: dbConfig.model,
      baseUrl:
        dbConfig.baseUrl ||
        (dbConfig.type === 'nvidia' ? DEFAULT_NVIDIA_BASE_URL : DEFAULT_OPENAI_BASE_URL),
      apiKey: dbConfig.apiKey,
      timeoutMs: dbConfig.timeoutMs,
      maxTokens: dbConfig.maxTokens,
    };
  }

  const type = normalizeProviderType(process.env.MODEL_PROVIDER_TYPE);
  const timeoutMs = parseTimeoutMs(process.env.MODEL_PROVIDER_TIMEOUT_MS);
  const maxTokens = parseMaxTokens(process.env.MODEL_PROVIDER_MAX_TOKENS);

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

  if (type === 'openai_compatible' || type === 'nvidia') {
    return {
      type,
      model: model || '',
      baseUrl:
        process.env.MODEL_PROVIDER_BASE_URL?.trim() ||
        (type === 'nvidia' ? DEFAULT_NVIDIA_BASE_URL : DEFAULT_OPENAI_BASE_URL),
      apiKey: apiKey || '',
      apiKeyEnvVar,
      timeoutMs,
      maxTokens,
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
    maxTokens,
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
