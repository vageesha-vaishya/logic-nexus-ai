import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FilesystemPromptLoader, parseFrontmatter } from "./index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("parseFrontmatter", () => {
  it("parses required scalar fields", () => {
    const { frontmatter, body } = parseFrontmatter(`---
key: test.example
version: 1
status: active
owner_module: core
default_model: claude-haiku-4-5
pii_handling: redact_emails_phones
safety_class: business_advisory
---
Hello, world.
`);
    expect(frontmatter.key).toBe("test.example");
    expect(frontmatter.version).toBe(1);
    expect(frontmatter.status).toBe("active");
    expect(frontmatter.owner_module).toBe("core");
    expect(body).toBe("Hello, world.\n");
  });

  it("parses array fields", () => {
    const { frontmatter } = parseFrontmatter(`---
key: test.array
version: 1
status: active
owner_module: core
default_model: m
pii_handling: pass_through
safety_class: business_advisory
expected_inputs: [foo, bar, "baz"]
---
body`);
    expect(frontmatter.expected_inputs).toEqual(["foo", "bar", "baz"]);
  });

  it("parses booleans, numbers, and null", () => {
    const { frontmatter } = parseFrontmatter(`---
key: test.types
version: 2
status: shadow
owner_module: core
default_model: m
pii_handling: pass_through
safety_class: business_advisory
temperature: 0.2
max_tokens: 600
cache_ttl_seconds: 0
---
b`);
    expect(frontmatter.temperature).toBe(0.2);
    expect(frontmatter.max_tokens).toBe(600);
    expect(frontmatter.cache_ttl_seconds).toBe(0);
  });

  it("throws when frontmatter is missing", () => {
    expect(() => parseFrontmatter("just markdown, no frontmatter")).toThrow(/missing YAML frontmatter/);
  });

  it("throws when required field is missing", () => {
    expect(() =>
      parseFrontmatter(`---
key: x
version: 1
---
body`),
    ).toThrow(/missing required field/);
  });

  it("ignores comment lines and empty lines", () => {
    const { frontmatter } = parseFrontmatter(`---
# top comment
key: test.comments
# inline comment
version: 1
status: active
owner_module: core
default_model: m
pii_handling: pass_through
safety_class: business_advisory

---
body`);
    expect(frontmatter.key).toBe("test.comments");
  });
});

describe("FilesystemPromptLoader against real fixtures", () => {
  const promptsRoot = path.resolve(__dirname);
  const loader = new FilesystemPromptLoader(promptsRoot);

  beforeAll(() => {
    // Force a fresh walk for the test run.
    loader.refresh();
  });

  it("finds the seeded core.party.dedup_suggestion prompt", async () => {
    const p = await loader.load("core.party.dedup_suggestion");
    expect(p.frontmatter.key).toBe("core.party.dedup_suggestion");
    expect(p.frontmatter.version).toBe(1);
    expect(p.frontmatter.status).toBe("active");
    expect(p.frontmatter.owner_module).toBe("core");
    expect(p.body.length).toBeGreaterThan(50);
  });

  it("load() returns the active version when no version is specified", async () => {
    const p = await loader.load("core.party.dedup_suggestion");
    expect(p.frontmatter.status).toBe("active");
  });

  it("load(key, version) returns the exact version", async () => {
    const p = await loader.load("core.party.dedup_suggestion", 1);
    expect(p.frontmatter.version).toBe(1);
  });

  it("load(unknown_key) throws", async () => {
    await expect(loader.load("not.a.real.prompt")).rejects.toThrow(/not found/);
  });

  it("load(key, missing_version) throws with available versions", async () => {
    await expect(loader.load("core.party.dedup_suggestion", 99)).rejects.toThrow(/no version 99/);
  });

  it("list() returns all prompts in the tree", async () => {
    const all = await loader.list();
    expect(all.length).toBeGreaterThanOrEqual(1);
  });

  it("list({module: 'core'}) filters", async () => {
    const corePrompts = await loader.list({ module: "core" });
    expect(corePrompts.every((p) => p.frontmatter.owner_module === "core")).toBe(true);
  });

  it("list({status: 'active'}) filters", async () => {
    const active = await loader.list({ status: "active" });
    expect(active.every((p) => p.frontmatter.status === "active")).toBe(true);
  });
});
