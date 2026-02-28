import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, History, RotateCcw, Eye, Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

interface Version {
  id: string;
  version_number: number;
  major: number;
  minor: number;
  status: 'draft' | 'active' | 'archived' | 'deleted';
  change_reason?: string;
  created_at: string;
  created_by?: string;
  metadata?: any;
}

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface VersionHistoryPanelProps {
  quoteId: string;
  onRestore?: (versionId: string) => Promise<void>;
  onPreview?: (versionId: string) => void;
}

export function VersionHistoryPanel({ quoteId, onRestore, onPreview }: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [versionToRestore, setVersionToRestore] = useState<string | null>(null);
  const { scopedDb, supabase } = useCRM();

  const handleRestoreConfirm = async () => {
    if (versionToRestore && onRestore) {
      await onRestore(versionToRestore);
      setVersionToRestore(null);
    }
  };

  const loadVersions = async () => {
    try {
      setLoading(true);
      const { data, error } = await scopedDb
        .from('quotation_versions')
        .select('*')
        .eq('quote_id', quoteId)
        .order('version_number', { ascending: false });

      if (error) throw error;
      setVersions(data || []);
    } catch (error) {
      console.error('Failed to load versions:', error);
      toast.error('Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (quoteId) {
      loadVersions();
    }
  }, [quoteId]);

  const handleDelete = async (versionId: string) => {
    try {
      // Optimistic update
      setVersions(prev => prev.filter(v => v.id !== versionId));
      
      const { error } = await scopedDb.rpc('soft_delete_quotation_version', {
        version_id: versionId,
        user_id: (await supabase.auth.getUser()).data.user?.id
      });

      if (error) throw error;
      toast.success('Version deleted successfully');
    } catch (error) {
      console.error('Failed to delete version:', error);
      toast.error('Failed to delete version');
      loadVersions(); // Revert
    }
  };

  if (loading) {
    return <div className="p-4 text-center text-muted-foreground">Loading history...</div>;
  }

  if (versions.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
        <History className="h-8 w-8 opacity-50" />
        <p>No version history available</p>
      </div>
    );
  }

  return (
    <div className="border rounded-md">
      <div className="p-4 border-b bg-muted/40 flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <History className="h-4 w-4" />
          Version History
        </h3>
        <Badge variant="secondary">{versions.length} versions</Badge>
      </div>
      
      <ScrollArea className="h-[300px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Version</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {versions.map((version) => (
              <TableRow key={version.id}>
                <TableCell className="font-medium">
                  v{version.major}.{version.minor}
                </TableCell>
                <TableCell>
                  <Badge 
                    variant={version.status === 'active' ? 'default' : 'outline'}
                    className="capitalize"
                  >
                    {version.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(version.created_at), 'MMM d, yyyy HH:mm')}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm" title={version.change_reason}>
                  {version.change_reason || '-'}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onPreview && (
                        <DropdownMenuItem onClick={() => onPreview(version.id)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Preview
                        </DropdownMenuItem>
                      )}
                      {onRestore && version.status !== 'deleted' && (
                        <DropdownMenuItem onClick={() => setVersionToRestore(version.id)}>
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Restore
                        </DropdownMenuItem>
                      )}
                      {version.status !== 'deleted' && (
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(version.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      <AlertDialog open={!!versionToRestore} onOpenChange={(open) => !open && setVersionToRestore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Version</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore this version? This will overwrite the current quote data with the snapshot from this version.
              A new version will be created to track this restoration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreConfirm}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
