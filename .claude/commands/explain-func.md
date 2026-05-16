# .claude/commands/explain-func.md

Document the function/method: $ARGUMENTS

Write documentation that answers WHY, not just WHAT.

Include:
1. **Purpose**: Why does this function exist? What problem does it solve?
2. **Context**: What calls this? What business rule does it implement?
3. **Algorithm**: Step-by-step explanation of the logic (not line-by-line)
4. **Edge cases**: What inputs cause special behavior? Why?
5. **Side effects**: Does it modify state, call APIs, write to DB?
6. **Historical context**: Any non-obvious decisions (check git blame)

Format as a JSDoc/docstring comment ready to paste above the function.
Avoid restating what the code literally does — explain the reasoning.