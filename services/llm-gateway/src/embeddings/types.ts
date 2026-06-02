// Types for the embeddings layer. Per design §9.2.
//
// Storage of vectors is caller's responsibility (pgvector, Pinecone,
// etc.) — gateway is stateless for embeddings beyond optional caching.

import type { ProviderKind } from '../types/gateway.types.js';

export interface EmbedRequest {
  tenant_id: string;
  /** Per-tenant model selector. Defaults to text-embedding-3-small. */
  model?: string;
  /** Inputs to embed. Must be a non-empty array of strings. */
  inputs: string[];
  /** Optional metadata pass-through (e.g. document_id); never embedded. */
  metadata?: Record<string, unknown>;
}

export interface EmbedResponse {
  invocation_id: string;
  model_used: string;
  provider_kind: ProviderKind;
  /** One vector per input, in the same order. */
  embeddings: number[][];
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
  cost_usd: number;
  latency_ms: number;
  warnings?: string[];
}

export interface EmbedProviderContext {
  invocation_id: string;
  model_id: string;
  started_at: number;
  request_id: string;
}

export interface EmbedProviderResult {
  embeddings: number[][];
  model_used: string;
  usage: { prompt_tokens: number; total_tokens: number };
  cost_usd: number;
  warnings?: string[];
}

/** Provider-side embeddings adapter — separate from the chat ProviderAdapter. */
export interface EmbedProviderAdapter {
  kind: ProviderKind;
  embed(req: EmbedRequest, ctx: EmbedProviderContext): Promise<EmbedProviderResult>;
}

export class EmbeddingsError extends Error {
  constructor(
    public readonly code: 'INVALID_REQUEST' | 'PROVIDER_NOT_CONFIGURED' | 'PROVIDER_UNAVAILABLE',
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'EmbeddingsError';
  }
}
