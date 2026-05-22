/**
 * useFeatureGate — Stripe-pattern "do this setup first" gate.
 *
 * Wrap any action that depends on an on_action setup task. Returns an
 * `attempt()` function the caller wires into onClick, plus a `Modal`
 * component the caller renders in JSX. If the underlying setup task is
 * not yet completed, attempt() returns false, opens the modal, and
 * promotes the card to the top of the "Get set up" panel so the user
 * sees it again next time they visit Home.
 *
 * Usage:
 *
 *   const gate = useFeatureGate('add_gst');
 *
 *   const onCreateInvoice = () => {
 *     if (!gate.attempt()) return;          // modal opens, abort
 *     doCreateInvoice();
 *   };
 *
 *   return (
 *     <>
 *       <Button onClick={onCreateInvoice}>Create invoice</Button>
 *       <gate.Modal />
 *     </>
 *   );
 *
 * Successful completion of the gated action should call
 * `useSetupCards().markComplete('add_gst')` so the card moves to
 * 'completed' and the gate stops firing.
 *
 * See docs/plans/2026-05-22-unified-platform-onboarding-design.md §"Setup
 * cards + invite flow".
 */
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lock, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { SETUP_CARDS } from "./registry";
import { useSetupCards } from "./useSetupCards";
import type { SetupCardDefinition } from "./types";

export interface FeatureGate {
  /** True when the underlying task isn't completed yet. */
  isLocked: boolean;
  /**
   * Call from a button onClick. Returns true when the action is allowed
   * (proceed) and false when the gate fired (modal opened, action aborted).
   * Promotes the underlying on_action card so it surfaces in the panel.
   */
  attempt: () => boolean;
  /** Imperatively open the modal without attempting an action. */
  show:    () => void;
  /** Render this somewhere inside the same component subtree. */
  Modal:   () => ReactNode;
}

interface GateOptions {
  /**
   * Optional override for the modal's primary CTA copy. Defaults to the
   * registry card's ctaLabel.
   */
  ctaLabel?: string;
  /** Optional copy describing what they were trying to do (e.g., "create
   *  an invoice"). Surfaces in the modal subhead. */
  attemptedAction?: string;
}

const RAW_DEFS = SETUP_CARDS as readonly SetupCardDefinition[];

export function useFeatureGate(taskKey: string, options: GateOptions = {}): FeatureGate {
  const def = useMemo<SetupCardDefinition | undefined>(
    () => RAW_DEFS.find((c) => c.key === taskKey),
    [taskKey],
  );

  const { cards, promote } = useSetupCards();
  const [open, setOpen] = useState(false);

  // A card "exists" in the cards array only when there's a tenant_setup_progress
  // row (always-cards always exist; on_action cards exist only after promote).
  // For gate logic, "completed" status anywhere in that row counts as unlocked.
  const status = useMemo(() => {
    const c = cards.find((entry) => entry.def.key === taskKey);
    return c?.status ?? "pending";
  }, [cards, taskKey]);

  const isLocked = status !== "completed";

  const show = useCallback(() => {
    if (!def) {
      // Unknown task key — nothing we can do; let the action proceed.
      // eslint-disable-next-line no-console
      console.warn(`useFeatureGate: unknown task_key "${taskKey}"`);
      return;
    }
    // Re-promote even if the card was previously dismissed so the user
    // sees it again in the panel after this attempt.
    void promote(taskKey);
    setOpen(true);
  }, [def, promote, taskKey]);

  const attempt = useCallback((): boolean => {
    if (!isLocked) return true;
    show();
    return false;
  }, [isLocked, show]);

  const Modal = useCallback((): ReactNode => {
    if (!def) return null;
    const ctaLabel = options.ctaLabel ?? def.ctaLabel;
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Lock className="h-4 w-4" />
            </div>
            <DialogTitle>{def.title} first</DialogTitle>
            <DialogDescription>
              {options.attemptedAction
                ? `Before you can ${options.attemptedAction}, `
                : "Before you can do that, "}
              we need this set up.
            </DialogDescription>
          </DialogHeader>

          <p className="text-sm text-muted-foreground leading-snug">{def.body}</p>

          {def.unlocks && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span>
                <span className="font-medium">Unlocks:</span> {def.unlocks}
              </span>
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Later
            </Button>
            {def.ctaTo ? (
              <Button asChild onClick={() => setOpen(false)}>
                <Link to={def.ctaTo}>{ctaLabel}</Link>
              </Button>
            ) : (
              <Button onClick={() => setOpen(false)}>{ctaLabel}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }, [def, open, options.attemptedAction, options.ctaLabel]);

  return { isLocked, attempt, show, Modal };
}
