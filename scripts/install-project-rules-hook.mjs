import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const hookPath = path.resolve(repoRoot, '.git/hooks/pre-commit');
const hookBody = `#!/bin/sh
set -e
npm run rules:enforce -- --staged
`;

fs.mkdirSync(path.dirname(hookPath), { recursive: true });
fs.writeFileSync(hookPath, hookBody, { mode: 0o755 });
fs.chmodSync(hookPath, 0o755);

console.log(`Installed pre-commit hook at ${hookPath}`);
