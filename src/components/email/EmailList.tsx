import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, Paperclip, Star, Filter, Calendar as CalendarIcon, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Email } from "@/types/email";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";

export interface AdvancedSearchFilters {
  from?: string;
  to?: string;
  subject?: string;
  hasAttachment?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}

interface EmailListProps {
  emails: (Email & { threadCount?: number })[];
  selectedEmail: Email | null;
  onSelect: (email: Email) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  loading: boolean;
  filterUnread: boolean;
  onToggleUnread: () => void;
  filterFlagged: boolean;
  onToggleFlagged: () => void;
  filterAttachments: boolean;
  onToggleAttachments: () => void;
  className?: string;
  advancedFilters?: AdvancedSearchFilters;
  onAdvancedFiltersChange?: (filters: AdvancedSearchFilters) => void;
  conversationView?: boolean;
  onToggleConversationView?: (enabled: boolean) => void;
}

export function EmailList({
  emails,
  selectedEmail,
  onSelect,
  searchQuery,
  onSearchChange,
  loading,
  filterUnread,
  onToggleUnread,
  filterFlagged,
  onToggleFlagged,
  filterAttachments,
  onToggleAttachments,
  className,
  advancedFilters = {},
  onAdvancedFiltersChange,
  conversationView = false,
  onToggleConversationView
}: EmailListProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const updateFilter = (key: keyof AdvancedSearchFilters, value: any) => {
    if (onAdvancedFiltersChange) {
      onAdvancedFiltersChange({ ...advancedFilters, [key]: value });
    }
  };

  return (
    <div className={cn("h-full flex flex-col", className)}>
      <div className="p-4 border-b space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search emails..." 
              className="pl-8" 
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <Popover open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
            <PopoverTrigger asChild>
              <Button variant={Object.keys(advancedFilters).length > 0 ? "secondary" : "outline"} size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4" align="end">
               <div className="space-y-4">
                 <h4 className="font-medium leading-none">Advanced Search</h4>
                 <div className="space-y-2">
                   <Label>From</Label>
                   <Input 
                     value={advancedFilters.from || ""} 
                     onChange={(e) => updateFilter('from', e.target.value)}
                     placeholder="Sender email or name"
                   />
                 </div>
                 <div className="space-y-2">
                   <Label>Subject</Label>
                   <Input 
                     value={advancedFilters.subject || ""} 
                     onChange={(e) => updateFilter('subject', e.target.value)}
                     placeholder="Subject line"
                   />
                 </div>
                 <div className="flex items-center space-x-2">
                   <Checkbox 
                     id="has-attachment" 
                     checked={advancedFilters.hasAttachment}
                     onCheckedChange={(c) => updateFilter('hasAttachment', !!c)}
                   />
                   <Label htmlFor="has-attachment">Has Attachment</Label>
                 </div>
                 <div className="flex justify-end gap-2 pt-2">
                   <Button variant="ghost" size="sm" onClick={() => onAdvancedFiltersChange?.({})}>Clear</Button>
                   <Button size="sm" onClick={() => setIsAdvancedOpen(false)}>Done</Button>
                 </div>
               </div>
            </PopoverContent>
          </Popover>
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <Button 
            variant={filterUnread ? "secondary" : "outline"} 
            size="sm" 
            className="h-7 text-xs whitespace-nowrap"
            onClick={onToggleUnread}
          >
            Unread
          </Button>
          <Button 
            variant={filterFlagged ? "secondary" : "outline"} 
            size="sm" 
            className="h-7 text-xs whitespace-nowrap"
            onClick={onToggleFlagged}
          >
            Flagged
          </Button>
          <Button 
            variant={filterAttachments ? "secondary" : "outline"} 
            size="sm" 
            className="h-7 text-xs whitespace-nowrap"
            onClick={onToggleAttachments}
          >
            Has Files
          </Button>
          
          {onToggleConversationView && (
            <div className="flex items-center space-x-2 border-l pl-2 ml-2">
              <Switch 
                id="conversation-view" 
                checked={conversationView}
                onCheckedChange={onToggleConversationView}
                className="h-5 w-9"
              />
              <Label htmlFor="conversation-view" className="text-[10px] whitespace-nowrap cursor-pointer">Threads</Label>
            </div>
          )}
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
            Loading...
          </div>
        ) : emails.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No emails found
          </div>
        ) : (
          <div className="flex flex-col">
            {emails.map(email => (
              <button
                key={email.id}
                className={cn(
                  "flex flex-col gap-1 p-4 border-b text-left hover:bg-muted/50 transition-colors",
                  selectedEmail?.id === email.id && "bg-muted"
                )}
                onClick={() => onSelect(email)}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={cn("font-medium text-sm truncate max-w-[70%]", !email.is_read && "font-bold")}>
                    {email.from_name || email.from_email}
                    {email.threadCount && email.threadCount > 1 && (
                      <span className="ml-2 text-muted-foreground font-normal">({email.threadCount})</span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                    {format(new Date(email.received_at), "MMM d")}
                  </span>
                </div>
                <div className={cn("text-sm truncate", !email.is_read && "font-bold")}>
                  {email.subject || "(No Subject)"}
                </div>
                <div className="text-xs text-muted-foreground line-clamp-2">
                  {email.snippet}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {email.has_attachments && <Paperclip className="h-3 w-3 text-muted-foreground" />}
                  {email.is_starred && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                  {email.folder && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                      {email.folder}
                    </Badge>
                  )}
                  {email.thread_id && (
                     <Badge variant="secondary" className="text-[10px] h-4 px-1">
                       Thread
                     </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
