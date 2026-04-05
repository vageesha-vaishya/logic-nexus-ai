import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const resultsPath = path.join(root, 'playwright-report', 'results.json');
const outputDir = path.join(root, 'artifacts', 'mro', 'analysis');
const outputPath = path.join(outputDir, 'uim-playwright-visual-report.md');

const now = new Date().toISOString();
fs.mkdirSync(outputDir, { recursive: true });

if (!fs.existsSync(resultsPath)) {
  fs.writeFileSync(
    outputPath,
    `# UIM Playwright Visual Report\n\nGenerated: \`${now}\`\n\n- Results file not found at \`playwright-report/results.json\`.\n- Run \`npm run test:playwright:uim:visual\` first.\n`,
    'utf8',
  );
  console.log(`Wrote report placeholder: ${outputPath}`);
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
const specs = [];

for (const suite of data.suites || []) {
  const stack = [suite];
  while (stack.length) {
    const current = stack.pop();
    for (const child of current.suites || []) stack.push(child);
    for (const spec of current.specs || []) {
      const file = spec.file || '';
      if (file.includes('uim-visual-regression.spec.ts')) specs.push(spec);
    }
  }
}

let passed = 0;
let failed = 0;
let skipped = 0;
const rows = [];

for (const spec of specs) {
  const title = spec.title || 'Untitled';
  const tests = spec.tests || [];
  const statuses = tests.map((t) => t.results?.[0]?.status || t.results?.at(-1)?.status || 'unknown');
  const status = statuses.includes('failed')
    ? 'failed'
    : statuses.includes('timedOut')
      ? 'timedOut'
      : statuses.includes('skipped')
        ? 'skipped'
        : statuses.includes('passed')
          ? 'passed'
          : 'unknown';

  if (status === 'passed') passed += 1;
  else if (status === 'skipped') skipped += 1;
  else failed += 1;

  rows.push(`| ${title.replace(/\|/g, '\\|')} | ${status} |`);
}

const md = [
  '# UIM Playwright Visual Report',
  '',
  `Generated: \`${now}\``,
  '',
  '## Summary',
  `- Specs discovered: \`${specs.length}\``,
  `- Passed: \`${passed}\``,
  `- Failed: \`${failed}\``,
  `- Skipped: \`${skipped}\``,
  '',
  '## Spec Results',
  '| Spec | Status |',
  '|---|---|',
  ...(rows.length ? rows : ['| No UIM visual specs discovered in results file | unknown |']),
  '',
  '## Artifact Paths',
  '- Raw Playwright JSON: `playwright-report/results.json`',
  '- Playwright HTML report: `playwright-report/html/index.html`',
  '- Captured screenshots: `artifacts/mro/analysis/uim-visual-regression/`',
].join('\n');

fs.writeFileSync(outputPath, md, 'utf8');
console.log(`Wrote report: ${outputPath}`);
