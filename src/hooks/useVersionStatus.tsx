import { useState } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { logger } from "@/lib/logger";
import { gateCheck } from '@/features/module-compliance/lib/complianceApi';

type VersionStatus = 'draft' | 'sent' | 'internal_review' | 'accepted' | 'rejected' | 'expired' | 'cancelled';

interface StatusTransition {
  from: VersionStatus;
  to: VersionStatus[];
}

const statusTransitions: StatusTransition[] = [
  { from: 'draft', to: ['sent', 'internal_review', 'cancelled'] },
  { from: 'sent', to: ['accepted', 'rejected', 'expired', 'cancelled'] },
  { from: 'internal_review', to: ['draft', 'sent', 'cancelled'] },
  { from: 'accepted', to: [] }, // Terminal state
  { from: 'rejected', to: [] }, // Terminal state
  { from: 'expired', to: [] }, // Terminal state
  { from: 'cancelled', to: [] }, // Terminal state
];

export function useVersionStatus() {
  const [isUpdating, setIsUpdating] = useState(false);
  const { scopedDb } = useCRM();

  const getAvailableTransitions = (currentStatus: VersionStatus): VersionStatus[] => {
    const transition = statusTransitions.find(t => t.from === currentStatus);
    return transition?.to || [];
  };

  const updateVersionStatus = async (versionId: string, newStatus: VersionStatus) => {
    setIsUpdating(true);
    try {
      // Phase 6 Compliance Step 5 — optimistic gate-check before the
      // sent transition. The DB-level trigger (Step 4) is the source of
      // truth; this just keeps the user from clicking through a server
      // raise. Failures fall open (allow DB attempt) — the server side
      // will still block if the verdict is failed/flagged.
      if (newStatus === 'sent') {
        const { data: versionRow } = await scopedDb
          .from('quotation_versions')
          .select('quote_id')
          .eq('id', versionId)
          .maybeSingle();
        const quoteId = (versionRow as { quote_id?: string } | null)?.quote_id;
        if (quoteId) {
          try {
            const verdict = await gateCheck('quotation.quote', quoteId);
            if (verdict.verdict === 'failed' || verdict.verdict === 'flagged') {
              toast.error('Compliance gate blocked this send', {
                description:
                  verdict.verdict === 'failed'
                    ? 'The most recent screening for this quote failed. Resolve it via the compliance officer page before sending.'
                    : 'The screening is flagged. A compliance officer must override it before this quote can be sent.',
              });
              return false;
            }
          } catch (gateErr) {
            // Gate-check itself failed (network, 5xx). Log and fall
            // through to the DB write — the trigger will still enforce.
            logger.warn('compliance gate-check failed (falling open to server enforcement)', { gateErr: String(gateErr) });
          }
        }
      }

      const { error } = await scopedDb
        .from('quotation_versions')
        .update({ status: newStatus })
        .eq('id', versionId);

      if (error) {
        // Check if it's a status transition validation error
        if (error.message.includes('Invalid status transition')) {
          toast.error('Invalid Status Transition', {
            description: error.message,
          });
        } else if (
          /compliance gate blocked quote send/i.test(error.message) ||
          (error as { code?: string }).code === 'P0001'
        ) {
          // Server-side gate raise (Phase 6 Step 4 trigger). The
          // optimistic check above missed it (race or fallback path).
          toast.error('Compliance gate blocked this send', {
            description: 'A failed or flagged screening exists for this quote. Open the compliance officer page to override or remediate.',
          });
          return false;
        } else {
          throw error;
        }
        return false;
      }

      // If status is 'accepted', also update the parent quote status
      if (newStatus === 'accepted') {
        // First get the quote_id from the version
        const { data: versionData } = await scopedDb
          .from('quotation_versions')
          .select('quote_id')
          .eq('id', versionId)
          .single();

        if (versionData?.quote_id) {
           const { error: quoteError } = await scopedDb
             .from('quotes')
             .update({ status: 'accepted' })
             .eq('id', versionData.quote_id);
           
           if (quoteError) {
             logger.error('Error updating parent quote status:', quoteError);
             toast.error('Failed to update parent quote status');
           }
        }
      }

      toast.success('Status Updated', {
        description: `Version status changed to ${newStatus}`,
      });
      return true;
    } catch (error) {
      logger.error('Error updating version status:', error);
      toast.error('Failed to update status');
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const setCurrentVersion = async (versionId: string) => {
    setIsUpdating(true);
    try {
      const { error } = await scopedDb.rpc('set_current_version', {
        p_version_id: versionId,
      });

      if (error) throw error;

      toast.success('Current Version Updated', {
        description: 'This version is now marked as current',
      });
      return true;
    } catch (error) {
      logger.error('Error setting current version:', error);
      toast.error('Failed to set current version');
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    isUpdating,
    getAvailableTransitions,
    updateVersionStatus,
    setCurrentVersion,
  };
}
