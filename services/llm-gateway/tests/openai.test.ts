// OpenAI adapter tests — SDK mocked at the module boundary.

import { jest } from '@jest/globals';

const mockCreate = jest.fn();

jest.unstable_mockModule('openai', () => {
  class FakeOpenAI {
    public chat = { completions: { create: mockCreate } };
    constructor(_opts: { apiKey: string }) {}
  }
  return { __esModule: true, default: FakeOpenAI };
});

const { makeOpenAIProvider } = await import('../src/providers/openai.js');

const baseReq = {
  tenant_id: 'tenant-A',
  module: 'compliance',
  feature: 'screening.hit_reasoning',
  prompt_key: 'compliance.screening.hit_reasoning',
  variables: { party: { name: 'ACME', country: 'US' } },
};
const ctx = { invocation_id: 'i', model_id: 'gpt-4o', started_at: 0, request_id: 'r' };

const fakeCompletion = {
  id: 'chatcmpl-01',
  model: 'gpt-4o',
  choices: [
    {
      index: 0,
      message: { role: 'assistant', content: 'OpenAI says: the party is a false positive.' },
      finish_reason: 'stop',
    },
  ],
  usage: { prompt_tokens: 412, completion_tokens: 87, total_tokens: 499 },
};

describe('OpenAI adapter', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    delete process.env.OPENAI_API_KEY;
  });
  afterAll(() => { delete process.env.OPENAI_API_KEY; });

  it('throws PROVIDER_NOT_CONFIGURED when OPENAI_API_KEY missing', async () => {
    const p = makeOpenAIProvider();
    await expect(p.invoke(baseReq, ctx)).rejects.toThrow(/PROVIDER_NOT_CONFIGURED:openai/);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('maps chat completion → ProviderResult', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    mockCreate.mockResolvedValue(fakeCompletion as never);
    const p = makeOpenAIProvider();
    const r = await p.invoke(baseReq, ctx);
    expect(r.model_used).toBe('gpt-4o');
    expect(r.output).toMatchObject({ text: expect.stringContaining('false positive') });
    expect(r.usage).toEqual({ prompt_tokens: 412, completion_tokens: 87, total_tokens: 499 });
  });

  it('passes max_tokens + temperature + timeout to chat.completions.create', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    mockCreate.mockResolvedValue(fakeCompletion as never);
    const p = makeOpenAIProvider();
    await p.invoke({ ...baseReq, options: { max_tokens: 500, temperature: 0.3, timeout_ms: 8000 } }, ctx);
    const [body, opts] = mockCreate.mock.calls[0]!;
    expect(body).toMatchObject({ model: 'gpt-4o', max_tokens: 500, temperature: 0.3 });
    expect(opts).toEqual({ timeout: 8000 });
  });

  it('prepends system message when config.system supplied', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    mockCreate.mockResolvedValue(fakeCompletion as never);
    const p = makeOpenAIProvider({ system: 'You are a helpful assistant.' });
    await p.invoke(baseReq, ctx);
    const [body] = mockCreate.mock.calls[0]!;
    const messages = (body as { messages: { role: string; content: string }[] }).messages;
    expect(messages[0]).toMatchObject({ role: 'system', content: 'You are a helpful assistant.' });
    expect(messages[1]?.role).toBe('user');
  });

  it('computes cost from per-million-token rates', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    mockCreate.mockResolvedValue(fakeCompletion as never);
    const p = makeOpenAIProvider({ input_cost_per_million_tokens: 5, output_cost_per_million_tokens: 15 });
    const r = await p.invoke(baseReq, ctx);
    // 412/M * 5 + 87/M * 15 = 0.00206 + 0.001305 = 0.003365
    expect(r.cost_usd).toBeCloseTo(0.003365, 6);
  });

  it('warns on empty response', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    mockCreate.mockResolvedValue({
      ...fakeCompletion,
      choices: [{ index: 0, message: { role: 'assistant', content: '' }, finish_reason: 'stop' }],
    } as never);
    const p = makeOpenAIProvider();
    const r = await p.invoke(baseReq, ctx);
    expect(r.warnings).toContain('openai_empty_response');
  });
});
