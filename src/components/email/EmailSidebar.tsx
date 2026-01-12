import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Inbox, Send, FileText, Star, Trash2, Archive, 
  AlertCircle, Plus, RefreshCw, Folder, MoreHorizontal
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Label } from "@/components/ui/label";

interface EmailSidebarProps {
  selectedFolder: string;
  onFolderSelect: (folder: string) => void;
  unreadCounts: Record<string, number>;
  onCompose: () => void;
  onSync: () => void;
  loading: boolean;
  customFolders?: string[];
  onCreateFolder?: (name: string) => void;
  onDeleteFolder?: (name: string) => void;
  className?: string;
}

export function EmailSidebar({
  selectedFolder,
  onFolderSelect,
  unreadCounts,
  onCompose,
  onSync,
  loading,
  customFolders = [],
  onCreateFolder,
  onDeleteFolder,
  className
}: EmailSidebarProps) {
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const handleCreateFolder = () => {
    if (newFolderName.trim() && onCreateFolder) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName("");
      setIsCreateFolderOpen(false);
    }
  };

  const NavItem = ({ id, icon: Icon, label, count, isCustom = false }: any) => (
    <div className="group flex items-center gap-1">
      <Button
        variant={selectedFolder === id ? "secondary" : "ghost"}
        className={cn("flex-1 justify-start gap-2", isCustom && "pl-4")}
        onClick={() => onFolderSelect(id)}
      >
        <Icon className="h-4 w-4" />
        <span className="flex-1 text-left truncate">{label}</span>
        {count > 0 && (
          <span className="text-xs text-muted-foreground">{count}</span>
        )}
      </Button>
      {isCustom && onDeleteFolder && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Delete folder "${label}"?`)) {
              onDeleteFolder(id);
            }
          }}
        >
          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
        </Button>
      )}
    </div>
  );

  return (
    <div className={cn("h-full flex flex-col p-2", className)}>
      <div className="flex items-center justify-between mb-4 px-2">
        <h2 className="font-semibold text-sm">Mailbox</h2>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onSync} disabled={loading}>
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
        </Button>
      </div>
      
      <Button className="w-full mb-4" onClick={onCompose}>
        <Plus className="mr-2 h-4 w-4" /> New Message
      </Button>
      
      <nav className="space-y-1 overflow-y-auto flex-1">
        <NavItem id="inbox" icon={Inbox} label="Inbox" count={unreadCounts['inbox']} />
        <NavItem id="sent" icon={Send} label="Sent Items" />
        <NavItem id="all_mail" icon={Inbox} label="All Mail" />
        <NavItem id="drafts" icon={FileText} label="Drafts" />
        <NavItem id="flagged" icon={Star} label="Flagged" />
        <NavItem id="trash" icon={Trash2} label="Trash" />
        
        <Separator className="my-4" />
        
        <div className="flex items-center justify-between px-2 mb-2">
           <div className="text-xs font-semibold text-muted-foreground">FOLDERS</div>
           <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
             <DialogTrigger asChild>
               <Button variant="ghost" size="icon" className="h-4 w-4">
                 <Plus className="h-3 w-3" />
               </Button>
             </DialogTrigger>
             <DialogContent>
               <DialogHeader>
                 <DialogTitle>Create New Folder</DialogTitle>
               </DialogHeader>
               <div className="py-4">
                 <Label>Folder Name</Label>
                 <Input 
                   value={newFolderName}
                   onChange={(e) => setNewFolderName(e.target.value)}
                   placeholder="e.g. Projects"
                   className="mt-2"
                 />
               </div>
               <DialogFooter>
                 <Button variant="outline" onClick={() => setIsCreateFolderOpen(false)}>Cancel</Button>
                 <Button onClick={handleCreateFolder}>Create</Button>
               </DialogFooter>
             </DialogContent>
           </Dialog>
        </div>
        
        <nav className="space-y-1">
          <NavItem id="archive" icon={Archive} label="Archive" />
          <NavItem id="spam" icon={AlertCircle} label="Spam" />
          {customFolders.map(folder => (
            <NavItem 
              key={folder} 
              id={folder} 
              icon={Folder} 
              label={folder} 
              isCustom={true} 
            />
          ))}
        </nav>
      </nav>
    </div>
  );
}
