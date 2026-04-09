import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function AmroCrudMessageBanner({
  message,
  tone = 'error',
}: {
  message: string | null;
  tone?: 'error' | 'warning' | 'info';
}): JSX.Element | null {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn(
        'mb-2 flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
        tone === 'error' ? 'border-red-300 bg-red-50 text-red-700' : '',
        tone === 'warning' ? 'border-amber-300 bg-amber-50 text-amber-800' : '',
        tone === 'info' ? 'border-sky-300 bg-sky-50 text-sky-800' : '',
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function AmroCrudDialogFooter({
  saving,
  onCancel,
  onConfirm,
  cancelLabel = 'Cancel',
  confirmLabel = 'Save',
  savingLabel = 'Saving...',
}: {
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
  savingLabel?: string;
}): JSX.Element {
  return (
    <div className="flex items-center justify-end gap-2 border-t pt-3">
      <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button type="button" disabled={saving} onClick={onConfirm}>
        {saving ? savingLabel : confirmLabel}
      </Button>
    </div>
  );
}

export function AmroCrudSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="space-y-2 rounded-md border p-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      {children}
    </section>
  );
}
