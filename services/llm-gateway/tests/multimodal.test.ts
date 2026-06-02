// §9.4 multi-modal — validation, Anthropic + OpenAI translation,
// end-to-end echo round-trip.

import { jest } from '@jest/globals';
import request from 'supertest';

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

const baseReq = {
  tenant_id: '00000000-0000-4000-8000-000000000001',
  module: 'mod', feature: 'feat', prompt_key: 'mod.feat',
  variables: {},
};
const ctx = { invocation_id: 'i', model_id: 'claude-opus-4-7', started_at: 0, request_id: 'r' };
const BASE64_JPEG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';  // tiny stub

describe('Anthropic adapter — multi-modal', () => {
  beforeEach(() => { mockAnthropicCreate.mockReset(); process.env.ANTHROPIC_API_KEY = 'sk-ant-test'; });
  afterAll(() => { delete process.env.ANTHROPIC_API_KEY; });

  it('sends image attachment as base64 image block', async () => {
    mockAnthropicCreate.mockResolvedValue({
      id: 'm', model: 'claude-opus-4-7',
      content: [{ type: 'text', text: 'I see a small image.' }],
      usage: { input_tokens: 50, output_tokens: 10 },
    } as never);
    const p = makeAnthropicProvider();
    await p.invoke({
      ...baseReq,
      attachments: [{ kind: 'image', mime_type: 'image/jpeg', content_base64: BASE64_JPEG }],
    }, ctx);
    const [body] = mockAnthropicCreate.mock.calls[0]!;
    const content = (body as { messages: { content: Array<{ type: string; source?: unknown }> }[] }).messages[0]!.content;
    expect(Array.isArray(content)).toBe(true);
    expect(content[0]).toMatchObject({ type: 'text' });
    expect(content[1]).toMatchObject({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: BASE64_JPEG },
    });
  });

  it('sends image attachment as url image block', async () => {
    mockAnthropicCreate.mockResolvedValue({
      id: 'm', model: 'claude-opus-4-7',
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    } as never);
    const p = makeAnthropicProvider();
    await p.invoke({
      ...baseReq,
      attachments: [{ kind: 'image', mime_type: 'image/png', url: 'https://example.com/img.png' }],
    }, ctx);
    const [body] = mockAnthropicCreate.mock.calls[0]!;
    const content = (body as { messages: { content: Array<{ type: string; source?: { type: string; url?: string } }> }[] }).messages[0]!.content;
    expect(content[1]).toMatchObject({
      type: 'image',
      source: { type: 'url', url: 'https://example.com/img.png' },
    });
  });

  it('no attachments → content stays a plain string (back-compat)', async () => {
    mockAnthropicCreate.mockResolvedValue({
      id: 'm', model: 'claude-opus-4-7',
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 1, output_tokens: 1 },
    } as never);
    const p = makeAnthropicProvider();
    await p.invoke(baseReq, ctx);
    const [body] = mockAnthropicCreate.mock.calls[0]!;
    const content = (body as { messages: { content: unknown }[] }).messages[0]!.content;
    expect(typeof content).toBe('string');
  });

  it('warns on unsupported attachment kinds (audio/document)', async () => {
    mockAnthropicCreate.mockResolvedValue({
      id: 'm', model: 'claude-opus-4-7',
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 1, output_tokens: 1 },
    } as never);
    const p = makeAnthropicProvider();
    const r = await p.invoke({
      ...baseReq,
      attachments: [
        { kind: 'audio', mime_type: 'audio/mpeg', url: 'https://example.com/clip.mp3' },
        { kind: 'document', mime_type: 'application/pdf', content_base64: BASE64_JPEG },
      ],
    }, ctx);
    expect(r.warnings).toEqual(expect.arrayContaining([
      'anthropic_attachment_kind_unsupported:audio',
      'anthropic_attachment_kind_unsupported:document',
    ]));
  });
});

