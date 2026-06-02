// Pure-function tests for the prompts layer: renderer + in-memory store.

import { renderPrompt, pickBodyForProvider } from '../src/prompts/renderer.js';
import { buildInMemoryPromptStore } from '../src/prompts/store.js';
import { PromptError } from '../src/prompts/types.js';

describe('renderPrompt', () => {
  it('substitutes top-level placeholders', () => {
    const r = renderPrompt('Hello {{name}}, age {{age}}', { name: 'Alice', age: 30 });
    expect(r.rendered).toBe('Hello Alice, age 30');
    expect(r.applied_paths.sort()).toEqual(['age', 'name']);
    expect(r.missing_paths).toEqual([]);
  });

  it('resolves dotted paths', () => {
    const r = renderPrompt(
      'Party: {{party.name}} ({{party.country}})',
      { party: { name: 'ACME', country: 'US' } },
    );
    expect(r.rendered).toBe('Party: ACME (US)');
  });

  it('JSON-stringifies object and array values', () => {
    const r = renderPrompt(
      'Hits: {{hits}}',
      { hits: [{ name: 'A', score: 0.9 }] },
    );
    expect(r.rendered).toBe('Hits: [{"name":"A","score":0.9}]');
  });

  it('treats missing variables as empty string + records in missing_paths', () => {
    const r = renderPrompt('Hello {{name}}', {});
    expect(r.rendered).toBe('Hello ');
    expect(r.missing_paths).toEqual(['name']);
    expect(r.applied_paths).toEqual([]);
  });

  it('mixed applied + missing in same template', () => {
    const r = renderPrompt('A={{a}} B={{b}} C={{a}}', { a: 1 });
    expect(r.rendered).toBe('A=1 B= C=1');
    expect(r.applied_paths).toEqual(['a']);
    expect(r.missing_paths).toEqual(['b']);
  });

  it('null and boolean values rendered as expected strings', () => {
    expect(renderPrompt('{{x}}', { x: null }).rendered).toBe('');
    expect(renderPrompt('{{x}}', { x: true }).rendered).toBe('true');
    expect(renderPrompt('{{x}}', { x: false }).rendered).toBe('false');
  });

  it('whitespace inside braces is tolerated', () => {
    const r = renderPrompt('Hello {{  name  }}', { name: 'A' });
    expect(r.rendered).toBe('Hello A');
  });
});

describe('pickBodyForProvider', () => {
  it('returns variant when present for the provider_kind', () => {
    expect(pickBodyForProvider('canonical', { anthropic: 'aware' }, 'anthropic')).toBe('aware');
  });
  it('falls back to canonical when no variant', () => {
    expect(pickBodyForProvider('canonical', { openai: 'x' }, 'anthropic')).toBe('canonical');
  });
  it('falls back to canonical on empty variant string', () => {
    expect(pickBodyForProvider('canonical', { anthropic: '' }, 'anthropic')).toBe('canonical');
  });
});

describe('in-memory prompt store', () => {
  it('upsert creates the prompt + active version on first call', async () => {
    const store = buildInMemoryPromptStore();
    const { version_id, version_number } = await store.upsert({
      key: 'm.f',
      module: 'm',
      feature: 'f',
      body: 'hello {{name}}',
    });
    expect(version_number).toBe(1);
    expect(version_id).toBeTruthy();

    const { prompt, active_version } = await store.getActive('m.f');
    expect(prompt.active_version_id).toBe(version_id);
    expect(active_version.status).toBe('active');
    expect(active_version.body).toBe('hello {{name}}');
  });

  it('upsert with promote=true supersedes the prior active version', async () => {
    const store = buildInMemoryPromptStore();
    await store.upsert({ key: 'm.f', module: 'm', feature: 'f', body: 'v1' });
    const { version_id: v2_id, version_number: v2_num } = await store.upsert({
      key: 'm.f', module: 'm', feature: 'f', body: 'v2',
    });
    expect(v2_num).toBe(2);

    const { active_version } = await store.getActive('m.f');
    expect(active_version.id).toBe(v2_id);
    expect(active_version.body).toBe('v2');
  });

  it('upsert with promote=false creates a draft; active stays on v1', async () => {
    const store = buildInMemoryPromptStore();
    const { version_id: v1_id } = await store.upsert({ key: 'm.f', module: 'm', feature: 'f', body: 'v1' });
    await store.upsert({ key: 'm.f', module: 'm', feature: 'f', body: 'v2', promote_active: false });
    const { active_version } = await store.getActive('m.f');
    expect(active_version.id).toBe(v1_id);
    expect(active_version.body).toBe('v1');
  });

  it('getActive throws PROMPT_NOT_FOUND for unknown key', async () => {
    const store = buildInMemoryPromptStore();
    await expect(store.getActive('does.not.exist')).rejects.toBeInstanceOf(PromptError);
  });
});
