// Prompt template renderer. Supports `{{path.to.value}}` interpolation
// against a variables object. No conditionals, no loops, no helpers —
// keep the surface tiny so the engine is provable.
//
// Edge cases:
//   - Missing variable → empty string + warning (degraded, not fatal)
//   - Object/array values → JSON.stringify
//   - null / undefined → empty string
//
// Per design §5.7, more powerful rendering can come later via a
// pluggable template engine; for P3.1 this minimal impl covers the
// 95% case.

const PLACEHOLDER_RE = /\{\{\s*([^{}\s|]+)\s*\}\}/g;

export interface RenderResult {
  rendered: string;
  missing_paths: string[];
  applied_paths: string[];
}

function resolvePath(root: Record<string, unknown>, path: string): unknown {
  if (path === '.') return root;
  const segments = path.split('.');
  let cur: unknown = root;
  for (const seg of segments) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function renderPrompt(body: string, variables: Record<string, unknown>): RenderResult {
  const missing = new Set<string>();
  const applied = new Set<string>();
  const rendered = body.replace(PLACEHOLDER_RE, (_match, path: string) => {
    const trimmed = path.trim();
    const value = resolvePath(variables, trimmed);
    if (value === undefined) {
      missing.add(trimmed);
      return '';
    }
    applied.add(trimmed);
    return stringify(value);
  });
  return {
    rendered,
    missing_paths: Array.from(missing),
    applied_paths: Array.from(applied),
  };
}

/**
 * Select the body variant for a given provider. Per design §5.5: most
 * prompts have body_variants={} forever; this falls back to the canonical
 * body. Variant lookup is case-sensitive on provider_kind.
 */
export function pickBodyForProvider(
  body: string,
  body_variants: Record<string, string>,
  provider_kind: string,
): string {
  const variant = body_variants[provider_kind];
  return typeof variant === 'string' && variant.length > 0 ? variant : body;
}
