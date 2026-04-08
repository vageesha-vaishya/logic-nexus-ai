# Changelog – v2.3.0

## Added
- Event-aware module layout prototypes for:
  - side Event Stream panel
  - CRUD FAB + contextual drawer
  - sticky Viewport Validation Checklist banner
- Persistent restore affordance for collapsed panels.
- Keyboard shortcut for panel restore (`Ctrl/Cmd + Shift + E`).
- CRUD action instrumentation hooks and Storybook trace panel.
- Regression tests for collapse/restore behavior.

## Changed
- Record Detail transformed into grouped, typed enterprise form layout.
- Grid-detail workspace now supports split-pane resize and collapsible panel controls.
- Accessibility metadata and keyboard interaction parity improved for controls.

## Fixed
- Detail panel collapse state could previously hide the restore path.
- Scroll-position edge case now has always-visible restore action.

## Quality Gates
- Lint diagnostics clean on updated module files.
- Unit tests added/updated and passing for target template suite.

## Release Notes
- Release tag: `v2.3.0`
- Rollout: progressive (alpha -> beta -> UAT -> production)
