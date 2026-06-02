// Provider registry. P0 only ships `echo`; P1 adds anthropic / openai /
// gemini / mistral; P2 adds replay; P3 onwards ollama / vllm / azure_openai.
//
// Per design §1.6 a CI lint will eventually forbid SDK imports outside
// services/llm-gateway/src/providers/**.

import type { ProviderAdapter, ProviderKind } from '../types/gateway.types.js';
import { echoProvider } from './echo.js';

const registry: Partial<Record<ProviderKind, ProviderAdapter>> = {
  echo: echoProvider,
};

export function resolveProvider(kind: ProviderKind): ProviderAdapter {
  const adapter = registry[kind];
  if (!adapter) {
    throw new Error(`PROVIDER_NOT_CONFIGURED:${kind}`);
  }
  return adapter;
}

export function availableProviders(): ProviderKind[] {
  return Object.keys(registry) as ProviderKind[];
}
