// Mistral adapter tests — SDK mocked at the module boundary.

import { jest } from '@jest/globals';

const mockComplete = jest.fn();

jest.unstable_mockModule('@mistralai/mistralai', () => {
  class FakeMistral {
    public chat = { complete: mockComplete };
    constructor(_opts: { apiKey: string }) {}
  }
  return { Mistral: FakeMistral };
});

const { makeMistralProvider } = await import('../src/providers/mistral.js');

const baseReq = {
  tenant_id: 'tenant-A',
  module: 'compliance',
  feature: 'screening.hit_reasoning',
  prompt_key: 'compliance.screening.hit_reasoning',
  variables: { party: { name: 'ACME', country: 'US' } },
};
const ctx = { invocation_id: 'i', model_id: 'mistral-large-latest', started_at: 0, request_id: 'r' };

const fakeResponse = {
  id: 'resp-01',
  model: 'mistral-large-latest',
  choices: [
    {
      index: 0,
      message: { role: 'assistant', content: 'Mistral says: the party is a false positive.' },
      finishReason: 'stop',
    },
  ],
  usage: { promptTokens: 380, completionTokens: 95, totalTokens: 475 },
};

describe('Mistral adapter', () => {
  beforeEach(() => {
    mockComplete.mockReset();
    delete process.env.MISTRAL_API_KEY;
  });
  afterAll(() => { delete process.env.MISTRAL_API_KEY; });

  it('throws PROVIDER_NOT_CONFIGURED when MISTRAL_API_KEY missing', async () => {
    const p = makeMistralProvider();
    await expect(p.invoke(baseReq, ctx)).rejects.toThrow(/PROVIDER_NOT_CONFIGURED:mistral/);
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it('maps chat.complete response → ProviderResult', async () => {
    process.env.MISTRAL_API_KEY = 'mst-test';
    mockComplete.mockResolvedValue(fakeResponse as never);
    const p = makeMistralProvider();
    const r = await p.invoke(baseReq, ctx);
    expect(r.model_used).toBe('mistral-large-latest');
    expect(r.output).toMatchObject({ text: expect.stringContaining('false positive') });
    expect(r.usage).toEqual({ prompt_tokens: 380, completion_tokens: 95, total_tokens: 475 });
  });

  it('passes maxTokens + temperature to chat.complete', async () => {
    process.env.MISTRAL_API_KEY = 'mst-test';
    mockComplete.mockResolvedValue(fakeResponse as never);
    const p = makeMistralProvider();
    await p.invoke({ ...baseReq, options: { max_tokens: 600, temperature: 0.1 } }, ctx);
    const [body] = mockComplete.mock.calls[0]!;
    expect(body).toMatchObject({
      model: 'mistral-large-latest',
      maxTokens: 600,
      temperature: 0.1,
    });
  });

  it('handles content as array of text-blocks', async () => {
    process.env.MISTRAL_API_KEY = 'mst-test';
    mockComplete.mockResolvedValue({
      ...fakeResponse,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'part one — ' },
              { type: 'text', text: 'part two.' },
            ],
          },
          finishReason: 'stop',
        },
      ],
    } as never);
    const p = makeMistralProvider();
    const r = await p.invoke(baseReq, ctx);
    expect((r.output as { text: string }).text).toBe('part one — part two.');
  });

  it('computes cost from per-million-token rates', async () => {
    process.env.MISTRAL_API_KEY = 'mst-test';
    mockComplete.mockResolvedValue(fakeResponse as never);
    const p = makeMistralProvider({ input_cost_per_million_tokens: 2, output_cost_per_million_tokens: 6 });
    const r = await p.invoke(baseReq, ctx);
    // 380/M * 2 + 95/M * 6 = 0.00076 + 0.00057 = 0.00133
    expect(r.cost_usd).toBeCloseTo(0.00133, 6);
  });

  it('warns on empty content', async () => {
    process.env.MISTRAL_API_KEY = 'mst-test';
    mockComplete.mockResolvedValue({
      ...fakeResponse,
      choices: [{ index: 0, message: { role: 'assistant', content: '' }, finishReason: 'stop' }],
    } as never);
    const p = makeMistralProvider();
    const r = await p.invoke(baseReq, ctx);
    expect(r.warnings).toContain('mistral_empty_response');
  });
});
