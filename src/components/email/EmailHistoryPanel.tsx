import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Mail, RefreshCw, Search, Plus, ExternalLink, Calendar, ArrowUpRight, ArrowDownLeft, MessageSquare, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useCRM } from "@/hooks/useCRM";
import { toast } from "sonner";
import { EmailComposeDialog } from "./EmailComposeDialog";
import { EmailDetailDialog } from "./EmailDetailDialog";

interface Email {
  id: string;
  subject: string;
  from_email: string;
  to_emails: string[];
  snippet: string;
  received_at: string;
  folder: string;
  has_attachments: boolean;
  thread_id?: string;
  from_name?: string;
  is_starred?: boolean;
}

interface EmailHistoryPanelProps {
  emailAddress?: string | null;
  entityType: string; // 'lead', 'contact', 'account', 'opportunity', 'shipment'
  entityId: string;
  tenantId?: string;
  accountId?: string;
  className?: string;
}

export function EmailHistoryPanel({ emailAddress, entityType, entityId, tenantId, accountId, className }: EmailHistoryPanelProps) {
  const { supabase } = useCRM();
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'threaded'>('list');
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  const fetchEmails = async () => {
    if (!emailAddress) return;
    
    try {
      setLoading(true);
      // We search for emails where the address is in 'from', 'to', 'cc', or 'bcc'
      // The search-emails function handles this if we pass the email query
      const { data, error } = await supabase.functions.invoke("search-emails", {
        body: { 
          email: emailAddress, 
          tenantId,
          accountId,
          page: 1, 
          pageSize: 50 
        },
      });

      if (error) {
        // If the function returned a structured error
        throw error;
      }
      if (data && (data as any).success === false) {
        throw new Error((data as any).error || "Email search failed");
      }
      
      const results = (data?.data as Email[]) || [];
      // Sort by date desc
      const sorted = results.sort((a, b) => 
        new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
      );
      setEmails(sorted);
    } catch (error: any) {
      console.error("Error fetching emails:", error);
      toast.error("Failed to load email history", {
        description: error.message || "Unknown error occurred"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, [emailAddress, tenantId, accountId]);

  const filteredEmails = useMemo(() => {
    return emails.filter(email => 
      email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.snippet.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [emails, searchQuery]);

  const threads = useMemo(() => {
    if (viewMode === 'list') return [];

    const groups: Record<string, Email[]> = {};
    filteredEmails.forEach(email => {
       // Use thread_id if available, otherwise normalize subject
       const subjectKey = email.subject.replace(/^(Re:|Fwd:|FW:|Aw:)\s+/i, '').trim().toLowerCase();
       const key = email.thread_id || subjectKey || 'no_subject';
       
       if (!groups[key]) groups[key] = [];
       groups[key].push(email);
    });

    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());
    });

    return Object.entries(groups)
      .map(([key, threadEmails]) => ({
        id: key,
        emails: threadEmails,
        latestEmail: threadEmails[0],
        count: threadEmails.length
      }))
      .sort((a, b) => new Date(b.latestEmail.received_at).getTime() - new Date(a.latestEmail.received_at).getTime());
  }, [filteredEmails, viewMode]);

  const toggleThread = (threadId: string) => {
    const next = new Set(expandedThreads);
    if (next.has(threadId)) next.delete(threadId);
    else next.add(threadId);
    setExpandedThreads(next);
  };

  if (!emailAddress) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email History
          </CardTitle>
          <CardDescription>
            No email address associated with this {entityType}.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <Button variant="outline" className="w-full" disabled>
             Add email to {entityType} to view history
           </Button>
        </CardContent>
      </Card>
    );
  }

  const renderEmailItem = (email: Email, isThreadChild = false) => {
    const isInbound = email.from_email.toLowerCase().includes(emailAddress.toLowerCase());
    return (
      <div 
        key={email.id} 
        className={`p-3 hover:bg-muted/50 cursor-pointer transition-colors ${isThreadChild ? 'pl-8 border-l-2 border-muted ml-2' : ''}`}
        onClick={() => setSelectedEmail(email)}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="font-medium text-sm truncate flex-1">
            {isInbound ? (
              <span className="flex items-center text-blue-600">
                <ArrowDownLeft className="h-3 w-3 mr-1" />
                {email.from_email}
              </span>
            ) : (
              <span className="flex items-center text-green-600">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                To: {emailAddress}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {format(new Date(email.received_at), 'MMM d, h:mm a')}
          </span>
        </div>
        <div className="font-medium text-sm truncate mb-0.5">
          {email.subject || '(No Subject)'}
        </div>
        <div className="text-xs text-muted-foreground line-clamp-2">
          {email.snippet}
        </div>
      </div>
    );
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            Correspondence
            <Badge variant="secondary" className="ml-2">
              {emails.length}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              title={viewMode === 'list' ? "Switch to Threaded View" : "Switch to List View"}
              onClick={() => setViewMode(v => v === 'list' ? 'threaded' : 'list')}
            >
              {viewMode === 'list' ? <MessageSquare className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={fetchEmails}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button 
              size="sm" 
              className="h-8" 
              onClick={() => setShowCompose(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Compose
            </Button>
          </div>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search emails..."
            className="pl-8 h-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          {loading && emails.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading history...
            </div>
          ) : filteredEmails.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Mail className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm">No emails found</p>
            </div>
          ) : (
            <div className="divide-y">
              {viewMode === 'list' ? (
                filteredEmails.map(email => renderEmailItem(email))
              ) : (
                threads.map(thread => (
                  <div key={thread.id} className="border-b last:border-0">
                    <div 
                      className="p-3 hover:bg-muted/30 cursor-pointer flex items-center justify-between group"
                      onClick={() => toggleThread(thread.id)}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        {expandedThreads.has(thread.id) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div className="flex flex-col overflow-hidden">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{thread.latestEmail.subject || '(No Subject)'}</span>
                            <Badge variant="outline" className="text-xs h-5 px-1.5 min-w-[1.5rem] flex justify-center">
                              {thread.count}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground truncate">
                            Latest: {format(new Date(thread.latestEmail.received_at), 'MMM d, h:mm a')}
                          </span>
                        </div>
                      </div>
                    </div>
                    {expandedThreads.has(thread.id) && (
                      <div className="bg-muted/10 pb-2">
                        {thread.emails.map(email => renderEmailItem(email, true))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>

      <EmailComposeDialog 
        open={showCompose} 
        onOpenChange={setShowCompose}
        initialTo={emailAddress ? [emailAddress] : []}
        onSent={fetchEmails}
        entityType={entityType}
        entityId={entityId}
      />
      
      {selectedEmail && (
        <EmailDetailDialog
          email={{
            ...selectedEmail,
            from_name: selectedEmail.from_name || selectedEmail.from_email,
            is_starred: selectedEmail.is_starred || false,
          }}
          open={!!selectedEmail}
          onOpenChange={(open) => !open && setSelectedEmail(null)}
          onRefresh={fetchEmails}
        />
      )}
    </Card>
  );
}
