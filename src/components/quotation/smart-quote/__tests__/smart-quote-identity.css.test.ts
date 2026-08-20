import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, '../smart-quote-identity.css'), 'utf-8');

const REQUIRED_TOKENS = [
  '--sq-ink',
  '--sq-bg',
  '--sq-surface',
  '--sq-border',
  '--sq-accent',
  '--sq-accent-ink',
  '--sq-tide',
  '--sq-good',
  '--sq-rust',
];

function block(source: string, selector: string): string {
  const start = source.indexOf(selector);
  if (start === -1) throw new Error(`selector not found: ${selector}`);
  const openBrace = source.indexOf('{', start);
  const closeBrace = source.indexOf('}', openBrace);
  return source.slice(openBrace, closeBrace);
}

describe('smart-quote-identity.css', () => {
  const lightBlock = block(css, '.smart-quote-identity');
  const darkBlock = block(css, '.dark .smart-quote-identity');

  it.each(REQUIRED_TOKENS)('defines %s in the light block', (token) => {
    expect(lightBlock).toContain(`${token}:`);
  });

  it.each(REQUIRED_TOKENS)('defines %s in the dark block', (token) => {
    expect(darkBlock).toContain(`${token}:`);
  });

  it('defines all three font-role tokens', () => {
    expect(lightBlock).toContain('--sq-font-display:');
    expect(lightBlock).toContain('--sq-font-body:');
    expect(lightBlock).toContain('--sq-font-mono:');
  });

  it('does not redefine font tokens in the dark block (fonts do not change with theme)', () => {
    expect(darkBlock).not.toContain('--sq-font-');
  });
});
