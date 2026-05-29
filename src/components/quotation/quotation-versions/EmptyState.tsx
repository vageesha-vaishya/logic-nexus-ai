import { Button } from '@/components/ui/button';
import { FileText, Plus } from 'lucide-react';

interface EmptyStateProps {
  onCreateMinor: () => void;
  loading: boolean;
}

export function EmptyState({ onCreateMinor, loading }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-muted/50 p-6 mb-4">
        <FileText className="w-12 h-12 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-lg mb-2">No Versions Yet</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        Get started by creating your first quotation version. You can add multiple
        options to each version and manage them independently.
      </p>
      <Button onClick={onCreateMinor} disabled={loading} className="gap-2">
        <Plus className="w-4 h-4" />
        Create First Version
      </Button>
    </div>
  );
}
