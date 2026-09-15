// Single source of the active usability-testing round and its tasks — read
// by UxFeedbackWidget (the Select options) and docs/design-system/usability/
// PROTOCOL.md (kept in sync by hand; PROTOCOL.md's round-1 list must match
// round 1 here). See docs/superpowers/specs/2026-09-13-design-system-
// verification-and-usability-design.md §5.3-5.4.

export interface UxTask {
  id: string;
  label: string;
}

export interface UxRound {
  tasks: UxTask[];
}

export const UX_ROUNDS: { activeRound: number; rounds: Record<number, UxRound> } = {
  activeRound: 1,
  rounds: {
    1: {
      tasks: [
        { id: 'find-open-lead', label: 'Find the lead for a given company and open it' },
        { id: 'move-opportunity-stage', label: "Move that lead's opportunity to the next stage on the pipeline board" },
        { id: 'create-contact', label: 'Create a new contact against the same account' },
        { id: 'switch-dark-mode', label: 'Switch the interface to dark mode' },
        { id: 'filter-todays-activities', label: "Show only today's activities" },
      ],
    },
  },
};

export function activeRoundTasks(): UxTask[] {
  return UX_ROUNDS.rounds[UX_ROUNDS.activeRound].tasks;
}
