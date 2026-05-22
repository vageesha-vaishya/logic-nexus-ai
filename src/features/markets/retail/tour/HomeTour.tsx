/**
 * HomeTour — coach-marked overlay sequence on the retail Home tab.
 *
 * The tour engine:
 *   1. Reads the current step's anchor selector (data-tour-id="…")
 *   2. Measures the target's bounding rect on every step change + window
 *      resize (debounced via requestAnimationFrame)
 *   3. Renders a fixed spotlight (transparent div with a huge box-shadow
 *      that paints the rest of the viewport at 50% black) over the target
 *   4. Renders a tooltip card positioned per the step's placement
 *   5. Wires Next / Back / Skip / Finish + Esc-to-skip
 *
 * Stateless about persistence — the parent calls onFinish/onSkip to mark
 * tour_completed in the DB.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { TOUR_STEPS, type TourStep } from './tourSteps';

interface Props {
  onFinish: () => void;
  onSkip:   () => void;
}

interface Rect {
  top:    number;
  left:   number;
  width:  number;
  height: number;
}

const TOOLTIP_GAP = 12;
const TOOLTIP_W   = 304;

function findAnchor(step: TourStep): HTMLElement | null {
  // Some anchors (e.g. nav tabs) are rendered twice — once in the desktop
  // sidebar, once in the mobile bottom nav — with CSS hiding the other.
  // Pick the first one with non-zero layout boxes so we measure the
  // currently-visible variant.
  const els = document.querySelectorAll<HTMLElement>(`[data-tour-id="${step.anchor}"]`);
  for (const el of Array.from(els)) {
    if (el.getClientRects().length > 0) return el;
  }
  return null;
}

function measure(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function tooltipPosition(
  rect:      Rect,
  placement: TourStep['placement'],
): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top  = 0;
  let left = 0;

  switch (placement) {
    case 'bottom':
      top  = rect.top + rect.height + TOOLTIP_GAP;
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
      break;
    case 'top':
      // Approx tooltip height; we'll let CSS do the rest. 200 is a safe
      // upper bound that nudges the tooltip above its anchor.
      top  = rect.top - TOOLTIP_GAP - 200;
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
      break;
    case 'right':
      top  = rect.top;
      left = rect.left + rect.width + TOOLTIP_GAP;
      break;
  }

  // Clamp inside the viewport with a 12px margin.
  left = Math.max(12, Math.min(left, vw - TOOLTIP_W - 12));
  top  = Math.max(12, Math.min(top,  vh - 240));
  return { top, left };
}

export function HomeTour({ onFinish, onSkip }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect]       = useState<Rect | null>(null);
  const rafRef                = useRef<number | null>(null);
  const step                  = TOUR_STEPS[stepIdx];

  const remeasure = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const el = findAnchor(step);
      if (!el) {
        setRect(null);
        return;
      }
      // Scroll the anchor into view if it's mostly off-screen.
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setRect(measure(el));
    });
  }, [step]);

  useEffect(() => {
    remeasure();
    window.addEventListener('resize', remeasure);
    window.addEventListener('scroll', remeasure, true);
    return () => {
      window.removeEventListener('resize', remeasure);
      window.removeEventListener('scroll', remeasure, true);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [remeasure]);

  // Esc skips the whole tour.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSkip]);

  if (typeof document === 'undefined') return null;
  if (!step) return null;

  const isLast = stepIdx === TOUR_STEPS.length - 1;
  const isFirst = stepIdx === 0;

  // If the anchor is missing (e.g. that card hasn't mounted yet), drop the
  // spotlight but still show the tooltip centred so the tour can advance.
  const pos = rect
    ? tooltipPosition(rect, step.placement)
    : { top: window.innerHeight / 2 - 120, left: window.innerWidth / 2 - TOOLTIP_W / 2 };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="home-tour-title"
      className="fixed inset-0 z-[100]"
    >
      {/* Scrim — full dim when no anchor is found, spotlight cutout otherwise. */}
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-lg transition-all duration-200"
          style={{
            top:        rect.top - 6,
            left:       rect.left - 6,
            width:      rect.width + 12,
            height:     rect.height + 12,
            boxShadow:  '0 0 0 9999px rgba(0,0,0,0.55)',
          }}
        />
      ) : (
        <div className="pointer-events-none fixed inset-0 bg-black/55" />
      )}

      {/* Tooltip card. */}
      <div
        role="document"
        className={cn(
          'fixed rounded-lg border bg-card p-4 shadow-xl',
          'animate-in fade-in-0 zoom-in-95 duration-150',
        )}
        style={{ top: pos.top, left: pos.left, width: TOOLTIP_W }}
      >
        <header className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Step {stepIdx + 1} of {TOUR_STEPS.length}
            </p>
            <h3 id="home-tour-title" className="text-base font-semibold leading-tight">
              {step.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Skip tour"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <p className="mt-2 text-sm text-muted-foreground leading-snug">{step.body}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          {!isFirst ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStepIdx((s) => Math.max(0, s - 1))}
            >
              Back
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={onSkip}>
              Skip
            </Button>
          )}
          <Button
            size="sm"
            onClick={() =>
              isLast ? onFinish() : setStepIdx((s) => Math.min(TOUR_STEPS.length - 1, s + 1))
            }
          >
            {isLast ? 'Finish' : 'Next'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
