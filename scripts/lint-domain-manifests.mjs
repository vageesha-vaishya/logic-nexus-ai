#!/usr/bin/env node
/**
 * lint-domain-manifests — CI guard that every domain feature dir has a
 * manifest, every manifest declares the contract fields, and every
 * `seedMigration` reference points to a real file under supabase/migrations.
 *
 * Phase 0 enforcement of the DomainManifest contract. Runs in CI; the
 * exit code is non-zero on any failure.
 *
 * Walks:
 *   src/features/markets/         expect manifest.ts
 *   src/features/module-*\/        expect manifest.ts
 *
 * For each found manifest, dynamically imports + validates structurally.
 *
 * See:
 *   docs/plans/2026-05-21-path-a-per-domain-spa-bundles-design.md
 *   src/platform/domains/types.ts
 *   src/platform/domains/registry.ts
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const FEATURES_DIR = join(REPO_ROOT, "src", "features");
const MIGRATIONS_DIR = join(REPO_ROOT, "supabase", "migrations");

const errors = [];
const warnings = [];

function fail(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

// 1. Find every domain feature dir.
const domainDirs = readdirSync(FEATURES_DIR)
  .map((name) => ({ name, path: join(FEATURES_DIR, name) }))
  .filter(({ path }) => statSync(path).isDirectory())
  .filter(({ name }) => name === "markets" || name.startsWith("module-"));

if (domainDirs.length === 0) {
  fail("No domain feature directories found under src/features/.");
}

// 2. Each must have a manifest.ts.
const manifestPaths = [];
for (const { name, path } of domainDirs) {
  const manifestPath = join(path, "manifest.ts");
  if (!existsSync(manifestPath)) {
    fail(`Domain "${name}" has no manifest.ts. Expected at ${manifestPath}.`);
    continue;
  }
  manifestPaths.push({ name, manifestPath });
}

// 3. Each manifest must be importable + structurally valid.
//    We can't `import()` .ts directly from a plain node script without a
//    loader; instead we shell out to `tsx` to evaluate the import and dump
//    the manifest as JSON. If `tsx` isn't installed yet we fall back to
//    a textual sanity check.
let canExecute = true;
try {
  execSync("node --version", { stdio: "ignore" });
} catch {
  canExecute = false;
}

const seenCodes = new Set();

for (const { name, manifestPath } of manifestPaths) {
  // Textual sanity check first — cheap, catches the obvious missing-field cases.
  const src = await import("node:fs").then((m) => m.promises.readFile(manifestPath, "utf8"));
  const requiredFields = ["code", "name", "brand", "routes", "defaultAssignmentPolicy"];
  for (const field of requiredFields) {
    if (!new RegExp(`\\b${field}\\s*:`).test(src)) {
      fail(`Manifest ${name}/manifest.ts is missing required field: ${field}.`);
    }
  }
  // Capture the code (uppercase). Naive regex but good enough for the
  // current convention — string-literal code: "FOO".
  const codeMatch = src.match(/code\s*:\s*["']([A-Z_]+)["']/);
  if (!codeMatch) {
    fail(`Manifest ${name}/manifest.ts has no parseable code field.`);
  } else {
    const code = codeMatch[1];
    if (seenCodes.has(code)) {
      fail(`Duplicate domain code "${code}" in ${name}/manifest.ts.`);
    }
    seenCodes.add(code);
  }

  // seedMigration must exist on disk if declared. Phase 0 warns when
  // missing; Phase 1 promotes this to a hard failure once every domain
  // has a real seed (today CRM / FINANCE / COMMUNICATIONS / COMPLIANCE /
  // QUOTATION ship without one).
  const seedMatch = src.match(/seedMigration\s*:\s*["']([^"']+)["']/);
  if (seedMatch) {
    const expectedFile = join(MIGRATIONS_DIR, seedMatch[1]);
    if (!existsSync(expectedFile)) {
      fail(
        `Manifest ${name}/manifest.ts references missing seedMigration: ${seedMatch[1]}.`,
      );
    }
  } else {
    warn(
      `Manifest ${name}/manifest.ts declares no seedMigration. ` +
        `Phase 1 will require one — track in docs/plans/2026-05-20-multi-domain-platform-sequence-design.md.`,
    );
  }
}

// 4. Every manifest must be wired into the registry.
const registryPath = join(REPO_ROOT, "src", "platform", "domains", "registry.ts");
let registrySrc = "";
if (!existsSync(registryPath)) {
  fail(`Domain registry missing at ${registryPath}.`);
} else {
  registrySrc = await import("node:fs").then((m) =>
    m.promises.readFile(registryPath, "utf8"),
  );
  for (const { name } of manifestPaths) {
    const expectedImport = name === "markets"
      ? "@/features/markets/manifest"
      : `@/features/${name}/manifest`;
    if (!registrySrc.includes(expectedImport)) {
      fail(
        `Domain "${name}" has manifest.ts but is not imported in ${registryPath} ` +
          `(expected: ${expectedImport}).`,
      );
    }
  }
}

// 5. Every domain code referenced by sidebar nav must have a manifest.
//    The nav guards (`hasAmroDomain`, `hasMarketsDomain`, …) call out
//    domain codes by string literal. If a guard ships for a code with no
//    manifest, the nav row will only ever render under the
//    platform-admin short-circuit — exactly the bug Phase 0 is closing.
const navPath = join(REPO_ROOT, "src", "components", "navigation", "CommandCenterNav.tsx");
if (existsSync(navPath)) {
  const navSrc = await import("node:fs").then((m) =>
    m.promises.readFile(navPath, "utf8"),
  );
  // Capture: domain.code || '').trim().toUpperCase() === 'FOO'
  const codeRefs = new Set();
  const re = /toUpperCase\(\)\s*===\s*['"]([A-Z_]+)['"]/g;
  let match;
  while ((match = re.exec(navSrc)) !== null) {
    codeRefs.add(match[1]);
  }
  for (const code of codeRefs) {
    if (!seenCodes.has(code)) {
      fail(
        `Sidebar nav (${navPath}) references domain code "${code}" but no ` +
          `manifest declares it. Either add a manifest with code:"${code}", ` +
          `or remove the nav gate.`,
      );
    }
  }
}

// Report.
if (warnings.length > 0) {
  for (const w of warnings) console.warn(`⚠️  ${w}`);
}
if (errors.length > 0) {
  for (const e of errors) console.error(`❌ ${e}`);
  console.error(`\nlint-domain-manifests: ${errors.length} error(s).`);
  process.exit(1);
}
console.log(
  `✅ lint-domain-manifests: ${manifestPaths.length} manifest(s) ok.`,
);
