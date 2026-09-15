# Usability Testing Protocol

**Status:** No rounds have run yet. This document is the protocol; round
write-ups live in `round-N.md` files that only exist once real sessions
have happened — see [Iteration loop](#iteration-loop).

## Participants

- 5–8 people per round, drawn from real sales and operations roles (not
  engineering).
- At least one participant testing on a 360–768px-wide device (phone or
  small tablet), matching the design system's verified breakpoints
  (`docs/design-system/verification/REPORT.md`).
- At least one first-time user of the product (no prior exposure) per
  round, to catch onboarding friction the rest of the team is now blind to.

## Moderator script

- Think-aloud: ask the participant to narrate what they're looking for and
  why, not just what they're clicking.
- Do not lead. If a participant is stuck, wait at least 15 seconds before
  the mildest possible nudge ("what would you try next?"), never "click
  the X button."
- Do not explain a UI element's purpose before they've attempted the task —
  that's the finding, not noise to route around.
- Time-box each task at 3 minutes; if not complete, mark it `no` and move on
  — a failed task is data, not a moderator failure.
- Consent line, read verbatim before starting: "We're testing the product,
  not you — there's no wrong way to use it, and anything that trips you up
  is something we want to fix. Is it OK if we record your screen and voice
  for this session, and if I collect this feedback here on the record?"

## Round 1 tasks

(Must match `src/config/uxRounds.ts`'s `UX_ROUNDS.rounds[1].tasks` — if you
change one, change both.)

1. Find the lead for a given company and open it.
2. Move that lead's opportunity to the next stage on the pipeline board.
3. Create a new contact against the same account.
4. Switch the interface to dark mode.
5. Show only today's activities.

## Iteration loop

1. Bump `UX_ROUNDS.activeRound` in `src/config/uxRounds.ts`; enable the
   `ux_feedback_widget` flag for the pilot tenant at
   `/dashboard/settings/feature-flags`; run sessions using the moderator
   script above, with participants submitting feedback through the widget
   as they go (or immediately after each task).
2. `node docs/design-system/usability/export.mjs --round N` → paste its
   output into a new `round-N.md` (copy `round-template.md` as the
   starting point); rank findings by severity × frequency; decide fix /
   defer / won't-fix per finding.
3. Implement fixes; `npm run audit:design-system` must stay green; commit
   referencing `round-N`.
4. Repeat. **Minimum three rounds before any "validated" claim enters
   `docs/design-system/README.md`.**
5. `docs/design-system/README.md` §9 links this file, every `round-N.md`,
   and states the current round status.
