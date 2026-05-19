import * as React from "react";
import { HelpCircle } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { lookupTerm } from "./glossary";

interface BaseProps {
  className?: string;
  /** Optional override for the visually-hidden screen-reader label. */
  srLabel?: string;
}

interface FromGlossaryProps extends BaseProps {
  /** Glossary key. Reads title+body from the seeded dictionary. */
  term: string;
  title?: never;
  children?: never;
}

interface InlineProps extends BaseProps {
  term?: never;
  /** Heading shown bold at top of the popover. */
  title: string;
  /** Body copy. Plain string or React nodes (for `<strong>`, links, etc). */
  children: React.ReactNode;
}

export type WhyButtonProps = FromGlossaryProps | InlineProps;

/**
 * Inline (?)-button that explains the surrounding concept on tap. Two modes:
 *
 *   <WhyButton term="rebalancing" />                              // reads glossary
 *   <WhyButton title="Why this signal?">Three indicators…</WhyButton>  // ad-hoc copy
 *
 * Designed to be sprinkled next to fields, metric labels, and signal cards
 * without restructuring the surrounding layout.
 */
export function WhyButton(props: WhyButtonProps) {
  const { className, srLabel } = props;

  let heading: string;
  let body: React.ReactNode;

  if ("term" in props && props.term) {
    const entry = lookupTerm(props.term);
    if (!entry) {
      // Unknown term → render nothing rather than a useless tooltip.
      return null;
    }
    heading = entry.title;
    body = entry.body;
  } else {
    heading = props.title;
    body = props.children;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={srLabel ?? `Why: ${heading}`}
          className={cn(
            "inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <HelpCircle className="h-4 w-4" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 text-sm" align="start" side="top">
        <div className="mb-1 font-semibold">{heading}</div>
        <div className="leading-snug text-muted-foreground">{body}</div>
      </PopoverContent>
    </Popover>
  );
}
