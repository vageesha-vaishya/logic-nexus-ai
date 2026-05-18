import { Lightbulb, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

import type { ExperienceLevel } from '../types';
import { EDUCATION_CONTENT } from './educationContent';
import type { EducationId } from './types';

interface InlineEducationProps {
  educationId: EducationId | null;
  experienceLevel: ExperienceLevel;
  onDismiss: (id: EducationId) => void;
  className?: string;
}

/**
 * Contextual education card. Pure presentation — caller decides when to mount
 * (e.g. only the first time the user sees a High Conviction signal). Dismiss
 * delegates to the parent so persistence (localStorage / behavioral_events)
 * stays out of the rendering path.
 */
export function InlineEducation({
  educationId,
  experienceLevel,
  onDismiss,
  className,
}: InlineEducationProps) {
  if (!educationId) return null;

  const content = EDUCATION_CONTENT[educationId];
  if (!content) return null;

  const text =
    experienceLevel === 'self_directed'
      ? content.self_directed
      : experienceLevel === 'casual'
      ? content.casual
      : content.beginner;

  return (
    <div
      role="note"
      className={
        'rounded-lg border border-sky-200 bg-sky-50 p-3 dark:border-sky-800 dark:bg-sky-950/40 ' +
        (className ?? '')
      }
    >
      <div className="flex items-start gap-2">
        <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-semibold text-sky-800 dark:text-sky-200">
            {content.title}
          </p>
          <p className="text-xs leading-relaxed text-sky-700 dark:text-sky-300">
            {text}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-5 w-5 shrink-0 p-0 text-sky-600 dark:text-sky-400"
          onClick={() => onDismiss(educationId)}
          aria-label="Dismiss"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
