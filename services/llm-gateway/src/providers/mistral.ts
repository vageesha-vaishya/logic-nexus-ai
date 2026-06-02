// Mistral provider adapter (P1.4). Built on the Anthropic template.
// Reads MISTRAL_API_KEY. SDK: @mistralai/mistralai.

import { Mistral } from '@mistralai/mistralai';
import type {
  InvokeRequest,
  InvokeUsage,
  ProviderAdapter,
  ProviderContext,
  ProviderResult,
} from '../types/gateway.types.js';

const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.0;
const DEFAULT_MODEL = 'mistral-large-latest';

let cachedClient: Mistral | null = null;
let cachedKeyFingerprint: string | null = null;

function clientForKey(apiKey: string): Mistral {
  const fingerprint = `${apiKey.slice(0, 6)}…${apiKey.length}`;
  if (cachedClient && cachedKeyFingerprint === fingerprint) return cachedClient;
  cachedClient = new Mistral({ apiKey });
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

interface MistralConfig {
  input_cost_per_million_tokens?: number;
  output_cost_per_million_tokens?: number;
  system?: string;
}

export function makeMistralProvider(config: MistralConfig = {}): ProviderAdapter {
  return {
    kind: 'mistral',
    async invoke(req: InvokeRequest, ctx: ProviderContext): Promise<ProviderResult> {
      const apiKey = process.env.MISTRAL_API_KEY;
      if (!apiKey) {
        throw new Error('PROVIDER_NOT_CONFIGURED:mistral:MISTRAL_API_KEY missing');
      }

      const client = clientForKey(apiKey);
      const model = ctx.model_id || DEFAULT_MODEL;
      const max_tokens = req.options?.max_tokens ?? DEFAULT_MAX_TOKENS;
      const temperature = req.options?.temperature ?? DEFAULT_TEMPERATURE;

      const messages: { role: 'system' | 'user'; content: string }[] = [];
      if (config.system) messages.push({ role: 'system', content: config.system });
      // P3.2: prefer pre-rendered prompt body from the gateway prompt store.
      messages.push({ role: 'user', content: ctx.rendered_body ?? renderPromptBody(req) });

      const response = await client.chat.complete({
        model,
        maxTokens: max_tokens,
        temperature,
        messages,
      });

      const choice = response.choices?.[0];
      const messageContent = choice?.message?.content ?? '';
      const text = typeof messageContent === 'string'
        ? messageContent
        : Array.isArray(messageContent)
          ? messageContent.map((c) => ('text' in c ? c.text : '')).join('')
          : '';

      const usage: InvokeUsage = {
        prompt_tokens: response.usage?.promptTokens ?? 0,
        completion_tokens: response.usage?.completionTokens ?? 0,
        total_tokens: response.usage?.totalTokens ?? 0,
      };

      const cost_usd =
        (usage.prompt_tokens * (config.input_cost_per_million_tokens ?? 0)) / 1_000_000 +
        (usage.completion_tokens * (config.output_cost_per_million_tokens ?? 0)) / 1_000_000;

      return {
        output: { text, raw_choice: choice },
        model_used: response.model ?? model,
        usage,
        cost_usd: Number(cost_usd.toFixed(6)),
        warnings: text.length === 0 ? ['mistral_empty_response'] : undefined,
      };
    },
  };
}

export const mistralProvider: ProviderAdapter = makeMistralProvider();
