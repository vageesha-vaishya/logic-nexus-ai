// Anthropic provider adapter — first real-LLM provider (P1.2).
//
// Credential-deferred pattern: if ANTHROPIC_API_KEY is missing at
// invocation time, throw PROVIDER_NOT_CONFIGURED so the resolver +
// route layer can return the correct 503 error envelope. Keys are NOT
// loaded at module import — that way the gateway boots successfully
// even when this provider isn't configured for the local dev/test env.
//
// P1.2 scope: text-only request → text-only response. P3 will add tool
// use, vision input, streaming. Cost is computed from
// gateway.provider_models input/output rates (passed by resolver).
//
// CI lint (per design §1.6) will eventually forbid @anthropic-ai/sdk
// imports outside services/llm-gateway/src/providers/**.

import Anthropic from '@anthropic-ai/sdk';
import type {
  InvokeRequest,
  ProviderAdapter,
  ProviderContext,
  ProviderResult,
  InvokeUsage,
} from '../types/gateway.types.js';

// Tunable defaults — overridden per-call via InvokeOptions.
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.0;
const DEFAULT_MODEL = 'claude-opus-4-7';

let cachedClient: Anthropic | null = null;
let cachedKeyHash: string | null = null;

function clientForKey(apiKey: string): Anthropic {
  // Cheap fingerprint so a key rotation reloads the SDK client.
  const fingerprint = `${apiKey.slice(0, 6)}…${apiKey.length}`;
  if (cachedClient && cachedKeyHash === fingerprint) return cachedClient;
  cachedClient = new Anthropic({ apiKey });
  cachedKeyHash = fingerprint;
  return cachedClient;
}

/**
 * Render variables into a prompt body. P1.2 uses a trivial JSON-stringify
 * scaffold; P3 swaps this for the prompt-template engine that reads
 * gateway.prompt_versions.body + frontmatter.
 */
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
    .filter((line) => line !== '')
    .join('\n');
}

interface AnthropicConfig {
  /** Captured cost rates from the model catalog. Resolver passes these. */
  input_cost_per_million_tokens?: number;
  output_cost_per_million_tokens?: number;
  /** Optional: custom system prompt (P3 will source from prompt frontmatter). */
  system?: string;
}

/**
 * Factory so the resolver can pass per-call cost rates. The actual
 * `ProviderAdapter` exported as default uses zero-cost defaults — the
 * cost calc kicks in once P3 wires the rate lookup.
 */
export function makeAnthropicProvider(config: AnthropicConfig = {}): ProviderAdapter {
  return {
    kind: 'anthropic',
    async invoke(req: InvokeRequest, ctx: ProviderContext): Promise<ProviderResult> {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('PROVIDER_NOT_CONFIGURED:anthropic:ANTHROPIC_API_KEY missing');
      }

      const client = clientForKey(apiKey);
      const model = ctx.model_id || DEFAULT_MODEL;
      const max_tokens = req.options?.max_tokens ?? DEFAULT_MAX_TOKENS;
      const temperature = req.options?.temperature ?? DEFAULT_TEMPERATURE;
      const timeout_ms = req.options?.timeout_ms ?? 30_000;

      // P3.2: prefer pre-rendered prompt body from the gateway prompt store;
      // fall back to the JSON-stringify scaffold when no prompt is registered.
      const userContent = ctx.rendered_body ?? renderPromptBody(req);

      // §9.3 tool use — translate gateway ToolDef → Anthropic's `tools` shape.
      const tools = (req.tools ?? []).map((t) => ({
        name: t.name,
        description: t.description ?? '',
        input_schema: t.parameters_schema as Anthropic.Tool['input_schema'],
      }));
      // Anthropic's tool_choice: { type: 'auto' | 'any' | 'tool', name? }
      let tool_choice: Anthropic.MessageCreateParams['tool_choice'];
      if (req.tool_choice === 'required') tool_choice = { type: 'any' };
      else if (req.tool_choice === 'auto') tool_choice = { type: 'auto' };
      else if (req.tool_choice && typeof req.tool_choice === 'object' && 'name' in req.tool_choice) {
        tool_choice = { type: 'tool', name: req.tool_choice.name };
      }
      // 'none' is honored by simply NOT passing the tools[] field
      const passTools = req.tool_choice === 'none' ? undefined : (tools.length > 0 ? tools : undefined);

      const message = await client.messages.create(
        {
          model,
          max_tokens,
          temperature,
          system: config.system,
          messages: [{ role: 'user', content: userContent }],
          ...(passTools ? { tools: passTools } : {}),
          ...(tool_choice && passTools ? { tool_choice } : {}),
        },
        { timeout: timeout_ms },
      );

      // Anthropic returns content as an array of typed blocks. §9.3:
      // both 'text' and 'tool_use' blocks now flow through.
      const textBlocks = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text);
      const output_text = textBlocks.join('\n');

      const tool_use_blocks = message.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );
      const tool_calls = tool_use_blocks.map((b) => ({
        id: b.id,
        name: b.name,
        args: (b.input ?? {}) as Record<string, unknown>,
      }));

      const usage: InvokeUsage = {
        prompt_tokens: message.usage.input_tokens,
        completion_tokens: message.usage.output_tokens,
        total_tokens: message.usage.input_tokens + message.usage.output_tokens,
      };

      const cost_usd =
        (usage.prompt_tokens * (config.input_cost_per_million_tokens ?? 0)) / 1_000_000 +
        (usage.completion_tokens * (config.output_cost_per_million_tokens ?? 0)) / 1_000_000;

      return {
        output: { text: output_text, raw_content: message.content },
        model_used: message.model,
        usage,
        cost_usd: Number(cost_usd.toFixed(6)),
        warnings: textBlocks.length === 0 && tool_calls.length === 0 ? ['anthropic_no_text_blocks'] : undefined,
        ...(tool_calls.length > 0 ? { tool_calls } : {}),
      };
    },
  };
}

// Default export uses zero-cost defaults; resolver can supply
// rates via the factory when wiring through gateway.provider_models.
export const anthropicProvider: ProviderAdapter = makeAnthropicProvider();
