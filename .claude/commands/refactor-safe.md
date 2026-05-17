# .claude/commands/refactor-safe.md

Refactor the internals of: $ARGUMENTS

CONSTRAINTS (non-negotiable):
- Do NOT change any public function signatures
- Do NOT change any exported types/interfaces
- Do NOT change any API response formats
- Do NOT rename any public methods or properties
- All existing tests must still pass without modification

ALLOWED improvements:
- Extract private helper functions from long methods
- Simplify nested conditionals (guard clauses, early returns)
- Replace magic numbers with named constants
- Improve variable names for clarity (internal only)
- Remove dead code paths
- Add missing error handling

After refactoring, run the test suite and confirm all tests pass.