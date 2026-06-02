// Anthropic adapter tests. We do NOT call the real API — instead we
// mock the SDK module at the boundary. The goal here is contract
// shaping: given a fake-but-realistic Anthropic Message response,
// does the adapter produce the right ProviderResult shape?

import { jest } from '@jest/globals';

// Mocked Anthropic.messages.create handler — captured below.
const mockCreate = jest.fn();

jest.unstable_mockModule('@anthropic-ai/sdk', () => {
  class FakeAnthropic {
    public messages = { create: mockCreate };
    constructor(_opts: { apiKey: string }) {
      // accept and discard — the cache fingerprint only looks at apiKey
    }
  }
  return { __esModule: true, default: FakeAnthropic };
});

// Import the adapter AFTER the mock is in place.
const { makeAnthropicProvider } = await import('../src/providers/anthropic.js');

const baseReq = {
  tenant_id: 'tenant-A',
  module: 'compliance',
  feature: 'screening.hit_reasoning',
  prompt_key: 'compliance.screening.hit_reasoning',
  variables: { party: { name: 'ACME', country: 'US' } },
};

const ctx = {
  invocation_id: 'invocation-1',
  model_id: 'claude-opus-4-7',
  started_at: 0,
  request_id: 'req-1',
};

const fakeMessage = {
  id: 'msg_01',
  model: 'claude-opus-4-7',
  type: 'message',
  role: 'assistant',
  content: [
    { type: 'text', text: 'The party is a false positive — reasoning omitted in test.' },
  ],
  stop_reason: 'end_turn',
  usage: { input_tokens: 412, output_tokens: 87 },
};

describe('Anthropic adapter — credential gate', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('throws PROVIDER_NOT_CONFIGURED when ANTHROPIC_API_KEY missing', async () => {
    const provider = makeAnthropicProvider();
    await expect(provider.invoke(baseReq, ctx)).rejects.toThrow(/PROVIDER_NOT_CONFIGURED:anthropic/);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('Anthropic adapter — happy path (mocked SDK)', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key-for-tests';
  });

  afterAll(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('maps Anthropic Message response to ProviderResult', async () => {
    mockCreate.mockResolvedValue(fakeMessage as never);
    const provider = makeAnthropicProvider();
    const result = await provider.invoke(baseReq, ctx);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result.model_used).toBe('claude-opus-4-7');
    expect(result.output).toMatchObject({ text: expect.stringContaining('false positive') });
    expect(result.usage).toEqual({ prompt_tokens: 412, completion_tokens: 87, total_tokens: 499 });
  });

  it('passes max_tokens + temperature + timeout from InvokeOptions', async () => {
    mockCreate.mockResolvedValue(fakeMessage as never);
    const provider = makeAnthropicProvider();
    await provider.invoke(
      { ...baseReq, options: { max_tokens: 500, temperature: 0.3, timeout_ms: 10_000 } },
      ctx,
    );

    const [body, opts] = mockCreate.mock.calls[0]!;
    expect(body).toMatchObject({
      model: 'claude-opus-4-7',
      max_tokens: 500,
      temperature: 0.3,
    });
    expect(opts).toEqual({ timeout: 10_000 });
  });

  it('computes cost from per-million-token rates', async () => {
    mockCreate.mockResolvedValue(fakeMessage as never);
    const provider = makeAnthropicProvider({
      input_cost_per_million_tokens: 15,
      output_cost_per_million_tokens: 75,
    });
    const result = await provider.invoke(baseReq, ctx);
    // 412/1M * 15  +  87/1M * 75  =  0.00618 + 0.006525 = 0.012705
    expect(result.cost_usd).toBeCloseTo(0.012705, 6);
  });

  it('zero-cost default when no rates supplied', async () => {
    mockCreate.mockResolvedValue(fakeMessage as never);
    const provider = makeAnthropicProvider();
    const result = await provider.invoke(baseReq, ctx);
    expect(result.cost_usd).toBe(0);
  });

  it('warns when SDK returns no text blocks', async () => {
    mockCreate.mockResolvedValue({ ...fakeMessage, content: [] } as never);
    const provider = makeAnthropicProvider();
    const result = await provider.invoke(baseReq, ctx);
    expect(result.warnings).toContain('anthropic_no_text_blocks');
    expect(result.output).toMatchObject({ text: '' });
  });
});
