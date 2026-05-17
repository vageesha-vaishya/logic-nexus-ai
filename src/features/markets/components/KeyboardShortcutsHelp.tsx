/**
 * Keyboard Shortcuts Help modal.
 *
 * Triggered by pressing ? or clicking the keyboard icon in the Markets header.
 * Two-column layout: key badge + description, grouped by section.
 */

import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/design-system";

// ── Shortcut data ─────────────────────────────────────────────────────────────

interface Shortcut {
  section: string;
  key:     string;
  desc:    string;
}

const SHORTCUTS: Shortcut[] = [
  // Navigation
  { section: "Navigation", key: "W", desc: "Watchlists" },
  { section: "Navigation", key: "P", desc: "Portfolios" },
  { section: "Navigation", key: "F", desc: "F&O Chain" },
  { section: "Navigation", key: "A", desc: "Price Alerts" },
  { section: "Navigation", key: "J", desc: "Trade Journal" },
  // Tools
  { section: "Tools", key: "M", desc: "Market Scanner / Signals" },
  { section: "Tools", key: "?", desc: "Show / hide this help" },
];

// ── Section grouping ──────────────────────────────────────────────────────────

function groupedSections(shortcuts: Shortcut[]): Map<string, Shortcut[]> {
  const map = new Map<string, Shortcut[]>();
  for (const s of shortcuts) {
    const arr = map.get(s.section) ?? [];
    arr.push(s);
    map.set(s.section, arr);
  }
  return map;
}

// ── Key badge ─────────────────────────────────────────────────────────────────

function KeyBadge({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-[1.75rem] items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground shadow-sm">
      {children}
    </kbd>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

interface KeyboardShortcutsHelpProps {
  open:    boolean;
  onClose: () => void;
}

export function KeyboardShortcutsHelp({ open, onClose }: KeyboardShortcutsHelpProps) {
  const sections = groupedSections(SHORTCUTS);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-primary" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-5">
          {Array.from(sections.entries()).map(([section, keys]) => (
            <div key={section}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {section}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {keys.map(({ key, desc }) => (
                  <div key={key} className="flex items-center gap-2">
                    <KeyBadge>{key}</KeyBadge>
                    <span className="text-xs text-muted-foreground">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <p className="text-[10px] text-muted-foreground/60">
            Shortcuts are disabled when focus is inside a text input.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
