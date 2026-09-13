import { describe, it, expect } from 'vitest';
import { checkAriaSnapshot } from './helpers/aria';

const GOOD = `
- banner:
  - link "Home"
- main:
  - heading "Leads" [level=1]
  - button "New lead"
  - textbox "Search leads"
`;

describe('checkAriaSnapshot', () => {
  it('passes a well-formed page', () => {
    expect(checkAriaSnapshot(GOOD)).toEqual({ passed: true, failures: [] });
  });

  it('fails on zero or multiple h1', () => {
    expect(checkAriaSnapshot(GOOD.replace('[level=1]', '[level=2]')).failures).toContain('expected exactly one heading level=1, found 0');
    expect(checkAriaSnapshot(GOOD + '  - heading "Again" [level=1]\n').failures).toContain('expected exactly one heading level=1, found 2');
  });

  it('fails when there is no main landmark', () => {
    expect(checkAriaSnapshot(GOOD.replace('- main:', '- region:')).failures).toContain('no main landmark');
  });

  it('fails on unnamed interactive controls', () => {
    const r = checkAriaSnapshot(GOOD + '  - button\n  - link ""\n  - textbox\n');
    expect(r.failures).toContain('3 unnamed button/link/textbox controls');
    expect(r.passed).toBe(false);
  });
});
