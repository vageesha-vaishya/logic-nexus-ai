import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { 
  ResizableHandle, 
  ResizablePanel, 
  ResizablePanelGroup 
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Mail, Plus, ChevronLeft } from "lucide-react";
import { useCRM } from "@/hooks/useCRM";
import { useToast } from "@/hooks/use-toast";
import { EmailDetailView } from "./EmailDetailView";
import { EmailComposeDialog } from "./EmailComposeDialog";
import { EmailSidebar } from "./EmailSidebar";
import { EmailList, AdvancedSearchFilters, EmailSortDirection, EmailSortField } from "./EmailList";
import { cn } from "@/lib/utils";
import { Email } from "@/types/email";

interface EmailClientProps {
  entityType?: string;
  entityId?: string;
  emailAddress?: string | null;
  className?: string;
}

export function EmailClient({ entityType, entityId, emailAddress, className }: EmailClientProps) {
  const { supabase } = useCRM();
  const { toast } = useToast();
  
  // State
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>(emailAddress ? "all_mail" : "inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  // Filter states
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterFlagged, setFilterFlagged] = useState(false);
  const [filterAttachments, setFilterAttachments] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedSearchFilters>({});

  const [sortField, setSortField] = useState<EmailSortField>("received_at");
  const [sortDirection, setSortDirection] = useState<EmailSortDirection>("desc");

  // Custom Folders State
  const [customFolders, setCustomFolders] = useState<string[]>([]);

  const [conversationView, setConversationView] = useState(true);
  const [useServerGrouping, setUseServerGrouping] = useState(false);

  const [replyTo, setReplyTo] = useState<{ to: string; subject: string; body?: string } | undefined>(undefined);
  const notifiedEmailIdsRef = useRef<Set<string>>(new Set());
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [queueCounts, setQueueCounts] = useState<Record<string, number>>({});

  // Layout check
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchEmails = useCallback(async () => {
    try {
      setLoading(true);
      
      // Contextual mode (e.g. Lead Detail)
      if (emailAddress) {
        const serverFilters: Record<string, any> = {
          filterFrom: advancedFilters.from || undefined,
          filterTo: advancedFilters.to || undefined,
          filterSubject: advancedFilters.subject || undefined,
          filterHasAttachment: advancedFilters.hasAttachment || undefined,
          filterDateFrom: advancedFilters.dateFrom ? advancedFilters.dateFrom.toISOString() : undefined,
          filterDateTo: advancedFilters.dateTo ? advancedFilters.dateTo.toISOString() : undefined,
        };
        const { data, error } = await supabase.functions.invoke("search-emails", {
          body: { 
            email: emailAddress, 
            query: searchQuery,
            page: 1, 
            pageSize: 50,
            ...serverFilters
          },
        });

        if (error) throw error;
        if (data && (data as any).success === false) {
          throw new Error((data as any).error || "Email search failed");
        }
        
        let fetchedEmails: Email[] = (data as any).data || [];
        
        // Client-side filtering for contextual view if needed (API might not handle all)
        if (filterUnread) fetchedEmails = fetchedEmails.filter(e => !e.is_read);
        if (filterFlagged) fetchedEmails = fetchedEmails.filter(e => e.is_starred);
        if (filterAttachments) fetchedEmails = fetchedEmails.filter(e => e.has_attachments);
        
        setEmails(fetchedEmails);
      } 
      // General Inbox mode
      else {
        let query = supabase.from("emails").select("*").limit(50);

        // Apply folder filter
        if (selectedFolder === 'inbox' || selectedFolder === 'sent' || selectedFolder === 'drafts' || selectedFolder === 'trash' || selectedFolder === 'spam' || selectedFolder === 'archive') {
             query = query.eq("folder", selectedFolder);
        } else if (selectedFolder === 'all_mail') {
             query = query.neq("folder", "trash").neq("folder", "spam");
        } else if (customFolders.includes(selectedFolder)) {
             // For custom folders, assuming they are stored in 'folder' column or we use labels
             // If we use 'folder' column:
             query = query.eq("folder", selectedFolder);
             // If we used labels, we would use .contains('labels', [selectedFolder])
        }

        if (searchQuery) {
          query = query.or(`subject.ilike.%${searchQuery}%,body_text.ilike.%${searchQuery}%,from_name.ilike.%${searchQuery}%,from_email.ilike.%${searchQuery}%`);
        }
        
        if (filterUnread) query = query.eq("is_read", false);
        if (filterFlagged) query = query.eq("is_starred", true);
        if (filterAttachments) query = query.eq("has_attachments", true);

        // Advanced Filters (Server-side simulation if needed, or client-side below)
        // Since Supabase generic query building is simple, complex AND/OR logic might be better handled by Edge Function
        // or carefully constructed here.
        if (advancedFilters.from) query = query.ilike('from_email', `%${advancedFilters.from}%`);
        if (advancedFilters.subject) query = query.ilike('subject', `%${advancedFilters.subject}%`);
        if (advancedFilters.hasAttachment) query = query.eq('has_attachments', true);
        if (advancedFilters.dateFrom) query = query.gte("received_at", advancedFilters.dateFrom.toISOString());
        if (advancedFilters.dateTo) {
          const end = new Date(advancedFilters.dateTo);
          end.setHours(23, 59, 59, 999);
          query = query.lte("received_at", end.toISOString());
        }

        if (sortField === "received_at") {
          query = query.order("received_at", { ascending: sortDirection === "asc" });
        } else {
          query = query.order(sortField, { ascending: sortDirection === "asc" });
        }

        if (conversationView && useServerGrouping) {
          const { data, error } = await supabase.functions.invoke("search-emails", {
            body: {
              folder: selectedFolder,
              groupBy: "conversation",
              sortGroupBy: "date",
              sortDirection: sortDirection,
              page: 1,
              pageSize: 50,
              query: searchQuery || undefined,
            }
          });
          if (error) throw error;
          const threads = (data?.data as any[]) || [];
          const fetched = threads.map((t) => ({ ...t.latestEmail, threadCount: t.count })) as any;
          setEmails(fetched as Email[]);
        } else {
          const { data, error } = await query;
          if (error) throw error;
          setEmails(data as Email[]);
        }
      }
    } catch (error) {
      console.error("Error fetching emails:", error);
      toast({
        title: "Error fetching emails",
        description: "Could not load emails. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [emailAddress, entityId, searchQuery, selectedFolder, filterUnread, filterFlagged, filterAttachments, advancedFilters, sortField, sortDirection, supabase, toast, customFolders]);

  const fetchQueueCounts = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_queue_counts');
    if (!error && data) {
      setQueueCounts(data as Record<string, number>);
    }
  }, [supabase]);

  // Real-time subscription
  useEffect(() => {
    if (emailAddress) return;

    const channel = supabase
      .channel("email-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "emails" }, (payload) => {
        // Refresh queue counts on any change
        fetchQueueCounts();

        const eventType = (payload as any).eventType as string | undefined;
        const next = (payload as any).new as any;
        const prev = (payload as any).old as any;

        if (eventType === "INSERT" && next?.id) {
          const inserted = next as Email;
          setEmails((current) => {
            if (current.some((e) => e.id === inserted.id)) return current;
            return [inserted, ...current].slice(0, 50);
          });

          if (
            notificationsEnabled &&
            inserted.folder === "inbox" &&
            inserted.is_read === false &&
            !notifiedEmailIdsRef.current.has(inserted.id)
          ) {
            notifiedEmailIdsRef.current.add(inserted.id);
            if (notifiedEmailIdsRef.current.size > 50) {
              const first = notifiedEmailIdsRef.current.values().next().value as string | undefined;
              if (first) notifiedEmailIdsRef.current.delete(first);
            }
            toast({
              title: inserted.from_name || inserted.from_email || "New email",
              description: inserted.subject || "(No Subject)",
            });
          }
          return;
        }

        if (eventType === "UPDATE" && next?.id) {
          const updated = next as Email;
          setEmails((current) => current.map((e) => (e.id === updated.id ? updated : e)));
          return;
        }

        if (eventType === "DELETE" && prev?.id) {
          const deletedId = String(prev.id);
          setEmails((current) => current.filter((e) => e.id !== deletedId));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [emailAddress, supabase, toast, notificationsEnabled]);

  useEffect(() => {
    fetchEmails();
    fetchQueueCounts();
  }, [fetchEmails, fetchQueueCounts]);

  // Load custom folders from localStorage for now (mock persistence)
  useEffect(() => {
    const saved = localStorage.getItem('custom_email_folders');
    if (saved) {
      try {
        setCustomFolders(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
    const notif = localStorage.getItem('email_notifications_enabled');
    if (notif) {
      try {
        setNotificationsEnabled(JSON.parse(notif));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleCreateFolder = (name: string) => {
    if (!customFolders.includes(name)) {
      const newFolders = [...customFolders, name];
      setCustomFolders(newFolders);
      localStorage.setItem('custom_email_folders', JSON.stringify(newFolders));
      toast({ title: "Folder created", description: `Folder "${name}" created.` });
    }
  };

  const handleDeleteFolder = (name: string) => {
    const newFolders = customFolders.filter(f => f !== name);
    setCustomFolders(newFolders);
    localStorage.setItem('custom_email_folders', JSON.stringify(newFolders));
    if (selectedFolder === name) setSelectedFolder('inbox');
    toast({ title: "Folder deleted", description: `Folder "${name}" deleted.` });
  };

  const handleSync = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.functions.invoke("sync-emails", {
        body: { accountId: null }
      });
      if (error) throw error;
      toast({ title: "Sync started", description: "Email synchronization has started in the background." });
    } catch (error) {
      console.error("Sync error:", error);
      toast({ title: "Sync failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Derived state for filtering
  const filteredEmails = useMemo<(Email & { threadCount?: number })[]>(() => {
    // Basic filtering is done by fetchEmails mostly, but for contextual view
    // or additional client-side refinement:
    const filtered = emails.filter(email => {
      // Contextual folder logic
      if (emailAddress) {
        if (selectedFolder === 'all_mail') return true;
        const isInbound = email.from_email.toLowerCase().includes(emailAddress.toLowerCase());
        if (selectedFolder === 'inbox' && !isInbound) return false;
        if (selectedFolder === 'sent' && isInbound) return false;
      }
      
      // Apply advanced filters locally if not handled by server query (redundancy is safe)
      if (advancedFilters.from && !email.from_email.toLowerCase().includes(advancedFilters.from.toLowerCase()) && !email.from_name.toLowerCase().includes(advancedFilters.from.toLowerCase())) return false;
      if (advancedFilters.to) {
        const q = advancedFilters.to.toLowerCase();
        const tos = Array.isArray(email.to_emails) ? email.to_emails : [];
        const ccs = Array.isArray(email.cc_emails) ? email.cc_emails : [];
        const bccs = Array.isArray(email.bcc_emails) ? email.bcc_emails : [];
        const all = [...tos, ...ccs, ...bccs].map((s) => String(s).toLowerCase());
        if (!all.some((s) => s.includes(q))) return false;
      }
      if (advancedFilters.subject && !email.subject.toLowerCase().includes(advancedFilters.subject.toLowerCase())) return false;
      if (advancedFilters.hasAttachment && !email.has_attachments) return false;
      if (advancedFilters.dateFrom) {
        const from = new Date(advancedFilters.dateFrom);
        from.setHours(0, 0, 0, 0);
        if (new Date(email.received_at).getTime() < from.getTime()) return false;
      }
      if (advancedFilters.dateTo) {
        const to = new Date(advancedFilters.dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(email.received_at).getTime() > to.getTime()) return false;
      }

      return true;
    });

    const getComparable = (e: Email) => {
      if (sortField === "received_at") return new Date(e.received_at).getTime();
      if (sortField === "from_email") return `${e.from_name || ""} ${e.from_email || ""}`.toLowerCase();
      return String(e.subject || "").toLowerCase();
    };

    const dir = sortDirection === "asc" ? 1 : -1;
    const sorted = [...filtered].sort((a, b) => {
      const av = getComparable(a) as any;
      const bv = getComparable(b) as any;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });

    if (!conversationView) return sorted;

    const byThread = new Map<string, { email: Email; count: number }>();
    for (const e of sorted) {
      const key = e.conversation_id || e.thread_id || e.id;
      const existing = byThread.get(key);
      if (!existing) {
        byThread.set(key, { email: e, count: 1 });
        continue;
      }
      existing.count += 1;
      if (new Date(e.received_at).getTime() > new Date(existing.email.received_at).getTime()) {
        existing.email = e;
      }
    }

    return Array.from(byThread.values())
      .map((v) => ({ ...v.email, threadCount: v.count }))
      .sort((a, b) => (new Date(a.received_at).getTime() - new Date(b.received_at).getTime()) * dir);
  }, [emails, selectedFolder, emailAddress, advancedFilters, sortField, sortDirection, conversationView]);

  const selectedThread = useMemo(() => {
    if (!selectedEmail) return null;
    if (!conversationView) return [selectedEmail];
    
    if (selectedEmail.conversation_id || selectedEmail.thread_id) {
       const key = selectedEmail.conversation_id || selectedEmail.thread_id;
       const thread = emails.filter(e => (e.conversation_id || e.thread_id) === key);
       return thread.length > 0 ? thread.sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime()) : [selectedEmail];
    }
    
    return [selectedEmail];
  }, [selectedEmail, emails, conversationView]);

  // Calculate unread counts (mock for now, ideally fetched from DB count query)
  const [unreadStats, setUnreadStats] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("email-stats", {
          body: { folder: selectedFolder },
        });
        if (!error && data?.success) {
          setUnreadStats(data.unreadByFolder || {});
          return;
        }
      } catch (e) {
        console.error(e);
      }
      const by = (folder: string) => emails.filter(e => e.folder === folder);
      setUnreadStats({
        inbox: by('inbox').filter(e => !e.is_read).length,
        sent: by('sent').length,
        drafts: by('drafts').length,
        trash: by('trash').length,
        spam: by('spam').length,
        archive: by('archive').length,
        flagged: emails.filter(e => e.is_starred).length,
      });
    };
    fetchStats();
  }, [emails, selectedFolder, supabase.functions]);

  const unreadCounts = useMemo(() => {
    const fallback = {
      inbox: unreadStats['inbox'] ?? emails.filter(e => e.folder === 'inbox' && !e.is_read).length,
      sent: unreadStats['sent'] ?? emails.filter(e => e.folder === 'sent').length,
      drafts: unreadStats['drafts'] ?? emails.filter(e => e.folder === 'drafts').length,
      trash: unreadStats['trash'] ?? emails.filter(e => e.folder === 'trash').length,
      spam: unreadStats['spam'] ?? emails.filter(e => e.folder === 'spam').length,
      archive: unreadStats['archive'] ?? emails.filter(e => e.folder === 'archive').length,
      flagged: unreadStats['flagged'] ?? emails.filter(e => e.is_starred).length,
    };
    return fallback;
  }, [unreadStats, emails]);

  const handleEmailSelect = (email: Email) => {
    setSelectedEmail(email);
    if (isMobile) setMobileView('detail');
  };

  const handleMoveEmail = async (emailId: string, folder: string) => {
    try {
      const { error } = await supabase
        .from('emails')
        .update({ folder })
        .eq('id', emailId);
        
      if (error) throw error;
      
      // Optimistic update
      setEmails(emails.map(e => e.id === emailId ? { ...e, folder } : e));
      
      if (selectedEmail?.id === emailId && selectedFolder !== 'all_mail' && selectedFolder !== folder) {
        setSelectedEmail(null);
      }
      
      toast({ title: "Moved", description: `Email moved to ${folder}` });
    } catch (error) {
      console.error("Error moving email:", error);
      toast({ title: "Error", description: "Failed to move email", variant: "destructive" });
    }
  };

  const handleReply = (email: Email) => {
    setReplyTo({
      to: email.from_email,
      subject: email.subject,
      body: email.body_text || email.snippet
    });
    setShowCompose(true);
  };

  const handleForward = (email: Email) => {
     setReplyTo({
       to: "",
       subject: `Fwd: ${email.subject}`,
       body: `\n\n---------- Forwarded message ---------\nFrom: ${email.from_name} <${email.from_email}>\nDate: ${new Date(email.received_at).toLocaleString()}\nSubject: ${email.subject}\nTo: ${email.to_emails.join(", ")}\n\n${email.body_text || email.snippet}`
     });
     setShowCompose(true);
  };

  const handleArchive = async (email: Email) => {
     await handleMoveEmail(email.id, 'archive');
  };
  
  const handleDelete = async (email: Email) => {
     await handleMoveEmail(email.id, 'trash');
  };

  // Mobile View
  if (isMobile) {
    return (
      <div className={cn("h-[calc(100vh-12rem)] flex flex-col bg-background border rounded-lg overflow-hidden", className)}>
        {mobileView === 'list' ? (
          <>
             <div className="p-2 border-b flex items-center justify-between bg-muted/20">
               <div className="flex gap-1 overflow-x-auto">
                 {/* Simplified mobile nav - maybe just a dropdown in future */}
                 <Button variant="ghost" size="sm" onClick={() => setSelectedFolder('inbox')}>Inbox</Button>
                 <Button variant="ghost" size="sm" onClick={() => setSelectedFolder('sent')}>Sent</Button>
               </div>
               <Button variant="ghost" size="icon" onClick={() => setShowCompose(true)}>
                   <Plus className="h-4 w-4" />
               </Button>
             </div>
            <EmailList 
              emails={filteredEmails}
              selectedEmail={selectedEmail}
              onSelect={handleEmailSelect}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              loading={loading}
              filterUnread={filterUnread}
              onToggleUnread={() => setFilterUnread(!filterUnread)}
              filterFlagged={filterFlagged}
              onToggleFlagged={() => setFilterFlagged(!filterFlagged)}
              filterAttachments={filterAttachments}
              onToggleAttachments={() => setFilterAttachments(!filterAttachments)}
              advancedFilters={advancedFilters}
              onAdvancedFiltersChange={setAdvancedFilters}
              sortField={sortField}
              sortDirection={sortDirection}
              onSortFieldChange={setSortField}
              onToggleSortDirection={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
             />
          </>
        ) : (
          <div className="h-full flex flex-col">
            <div className="p-2 border-b flex items-center gap-2 bg-muted/20">
              <Button variant="ghost" size="sm" onClick={() => setMobileView('list')}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              {selectedEmail && (
                <EmailDetailView 
                  email={selectedEmail} 
                  thread={selectedThread || undefined}
                  onReply={() => handleReply(selectedEmail)}
                  onForward={() => handleForward(selectedEmail)}
                  onArchive={() => handleArchive(selectedEmail)}
                  onDelete={() => handleDelete(selectedEmail)}
                  onMove={handleMoveEmail}
                  customFolders={customFolders}
                />
              )}
            </div>
          </div>
        )}
        <EmailComposeDialog 
          open={showCompose} 
          onOpenChange={setShowCompose}
          initialTo={emailAddress ? [emailAddress] : []}
          replyTo={replyTo}
          onSent={fetchEmails}
          entityType={entityType}
          entityId={entityId}
        />
      </div>
    );
  }

  // Desktop 3-pane layout
  return (
    <div className={cn("h-[600px] bg-background border rounded-lg overflow-hidden flex flex-col", className)}>
      <ResizablePanelGroup direction="horizontal">
        {/* Sidebar */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={25} className="bg-muted/10 min-w-[200px]">
          <EmailSidebar 
            selectedFolder={selectedFolder}
            onFolderSelect={setSelectedFolder}
            unreadCounts={unreadCounts}
            onCompose={() => {
              setReplyTo(undefined);
              setShowCompose(true);
            }}
            onSync={handleSync}
            loading={loading}
            customFolders={customFolders}
            onCreateFolder={handleCreateFolder}
            onDeleteFolder={handleDeleteFolder}
            notificationsEnabled={notificationsEnabled}
            onToggleNotifications={() => {
              setNotificationsEnabled((prev) => {
                const next = !prev;
                localStorage.setItem('email_notifications_enabled', JSON.stringify(next));
                return next;
              });
            }}
            queueCounts={queueCounts}
          />
        </ResizablePanel>
        
        <ResizableHandle />
        
        {/* Email List */}
        <ResizablePanel defaultSize={30} minSize={25} className="min-w-[300px]">
          <EmailList 
             emails={filteredEmails}
             selectedEmail={selectedEmail}
             onSelect={handleEmailSelect}
             searchQuery={searchQuery}
             onSearchChange={setSearchQuery}
             loading={loading}
             filterUnread={filterUnread}
             onToggleUnread={() => setFilterUnread(!filterUnread)}
             filterFlagged={filterFlagged}
             onToggleFlagged={() => setFilterFlagged(!filterFlagged)}
             filterAttachments={filterAttachments}
             onToggleAttachments={() => setFilterAttachments(!filterAttachments)}
             advancedFilters={advancedFilters}
             onAdvancedFiltersChange={setAdvancedFilters}
             conversationView={conversationView}
             onToggleConversationView={setConversationView}
             useServerGrouping={useServerGrouping}
             onToggleServerGrouping={setUseServerGrouping}
             sortField={sortField}
             sortDirection={sortDirection}
             onSortFieldChange={setSortField}
             onToggleSortDirection={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
          />
        </ResizablePanel>
        
        <ResizableHandle />
        
        {/* Reading Pane */}
        <ResizablePanel defaultSize={50} className="min-w-[400px]">
          {selectedEmail ? (
            <div className="h-full overflow-y-auto">
               <EmailDetailView 
                  email={selectedEmail} 
                  thread={selectedThread || undefined}
                  onReply={() => handleReply(selectedEmail)}
                  onForward={() => handleForward(selectedEmail)}
                  onArchive={() => handleArchive(selectedEmail)}
                  onDelete={() => handleDelete(selectedEmail)}
                  onMove={handleMoveEmail}
                  customFolders={customFolders}
               />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <Mail className="h-12 w-12 mb-4 opacity-20" />
              <p>Select an email to read</p>
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>

      <EmailComposeDialog 
        open={showCompose} 
        onOpenChange={(open) => {
          setShowCompose(open);
          if (!open) setReplyTo(undefined);
        }}
        initialTo={emailAddress ? [emailAddress] : []}
        replyTo={replyTo}
        onSent={fetchEmails}
        entityType={entityType}
        entityId={entityId}
      />
    </div>
  );
}
