import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

const AUTO_SAVE_DEBOUNCE_MS = 30_000; // 30 seconds

interface AutoSavePayload {
  quoteId?: string | null;
  versionId?: string | null;
  optionId?: string | null;
  tenantId?: string | null;
  quoteData: any;
  legs: any[];
  charges: any[];
}

interface UseDraftAutoSaveOptions {
  enabled?: boolean;
}

export interface DraftAutoSaveResult {
  lastSaved: Date | null;
  isSavingDraft: boolean;
}

/**
 * Auto-saves quote draft state via save_quote_atomic RPC after 30s of inactivity.
 * Compares current state against last-saved snapshot to avoid redundant writes.
 */
export function useDraftAutoSave(
  scopedDb: any,
  getPayload: () => AutoSavePayload,
  options: UseDraftAutoSaveOptions = {}
): DraftAutoSaveResult {
  const { enabled = true } = options;
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const { toast } = useToast();

  const lastSnapshotRef = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isUUID = (v: any) =>
    typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

  const saveDraft = useCallback(async () => {
    const payload = getPayload();

    // Must have at minimum a versionId and tenantId to save
    if (!isUUID(payload.versionId) || !isUUID(payload.tenantId)) return;

    // Check dirty state
    const snapshot = JSON.stringify({
      quoteData: payload.quoteData,
      legs: payload.legs,
      charges: payload.charges,
    });

    if (snapshot === lastSnapshotRef.current) return; // No changes

    setIsSavingDraft(true);

    try {
      // Build a minimal RPC payload matching save_quote_atomic format
      const rpcPayload: any = {
        quote: {
          id: isUUID(payload.quoteId) ? payload.quoteId : undefined,
          title: payload.quoteData.title || null,
          description: payload.quoteData.description || null,
          service_type_id: payload.quoteData.service_type_id || null,
          incoterms: payload.quoteData.incoterms || null,
          currency_id: payload.quoteData.currencyId || null,
          carrier_id: payload.quoteData.carrier_id || null,
          origin_port_id: payload.quoteData.origin_port_id || null,
          destination_port_id: payload.quoteData.destination_port_id || null,
          account_id: payload.quoteData.account_id || null,
          contact_id: payload.quoteData.contact_id || null,
          status: 'draft',
          tenant_id: payload.tenantId,
          notes: payload.quoteData.notes || null,
        },
        items: [],
        cargo_configurations: [],
        options: payload.optionId
          ? [
              {
                id: isUUID(payload.optionId) ? payload.optionId : undefined,
                is_selected: true,
                legs: payload.legs.map((leg: any) => ({
                  id: isUUID(leg.id) ? leg.id : undefined,
                  carrier_id: isUUID(leg.carrierId) ? leg.carrierId : null,
                  transport_mode: leg.mode,
                  leg_type: leg.legType || 'transport',
                  origin_location_name: leg.origin,
                  destination_location_name: leg.destination,
                  charges: (leg.charges || []).flatMap((c: any) => {
                    const entries: any[] = [];
                    if (c.buy && typeof c.buy.rate === 'number') {
                      entries.push({
                        category_id: c.category_id,
                        side: 'buy',
                        unit_price: c.buy.rate,
                        quantity: c.buy.quantity,
                        amount: c.buy.amount,
                      });
                    }
                    if (c.sell && typeof c.sell.rate === 'number') {
                      entries.push({
                        category_id: c.category_id,
                        side: 'sell',
                        unit_price: c.sell.rate,
                        quantity: c.sell.quantity,
                        amount: c.sell.amount,
                      });
                    }
                    return entries;
                  }),
                })),
                combined_charges: (payload.charges || []).flatMap((c: any) => {
                  const entries: any[] = [];
                  if (c.buy && typeof c.buy.rate === 'number') {
                    entries.push({
                      category_id: c.category_id,
                      side: 'buy',
                      unit_price: c.buy.rate,
                      quantity: c.buy.quantity,
                      amount: c.buy.amount,
                    });
                  }
                  if (c.sell && typeof c.sell.rate === 'number') {
                    entries.push({
                      category_id: c.category_id,
                      side: 'sell',
                      unit_price: c.sell.rate,
                      quantity: c.sell.quantity,
                      amount: c.sell.amount,
                    });
                  }
                  return entries;
                }),
              },
            ]
          : [],
      };

      const { error: rpcError } = await scopedDb.rpc('save_quote_atomic', {
        p_payload: rpcPayload,
      });

      if (rpcError) {
        logger.error('[useDraftAutoSave] RPC error:', rpcError);
        return;
      }

      lastSnapshotRef.current = snapshot;
      setLastSaved(new Date());
    } catch (err) {
      logger.error('[useDraftAutoSave] Auto-save failed:', err);
    } finally {
      setIsSavingDraft(false);
    }
  }, [scopedDb, getPayload]);

  // Set up debounced timer that resets on every payload change
  useEffect(() => {
    if (!enabled) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      saveDraft();
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, saveDraft]);

  return { lastSaved, isSavingDraft };
}
