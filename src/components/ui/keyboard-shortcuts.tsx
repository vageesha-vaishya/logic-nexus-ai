import * as React from "react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Command } from "lucide-react";
import { cn } from "@/lib/utils";

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const shortcuts: Shortcut[] = [
  { keys: ["⌘", "K"], description: "Open global search", category: "Navigation" },
  { keys: ["⌘", "N"], description: "Create new item", category: "Actions" },
  { keys: ["⌘", "S"], description: "Save changes", category: "Actions" },
  { keys: ["⌘", "E"], description: "Edit selected item", category: "Actions" },
  { keys: ["⌘", "D"], description: "Delete selected item", category: "Actions" },
  { keys: ["⌘", "/"], description: "Show keyboard shortcuts", category: "Help" },
  { keys: ["Esc"], description: "Close dialog or cancel", category: "Navigation" },
  { keys: ["↑", "↓"], description: "Navigate items", category: "Navigation" },
  { keys: ["Enter"], description: "Select item", category: "Navigation" },
  { keys: ["Tab"], description: "Next field", category: "Forms" },
  { keys: ["Shift", "Tab"], description: "Previous field", category: "Forms" },
];

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "/" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const categories = Array.from(new Set(shortcuts.map((s) => s.category)));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Command className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these keyboard shortcuts to navigate faster
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {categories.map((category) => (
            <div key={category}>
              <h3 className="font-semibold text-sm mb-3 text-muted-foreground">{category}</h3>
              <div className="space-y-2">
                {shortcuts
                  .filter((s) => s.category === category)
                  .map((shortcut, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-accent">
                      <span className="text-sm">{shortcut.description}</span>
                      <div className="flex gap-1">
                        {shortcut.keys.map((key, j) => (
                          <React.Fragment key={j}>
                            <kbd
                              className={cn(
                                "px-2 py-1 text-xs font-semibold bg-muted border border-border rounded",
                                "min-w-[24px] text-center"
                              )}
                            >
                              {key}
                            </kbd>
                            {j < shortcut.keys.length - 1 && (
                              <span className="text-muted-foreground mx-1">+</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook to register custom shortcuts
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: { ctrl?: boolean; shift?: boolean; alt?: boolean } = {}
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const { ctrl = false, shift = false, alt = false } = options;
      
      if (
        e.key.toLowerCase() === key.toLowerCase() &&
        (ctrl ? e.ctrlKey || e.metaKey : true) &&
        (shift ? e.shiftKey : !e.shiftKey) &&
        (alt ? e.altKey : !e.altKey)
      ) {
        e.preventDefault();
        callback();
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [key, callback, options]);
}
