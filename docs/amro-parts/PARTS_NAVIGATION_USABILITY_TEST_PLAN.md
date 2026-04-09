# AMRO Parts Navigation Usability Test Plan

## Objective
Validate that users can discover and switch across all authorized modules quickly and accurately on desktop, tablet, and mobile form factors.

## Target Participants
- 2 Storekeepers
- 2 Maintenance Engineers
- 1 Inspector
- 1 Planner
- 1 Operations Manager

## Tasks
1. Locate and open `Stock Ledger` from default landing.
2. Use breadcrumb context to return to `Overview`.
3. Access `Reservations` via quick shortcut.
4. On mobile, open module drawer and switch to `Locations`.
5. Validate role-restricted module absence for technician profile.
6. Export a report from the active module.

## Metrics
- Task success rate target: `>= 95%`
- Time-to-module-switch target: `<= 5 seconds` (human task)
- UI response benchmark target: `<= 200ms` (system metric)
- Misclick/error target: `< 1` per task average
- SUS score target: `>= 80`

## Accessibility Validation
- Keyboard-only navigation through module menu.
- Screen-reader announcement for active module and breadcrumb.
- Contrast checks on active/hover states.
- Focus visibility and trap behavior in mobile drawer.

## Data Capture Template
- Participant ID
- Role profile
- Device type
- Task completion (pass/fail)
- Time per task
- Notes and friction points
- Suggested improvements

## Exit Criteria
- All critical tasks pass by all role groups.
- No blocking accessibility defects.
- Benchmark badge consistently remains below 200ms in standard conditions.