describe('OpenAI adapter — multi-modal', () => {
  beforeEach(() => { mockOpenAICreate.mockReset(); process.env.OPENAI_API_KEY = 'sk-test'; });
  afterAll(() => { delete process.env.OPENAI_API_KEY; });

  it('sends image attachment as image_url part with data URL', async () => {
    mockOpenAICreate.mockResolvedValue({
      id: 'c', model: 'gpt-4o',
      choices: [{ index: 0, message: { role: 'assistant', content: 'I see an image.', tool_calls: [] }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 100, completion_tokens: 5, total_tokens: 105 },
    } as never);
    const p = makeOpenAIProvider();
    await p.invoke({
      ...baseReq,
      attachments: [{ kind: 'image', mime_type: 'image/png', content_base64: BASE64_JPEG }],
    }, { ...ctx, model_id: 'gpt-4o' });
    const [body] = mockOpenAICreate.mock.calls[0]!;
    const messages = (body as { messages: { content: unknown }[] }).messages;
    const userContent = messages[messages.length - 1]!.content as Array<{ type: string; image_url?: { url: string } }>;
    expect(Array.isArray(userContent)).toBe(true);
    expect(userContent[0]).toMatchObject({ type: 'text' });
    expect(userContent[1]).toMatchObject({
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${BASE64_JPEG}` },
    });
  });

  it('sends image attachment with absolute url unchanged', async () => {
    mockOpenAICreate.mockResolvedValue({
      id: 'c', model: 'gpt-4o',
      choices: [{ index: 0, message: { role: 'assistant', content: 'ok', tool_calls: [] }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    } as never);
    const p = makeOpenAIProvider();
    await p.invoke({
      ...baseReq,
      attachments: [{ kind: 'image', mime_type: 'image/jpeg', url: 'https://example.com/x.jpg' }],
    }, { ...ctx, model_id: 'gpt-4o' });
    const [body] = mockOpenAICreate.mock.calls[0]!;
    const messages = (body as { messages: { content: unknown }[] }).messages;
    const userContent = messages[messages.length - 1]!.content as Array<{ image_url?: { url: string } }>;
    expect(userContent[1]).toMatchObject({ image_url: { url: 'https://example.com/x.jpg' } });
  });

  it('no attachments → content stays plain string', async () => {
    mockOpenAICreate.mockResolvedValue({
      id: 'c', model: 'gpt-4o',
      choices: [{ index: 0, message: { role: 'assistant', content: 'ok', tool_calls: [] }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    } as never);
    const p = makeOpenAIProvider();
    await p.invoke(baseReq, { ...ctx, model_id: 'gpt-4o' });
    const [body] = mockOpenAICreate.mock.calls[0]!;
    const messages = (body as { messages: { content: unknown }[] }).messages;
    const userContent = messages[messages.length - 1]!.content;
    expect(typeof userContent).toBe('string');
  });
});

describe('Route validation — attachments', () => {
  const app = createApp();
  beforeAll(() => setAuthLookupForTesting(async () => ({ authenticated: true, open_mode: true })));
  afterAll(() => setAuthLookupForTesting(null));

  function bodyWith(attachments: unknown) {
    return { tenant_id: '00000000-0000-4000-8000-000000000001', module: 'm', feature: 'f', prompt_key: 'm.f', variables: {}, attachments };
  }

  it('400 when attachments is not an array', async () => {
    const res = await request(app).post('/v1/invoke').send(bodyWith('not-an-array'));
    expect(res.status).toBe(400);
  });

  it('400 when attachments[].kind is invalid', async () => {
    const res = await request(app).post('/v1/invoke').send(bodyWith([{ kind: 'rogue', mime_type: 'image/png', url: 'https://x' }]));
    expect(res.status).toBe(400);
  });

  it('400 when both content_base64 and url are present', async () => {
    const res = await request(app).post('/v1/invoke').send(bodyWith([{ kind: 'image', mime_type: 'image/png', content_base64: 'x', url: 'https://y' }]));
    expect(res.status).toBe(400);
  });

  it('400 when neither content_base64 nor url present', async () => {
    const res = await request(app).post('/v1/invoke').send(bodyWith([{ kind: 'image', mime_type: 'image/png' }]));
    expect(res.status).toBe(400);
  });

  it('400 when mime_type missing', async () => {
    const res = await request(app).post('/v1/invoke').send(bodyWith([{ kind: 'image', url: 'https://x' }]));
    expect(res.status).toBe(400);
  });

  it('400 when more than 16 attachments', async () => {
    const att = Array.from({ length: 20 }, () => ({ kind: 'image', mime_type: 'image/png', url: 'https://x' }));
    const res = await request(app).post('/v1/invoke').send(bodyWith(att));
    expect(res.status).toBe(400);
  });

  it('200 with valid attachments; echo surfaces them in output', async () => {
    const res = await request(app).post('/v1/invoke').send(bodyWith([
      { kind: 'image', mime_type: 'image/png', content_base64: BASE64_JPEG, label: 'screenshot' },
    ]));
    expect(res.status).toBe(200);
    const echo = (res.body.output as { echo: { attachments: { kind: string; mime_type: string; content_base64_length: number; label: string }[] } }).echo;
    expect(echo.attachments).toHaveLength(1);
    expect(echo.attachments[0]).toMatchObject({
      kind: 'image',
      mime_type: 'image/png',
      content_base64_length: BASE64_JPEG.length,
      label: 'screenshot',
    });
  });
});
