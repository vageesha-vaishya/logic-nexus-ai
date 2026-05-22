/**
 * Shared step layout — title, optional helper text, primary CTA, optional
 * secondary action (Back / Skip). Each concrete step component slots its
 * form fields into `children` and owns the disabled/loading state of the
 * primary CTA via `canAdvance` + `saving`.
 */
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';

export interface StepShellProps {
  title:        string;
  description?: string;
  children:     ReactNode;
  primaryLabel?: string;
  onPrimary:    () => void | Promise<void>;
  canAdvance?:  boolean;
  saving?:      boolean;

  onBack?:        () => void;
  secondaryLabel?: string;
  onSecondary?:   () => void | Promise<void>;
}

export function StepShell({
  title,
  description,
  children,
  primaryLabel = 'Continue',
  onPrimary,
  canAdvance = true,
  saving = false,
  onBack,
  secondaryLabel,
  onSecondary,
}: StepShellProps) {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold leading-tight">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground leading-snug">{description}</p>
        )}
      </header>

      <div className="space-y-4">{children}</div>

      <div className="flex flex-col gap-3 pt-2">
        <Button
          onClick={() => void onPrimary()}
          disabled={!canAdvance || saving}
          className="w-full"
        >
          {saving ? 'Saving…' : primaryLabel}
        </Button>
        <div className="flex items-center justify-between">
          {onBack ? (
            <Button variant="ghost" size="sm" onClick={onBack} disabled={saving}>
              Back
            </Button>
          ) : <span />}
          {secondaryLabel && onSecondary && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void onSecondary()}
              disabled={saving}
            >
              {secondaryLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
