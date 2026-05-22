/**
 * Setup-card types — task registry for the "Get set up" panel.
 *
 * Tasks are defined in TypeScript (not in the DB) so we can iterate
 * copy + ordering + per-domain task lists without migrations. The DB
 * stores only state (pending | completed | dismissed) keyed on
 * (tenant_id, domain_code, task_key).
 *
 * Tasks have one of two trigger modes:
 *   - "always"     — appears on the panel from day one for every new tenant
 *   - "on_action"  — promoted to the top of the panel by a feature-gate
 *                    hook the first time the user attempts the gated
 *                    action (e.g., "Create invoice" → add_gst card).
 *                    Until promoted, on_action tasks are hidden.
 *
 * See docs/plans/2026-05-22-unified-platform-onboarding-design.md
 * §"Setup cards + invite flow".
 */

import type { LucideIcon } from "lucide-react";

export type SetupCardStatus = "pending" | "completed" | "dismissed";

export type SetupCardTrigger = "always" | "on_action";

export interface SetupCardDefinition {
  /** Stable identifier — primary key column in tenant_setup_progress. */
  key:        string;
  /** Domain code (matches public.platform_domains.code). */
  domain:     "logistics" | "markets";
  title:      string;
  body:       string;
  ctaLabel:   string;
  /** Internal navigation target. Falls back to no-op if the card has
   *  state to mark complete via something other than a click. */
  ctaTo?:     string;
  icon:       LucideIcon;
  trigger:    SetupCardTrigger;
  /** Display order — lower numbers float to the top. Trigger="on_action"
   *  cards that have been promoted display with order=0 regardless. */
  order:      number;
  /** Optional hint copy shown when this card unblocks downstream
   *  functionality (e.g., "Unlocks tax invoices"). */
  unlocks?:   string;
}

export interface SetupCardRow {
  tenant_id:    string;
  domain_code:  string;
  task_key:     string;
  status:       SetupCardStatus;
  completed_at: string | null;
  dismissed_at: string | null;
  updated_at:   string;
}
