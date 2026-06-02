// Embeddings provider registry. Mirrors src/providers/index.ts for chat.

import type { ProviderKind } from '../types/gateway.types.js';
import type { EmbedProviderAdapter } from './types.js';
import { echoEmbedProvider } from './echo.js';
import { openaiEmbedProvider } from './openai.js';

const registry: Partial<Record<ProviderKind, EmbedProviderAdapter>> = {
  echo: echoEmbedProvider,
  openai: openaiEmbedProvider,
  // anthropic + gemini + mistral embeddings come in a future slice.
};

export function resolveEmbedProvider(kind: ProviderKind): EmbedProviderAdapter {
  const adapter = registry[kind];
  if (!adapter) {
    throw new Error(`PROVIDER_NOT_CONFIGURED:embeddings:${kind}`);
  }
  return adapter;
}

export function availableEmbedProviders(): ProviderKind[] {
  return Object.keys(registry) as ProviderKind[];
}
