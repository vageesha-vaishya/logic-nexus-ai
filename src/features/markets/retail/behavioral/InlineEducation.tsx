// src/features/markets/retail/behavioral/InlineEducation.tsx
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EDUCATION_CONTENT } from './educationContent';
import type { EducationId } from './types';
import type { ExperienceLevel } from '../types';

interface InlineEducationProps {
  educationId: EducationId | null;
  experienceLevel: ExperienceLevel;
  onDismiss: (id: EducationId) => void;
  className?: string;
}

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
    experienceLevel === 'self_directed' && content.self_directed
      ? content.self_directed
      : experienceLevel === 'casual'
      ? content.casual
      : content.beginner;

  return (
    <div
      className={`rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-3 ${className ?? ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 flex-1">
          <p className="text-xs font-semibold text-blue-800 dark:text-blue-200">
            {content.title}
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">{text}</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-5 w-5 p-0 text-blue-600 dark:text-blue-400 shrink-0"
          onClick={() => onDismiss(educationId)}
          aria-label="Dismiss"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
