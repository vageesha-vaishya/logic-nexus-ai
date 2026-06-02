// Gemini adapter tests — SDK mocked at the module boundary.

import { jest } from '@jest/globals';

const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({ generateContent: mockGenerateContent }));

jest.unstable_mockModule('@google/generative-ai', () => {
  class FakeGoogleGenerativeAI {
    public getGenerativeModel = mockGetGenerativeModel;
    constructor(_apiKey: string) {}
  }
  return { GoogleGenerativeAI: FakeGoogleGenerativeAI };
});

const { makeGeminiProvider } = await import('../src/providers/gemini.js');

const baseReq = {
  tenant_id: 'tenant-A',
  module: 'compliance',
  feature: 'screening.hit_reasoning',
  prompt_key: 'compliance.screening.hit_reasoning',
  variables: { party: { name: 'ACME', country: 'US' } },
};
const ctx = { invocation_id: 'i', model_id: 'gemini-1.5-pro', started_at: 0, request_id: 'r' };

const fakeResult = {
  response: {
    text: () => 'Gemini says: the party is a false positive.',
    usageMetadata: { promptTokenCount: 400, candidatesTokenCount: 75, totalTokenCount: 475 },
    candidates: [{ content: { parts: [{ text: 'Gemini says…' }] } }],
  },
};

describe('Gemini adapter', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
    mockGetGenerativeModel.mockClear();
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_AI_API_KEY;
  });
  afterAll(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_AI_API_KEY;
  });

  it('throws PROVIDER_NOT_CONFIGURED when GEMINI_API_KEY (and GOOGLE_AI_API_KEY) missing', async () => {
    const p = makeGeminiProvider();
    await expect(p.invoke(baseReq, ctx)).rejects.toThrow(/PROVIDER_NOT_CONFIGURED:google_gemini/);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('accepts GOOGLE_AI_API_KEY as alternative env var', async () => {
    process.env.GOOGLE_AI_API_KEY = 'goog-test';
    mockGenerateContent.mockResolvedValue(fakeResult as never);
    const p = makeGeminiProvider();
    const r = await p.invoke(baseReq, ctx);
    expect(r.model_used).toBe('gemini-1.5-pro');
    expect(r.output).toMatchObject({ text: expect.stringContaining('false positive') });
  });

  it('maps response.usageMetadata → ProviderResult.usage', async () => {
    process.env.GEMINI_API_KEY = 'goog-test';
    mockGenerateContent.mockResolvedValue(fakeResult as never);
    const p = makeGeminiProvider();
    const r = await p.invoke(baseReq, ctx);
    expect(r.usage).toEqual({ prompt_tokens: 400, completion_tokens: 75, total_tokens: 475 });
  });

  it('passes max_tokens + temperature + system to getGenerativeModel', async () => {
    process.env.GEMINI_API_KEY = 'goog-test';
    mockGenerateContent.mockResolvedValue(fakeResult as never);
    const p = makeGeminiProvider({ system: 'You are precise.' });
    await p.invoke({ ...baseReq, options: { max_tokens: 256, temperature: 0.2 } }, ctx);
    const [modelArgs] = mockGetGenerativeModel.mock.calls[0]!;
    expect(modelArgs).toMatchObject({
      model: 'gemini-1.5-pro',
      generationConfig: { maxOutputTokens: 256, temperature: 0.2 },
      systemInstruction: 'You are precise.',
    });
  });

  it('computes cost from per-million-token rates', async () => {
    process.env.GEMINI_API_KEY = 'goog-test';
    mockGenerateContent.mockResolvedValue(fakeResult as never);
    const p = makeGeminiProvider({ input_cost_per_million_tokens: 1.25, output_cost_per_million_tokens: 5 });
    const r = await p.invoke(baseReq, ctx);
    // 400/M * 1.25 + 75/M * 5 = 0.0005 + 0.000375 = 0.000875
    expect(r.cost_usd).toBeCloseTo(0.000875, 6);
  });

  it('warns on empty response', async () => {
    process.env.GEMINI_API_KEY = 'goog-test';
    mockGenerateContent.mockResolvedValue({
      response: { text: () => '', usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 } },
    } as never);
    const p = makeGeminiProvider();
    const r = await p.invoke(baseReq, ctx);
    expect(r.warnings).toContain('gemini_empty_response');
  });
});
