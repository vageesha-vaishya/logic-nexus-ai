import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packagePath = path.join(root, 'src/design-system/package.json');
const migrationPath = path.join(root, 'src/design-system/MIGRATION_GUIDE.md');

const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
const latestTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
const changedFilesRaw = execSync(`git diff --name-only ${latestTag}..HEAD -- src/design-system/components`, { encoding: 'utf8' });
const changedFiles = changedFilesRaw.split('\n').filter(Boolean);

const lines = [
  `# Migration Guide ${latestTag} -> v${pkg.version}`,
  '',
  '## Prop/API Diffs',
  '',
  ...(changedFiles.length
    ? changedFiles.map((file) => `- Updated: ${file}`)
    : ['- No component prop changes detected.']),
  '',
  '## Action Checklist',
  '',
  '- Review Storybook controls for updated props.',
  '- Validate visual snapshots in Chromatic.',
  '- Run npm run design-system:gate before adoption.'
];

writeFileSync(migrationPath, `${lines.join('\n')}\n`);
process.stdout.write(`${migrationPath}\n`);
