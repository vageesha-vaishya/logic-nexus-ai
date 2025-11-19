import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Plus, GitBranch, Trash2 } from 'lucide-react';

interface VersionActionsProps {
  loading: boolean;
  onCreateMinor: () => void;
  onCreateMajor: () => void;
  onDeleteMinor: () => void;
  onDeleteMajor: () => void;
}

export function VersionActions({
  loading,
  onCreateMinor,
  onCreateMajor,
  onDeleteMinor,
  onDeleteMajor,
}: VersionActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/30 rounded-lg border">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Create:</span>
        <Button
          size="sm"
          onClick={onCreateMinor}
          disabled={loading}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Minor Version
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={onCreateMajor}
          disabled={loading}
          className="gap-2"
        >
          <GitBranch className="w-4 h-4" />
          Major Version
        </Button>
      </div>

      <Separator orientation="vertical" className="h-8" />

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Bulk Delete:</span>
        <Button
          size="sm"
          variant="destructive"
          onClick={onDeleteMinor}
          disabled={loading}
          className="gap-2"
        >
          <Trash2 className="w-4 h-4" />
          All Minor
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={onDeleteMajor}
          disabled={loading}
          className="gap-2"
        >
          <Trash2 className="w-4 h-4" />
          All Major
        </Button>
      </div>
    </div>
  );
}
