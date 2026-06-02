// Google Gemini provider adapter (P1.4). Built on the Anthropic
// template. Reads GEMINI_API_KEY (or GOOGLE_AI_API_KEY).
// SDK: @google/generative-ai.

import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  InvokeRequest,
  InvokeUsage,
  ProviderAdapter,
  ProviderContext,
  ProviderResult,
} from '../types/gateway.types.js';

const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.0;
const DEFAULT_MODEL = 'gemini-1.5-pro';

let cachedClient: GoogleGenerativeAI | null = null;
let cachedKeyFingerprint: string | null = null;

function clientForKey(apiKey: string): GoogleGenerativeAI {
  const fingerprint = `${apiKey.slice(0, 6)}…${apiKey.length}`;
  if (cachedClient && cachedKeyFingerprint === fingerprint) return cachedClient;
  cachedClient = new GoogleGenerativeAI(apiKey);
  cachedKeyFingerprint = fingerprint;
  return cachedClient;
}

function renderPromptBody(req: InvokeRequest): string {
  return [
    `[prompt_key=${req.prompt_key}]`,
    `[tenant_id=${req.tenant_id}]`,
    '',
    'Variables:',
    JSON.stringify(req.variables, null, 2),
    '',
    req.subject ? `Subject: ${req.subject.type}/${req.subject.id}` : '',
  ]
    .filter((l) => l !== '')
    .join('\n');
}

interface GeminiConfig {
  input_cost_per_million_tokens?: number;
  output_cost_per_million_tokens?: number;
  system?: string;
}

export function makeGeminiProvider(config: GeminiConfig = {}): ProviderAdapter {
  return {
    kind: 'google_gemini',
    async invoke(req: InvokeRequest, ctx: ProviderContext): Promise<ProviderResult> {
      const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
      if (!apiKey) {
        throw new Error('PROVIDER_NOT_CONFIGURED:google_gemini:GEMINI_API_KEY missing');
      }

      const client = clientForKey(apiKey);
      const modelId = ctx.model_id || DEFAULT_MODEL;
      const max_tokens = req.options?.max_tokens ?? DEFAULT_MAX_TOKENS;
      const temperature = req.options?.temperature ?? DEFAULT_TEMPERATURE;
      // Gemini SDK has no per-call timeout knob; rely on the surrounding
      // request timeout from Express until the SDK gains one.

      const model = client.getGenerativeModel({
        model: modelId,
        generationConfig: {
          maxOutputTokens: max_tokens,
          temperature,
        },
        systemInstruction: config.system,
      });

      const result = await model.generateContent(renderPromptBody(req));
      const response = result.response;

      const text = response.text();
      const usageMeta = response.usageMetadata;
      const usage: InvokeUsage = {
        prompt_tokens: usageMeta?.promptTokenCount ?? 0,
        completion_tokens: usageMeta?.candidatesTokenCount ?? 0,
        total_tokens:
          usageMeta?.totalTokenCount ??
          ((usageMeta?.promptTokenCount ?? 0) + (usageMeta?.candidatesTokenCount ?? 0)),
      };

      const cost_usd =
        (usage.prompt_tokens * (config.input_cost_per_million_tokens ?? 0)) / 1_000_000 +
        (usage.completion_tokens * (config.output_cost_per_million_tokens ?? 0)) / 1_000_000;

      return {
        output: { text, raw_response_candidates: response.candidates },
        model_used: modelId,
        usage,
        cost_usd: Number(cost_usd.toFixed(6)),
        warnings: text.length === 0 ? ['gemini_empty_response'] : undefined,
      };
    },
  };
}

export const geminiProvider: ProviderAdapter = makeGeminiProvider();
