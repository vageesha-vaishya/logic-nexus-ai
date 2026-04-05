import { useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from '@/components/ui/use-toast';
import type { UimNodeConfig } from './types';
import { createUimEntity, updateUimEntity } from '@/services/uim/uimFormAdapters';

type UseUimNodeFormOptions = {
  config: UimNodeConfig;
  existingEntity?: Record<string, unknown> | null;
};

export function useUimNodeForm({ config, existingEntity }: UseUimNodeFormOptions) {
  const defaults = useMemo(
    () => ({
      ...config.defaultValues,
      ...(existingEntity || {}),
    }),
    [config.defaultValues, existingEntity],
  );

  const form = useForm({
    resolver: zodResolver(config.schema),
    defaultValues: defaults,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const previousSnapshotRef = useRef<Record<string, unknown>>(defaults);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);

  useEffect(() => {
    form.reset(defaults);
  }, [defaults, form]);

  const submit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    previousSnapshotRef.current = form.getValues() as Record<string, unknown>;
    setIsSaving(true);

    try {
      const entityId = typeof existingEntity?.id === 'string' ? existingEntity.id : '';
      if (entityId) {
        const updated = await updateUimEntity(config.key, entityId, values as Record<string, unknown>);
        setLastSavedId(String(updated.id || entityId));
      } else {
        const created = await createUimEntity(config.key, values as Record<string, unknown>);
        setLastSavedId(String(created.id || ''));
      }

      toast({
        title: entityId ? 'Updated successfully' : 'Created successfully',
        description: `UIM ${config.key} form has been saved.`,
      });
    } catch (error) {
      form.reset(previousSnapshotRef.current);
      setSubmitError('We could not save your changes. Please review fields and try again.');
      toast({
        title: 'Save failed',
        description: 'Your previous values were restored. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  });

  return {
    form,
    isSaving,
    submitError,
    submit,
    reset: () => form.reset(defaults),
    isEditMode: Boolean(existingEntity?.id),
    lastSavedId,
    clearSubmitError: () => setSubmitError(null),
  };
}
