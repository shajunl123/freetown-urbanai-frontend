import type { PolicyIntelligenceMode, RetrievalResult } from '../types.js';

export type ProviderType =
  | 'none'
  | 'openai_compatible'
  | 'anthropic'
  | 'legacy_n8n';

export interface ProviderRequest {
  sessionId: string;
  prompt: string;
  mode: PolicyIntelligenceMode;
  evidence: RetrievalResult[];
}

export interface ProviderOutput {
  providerType: Exclude<ProviderType, 'none'>;
  model?: string;
  raw: string | null;
}

export interface ProviderStatus {
  type: ProviderType;
  configured: boolean;
  model?: string;
  baseUrl?: string;
  apiKeyEnvVar?: string;
  legacy: boolean;
  missing: string[];
}

export interface OpenAICompatibleProviderConfig {
  type: 'openai_compatible';
  model: string;
  baseUrl: string;
  apiKey: string;
  apiKeyEnvVar?: string;
  timeoutMs: number;
}

export interface AnthropicProviderConfig {
  type: 'anthropic';
  model: string;
  baseUrl: string;
  apiKey: string;
  apiKeyEnvVar?: string;
  timeoutMs: number;
  anthropicVersion: string;
}

export interface LegacyN8nProviderConfig {
  type: 'legacy_n8n';
  webhookUrl: string;
  timeoutMs: number;
}

export type ResolvedProviderConfig =
  | { type: 'none'; timeoutMs: number }
  | OpenAICompatibleProviderConfig
  | AnthropicProviderConfig
  | LegacyN8nProviderConfig;
