/**
 * Spec §3.5 gate over a Playwright `ariaSnapshot()` (YAML-ish, one node per
 * line: `- role "name" [attrs]`). Pure so it can be unit-tested on fixtures.
 */
export function checkAriaSnapshot(yaml: string): { passed: boolean; failures: string[] } {
  const failures: string[] = [];
  const lines = yaml.split('\n').map(l => l.trim()).filter(l => l.startsWith('- '));

  const h1 = lines.filter(l => /^- heading\b/.test(l) && /\[level=1\]/.test(l)).length;
  if (h1 !== 1) failures.push(`expected exactly one heading level=1, found ${h1}`);

  if (!lines.some(l => /^- main\b/.test(l))) failures.push('no main landmark');

  const unnamed = lines.filter(l => {
    const m = /^- (button|link|textbox)\b(.*)$/.exec(l);
    if (!m) return false;
    const rest = m[2].trim();
    // Named nodes look like: `button "New lead"` or `button "New lead" [pressed]`.
    const name = /^"([^"]*)"/.exec(rest);
    return !name || name[1].trim() === '';
  }).length;
  if (unnamed > 0) failures.push(`${unnamed} unnamed button/link/textbox controls`);

  return { passed: failures.length === 0, failures };
}
