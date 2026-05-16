# .claude/commands/testmatch.md

Generate tests for: $ARGUMENTS

BEFORE writing any tests:
1. Read 3 existing test files in the same directory
2. Identify the patterns: naming convention, assertion style,
   fixture usage, describe/it structure, data setup approach
3. Note the testing library and custom helpers used

THEN generate tests that:
- Follow the EXACT same patterns (naming, structure, helpers)
- Cover: happy path, error cases, edge cases, boundary values
- Use existing test utilities and fixtures (don't create new ones)
- Include both positive and negative assertions

The generated tests should look like a teammate wrote them,
not like AI generated them.