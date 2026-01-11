import { useState } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

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
        } else {
          throw error;
        }
        return false;
      }

      toast.success('Status Updated', {
        description: `Version status changed to ${newStatus}`,
      });
      return true;
    } catch (error) {
      console.error('Error updating version status:', error);
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
      console.error('Error setting current version:', error);
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
