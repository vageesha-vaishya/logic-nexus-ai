import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const repoRoot = process.cwd();
const rulesPath = path.resolve(repoRoot, '.trae/rules/project_rules.md');
const rulesStatePath = path.resolve(repoRoot, '.trae/rules/.consultation-state.json');
const generatedDir = path.resolve(repoRoot, '.trae/rules/generated');
const analysisPath = path.resolve(generatedDir, 'rule-analysis-report.json');
const proposalsPath = path.resolve(generatedDir, 'rule-proposals.json');
const args = process.argv.slice(2);
const command = args[0] || 'help';
const now = new Date();

const ensureDir = (filePath) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

const hasArg = (name) => args.includes(name);

const readFile = (filePath) => fs.readFileSync(filePath, 'utf8');

const writeJson = (filePath, payload) => {
  ensureDir(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
};

const safeExec = (cmd, fallback = '') => {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return fallback;
  }
};

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const checkRulesFile = () => {
  if (!fs.existsSync(rulesPath)) {
    console.error(`Rules file not found: ${rulesPath}`);
    process.exit(1);
  }
};

const listFiles = (rootDir, extensions, ignoredDirs) => {
  const output = [];
  const walk = (currentDir) => {
    if (!fs.existsSync(currentDir)) {
      return;
    }
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (ignoredDirs.some((ignored) => fullPath.includes(ignored))) {
          continue;
        }
        walk(fullPath);
        continue;
      }
      const extension = path.extname(entry.name).toLowerCase();
      if (extensions.has(extension)) {
        output.push(fullPath);
      }
    }
  };
  walk(rootDir);
  return output;
};

const countMatches = (content, pattern) => {
  const match = content.match(pattern);
  return match ? match.length : 0;
};

const getChangedFiles = (stagedOnly) => {
  const cmd = stagedOnly ? 'git diff --cached --name-only' : 'git status --porcelain';
  const raw = safeExec(cmd, '');
  if (!raw) {
    return [];
  }
  if (stagedOnly) {
    return raw.split('\n').map((line) => line.trim()).filter(Boolean);
  }
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.slice(3).trim());
};

const runConsult = () => {
  checkRulesFile();
  const rulesBody = readFile(rulesPath);
  const payload = {
    consultedAt: now.toISOString(),
    consultedAtEpochMs: now.getTime(),
    actor: safeExec('git config user.email', safeExec('git config user.name', 'unknown')),
    branch: safeExec('git rev-parse --abbrev-ref HEAD', 'unknown'),
    rulesChecksum: sha256(rulesBody)
  };
  writeJson(rulesStatePath, payload);
  console.log('Project rules consultation recorded.');
  console.log(`State file: ${rulesStatePath}`);
};

const runEnforce = () => {
  checkRulesFile();
  if (!fs.existsSync(rulesStatePath)) {
    console.error('Rules consultation state not found.');
    console.error('Run: npm run rules:consult');
    process.exit(1);
  }
  const state = JSON.parse(readFile(rulesStatePath));
  const maxAgeHours = Number.parseInt(process.env.RULES_CONSULT_MAX_AGE_HOURS || '12', 10);
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
  const ageMs = now.getTime() - Number(state.consultedAtEpochMs || 0);
  const rulesChecksum = sha256(readFile(rulesPath));
  const stagedOnly = hasArg('--staged');
  const changedFiles = getChangedFiles(stagedOnly);
  const hasCodeChanges = changedFiles.some((file) => /\.(tsx?|jsx?|mjs|cjs|css|sql)$/.test(file));
  const violations = [];

  if (ageMs > maxAgeMs) {
    violations.push(`Rules consultation expired (${Math.floor(ageMs / (60 * 1000))} minutes old, max ${maxAgeHours} hours).`);
  }
  if (state.rulesChecksum !== rulesChecksum) {
    violations.push('project_rules.md changed after the last consultation. Re-run rules consultation.');
  }
  if (hasCodeChanges && !state.consultedAtEpochMs) {
    violations.push('Code changes detected without a valid rules consultation state.');
  }

  if (violations.length > 0) {
    console.error('Rule workflow enforcement failed.');
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    console.error('Run: npm run rules:consult');
    process.exit(1);
  }

  console.log(`Rule workflow enforcement passed (${stagedOnly ? 'staged' : 'workspace'} scope).`);
};

