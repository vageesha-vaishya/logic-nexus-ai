# .claude/commands/changelog.md

Generate release notes from recent commits.

Commits since last tag:
!`git log $(git describe --tags --abbrev=0 2>/dev/null || echo HEAD~20)..HEAD --oneline`

Organize into sections:
## New Features
## Bug Fixes
## Improvements
## Breaking Changes

For each entry:
- Write from the USER's perspective, not the developer's
- "Added dark mode support" not "Implemented ThemeContext provider"
- Link to PR number if visible in commit message

If there are breaking changes, add a Migration Guide section.