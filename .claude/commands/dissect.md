> Perform a deep structural and quality review of the following file: $ARGUMENTS
> 
> Please analyze:
> 1. Complexity & modularity (Are functions doing too much?).
> 2. Redundancy (Can any patterns be abstracted or reused?).
> 3. Performance optimizations or potential memory leaks.
> ```

---

## 3. Databases & Migrations (Custom Commands)

### `/migrate-draft`
**Purpose:** Generates zero-downtime, safe migration files that match your project's precise existing schema patterns.
> **Implementation (`.claude/commands/migrate-draft.md`):**
> ```markdown
> Draft a database migration for: $ARGUMENTS
> 
> BEFORE writing the code:
> 1. Check our current schema structure or existing migration files to learn our naming conventions (camelCase vs snake_case).
> 2. Identify any foreign key constraints or indexes required.
> 
> Generate:
> - The UP migration script.
> - The DOWN migration script (exact rollback).
> ```

---

## 4. Git Workflows & Shipping (Custom Commands)

### `/ship`
**Purpose:** Prepares your branch for a Pull Request by verifying tests, reviewing differences, and writing a comprehensive PR description.
> **Implementation (`.claude/commands/ship.md`):**
> 
```markdown
> Step 1 — Pre-flight validation:
> Run our test suite using the standard local command. If tests fail, STOP immediately.
> 
> Step 2 — Analyze the branch changes against main:
> !`git log main..HEAD --stat`
> 
> Step 3 — Generate a comprehensive Pull Request Description:
> - **Summary**: 2-3 sentences explaining the WHAT and WHY.
> - **Changes**: Bulleted list of modifications grouped by logic.
> - **Risk Assessment**: Breaking changes, data migrations, or roll-back instructions.
> ```

### `/review-pr`
**Purpose:** Pulls down a teammate's PR locally and gives it an autonomous pass to check for logical bugs and edge cases.
> **Implementation (`~/.claude/commands/review-pr.md`):**
> 
```markdown
> Check out the PR branch or file path provided: $ARGUMENTS
> Run a comprehensive review looking for:
> 1. Edge-case logic bugs (e.g., null pointers, unhandled array states).
> 2. Type-safety violations.
> 3. Divergence from architecture standards.
> Provide line-by-line feedback with corrected code suggestions where applicable.
> ```

---

## 5. Automation & Architecture (Custom Commands)

### `/orient`
**Purpose:** Run this immediately after a `/clear` command. It reads your project structure and local documentation so Claude instantly regains full context of what you are working on.
> **Implementation (`.claude/commands/orient.md`):**
> ```markdown
> Read the root directories and key design files. 
> Give me a quick 2-sentence summary of the active project scope and stack so I know you're oriented.
> ```

### `/testmatch`
**Purpose:** Generates unit tests for a chosen file, automatically analyzing existing test suites first to perfectly duplicate your mocking libraries, test suites, and assertions.
> **Implementation (`~/.claude/commands/testmatch.md`):**
> 
```markdown
> Generate a complete unit test file for: $ARGUMENTS
> First, read a couple of existing test files in the project to match the testing framework (Jest, Vitest, etc.), mocking style, and assertion patterns exactly.
> ```

---

### 💡 Pro-Tip for Setting Up:
To make these active, simply create a directory named `.claude/commands/` at the root of your codebase, drop any of these blocks into a `.md` file (e.g., `ship.md`), and you can immediately trigger it inside your Claude session by typing `/ship`.