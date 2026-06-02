// Provider registry. P0 only ships `echo`; P1 adds anthropic / openai /
// gemini / mistral; P2 adds replay; P3 onwards ollama / vllm / azure_openai.
//
// Per design §1.6 a CI lint will eventually forbid SDK imports outside
// services/llm-gateway/src/providers/**.

import type { ProviderAdapter, ProviderKind } from '../types/gateway.types.js';
import { echoProvider } from './echo.js';
import { replayProvider } from './replay.js';
import { anthropicProvider } from './anthropic.js';
import { openaiProvider } from './openai.js';
import { geminiProvider } from './gemini.js';
import { mistralProvider } from './mistral.js';

const registry: Partial<Record<ProviderKind, ProviderAdapter>> = {
  echo: echoProvider,
  replay: replayProvider,
  anthropic: anthropicProvider,
  openai: openaiProvider,
  google_gemini: geminiProvider,
  mistral: mistralProvider,
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
