import type { PromptDefinition, PromptFrontmatter, PromptListFilter } from "./types.js";

export interface PromptLoader {
  load(key: string, version?: number): Promise<PromptDefinition>;
  list(filter?: PromptListFilter): Promise<PromptDefinition[]>;
}

/**
 * Filesystem-backed prompt loader. Reads .prompt.md files under a root dir,
 * parses frontmatter, returns PromptDefinitions.
 *
 * Phase 0 skeleton — load()/list() throw until Phase 0.5 implements walk + parse.
 */
export class FilesystemPromptLoader implements PromptLoader {
  constructor(private readonly rootDir: string) {}

  async load(key: string, version?: number): Promise<PromptDefinition> {
    void key;
    void version;
    throw new Error(
      `[@platform/llm-prompts] FilesystemPromptLoader.load not yet implemented (rootDir=${this.rootDir}). See docs/plans/2026-05-28-platform-modules-redesign.md §6.3`,
    );
  }

  async list(filter?: PromptListFilter): Promise<PromptDefinition[]> {
    void filter;
    return [];
  }
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

/**
 * Minimal YAML-frontmatter parser. Supports flat `key: value` pairs and
 * `[a, b, c]` arrays. Numbers detected by /^-?\d+$/. No nested objects.
 *
 * Phase 0 stand-in — Phase 0.5 swaps in `js-yaml` for full YAML support.
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
    if (line.trim().length === 0 || line.trim().startsWith("#")) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      fm[key] = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    } else if (/^-?\d+$/.test(value)) {
      fm[key] = Number(value);
    } else if (/^-?\d+\.\d+$/.test(value)) {
      fm[key] = Number(value);
    } else if (value === "true" || value === "false") {
      fm[key] = value === "true";
    } else {
      fm[key] = value.replace(/^["']|["']$/g, "");
    }
  }

  return { frontmatter: fm as unknown as PromptFrontmatter, body };
}
