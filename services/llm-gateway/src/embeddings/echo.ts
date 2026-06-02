// Echo embeddings provider — deterministic mock for dev + tests.
// Produces a fixed-dimensional float vector from a hash of the input
// so identical inputs always produce identical vectors. No network,
// no LLM. Per the convention from the chat-echo provider.

import { createHash } from 'crypto';
import type {
  EmbedRequest,
  EmbedProviderAdapter,
  EmbedProviderContext,
  EmbedProviderResult,
} from './types.js';

const DEFAULT_DIM = 256;

function hashToVector(input: string, dim: number): number[] {
  // Roll the SHA-256 of the input over 32 bytes; convert each byte to a
  // float in [-1, 1]; tile to fill `dim` slots if dim > 32.
  const hash = createHash('sha256').update(input).digest();
  const vec: number[] = new Array(dim);
  for (let i = 0; i < dim; i += 1) {
    const byte = hash[i % hash.length]!;
    // Map 0..255 → -1..1 (continuous), with a small offset for non-zero values
    vec[i] = (byte / 255) * 2 - 1;
  }
  return vec;
}

function approxTokenCount(s: string): number {
  return Math.max(1, Math.ceil(s.length / 4));
}

export const echoEmbedProvider: EmbedProviderAdapter = {
  kind: 'echo',
  async embed(req: EmbedRequest, _ctx: EmbedProviderContext): Promise<EmbedProviderResult> {
    const dim = DEFAULT_DIM;
    const embeddings = req.inputs.map((s) => hashToVector(s, dim));
    const total_tokens = req.inputs.reduce((sum, s) => sum + approxTokenCount(s), 0);
    return {
      embeddings,
      model_used: 'echo-embed-v1',
      usage: { prompt_tokens: total_tokens, total_tokens },
      cost_usd: 0,
      warnings: ['echo_embed_provider_used'],
    };
  },
};
