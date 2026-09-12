import { useEffect, useRef, useState } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';

interface UseAutoSaveFormOptions<T extends FieldValues> {
  form: UseFormReturn<T>;
  onAutoSave: (data: T) => Promise<void>;
  enabled: boolean;
  delayMs?: number;
}

/**
 * Shared debounced autosave for react-hook-form forms: waits `delayMs` after the
 * last change to a dirty form, validates, then calls `onAutoSave` silently
 * (no toast/navigation side effects -- callers should pass a save function
 * distinct from their manual-submit handler, e.g. updateX(data, { silent: true }).
 */
export function useAutoSaveForm<T extends FieldValues>({
  form,
  onAutoSave,
  enabled,
  delayMs = 30000,
}: UseAutoSaveFormOptions<T>) {
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const isSavingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const subscription = form.watch(() => {
      if (!form.formState.isDirty) return;
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(async () => {
        if (isSavingRef.current) return;
        const valid = await form.trigger();
        if (!valid) return;
        try {
          isSavingRef.current = true;
          setAutoSaveError(null);
          const payload = form.getValues();
          await onAutoSave(payload);
          form.reset(payload);
        } catch (error) {
          setAutoSaveError(error instanceof Error ? error.message : 'Auto-save failed');
        } finally {
          isSavingRef.current = false;
        }
      }, delayMs);
    });
    return () => {
      subscription.unsubscribe();
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, delayMs, form, onAutoSave]);

  return { autoSaveError };
}
