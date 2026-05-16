# .claude/commands/debt-scan.md

Scan the codebase for technical debt patterns.

Check for:
1. **Dead code**: Unused exports, unreachable branches, commented blocks
2. **Duplication**: Similar logic in multiple places (DRY violations)
3. **Complexity**: Functions with cyclomatic complexity > 10
4. **Outdated deps**: packages with major version updates available
5. **Missing tests**: Public functions/endpoints with zero test coverage
6. **TODO archaeology**: TODOs older than 6 months (check git blame)
7. **Type safety**: any/unknown usage, missing return types
8. **Config drift**: Inconsistencies between environments

For each finding:
- Severity: critical / high / medium / low
- Location: file:line
- Estimated fix effort: quick (< 1hr) / medium (1-4hr) / large (1+ day)
- Suggested fix approach

End with a Debt Score: 0 (pristine) to 100 (rewrite territory)