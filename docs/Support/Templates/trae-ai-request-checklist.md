# Trae AI Request Checklist

Use this checklist to make your requests consistent, concrete, and testable.

- Title clearly states the action and scope.
- Outcome summarized in one sentence (why + what changes).
- List affected files/folders as absolute paths.
- Define acceptance criteria with measurable pass/fail.
- Provide environment details and required env vars.
- Include non-interactive, macOS-compatible commands.
- Specify UI preview steps if visuals change.
- Provide sample inputs/IDs and edge cases.
- Note tenancy/RLS and security constraints.
- Call out performance/UX expectations.
- Prefer minimal diffs/patches over big rewrites.
- Reference existing hooks/utils/APIs to reuse.
- Add validation steps (console checks, API responses).
- Include fallback plan or rollback note if risky.
- Avoid unrelated refactors; keep scope tight.

## Code Review Checklist for New Tables

- If migration adds `CREATE TABLE`, confirm schema/code overlap analysis is attached.
- Confirm review lists candidate existing tables and extension feasibility result.
- Confirm written justification explains why extension is not reasonable.
- Confirm database architecture team approval reference is provided.
- Confirm migration includes `DB-VERIFICATION:` and `DB-ARCH-APPROVAL:` metadata lines.
