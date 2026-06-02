// §9.3 tool use — covers the type shape, Anthropic + OpenAI translations
// (via mocked SDKs), and the round-trip through /v1/invoke (echo).

import { jest } from '@jest/globals';
import request from 'supertest';

// ── Mock the chat SDKs at the module boundary so we can capture the
// arguments the adapters pass through. ────────────────────────────────
const mockAnthropicCreate = jest.fn();
jest.unstable_mockModule('@anthropic-ai/sdk', () => {
  class FakeAnthropic { public messages = { create: mockAnthropicCreate }; constructor(_o: { apiKey: string }) {} }
  return { __esModule: true, default: FakeAnthropic };
});

const mockOpenAICreate = jest.fn();
jest.unstable_mockModule('openai', () => {
  class FakeOpenAI { public chat = { completions: { create: mockOpenAICreate } }; constructor(_o: { apiKey: string }) {} }
  return { __esModule: true, default: FakeOpenAI };
});

const { makeAnthropicProvider } = await import('../src/providers/anthropic.js');
const { makeOpenAIProvider } = await import('../src/providers/openai.js');
const { createApp } = await import('../src/app.js');
const { setAuthLookupForTesting } = await import('../src/routes/invoke.js');

const tools = [
  {
    name: 'search_db',
    description: 'Search the customer database',
    parameters_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
];

const baseReq = {
  tenant_id: '00000000-0000-4000-8000-000000000001',
  module: 'mod',
  feature: 'feat',
  prompt_key: 'mod.feat',
  variables: {},
};

const ctx = {
  invocation_id: 'i', model_id: 'claude-opus-4-7', started_at: 0, request_id: 'r',
};

describe('Anthropic adapter — tool use', () => {
  beforeEach(() => { mockAnthropicCreate.mockReset(); process.env.ANTHROPIC_API_KEY = 'sk-ant-test'; });
  afterAll(() => { delete process.env.ANTHROPIC_API_KEY; });

  it('passes tools[] + tool_choice=auto through to messages.create', async () => {
    mockAnthropicCreate.mockResolvedValue({
      id: 'm', model: 'claude-opus-4-7', content: [], usage: { input_tokens: 10, output_tokens: 5 },
    } as never);
    const p = makeAnthropicProvider();
    await p.invoke({ ...baseReq, tools, tool_choice: 'auto' }, ctx);
    const [body] = mockAnthropicCreate.mock.calls[0]!;
    expect((body as { tools: unknown[] }).tools).toHaveLength(1);
    expect((body as { tools: { name: string; input_schema: unknown }[] }).tools[0]).toMatchObject({
      name: 'search_db',
      input_schema: tools[0]!.parameters_schema,
    });
    expect((body as { tool_choice: { type: string } }).tool_choice).toMatchObject({ type: 'auto' });
  });

  it('translates tool_choice=required → type:any', async () => {
    mockAnthropicCreate.mockResolvedValue({
      id: 'm', model: 'claude-opus-4-7', content: [], usage: { input_tokens: 1, output_tokens: 1 },
    } as never);
    const p = makeAnthropicProvider();
    await p.invoke({ ...baseReq, tools, tool_choice: 'required' }, ctx);
    const [body] = mockAnthropicCreate.mock.calls[0]!;
    expect((body as { tool_choice: { type: string } }).tool_choice.type).toBe('any');
  });

  it('translates tool_choice={name} → type:tool with name', async () => {
    mockAnthropicCreate.mockResolvedValue({
      id: 'm', model: 'claude-opus-4-7', content: [], usage: { input_tokens: 1, output_tokens: 1 },
    } as never);
    const p = makeAnthropicProvider();
    await p.invoke({ ...baseReq, tools, tool_choice: { name: 'search_db' } }, ctx);
    const [body] = mockAnthropicCreate.mock.calls[0]!;
    expect((body as { tool_choice: { type: string; name: string } }).tool_choice).toEqual({
      type: 'tool', name: 'search_db',
    });
  });

  it('tool_choice=none → tools[] NOT passed', async () => {
    mockAnthropicCreate.mockResolvedValue({
      id: 'm', model: 'claude-opus-4-7', content: [], usage: { input_tokens: 1, output_tokens: 1 },
    } as never);
    const p = makeAnthropicProvider();
    await p.invoke({ ...baseReq, tools, tool_choice: 'none' }, ctx);
    const [body] = mockAnthropicCreate.mock.calls[0]!;
    expect((body as { tools?: unknown }).tools).toBeUndefined();
  });

  it('extracts tool_use blocks from response content', async () => {
    mockAnthropicCreate.mockResolvedValue({
      id: 'm', model: 'claude-opus-4-7',
      content: [
        { type: 'text', text: "I'll search the DB." },
        { type: 'tool_use', id: 'toolu_01', name: 'search_db', input: { query: 'ACME Corp' } },
      ],
      usage: { input_tokens: 10, output_tokens: 5 },
    } as never);
    const p = makeAnthropicProvider();
    const r = await p.invoke({ ...baseReq, tools, tool_choice: 'auto' }, ctx);
    expect(r.tool_calls).toEqual([
      { id: 'toolu_01', name: 'search_db', args: { query: 'ACME Corp' } },
    ]);
  });

  it('no anthropic_no_text_blocks warning when tool_use blocks are present', async () => {
    mockAnthropicCreate.mockResolvedValue({
      id: 'm', model: 'claude-opus-4-7',
      content: [{ type: 'tool_use', id: 't1', name: 'search_db', input: { query: 'x' } }],
      usage: { input_tokens: 1, output_tokens: 1 },
    } as never);
    const p = makeAnthropicProvider();
    const r = await p.invoke({ ...baseReq, tools, tool_choice: 'auto' }, ctx);
    expect(r.warnings).toBeUndefined();
  });
});

describe('OpenAI adapter — tool use', () => {
  beforeEach(() => { mockOpenAICreate.mockReset(); process.env.OPENAI_API_KEY = 'sk-test'; });
  afterAll(() => { delete process.env.OPENAI_API_KEY; });

  it('wraps tools[] in {type:function, function:{...}}', async () => {
    mockOpenAICreate.mockResolvedValue({
      id: 'c', model: 'gpt-4o',
      choices: [{ index: 0, message: { role: 'assistant', content: '', tool_calls: [] }, finish_reason: 'tool_calls' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    } as never);
    const p = makeOpenAIProvider();
    await p.invoke({ ...baseReq, tools, tool_choice: 'auto' }, { ...ctx, model_id: 'gpt-4o' });
    const [body] = mockOpenAICreate.mock.calls[0]!;
    const bodyTools = (body as { tools: { type: string; function: { name: string } }[] }).tools;
    expect(bodyTools).toHaveLength(1);
    expect(bodyTools[0]).toMatchObject({
      type: 'function',
      function: { name: 'search_db', parameters: tools[0]!.parameters_schema },
    });
  });

  it('tool_choice values map directly: auto/required/none/{name}', async () => {
    mockOpenAICreate.mockResolvedValue({
      id: 'c', model: 'gpt-4o',
      choices: [{ index: 0, message: { role: 'assistant', content: '', tool_calls: [] }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    } as never);
    const p = makeOpenAIProvider();
    await p.invoke({ ...baseReq, tools, tool_choice: 'required' }, { ...ctx, model_id: 'gpt-4o' });
    expect((mockOpenAICreate.mock.calls[0]![0] as { tool_choice: string }).tool_choice).toBe('required');

    mockOpenAICreate.mockClear();
    await p.invoke({ ...baseReq, tools, tool_choice: { name: 'search_db' } }, { ...ctx, model_id: 'gpt-4o' });
    expect((mockOpenAICreate.mock.calls[0]![0] as { tool_choice: { function: { name: string } } }).tool_choice).toEqual({
      type: 'function', function: { name: 'search_db' },
    });

    mockOpenAICreate.mockClear();
    await p.invoke({ ...baseReq, tools, tool_choice: 'none' }, { ...ctx, model_id: 'gpt-4o' });
    // 'none' suppresses tools[]
    expect((mockOpenAICreate.mock.calls[0]![0] as { tools?: unknown }).tools).toBeUndefined();
  });

  it('extracts tool_calls (function variant only) from response', async () => {
    mockOpenAICreate.mockResolvedValue({
      id: 'c', model: 'gpt-4o',
      choices: [{
        index: 0,
        message: {
          role: 'assistant', content: null,
          tool_calls: [
            { id: 'call_1', type: 'function', function: { name: 'search_db', arguments: '{"query":"ACME"}' } },
          ],
        },
        finish_reason: 'tool_calls',
      }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    } as never);
    const p = makeOpenAIProvider();
    const r = await p.invoke({ ...baseReq, tools, tool_choice: 'auto' }, { ...ctx, model_id: 'gpt-4o' });
    expect(r.tool_calls).toEqual([{ id: 'call_1', name: 'search_db', args: { query: 'ACME' } }]);
  });

  it('handles malformed JSON in tool_call.arguments gracefully', async () => {
    mockOpenAICreate.mockResolvedValue({
      id: 'c', model: 'gpt-4o',
      choices: [{
        index: 0,
        message: {
          role: 'assistant', content: null,
          tool_calls: [
            { id: 'call_x', type: 'function', function: { name: 'search_db', arguments: 'not-json' } },
          ],
        },
        finish_reason: 'tool_calls',
      }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    } as never);
    const p = makeOpenAIProvider();
    const r = await p.invoke({ ...baseReq, tools, tool_choice: 'auto' }, { ...ctx, model_id: 'gpt-4o' });
    expect(r.tool_calls).toEqual([{ id: 'call_x', name: 'search_db', args: {} }]);
  });
});

describe('end-to-end: tools[] flows through /v1/invoke (echo)', () => {
  const app = createApp();
  beforeAll(() => { setAuthLookupForTesting(async () => ({ authenticated: true, open_mode: true })); });
  afterAll(() => { setAuthLookupForTesting(null); });

  it('echo surfaces tools[] and tool_choice in the response output', async () => {
    const res = await request(app).post('/v1/invoke').send({
      ...baseReq, tools, tool_choice: 'auto',
    });
    expect(res.status).toBe(200);
    const echo = (res.body.output as { echo: { tools: unknown; tool_choice: unknown } }).echo;
    expect(echo.tools).toEqual(tools);
    expect(echo.tool_choice).toBe('auto');
  });
});
