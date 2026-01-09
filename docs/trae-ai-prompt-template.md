# Trae AI Prompt Template

Use this template to give Trae AI clear, actionable instructions for complex development tasks. It enforces scope, concrete paths, acceptance criteria, output style, and validation.

## How to Use
- Copy the template block and fill in each section.
- Use absolute paths for files and directories.
- Keep acceptance criteria measurable and tied to visible results or command output.
- Prefer minimal, surgical changes and show diffs/patches.

## Template
```text
Title: <Clear, specific goal>

Goal
- <One sentence outcome: what changes and why>

Scope & Context
- Paths: <absolute paths to files/folders>
- In-scope: <key components/areas>
- Out-of-scope: <things not to touch>
- Tenancy & Security: <tenant rules, RLS, auth constraints>
- Performance & UX constraints: <latency targets, UI guardrails>

Inputs
- Data/IDs: <IDs, example payloads, UUIDs>
- Env: <macOS, node version, env vars>
- Preexisting: <functions, hooks, APIs to reuse>

Outputs
- Code changes: <files expected to change>
- UI changes: <components affected, visual expectations>

Acceptance Criteria
1) <Criterion with pass/fail and where to verify>
2) <Criterion with path/command to check>
3) <Criterion for edge/corner cases>

Implementation Tasks
- <High-level steps to make the change>
- <Testing steps and minimal commands>

Output Style
- Use absolute paths.
- Provide minimal diffs/patches; avoid large rewrites.
- Keep commands non-interactive and macOS-compatible.
- Use DEV-only logging if needed.

Validation
- Commands: <npm run dev, test, etc.>
- Preview: <open preview URL if UI changes>
- Console: <what to check and what should not appear>

Risks & Fallbacks
- Risks: <data shape assumptions, race conditions>
- Fallbacks: <safe rollback or feature flag>
```

## Notes
- Prefer small, focused changes over refactors.
- If UI changes, include a preview step to visually confirm.
- Tie acceptance criteria to observable outcomes: rendered UI, console logs, API responses, or command output.
