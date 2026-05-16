# .claude/commands/preflight.md

Scan all staged changes for issues before I commit.

Review these staged changes:
!`git diff --cached`

Check for:
1. console.log / print / debugger statements left in
2. Hardcoded secrets, API keys, or passwords
3. TODO/FIXME comments that should be resolved before commit
4. Commented-out code blocks (dead code)
5. Missing error handling (try/catch, null checks)
6. Typos in user-facing strings
7. Import statements for unused modules

IMPORTANT: Report issues only. Do NOT fix anything.
Format: file:line — issue description — severity (critical/warning/info)