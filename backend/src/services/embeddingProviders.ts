export type EmbeddingProviderName = 'nvidia' | 'mistral' | 'local';

export interface EmbeddingProviderStatus {
  provider: EmbeddingProviderName;
  configured: boolean;
  model?: string;
  baseUrl?: string;
  missing: string[];
  external: boolean;
}

export interface ResolvedEmbeddingConfig extends EmbeddingProviderStatus {
  apiKey: string;
  timeoutMs: number;
  batchSize: number;
}

const DEFAULT_NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const DEFAULT_NVIDIA_MODEL = 'nvidia/nv-embedqa-mistral-7b-v2';
const DEFAULT_MISTRAL_BASE_URL = 'https://api.mistral.ai/v1';
const DEFAULT_MISTRAL_MODEL = 'mistral-embed';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_BATCH_SIZE = 32;

function normalizeProvider(value: string | undefined): EmbeddingProviderName {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'nvidia' || normalized === 'mistral' || normalized === 'local') {
    return normalized;
  }
  return 'local';
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function resolveEmbeddingConfig(): ResolvedEmbeddingConfig {
  const provider = normalizeProvider(process.env.EMBEDDING_PROVIDER);
  const timeoutMs = parsePositiveInt(process.env.EMBEDDING_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const batchSize = parsePositiveInt(process.env.EMBEDDING_BATCH_SIZE, DEFAULT_BATCH_SIZE);

  if (provider === 'local') {
    return {
      provider,
      configured: true,
      missing: [],
      external: false,
      apiKey: '',
      timeoutMs,
      batchSize,
    };
  }

  const defaultBaseUrl =
    provider === 'nvidia' ? DEFAULT_NVIDIA_BASE_URL : DEFAULT_MISTRAL_BASE_URL;
  const defaultModel = provider === 'nvidia' ? DEFAULT_NVIDIA_MODEL : DEFAULT_MISTRAL_MODEL;
  const apiKey = process.env.EMBEDDING_API_KEY?.trim() || '';
  const baseUrl = process.env.EMBEDDING_BASE_URL?.trim() || defaultBaseUrl;
  const model = process.env.EMBEDDING_MODEL?.trim() || defaultModel;
  const missing = [];

  if (!apiKey) missing.push('EMBEDDING_API_KEY');
  if (!model) missing.push('EMBEDDING_MODEL');

  return {
    provider,
    configured: missing.length === 0,
    model,
    baseUrl,
    missing,
    external: true,
    apiKey,
    timeoutMs,
    batchSize,
  };
}

function extractEmbeddingData(body: unknown): number[][] {
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => {
      const embedding = (item as { embedding?: unknown }).embedding;
      return Array.isArray(embedding)
        ? embedding.map((value) => Number(value)).filter((value) => Number.isFinite(value))
        : [];
    })
    .filter((embedding) => embedding.length > 0);
}

function extraEmbeddingBody(): Record<string, unknown> {
  const raw = process.env.EMBEDDING_EXTRA_JSON?.trim();
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    console.warn('[embedding] Ignoring invalid EMBEDDING_EXTRA_JSON.');
    return {};
  }
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const config = resolveEmbeddingConfig();
  if (!config.external) {
    throw new Error('Local TF-IDF provider does not produce dense embeddings.');
  }
  if (!config.configured || !config.baseUrl || !config.model) {
    throw new Error(`Embedding provider is not configured: ${config.missing.join(', ')}`);
  }

  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      input: texts,
      encoding_format: 'float',
      ...extraEmbeddingBody(),
    }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  const bodyText = await response.text().catch(() => '');
  if (!response.ok) {
    throw new Error(`Embedding provider failed (${response.status}): ${bodyText}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new Error('Embedding provider returned non-JSON output.');
  }

  const embeddings = extractEmbeddingData(parsed);
  if (embeddings.length !== texts.length) {
    throw new Error(
      `Embedding provider returned ${embeddings.length} embeddings for ${texts.length} inputs.`
    );
  }

  return embeddings;
}

export function getEmbeddingProviderStatus(): EmbeddingProviderStatus {
  const config = resolveEmbeddingConfig();
  return {
    provider: config.provider,
    configured: config.configured,
    model: config.model,
    baseUrl: config.baseUrl,
    missing: config.missing,
    external: config.external,
  };
}
