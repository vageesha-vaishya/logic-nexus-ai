// OpenAI provider adapter (P1.4). Built on the Anthropic template.
// Same credential-deferred pattern: ANTHROPIC_API_KEY → OPENAI_API_KEY.
// SDK: openai (the official Node SDK).

import OpenAI from 'openai';
import type {
  InvokeRequest,
  InvokeUsage,
  ProviderAdapter,
  ProviderContext,
  ProviderResult,
} from '../types/gateway.types.js';

const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.0;
const DEFAULT_MODEL = 'gpt-4o';

let cachedClient: OpenAI | null = null;
let cachedKeyFingerprint: string | null = null;

function clientForKey(apiKey: string): OpenAI {
  const fingerprint = `${apiKey.slice(0, 6)}…${apiKey.length}`;
  if (cachedClient && cachedKeyFingerprint === fingerprint) return cachedClient;
  cachedClient = new OpenAI({ apiKey });
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

interface OpenAIConfig {
  input_cost_per_million_tokens?: number;
  output_cost_per_million_tokens?: number;
  system?: string;
}

export function makeOpenAIProvider(config: OpenAIConfig = {}): ProviderAdapter {
  return {
    kind: 'openai',
    async invoke(req: InvokeRequest, ctx: ProviderContext): Promise<ProviderResult> {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('PROVIDER_NOT_CONFIGURED:openai:OPENAI_API_KEY missing');
      }

      const client = clientForKey(apiKey);
      const model = ctx.model_id || DEFAULT_MODEL;
      const max_tokens = req.options?.max_tokens ?? DEFAULT_MAX_TOKENS;
      const temperature = req.options?.temperature ?? DEFAULT_TEMPERATURE;
      const timeout_ms = req.options?.timeout_ms ?? 30_000;

      const messages: { role: 'system' | 'user'; content: string }[] = [];
      if (config.system) messages.push({ role: 'system', content: config.system });
      // P3.2: prefer pre-rendered prompt body from the gateway prompt store.
      messages.push({ role: 'user', content: ctx.rendered_body ?? renderPromptBody(req) });

      // §9.3 tool use — translate gateway ToolDef → OpenAI's `tools` shape
      // (each tool wrapped in { type: 'function', function: { name, description, parameters } }).
      const tools = (req.tools ?? []).map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description ?? '',
          parameters: t.parameters_schema,
        },
      }));
      let tool_choice: OpenAI.Chat.ChatCompletionToolChoiceOption | undefined;
      if (req.tool_choice === 'required') tool_choice = 'required';
      else if (req.tool_choice === 'auto') tool_choice = 'auto';
      else if (req.tool_choice === 'none') tool_choice = 'none';
      else if (req.tool_choice && typeof req.tool_choice === 'object' && 'name' in req.tool_choice) {
        tool_choice = { type: 'function', function: { name: req.tool_choice.name } };
      }
      const passTools = req.tool_choice === 'none' ? undefined : (tools.length > 0 ? tools : undefined);

      const completion = await client.chat.completions.create(
        {
          model,
          max_tokens,
          temperature,
          messages,
          ...(passTools ? { tools: passTools } : {}),
          ...(tool_choice && passTools ? { tool_choice } : {}),
        },
        { timeout: timeout_ms },
      );

      const choice = completion.choices[0];
      const text = choice?.message?.content ?? '';
      const tool_calls = (choice?.message?.tool_calls ?? [])
        .filter((tc): tc is OpenAI.Chat.ChatCompletionMessageFunctionToolCall => tc.type === 'function')
        .map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          args: (() => {
            try { return JSON.parse(tc.function.arguments) as Record<string, unknown>; }
            catch { return {} as Record<string, unknown>; }
          })(),
        }));

      const usage: InvokeUsage = {
        prompt_tokens: completion.usage?.prompt_tokens ?? 0,
        completion_tokens: completion.usage?.completion_tokens ?? 0,
        total_tokens: completion.usage?.total_tokens ?? 0,
      };

      const cost_usd =
        (usage.prompt_tokens * (config.input_cost_per_million_tokens ?? 0)) / 1_000_000 +
        (usage.completion_tokens * (config.output_cost_per_million_tokens ?? 0)) / 1_000_000;

      return {
        output: { text, raw_choice: completion.choices[0] },
        model_used: completion.model,
        usage,
        cost_usd: Number(cost_usd.toFixed(6)),
        warnings: text.length === 0 && tool_calls.length === 0 ? ['openai_empty_response'] : undefined,
        ...(tool_calls.length > 0 ? { tool_calls } : {}),
      };
    },
  };
}

export const openaiProvider: ProviderAdapter = makeOpenAIProvider();
