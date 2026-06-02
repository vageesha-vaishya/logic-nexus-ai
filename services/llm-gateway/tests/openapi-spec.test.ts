// OpenAPI spec sanity. Catches three classes of regression that have
// already burned us once:
//   1. duplicate top-level `components:` keys (last-write wins under YAML)
//   2. $ref-to-nowhere — every $ref must resolve inside this same file
//   3. silent drift between routes mounted in app.ts and paths declared
//      in the spec (we assert the known canonical set is present).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseDocument, parse } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SPEC_PATH = path.resolve(__dirname, '..', 'openapi.yaml');
const SPEC_TEXT = fs.readFileSync(SPEC_PATH, 'utf-8');

interface OpenAPIDoc {
  paths?: Record<string, Record<string, unknown>>;
  components?: {
    schemas?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
    responses?: Record<string, unknown>;
  };
}

describe('OpenAPI spec', () => {
  const doc = parse(SPEC_TEXT) as OpenAPIDoc;

  it('parses as valid YAML', () => {
    expect(doc).toBeTruthy();
    expect(doc.paths).toBeTruthy();
  });

  it('has no duplicate top-level `components:` key', () => {
    // parseDocument keeps the AST so we can inspect duplicates;
    // duplicate top-level keys would have produced a warning.
    const ast = parseDocument(SPEC_TEXT, { logLevel: 'silent' });
    const root = ast.contents as { items?: Array<{ key?: { value?: string } }> } | null;
    const items = root?.items ?? [];
    const componentsKeys = items.filter((i) => i?.key?.value === 'components');
    expect(componentsKeys.length).toBeLessThanOrEqual(1);
  });

  it('every $ref resolves inside this file', () => {
    const schemas = new Set(Object.keys(doc.components?.schemas ?? {}));
    const params = new Set(Object.keys(doc.components?.parameters ?? {}));
    const responses = new Set(Object.keys(doc.components?.responses ?? {}));
    const missing: Array<{ ref: string; at: string; why: string }> = [];
    const refs: Array<{ ref: string; at: string }> = [];
    const walk = (n: unknown, p: string): void => {
      if (!n || typeof n !== 'object') return;
      const obj = n as Record<string, unknown>;
      const refValue = obj.$ref;
      if (typeof refValue === 'string') refs.push({ ref: refValue, at: p });
      for (const [k, v] of Object.entries(obj)) walk(v, `${p}.${k}`);
    };
    walk(doc, '$');
    for (const { ref, at } of refs) {
      const m = ref.match(/^#\/components\/(schemas|parameters|responses)\/(.+)$/);
      if (!m) { missing.push({ ref, at, why: 'unparseable' }); continue; }
      const [, kind, name] = m;
      const set = kind === 'schemas' ? schemas : kind === 'parameters' ? params : responses;
      if (!set.has(name)) missing.push({ ref, at, why: `not in components.${kind}` });
    }
    expect({ missingCount: missing.length, sample: missing.slice(0, 5) }).toEqual({ missingCount: 0, sample: [] });
  });

  it('documents the canonical route set', () => {
    const expectedPaths = [
      '/healthz', '/readyz',
      '/v1/invoke', '/v1/embed', '/v1/outcomes',
      '/v1/prompts/{key}', '/v1/prompts/{key}/render',
      '/v1/admin/prompts', '/v1/admin/experiments', '/v1/admin/audit',
      '/v1/admin/experiments/{id}/evaluate', '/v1/admin/experiments/{id}/auto-promote',
      '/v1/admin/right-to-be-forgotten',
      '/v1/fine-tunes', '/v1/fine-tunes/{id}',
      '/v1/fine-tunes/{id}/submit', '/v1/fine-tunes/{id}/cancel',
      '/v1/fine-tunes/poll',
    ];
    const actualPaths = new Set(Object.keys(doc.paths ?? {}));
    const missingFromSpec = expectedPaths.filter((p) => !actualPaths.has(p));
    expect(missingFromSpec).toEqual([]);
  });
});
