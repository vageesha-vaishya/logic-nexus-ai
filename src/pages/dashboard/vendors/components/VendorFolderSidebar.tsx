import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Edit, Folder, Plus, Trash } from 'lucide-react';

interface VendorFolderSidebarProps {
  folders: any[];
  currentFolder: string;
  onSelectFolder: (folderName: string) => void;
  onCreateFolder: () => void;
  onEditFolder: (folder: VendorFolder) => void;
  onDeleteFolder: (folderId: string) => void;
  storageUsedMB: number;
  storagePercentage: number;
  canCreateFolder?: boolean;
  canEditFolder?: (folder: VendorFolder) => boolean;
}

export function VendorFolderSidebar({
  folders,
  currentFolder,
  onSelectFolder,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
  storageUsedMB,
  storagePercentage,
  canCreateFolder = true,
  canEditFolder = () => true
}: VendorFolderSidebarProps) {
  return (
    <div className="w-full md:w-64 flex-shrink-0 space-y-4">
      <Card>
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Folders</CardTitle>
            {canCreateFolder && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCreateFolder}>
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-2">
          <div className="space-y-1">
            <Button
              variant={currentFolder === 'All' ? 'secondary' : 'ghost'}
              className="w-full justify-start text-sm"
              onClick={() => onSelectFolder('All')}
            >
              <Folder className="mr-2 h-4 w-4" /> All Documents
            </Button>
            {folders.map(folder => (
              <div key={folder.id} className="group flex items-center relative">
                <Button
                  variant={currentFolder === folder.name ? 'secondary' : 'ghost'}
                  className="w-full justify-start text-sm truncate pr-16"
                  onClick={() => onSelectFolder(folder.name)}
                >
                  <Folder className="mr-2 h-4 w-4" /> {folder.name}
                </Button>
                {folder.name !== 'General' && canEditFolder(folder) && (
                  <div className="absolute right-1 opacity-0 group-hover:opacity-100 flex bg-background/80 rounded-sm">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onEditFolder(folder); }}>
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }}>
                      <Trash className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-medium">Storage Usage</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="flex justify-between items-end mb-1">
            <div className="text-2xl font-bold">{storageUsedMB.toFixed(2)} MB</div>
            <div className="text-xs text-muted-foreground">of 1 GB</div>
          </div>
          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div 
              className={cn("h-full bg-primary transition-all", storagePercentage > 90 ? "bg-destructive" : "")} 
              style={{ width: `${storagePercentage}%` }} 
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
