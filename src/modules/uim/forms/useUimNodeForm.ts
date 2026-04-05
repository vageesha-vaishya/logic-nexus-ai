import { useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from '@/components/ui/use-toast';
import type { UimNodeConfig } from './types';
import { createUimEntity, updateUimEntity } from '@/services/uim/uimFormAdapters';
import { executeUimCommand, replayUimProjections, type UimCommandType } from '@/services/uim/uimCoreServices';

type UseUimNodeFormOptions = {
  config: UimNodeConfig;
  existingEntity?: Record<string, unknown> | null;
};

function buildCommandPayload(
  nodeKey: UimNodeConfig['key'],
  values: Record<string, unknown>,
): { commandType: UimCommandType; payload: Record<string, unknown> } | null {
  if (nodeKey === 'item-master') {
    const suggestedQty = Number(values.safety_stock || values.reorder_point || 1);
    return {
      commandType: 'RECEIVE',
      payload: {
        sku: String(values.sku || ''),
        title: String(values.item_name || ''),
        item_name: String(values.item_name || ''),
        category: String(values.category || ''),
        uom: String(values.uom || 'EA'),
        quantity: Number.isFinite(suggestedQty) && suggestedQty > 0 ? suggestedQty : 1,
        attributes: {
          dimensions: {
            length_cm: values.length_cm || 0,
            width_cm: values.width_cm || 0,
            height_cm: values.height_cm || 0,
            weight_kg: values.weight_kg || 0,
          },
        },
      },
    };
  }

  if (nodeKey === 'stock-ledger') {
    const transactionType = String(values.transaction_type || '').toUpperCase();
    if (!['RECEIVE', 'RESERVE', 'CONSUME', 'MOVE'].includes(transactionType)) return null;
    const commandType = transactionType as UimCommandType;
    return {
      commandType,
      payload: {
        inventory_item_id: String(values.item_id || ''),
        catalog_item_id: String(values.item_id || ''),
        quantity: Number(values.quantity_delta || 0),
        to_location_id: String(values.reference || ''),
        metadata: {
          transaction_at: values.transaction_at || null,
          resulting_quantity: values.resulting_quantity || null,
          reference: values.reference || null,
        },
      },
    };
  }

  if (nodeKey === 'reservations') {
    return {
      commandType: 'RESERVE',
      payload: {
        inventory_item_id: String(values.item_id || ''),
        catalog_item_id: String(values.item_id || ''),
        quantity: Number(values.requested_quantity || 0),
        expected_use_date: values.expected_use_date || null,
        referenced_module: 'uim.reservations',
        referenced_record_id: values.consumer_reference || null,
        metadata: {
          available_quantity: values.available_quantity || 0,
          reservation_status: values.reservation_status || 'active',
        },
      },
    };
  }

  return null;
}

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
      const normalizedValues = values as Record<string, unknown>;
      const entityId = typeof existingEntity?.id === 'string' ? existingEntity.id : '';
      if (entityId) {
        const updated = await updateUimEntity(config.key, entityId, normalizedValues);
        setLastSavedId(String(updated.id || entityId));
      } else {
        const commandIntent = buildCommandPayload(config.key, normalizedValues);
        if (commandIntent) {
          await executeUimCommand({
            command_type: commandIntent.commandType,
            command_payload: commandIntent.payload,
            idempotency_key: `uim-${config.key}-${Date.now()}`,
          });
          await replayUimProjections();
        }
        const created = await createUimEntity(config.key, normalizedValues);
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
