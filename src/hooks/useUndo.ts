import { useCallback } from 'react';
import { toast } from 'sonner';
import { useCRM } from './useCRM';

interface UndoOptions<T> {
  table: string;
  data: T;
  label: string;
  onUndo?: (data: T) => void;
  onSuccess?: () => void;
}

/**
 * A hook to handle "Undo" logic for delete operations.
 */
export function useUndo() {
  const { scopedDb } = useCRM();

  const performDeleteWithUndo = useCallback(async <T extends { id: string }>(options: UndoOptions<T>) => {
    const { table, data, label, onUndo, onSuccess } = options;

    try {
      // 1. Perform the actual delete
      const { error } = await scopedDb.from(table).delete().eq('id', data.id);
      
      if (error) throw error;

      // 2. Notify success with an Undo action
      toast.success(`${label} deleted`, {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              // 3. Re-insert the data on undo
              // We need to remove the id or keep it depending on the table constraints
              // For most tables, we want to keep the same ID to preserve relations if possible
              const { error: reinsertError } = await scopedDb.from(table).insert(data);
              
              if (reinsertError) throw reinsertError;
              
              toast.success(`${label} restored`);
              if (onUndo) onUndo(data);
              if (onSuccess) onSuccess();
            } catch (err: any) {
              console.error(`Failed to undo delete for ${table}:`, err);
              toast.error(`Failed to restore ${label}`);
            }
          }
        },
        duration: 5000,
      });

      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error(`Failed to delete ${table}:`, err);
      toast.error(`Failed to delete ${label}`);
    }
  }, [scopedDb]);

  return { performDeleteWithUndo };
}
