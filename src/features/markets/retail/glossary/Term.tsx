import * as React from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { lookupTerm } from "./glossary";

export interface TermProps {
  /**
   * Glossary key (case-insensitive). If omitted, falls back to the visible
   * children string. Sprinkling `<Term>P/E</Term>` is safe — if the term
   * isn't in the dictionary, the children render as plain text with no
   * popover affordance, so we won't break copy by mis-spelling a key.
   */
  word?: string;
  className?: string;
  children: React.ReactNode;
}

export function Term({ word, className, children }: TermProps) {
  const lookupKey =
    word ?? (typeof children === "string" ? children : "");
  const entry = lookupKey ? lookupTerm(lookupKey) : undefined;

  if (!entry) {
    return <>{children}</>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Define: ${entry.title}`}
          className={cn(
            "inline cursor-help rounded-sm border-b border-dotted border-current text-current underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-3 text-sm"
        align="start"
        side="top"
      >
        <div className="mb-1 font-semibold">{entry.title}</div>
        <div className="leading-snug text-muted-foreground">
          {entry.body}
        </div>
      </PopoverContent>
    </Popover>
  );
}