const runAnalyze = () => {
  checkRulesFile();
  const sourceDirs = [path.resolve(repoRoot, 'src'), path.resolve(repoRoot, 'scripts')];
  const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
  const ignoredDirs = ['node_modules', '.git', 'dist', 'coverage', '.next', 'build'];
  const files = sourceDirs.flatMap((dir) => listFiles(dir, extensions, ignoredDirs));
  const findings = [];

  const detectors = [
    {
      id: 'DIRECT_SUPABASE_CLIENT_USAGE',
      type: 'anti-pattern',
      severity: 'high',
      title: 'Direct Supabase client usage in app code',
      pattern: /\bsupabase\.from\(/g,
      include: (filePath) => filePath.includes('/src/'),
      threshold: 2,
      proposedRequirement:
        'Require all data operations in app modules to use scoped access wrappers such as scopedDb instead of direct supabase.from calls.',
      enforcementCommand: 'npm run rules:enforce'
    },
    {
      id: 'CONSOLE_STATEMENTS',
      type: 'anti-pattern',
      severity: 'medium',
      title: 'Console statements in runtime source files',
      pattern: /\bconsole\.(log|debug|info|warn|error)\(/g,
      include: (filePath) => filePath.includes('/src/'),
      threshold: 10,
      proposedRequirement: 'Require runtime source modules to avoid console logging and use approved structured logging utilities.',
      enforcementCommand: 'npm run lint'
    },
    {
      id: 'PIPELINE_LAYOUT_DRIFT',
      type: 'anti-pattern',
      severity: 'high',
      title: 'Pipeline pages missing DashboardLayout',
      customScan: (filePath, content) => {
        const isPipelineFile = /pipeline/i.test(path.basename(filePath));
        if (!isPipelineFile) {
          return 0;
        }
        return /DashboardLayout/.test(content) ? 0 : 1;
      },
      include: (filePath) => filePath.endsWith('.tsx') && filePath.includes('/src/'),
      threshold: 1,
      proposedRequirement:
        'Require every pipeline route component to render within DashboardLayout to preserve platform shell consistency.',
      enforcementCommand: 'npm run rules:analyze'
    },
    {
      id: 'TODO_MARKERS',
      type: 'pattern',
      severity: 'low',
      title: 'TODO/FIXME/HACK markers',
      pattern: /\b(TODO|FIXME|HACK)\b/g,
      include: (filePath) => filePath.includes('/src/') || filePath.includes('/scripts/'),
      threshold: 15,
      proposedRequirement:
        'Require TODO/FIXME/HACK markers to include owner and ticket reference to maintain actionable technical debt tracking.',
      enforcementCommand: 'npm run rules:analyze'
    },
    {
      id: 'SCOPED_DB_USAGE',
      type: 'best-practice',
      severity: 'info',
      title: 'Scoped data access usage',
      pattern: /\bscopedDb\.from\(/g,
      include: (filePath) => filePath.includes('/src/'),
      threshold: 1,
      proposedRequirement:
        'Require new data-access implementations to follow existing scopedDb data isolation patterns for tenant and franchise safety.',
      enforcementCommand: 'npm run rules:enforce'
    }
  ];

  for (const detector of detectors) {
    let count = 0;
    const evidence = [];
    for (const filePath of files) {
      if (!detector.include(filePath)) {
        continue;
      }
      const content = readFile(filePath);
      const fileCount = detector.customScan ? detector.customScan(filePath, content) : countMatches(content, detector.pattern);
      if (fileCount > 0 && evidence.length < 15) {
        evidence.push({
          file: path.relative(repoRoot, filePath),
          count: fileCount
        });
      }
      count += fileCount;
    }
    findings.push({
      id: detector.id,
      type: detector.type,
      severity: detector.severity,
      title: detector.title,
      count,
      threshold: detector.threshold,
      evidence,
      proposedRequirement: detector.proposedRequirement,
      enforcementCommand: detector.enforcementCommand
    });
  }

  const report = {
    generatedAt: now.toISOString(),
    filesScanned: files.length,
    findings
  };
  writeJson(analysisPath, report);
  console.log(`Rule analysis generated: ${analysisPath}`);
};

const buildProposals = (analysisReport) => {
  const alignedKeywords = ['Require', 'tenant', 'franchise', 'DashboardLayout', 'scopedDb', 'backward', 'security'];
  let sequence = 1;
  const proposals = [];

  for (const finding of analysisReport.findings) {
    if (finding.count < finding.threshold) {
      continue;
    }
    const requirement = String(finding.proposedRequirement || '').trim();
    const relevanceScore = Math.min(1, finding.count / Math.max(1, finding.threshold));
    const actionable = requirement.startsWith('Require ') && Boolean(finding.enforcementCommand);
    const aligned = alignedKeywords.some((keyword) => requirement.includes(keyword));
    const validated = relevanceScore >= 1 && actionable && aligned;
    if (!validated) {
      continue;
    }
    const numericId = String(sequence).padStart(3, '0');
    proposals.push({
      proposalId: `LNX-GOV-AUTO-${numericId}`,
      sourceFindingId: finding.id,
      title: finding.title,
      proposedRequirement: requirement,
      evidenceCount: finding.count,
      relevanceScore: Number(relevanceScore.toFixed(2)),
      validation: {
        relevant: relevanceScore >= 1,
        actionable,
        alignedToArchitecture: aligned
      },
      enforcementCommand: finding.enforcementCommand,
      evidence: finding.evidence.slice(0, 8)
    });
    sequence += 1;
  }
  return proposals;
};

const syncProposalsToProjectRules = (proposals, generatedAt) => {
  checkRulesFile();
  const sectionStart = '<!-- DYNAMIC-RULES:START -->';
  const sectionEnd = '<!-- DYNAMIC-RULES:END -->';
  const startMarker = '<!-- RULE-PROPOSALS:START -->';
  const endMarker = '<!-- RULE-PROPOSALS:END -->';
  const header = '## Dynamic Rule Proposals (Auto-Generated)';
  const proposalLines = [
    sectionStart,
    header,
    `Last Generated: ${generatedAt}`,
    '',
    startMarker,
    ''
  ];

  if (proposals.length === 0) {
    proposalLines.push('- No validated dynamic proposals were generated in this run.');
  } else {
    for (const proposal of proposals) {
      proposalLines.push(`### ${proposal.title}`);
      proposalLines.push(`- **Generated Rule ID:** \`${proposal.proposalId}\``);
      proposalLines.push(`- **Source Finding:** \`${proposal.sourceFindingId}\``);
      proposalLines.push(`- **Proposed Requirement:** ${proposal.proposedRequirement}`);
      proposalLines.push(`- **Evidence Count:** ${proposal.evidenceCount}`);
      proposalLines.push(
        `- **Validation:** relevant=${proposal.validation.relevant ? 'yes' : 'no'}, actionable=${proposal.validation.actionable ? 'yes' : 'no'}, aligned=${proposal.validation.alignedToArchitecture ? 'yes' : 'no'}`
      );
      proposalLines.push(`- **Suggested Enforcement Command:** \`${proposal.enforcementCommand}\``);
      if (proposal.evidence.length > 0) {
        proposalLines.push('- **Evidence Files:**');
        for (const item of proposal.evidence) {
          proposalLines.push(`- \`${item.file}\` (${item.count})`);
        }
      }
      proposalLines.push('');
    }
  }

  proposalLines.push(endMarker);
  proposalLines.push(sectionEnd);
  const block = `${proposalLines.join('\n')}\n`;
  const rulesBody = readFile(rulesPath);
  const sectionRegex = new RegExp(`${sectionStart}[\\s\\S]*?${sectionEnd}`, 'm');
  let updated;

  if (rulesBody.includes(sectionStart) && rulesBody.includes(sectionEnd)) {
    updated = rulesBody.replace(sectionRegex, block.trimEnd());
  } else {
    updated = `${rulesBody.trimEnd()}\n\n---\n\n${block}`;
  }

  fs.writeFileSync(rulesPath, `${updated.trimEnd()}\n`);
};

const runPropose = (syncProjectRules = false) => {
  if (!fs.existsSync(analysisPath)) {
    runAnalyze();
  }
  const analysisReport = JSON.parse(readFile(analysisPath));
  const proposals = buildProposals(analysisReport);
  const payload = {
    generatedAt: now.toISOString(),
    sourceAnalysis: path.relative(repoRoot, analysisPath),
    proposals
  };
  writeJson(proposalsPath, payload);
  console.log(`Rule proposals generated: ${proposalsPath}`);

  if (syncProjectRules) {
    syncProposalsToProjectRules(proposals, payload.generatedAt);
    console.log(`project_rules.md synchronized with dynamic proposals: ${rulesPath}`);
  }
};

const runSync = () => {
  runAnalyze();
  runPropose(true);
};

const runHelp = () => {
  const output = [
    'Usage: node scripts/project-rules-workflow.mjs <command> [options]',
    '',
    'Commands:',
    '  consult                 Record mandatory rules consultation state',
    '  enforce [--staged]      Enforce consultation compliance before changes/commit',
    '  analyze                 Analyze codebase patterns and anti-patterns',
    '  propose                 Generate validated dynamic rule proposals from analysis',
    '  sync                    Analyze + propose + sync auto-proposals into project_rules.md',
    '  help                    Show this help'
  ];
  console.log(output.join('\n'));
};

switch (command) {
  case 'consult':
    runConsult();
    break;
  case 'enforce':
    runEnforce();
    break;
  case 'analyze':
    runAnalyze();
    break;
  case 'propose':
    runPropose(hasArg('--sync-project-rules'));
    break;
  case 'sync':
    runSync();
    break;
  default:
    runHelp();
    break;
}
