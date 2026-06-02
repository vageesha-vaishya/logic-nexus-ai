// OpenAI embeddings adapter. Credential-deferred — reads OPENAI_API_KEY
// at invoke time. Same pattern as the chat provider.

import OpenAI from 'openai';
import type {
  EmbedRequest,
  EmbedProviderAdapter,
  EmbedProviderContext,
  EmbedProviderResult,
} from './types.js';

const DEFAULT_MODEL = 'text-embedding-3-small';

let cachedClient: OpenAI | null = null;
let cachedKeyFingerprint: string | null = null;

function clientForKey(apiKey: string): OpenAI {
  const fingerprint = `${apiKey.slice(0, 6)}…${apiKey.length}`;
  if (cachedClient && cachedKeyFingerprint === fingerprint) return cachedClient;
  cachedClient = new OpenAI({ apiKey });
  cachedKeyFingerprint = fingerprint;
  return cachedClient;
}

interface OpenAIEmbedConfig {
  /** Cost per million input tokens. */
  input_cost_per_million_tokens?: number;
}

export function makeOpenAIEmbedProvider(config: OpenAIEmbedConfig = {}): EmbedProviderAdapter {
  return {
    kind: 'openai',
    async embed(req: EmbedRequest, ctx: EmbedProviderContext): Promise<EmbedProviderResult> {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('PROVIDER_NOT_CONFIGURED:openai:OPENAI_API_KEY missing');
      }
      const client = clientForKey(apiKey);
      const model = ctx.model_id || DEFAULT_MODEL;

      const response = await client.embeddings.create({
        model,
        input: req.inputs,
      });

      const embeddings = response.data.map((d) => d.embedding);
      const total_tokens = response.usage?.total_tokens ?? 0;
      const prompt_tokens = response.usage?.prompt_tokens ?? total_tokens;
      const cost_usd = (prompt_tokens * (config.input_cost_per_million_tokens ?? 0)) / 1_000_000;

      return {
        embeddings,
        model_used: response.model ?? model,
        usage: { prompt_tokens, total_tokens },
        cost_usd: Number(cost_usd.toFixed(6)),
      };
    },
  };
}

export const openaiEmbedProvider: EmbedProviderAdapter = makeOpenAIEmbedProvider();
