# .claude/commands/env-check.md

Check my local development environment for this project.

Verify:
1. All required tools are installed (node, npm, python, docker, etc.)
2. Correct versions match what's in package.json / .tool-versions
3. Required environment variables exist in .env (compare to .env.example)
4. Dependencies are installed and up to date (npm ci / pip install)
5. Database/services are running (Docker containers, local servers)
6. Build compiles without errors

For each check:
- PASS: Show green checkmark and version
- FAIL: Show what's wrong and the exact command to fix it

End with a summary: "Ready to develop" or "N issues need fixing"
