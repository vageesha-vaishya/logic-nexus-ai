import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  PromptDefinition,
  PromptFrontmatter,
  PromptListFilter,
} from "./types.js";

export interface PromptLoader {
  /**
   * Load a prompt by key + version. When version is omitted, returns
   * the active version (status='active'). Throws if not found, or if
   * multiple files in the tree claim the same key+version.
   */
  load(key: string, version?: number): Promise<PromptDefinition>;

  /** List all prompts; supports optional filter by module and/or status. */
  list(filter?: PromptListFilter): Promise<PromptDefinition[]>;
}

const PROMPT_FILE_RE = /\.prompt\.md$/i;

/**
 * Filesystem-backed prompt loader. Walks a rootDir for files named
 * `*.prompt.md` and indexes them by frontmatter key + version.
 *
 * The walker uses an internal cache so the first call pays the IO
 * cost; subsequent calls are in-memory. Call refresh() to invalidate.
 */
export class FilesystemPromptLoader implements PromptLoader {
  private indexCache: PromptDefinition[] | null = null;

  constructor(private readonly rootDir: string) {}

  async load(key: string, version?: number): Promise<PromptDefinition> {
    const all = await this.getIndex();
    const matches = all.filter((p) => p.frontmatter.key === key);
    if (matches.length === 0) {
      throw new Error(`prompt key not found: "${key}"`);
    }
    if (typeof version === "number") {
      const exact = matches.filter((p) => p.frontmatter.version === version);
      if (exact.length === 0) {
        const versions = matches.map((p) => p.frontmatter.version).sort((a, b) => a - b);
        throw new Error(
          `prompt "${key}" has no version ${version}; available: ${versions.join(", ")}`,
        );
      }
      if (exact.length > 1) {
        throw new Error(
          `prompt "${key}" version ${version} found in multiple files: ${exact.map((p) => p.source_path).join(", ")}`,
        );
      }
      return exact[0];
    }
    // No version specified → return active. Exactly one active per key is the rule.
    const active = matches.filter((p) => p.frontmatter.status === "active");
    if (active.length === 0) {
      const statuses = matches.map((p) => `v${p.frontmatter.version}:${p.frontmatter.status}`);
      throw new Error(
        `prompt "${key}" has no active version. Statuses: ${statuses.join(", ")}`,
      );
    }
    if (active.length > 1) {
      throw new Error(
        `prompt "${key}" has more than one active version (must be exactly one): ${active.map((p) => `v${p.frontmatter.version}`).join(", ")}`,
      );
    }
    return active[0];
  }

  async list(filter?: PromptListFilter): Promise<PromptDefinition[]> {
    const all = await this.getIndex();
    return all.filter((p) => {
      if (filter?.module && p.frontmatter.owner_module !== filter.module) return false;
      if (filter?.status && p.frontmatter.status !== filter.status) return false;
      return true;
    });
  }

  /** Invalidate the in-memory cache so the next load() re-walks the disk. */
  refresh(): void {
    this.indexCache = null;
  }

  private async getIndex(): Promise<PromptDefinition[]> {
    if (this.indexCache !== null) return this.indexCache;
    const files = await walkPromptFiles(this.rootDir);
    const defs: PromptDefinition[] = [];
    for (const file of files) {
      const raw = await fs.readFile(file, "utf8");
      const { frontmatter, body } = parseFrontmatter(raw);
      defs.push({ frontmatter, body, source_path: file });
    }
    this.indexCache = defs;
    return defs;
  }
}

async function walkPromptFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkPromptFiles(full)));
    } else if (entry.isFile() && PROMPT_FILE_RE.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

/**
 * Minimal YAML-frontmatter parser. Supports flat `key: value` pairs,
 * arrays `[a, b, c]`, integers, floats, booleans, quoted strings, and
 * comment lines. No nested objects, no multi-line scalars. Sufficient
 * for the prompt frontmatter schema (master §6.3). Phase 9 can swap
 * in `js-yaml` if the format grows.
 */
export function parseFrontmatter(rawMarkdown: string): {
  frontmatter: PromptFrontmatter;
  body: string;
} {
  const match = FRONTMATTER_RE.exec(rawMarkdown);
  if (!match) {
    throw new Error("prompt file missing YAML frontmatter (--- ... --- block)");
  }
  const yamlLines = match[1].split(/\r?\n/);
  const body = match[2].replace(/^\s+/, "");

  const fm: Record<string, unknown> = {};
  for (const rawLine of yamlLines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    fm[key] = parseScalar(value);
  }

  // Light validation of required fields — full schema check done by callers.
  for (const required of ["key", "version", "status", "owner_module", "default_model", "pii_handling", "safety_class"]) {
    if (typeof fm[required] === "undefined") {
      throw new Error(`prompt frontmatter missing required field "${required}"`);
    }
  }

  return { frontmatter: fm as unknown as PromptFrontmatter, body };
}

function parseScalar(value: string): unknown {
  if (value.length === 0) return "";
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (inner.length === 0) return [];
    return inner
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => s.replace(/^["']|["']$/g, ""));
  }
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (/^-?\d+$/.test(value)) return Number(value);
  if (/^-?\d+\.\d+$/.test(value)) return Number(value);
  return value.replace(/^["']|["']$/g, "");
}
