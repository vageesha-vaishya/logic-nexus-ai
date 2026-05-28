#!/usr/bin/env node
/**
 * Enforces master design doc §6.2:
 * @platform/llm-client is the ONLY legal path to LLM providers.
 *
 * Any TypeScript/JavaScript file outside packages/llm-client/** that imports
 * from a provider SDK fails this check.
 *
 * Run via `npm run lint:llm-imports` or as part of `npm run ci:lint`.
 *
 * Aligns with the existing pattern of scripts/lint-domain-manifests.mjs.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const FORBIDDEN_IMPORTS = [
  // Anthropic
  "@anthropic-ai/sdk",
  "@anthropic-ai/bedrock-sdk",
  "@anthropic-ai/vertex-sdk",
  // OpenAI
  "openai",
  // Google
  "@google/generative-ai",
  "@google-ai/generativelanguage",
  "@google-cloud/aiplatform",
  // Mistral
  "@mistralai/mistralai",
  // Cohere
  "cohere-ai",
  // Voyage / others used by some integrations
  "voyageai",
];

const ALLOW_GLOBS = [
  // The single legal home for provider SDKs
  "packages/llm-client/",
  // Out-of-process workers may legitimately call providers directly today;
  // they'll migrate to @platform/llm-client during Phase 9 (master §7.4).
  // Listed here explicitly so migration progress is visible.
  "services/markets-worker/",
];

const SCAN_DIRS = ["src", "packages", "services", "scripts", "tests"];

const IGNORE_DIRS = new Set([
  "node_modules",
  ".venv",
  "dist",
  "build",
  "coverage",
  ".pytest_cache",
  ".ruff_cache",
  "__pycache__",
  "storybook-static",
  "test-results",
  "playwright-report",
]);

const FILE_EXTS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);

/**
 * Matches `from '<spec>'`, `from "<spec>"`, `require('<spec>')`, `import('<spec>')`.
 * Captures the spec.
 */
const IMPORT_PATTERNS = [
  /\bfrom\s+["']([^"']+)["']/g,
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
];

function isAllowed(relativePath) {
  return ALLOW_GLOBS.some((glob) => relativePath.startsWith(glob));
}

function specIsForbidden(spec) {
  return FORBIDDEN_IMPORTS.some(
    (forbidden) => spec === forbidden || spec.startsWith(`${forbidden}/`),
  );
}

async function* walk(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile() && FILE_EXTS.has(path.extname(entry.name))) {
      yield full;
    }
  }
}

async function scanFile(absPath) {
  const text = await fs.readFile(absPath, "utf8");
  const hits = [];
  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const spec = match[1];
      if (specIsForbidden(spec)) {
        const before = text.slice(0, match.index);
        const line = before.split("\n").length;
        hits.push({ spec, line });
      }
    }
  }
  return hits;
}

async function main() {
  const violations = [];
  let filesScanned = 0;

  for (const scanDir of SCAN_DIRS) {
    const absScanDir = path.join(ROOT, scanDir);
    try {
      await fs.access(absScanDir);
    } catch {
      continue;
    }
    for await (const file of walk(absScanDir)) {
      const rel = path.relative(ROOT, file);
      if (isAllowed(rel)) continue;
      filesScanned++;
      const hits = await scanFile(file);
      for (const hit of hits) {
        violations.push({ file: rel, ...hit });
      }
    }
  }

  if (violations.length === 0) {
    console.log(
      `✓ lint:llm-imports — no forbidden provider-SDK imports (${filesScanned} files scanned).`,
    );
    process.exit(0);
  }

  console.error("✗ lint:llm-imports — forbidden provider-SDK imports detected:");
  console.error("");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  imports "${v.spec}"`);
  }
  console.error("");
  console.error(
    "  Master design doc §6.2: @platform/llm-client is the only legal path to LLM providers.",
  );
  console.error(
    "  If a service genuinely needs a temporary exception, add it to ALLOW_GLOBS in",
  );
  console.error(
    "  scripts/lint-llm-imports.mjs with a comment naming the migration phase that will remove it.",
  );
  process.exit(1);
}

main().catch((err) => {
  console.error("lint-llm-imports crashed:", err);
  process.exit(2);
});
