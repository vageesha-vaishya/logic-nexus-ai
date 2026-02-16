import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Mail, Search, RefreshCw, Star, Archive, Trash2, 
  Plus, Reply, Forward, MoreVertical, Paperclip, Flag, Circle, ArrowUpDown,
  Flame, Smile, Frown, Meh, Shield, ShieldAlert, ShieldCheck
} from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useAuth } from "@/hooks/useAuth";
import { invokeFunction } from "@/lib/supabase-functions";
import { useLeadDuplicateCheck } from "@/hooks/useLeadDuplicateCheck";
import { cleanEmail } from "@/lib/data-cleaning";
import { EmailComposeDialog } from "./EmailComposeDialog";
import { EmailDetailDialog } from "./EmailDetailDialog";
import { format } from "date-fns";

interface Email {
  id: string;
  subject: string;
  from_email: string;
  from_name: string;
  snippet: string;
  received_at: string;
  is_read: boolean;
  is_starred: boolean;
  has_attachments: boolean;
  folder: string;
  labels: any;
  priority?: string;
  importance?: string;
  ai_sentiment?: string;
  ai_urgency?: string;
  security_status?: 'pending' | 'scanning' | 'clean' | 'suspicious' | 'malicious';
  quarantine_reason?: string;
}

export function EmailInbox() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("inbox");
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [sortField, setSortField] = useState<"received_at" | "from_email" | "subject" | "priority">("received_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [conversationView, setConversationView] = useState(false);
  const [threads, setThreads] = useState<any[]>([]);
  const { toast } = useToast();
  const { roles } = useAuth();
  const { buildEmailDuplicateMap } = useLeadDuplicateCheck();
  const [duplicateMap, setDuplicateMap] = useState<Record<string, { count: number; leadIds: string[] }>>({});

  const renderSecurityBadge = (email: Email) => {
    if (!email.security_status || email.security_status === 'pending') return null;
    
    const status = email.security_status;
    if (status === 'clean') {
       return (
          <Badge variant="outline" className="text-[10px] h-4 px-1 border-green-500 text-green-600 bg-green-50">
            <ShieldCheck className="h-3 w-3 mr-1" />
            Clean
          </Badge>
       );
    }
    if (status === 'suspicious') {
       return (
          <Badge variant="outline" className="text-[10px] h-4 px-1 border-orange-500 text-orange-600 bg-orange-50">
            <Shield className="h-3 w-3 mr-1" />
            Suspicious
          </Badge>
       );
    }
    if (status === 'malicious') {
       return (
          <Badge variant="outline" className="text-[10px] h-4 px-1 border-red-500 text-red-600 bg-red-50">
            <ShieldAlert className="h-3 w-3 mr-1" />
            Malicious
          </Badge>
       );
    }
    if (status === 'scanning') {
       return (
          <Badge variant="outline" className="text-[10px] h-4 px-1 border-blue-500 text-blue-600 bg-blue-50">
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            Scanning
          </Badge>
       );
    }
    return null;
  };

  const autoSyncedRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    // Only auto-sync if we have a valid (non-empty) account selected
    if (selectedAccountId && selectedAccountId !== "" && !autoSyncedRef.current[selectedAccountId]) {
      autoSyncedRef.current[selectedAccountId] = true;
      syncEmails({ silent: true });
    }
  }, [selectedAccountId]);

  const getTenantId = () => {
    const tenantAdmin = roles.find((r) => r.role === "tenant_admin" && r.tenant_id);
    return tenantAdmin?.tenant_id || roles.find((r) => r.tenant_id)?.tenant_id || null;
  };
 
  const fetchEmails = async () => {
    try {
      setLoading(true);

      const looksLikeEmail = /@/.test(searchQuery.trim());
      const tenantId = getTenantId();

      if (conversationView) {
        const { data, error } = await invokeFunction("search-emails", {
          body: {
            tenantId,
            accountId: selectedAccountId || undefined,
            folder: selectedFolder,
            groupBy: "conversation",
            page: 1,
            pageSize: 50,
            sortGroupBy: "date",
            sortDirection,
          },
        });
        if (error) throw error as any;
        const grouped = (data?.data as any[]) || [];
        setThreads(grouped);
        setEmails([]);
        return;
      }

      if (searchQuery && looksLikeEmail) {
        const direction = selectedFolder === "inbox" ? "inbound" : selectedFolder === "sent" ? "outbound" : undefined;
        const { data, error } = await invokeFunction("search-emails", {
          body: { email: searchQuery.trim(), tenantId, accountId: selectedAccountId || undefined, direction, page: 1, pageSize: 50 },
        });
        if (error) throw error as any;
        const results = (data?.data as Email[]) || [];
        // Apply client-side sorting for search results
        const sorted = [...results].sort((a, b) => {
          const dir = sortDirection === "asc" ? 1 : -1;
          if (sortField === "received_at") {
            return (new Date(a.received_at).getTime() - new Date(b.received_at).getTime()) * dir;
          }
          const av = (a[sortField] || "").toString().toLowerCase();
          const bv = (b[sortField] || "").toString().toLowerCase();
          return av.localeCompare(bv) * dir;
        });
        setEmails(sorted);
      } else {
        let query = (supabase as any)
          .from("emails")
          .select("*")
          .eq("folder", selectedFolder)
          .order(sortField, { ascending: sortDirection === "asc" })
          .limit(50);

        if (selectedAccountId && selectedAccountId !== "") {
          query = query.eq("account_id", selectedAccountId);
        }
        if (searchQuery) {
          query = query.or(`subject.ilike.%${searchQuery}%,from_email.ilike.%${searchQuery}%,snippet.ilike.%${searchQuery}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        setEmails(data || []);
      }
    } catch (error: any) {
      if (error.message?.includes("non-2xx") && (error as any)?.context?.status === 401) {
          console.error("Fetch Emails Unauthorized. Full error:", error);
          toast({ title: "Session Expired", description: "Please log out and log in again to view emails.", variant: "destructive" });
      } else {
          toast({
            title: "Error fetching emails",
            description: error.message,
            variant: "destructive",
            action: <ToastAction altText="Retry" onClick={fetchEmails}>Retry</ToastAction>,
          });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, [selectedFolder, searchQuery, selectedAccountId, sortField, sortDirection, conversationView]);

  useEffect(() => {
    async function computeDuplicates() {
      try {
        if (conversationView) {
          const emailList = threads.map((t: any) => t.latestEmail?.from_email).filter(Boolean);
          const map = await buildEmailDuplicateMap(emailList);
          setDuplicateMap(map);
        } else {
          const emailList = emails.map((e: any) => e.from_email).filter(Boolean);
          const map = await buildEmailDuplicateMap(emailList);
          setDuplicateMap(map);
        }
      } catch {
        setDuplicateMap({});
      }
    }
    if (!loading) {
      computeDuplicates();
    }
  }, [loading, emails, threads, conversationView]);
  const fetchAccounts = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("email_accounts")
        .select("id, email_address, provider, is_primary")
        .eq("is_active", true)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      setAccounts(data || []);
      if (data && data.length > 0) {
        const primary = data.find((a: any) => a.is_primary);
        setSelectedAccountId((primary || data[0]).id);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const markAsRead = async (emailId: string) => {
    try {
      const response: any = await (supabase as any)
        .from("emails")
        .update({ is_read: true })
        .eq("id", emailId);
      const { error } = response;

      if (error) throw error;
      fetchEmails();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleStar = async (emailId: string, isStarred: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from("emails")
        .update({ is_starred: !isStarred })
        .eq("id", emailId);

      if (error) throw error;
      fetchEmails();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const moveToFolder = async (emailId: string, folder: string) => {
    try {
      const { error } = await (supabase as any)
        .from("emails")
        .update({ folder })
        .eq("id", emailId);

      if (error) throw error;
      toast({
        title: "Success",
        description: `Email moved to ${folder}`,
      });
      fetchEmails();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const syncEmails = async (options?: { silent?: boolean }) => {
    try {
      setSyncing(true);
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const userId = authData.user?.id;
      if (!userId) throw new Error("Not authenticated");
      const accountId = selectedAccountId;
      if (!accountId || accountId === "") {
        toast({ title: "Select a mailbox", description: "Please choose a mailbox from the selector before syncing.", variant: "destructive" });
        setSyncing(false);
        return;
      }

      // invokeFunction handles 401 retries automatically
      const { data, error } = await invokeFunction("sync-emails-v2", {
        body: { accountId },
      });

      if (error) throw error as any;
      if (!options?.silent) {
        toast({
          title: "Synced",
          description: data?.message || "Email sync complete.",
        });
      }
      await fetchEmails();
    } catch (error: any) {
      if (!options?.silent) {
        const rawMessage = error?.message as string | undefined;
        let message = rawMessage || "Email sync failed";
        
        if (rawMessage?.includes("non-2xx")) {
           const status = (error as any)?.context?.status;
           if (status === 401) {
              // If we get here, the retry logic in invokeFunction also failed
              console.error("Sync Unauthorized after retry. Full error:", error);
              if ((error as any)?.context) {
                  console.error("Debug info (context):", (error as any).context);
              }
              toast({ title: "Sync Unauthorized", description: "Session expired. Please log out and log in again.", variant: "destructive" });
              return;
           }
        }
        
        if (rawMessage?.includes("Failed to fetch")) {
          message = "Could not reach Supabase Edge Functions. Check network connection and project configuration.";
        }
        toast({ title: "Sync failed", description: message, variant: "destructive" });
      }
    } finally {
      setSyncing(false);
    }
  };

  const syncAllMailboxes = async () => {
    try {
      setSyncing(true);
      const tenantId = getTenantId();

      if (tenantId) {
        // invokeFunction handles session and headers automatically
        const { data, error } = await invokeFunction("sync-all-mailboxes", {
          body: { tenantId, limit: 100 },
        });
        if (error) throw error as any;
        toast({ title: "Sync triggered", description: `Processed ${data?.accountsProcessed || 0} accounts` });
        await fetchEmails();
        return;
      }

      // Fallback: sync all active accounts for current user when no tenant role is set
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const userId = authData.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const response: any = await (supabase as any)
        .from("email_accounts")
        .select("id")
        .eq("user_id", userId)
        .eq("is_active", true);
      const { data: userAccounts, error: accErr } = response;
      
      if (accErr) throw accErr;
      if (!userAccounts || userAccounts.length === 0) {
        toast({ title: "No accounts", description: "Add an email account first.", variant: "destructive" });
        return;
      }

      let totalSynced = 0;
      for (const acc of userAccounts) {
        const { data, error } = await invokeFunction("sync-emails-v2", {
          body: { accountId: acc.id },
        });
        if (error) {
          console.error("Sync error for account", acc.id, error);
          if ((error as any)?.context) {
             console.error("Sync error context:", (error as any).context);
          }
          continue;
        }
        totalSynced += data?.syncedCount || 0;
      }

      toast({ title: "Sync complete", description: `Processed ${userAccounts.length} accounts. Total emails: ${totalSynced}` });
      await fetchEmails();
    } catch (error: any) {
      toast({ title: "Sync all failed", description: error.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleEmailClick = (email: Email) => {
    setSelectedEmail(email);
    setShowDetail(true);
    if (!email.is_read) {
      markAsRead(email.id);
    }
  };

  const scanEmail = async (emailId: string) => {
    try {
      toast({ title: "Scanning email...", description: "Please wait while we check for threats." });
      
      // Optimistic update
      setEmails(prev => prev.map(e => e.id === emailId ? { ...e, security_status: 'scanning' } : e));

      const { data, error } = await invokeFunction("email-scan", {
        body: { email_id: emailId },
      });

      if (error) throw error;
      
      toast({
        title: "Scan Complete",
        description: `Status: ${data?.scan_result?.security_status || 'Unknown'}`,
        variant: data?.scan_result?.security_status === 'clean' ? "default" : "destructive"
      });
      
      fetchEmails();
    } catch (error: any) {
      toast({ title: "Scan Failed", description: error.message, variant: "destructive" });
      fetchEmails(); // Revert optimistic update
    }
  };
  
  const processEmail = async (emailId: string) => {
    try {
      toast({ title: "Processing email...", description: "Running classification and security scan." });
      
      // Classify (category, sentiment, intent)
      const { error: classifyError } = await invokeFunction("classify-email", {
        body: { email_id: emailId },
      });
      if (classifyError) throw classifyError as any;
      
      // Then scan for security threats
      const { error: scanError } = await invokeFunction("email-scan", {
        body: { email_id: emailId },
      });
      if (scanError) throw scanError as any;
      
      toast({ title: "Processed", description: "Classification and security scan complete." });
      fetchEmails();
    } catch (error: any) {
      toast({ title: "Process failed", description: error.message, variant: "destructive" });
      fetchEmails();
    }
  };

  const updateEmailPriority = async (emailId: string, priority: string) => {
    try {
      const response: any = await (supabase as any)
        .from("emails")
        .update({ priority })
        .eq("id", emailId);
      const { error } = response;
      if (error) throw error;
      setEmails((prev) => prev.map((e) => (e.id === emailId ? { ...e, priority } : e)));
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const clampText = (text: string, maxChars: number) => {
    const t = text || "";
    if (t.length <= maxChars) return t;
    return t.slice(0, Math.max(0, maxChars - 1)) + "…";
  };

  return (
    <div className="space-y-6 font-outlook">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Email Inbox</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={fetchEmails}>
            <RefreshCw className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => syncEmails()} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 sm:mr-2 ${syncing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Sync</span>
          </Button>
          <Button variant="outline" size="sm" onClick={syncAllMailboxes} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 sm:mr-2 ${syncing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Sync All</span>
          </Button>
          <Button size="sm" onClick={() => setShowCompose(true)}>
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Compose</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        <div className="relative w-full sm:w-[220px] lg:w-[240px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="w-full lg:w-[280px]">
          <Select onValueChange={(v) => setSelectedAccountId(v)} value={selectedAccountId || undefined}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select mailbox" />
            </SelectTrigger>
            <SelectContent>
              {accounts.length === 0 ? (
                <SelectItem value="none" disabled>
                  No accounts
                </SelectItem>
              ) : (
                accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.email_address} {a.is_primary ? "(Primary)" : ""}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full lg:flex-1 overflow-x-auto">
          <Tabs value={selectedFolder} onValueChange={setSelectedFolder} className="w-full">
            <TabsList className="flex w-full whitespace-nowrap">
              <TabsTrigger value="inbox">Inbox</TabsTrigger>
              <TabsTrigger value="sent">Sent</TabsTrigger>
              <TabsTrigger value="drafts">Drafts</TabsTrigger>
              <TabsTrigger value="archive">Archive</TabsTrigger>
              <TabsTrigger value="trash">Trash</TabsTrigger>
              <TabsTrigger value="quarantine" className="text-red-500 data-[state=active]:text-red-600">Quarantine</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="w-full lg:w-auto flex items-center gap-2 shrink-0">
          <Select value={sortField} onValueChange={(v) => setSortField(v as any)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="received_at">Date</SelectItem>
              <SelectItem value="from_email">From</SelectItem>
              <SelectItem value="subject">Subject</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
            className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4" />
            {sortDirection === "asc" ? "Asc" : "Desc"}
          </Button>
          <div className="flex items-center gap-2 pl-2 border-l">
            <Switch
              id="conversation-view"
              checked={conversationView}
              onCheckedChange={setConversationView}
              className="h-5 w-9"
            />
            <Label htmlFor="conversation-view" className="text-xs whitespace-nowrap cursor-pointer">Threads</Label>
          </div>
        </div>
      </div>

      {
        <Card>
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading emails...</div>
          ) : conversationView ? (
            threads.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No threads found</p>
              </div>
            ) : (
              <div className="divide-y">
                {threads.map((thread) => {
                  const latest = thread.latestEmail;
                  return (
                    <div
                      key={thread.id}
                      className={`p-4 hover:bg-accent/5 cursor-pointer transition-colors ${!latest.is_read ? "bg-primary/5" : ""} overflow-x-hidden`}
                      onClick={() => handleEmailClick(latest)}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs h-5 px-1.5 min-w-[1.5rem] flex justify-center">
                            {thread.count}
                          </Badge>
                        </div>
                        <div className="flex-1 min-w-0 max-w-[100ch]">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`font-medium ${!latest.is_read ? "font-bold" : ""} break-words whitespace-normal lg:truncate`}>
                                {latest.subject || "(No Subject)"}
                              </span>
                              {(() => {
                                const key = cleanEmail(latest.from_email).value || latest.from_email?.trim().toLowerCase();
                                const dup = key ? duplicateMap[key] : undefined;
                                if (dup && dup.count > 0) {
                                  return (
                                    <Badge variant="outline" className="text-[10px] h-4 px-1 border-amber-500 text-amber-700 bg-amber-50">
                                      Duplicate Lead
                                    </Badge>
                                  );
                                }
                                return null;
                              })()}
                              {latest.ai_urgency && latest.ai_urgency !== 'low' && (
                                <Badge 
                                  variant="outline" 
                                  className={`text-[10px] h-4 px-1 ${
                                    latest.ai_urgency === 'high' ? "border-red-500 text-red-600 bg-red-50" : 
                                    latest.ai_urgency === 'medium' ? "border-orange-500 text-orange-600 bg-orange-50" : ""
                                  }`}
                                >
                                  <Flame className="h-3 w-3 mr-1" />
                                  {latest.ai_urgency.charAt(0).toUpperCase() + latest.ai_urgency.slice(1)}
                                </Badge>
                              )}
                              {latest.ai_sentiment && (
                                <Badge 
                                  variant="outline" 
                                  className={`text-[10px] h-4 px-1 ${
                                    latest.ai_sentiment === 'positive' ? "border-green-500 text-green-600 bg-green-50" : 
                                    latest.ai_sentiment === 'negative' ? "border-red-500 text-red-600 bg-red-50" : 
                                    "border-gray-400 text-gray-600 bg-gray-50"
                                  }`}
                                >
                                  {latest.ai_sentiment === 'positive' ? <Smile className="h-3 w-3 mr-1" /> :
                                   latest.ai_sentiment === 'negative' ? <Frown className="h-3 w-3 mr-1" /> :
                                   <Meh className="h-3 w-3 mr-1" />}
                                  {latest.ai_sentiment.charAt(0).toUpperCase() + latest.ai_sentiment.slice(1)}
                                </Badge>
                              )}
                              {renderSecurityBadge(latest)}
                            </div>
                            <span className="text-xs text-muted-foreground">{format(new Date(latest.received_at), "MMM d, h:mm a")}</span>
                          </div>
                          <div
                            className="text-sm text-muted-foreground break-words whitespace-normal"
                            style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as any}
                          >
                            {clampText(latest.snippet || "", 100)}
                          </div>
                          <div className="mt-1">
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 h-auto"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEmailClick(latest);
                              }}
                            >
                              Open
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : emails.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No emails found</p>
            </div>
          ) : (
            <div className="divide-y">
              {emails.map((email) => (
                <div
                  key={email.id}
                  className={`p-4 hover:bg-accent/5 cursor-pointer transition-colors ${!email.is_read ? "bg-primary/5" : ""} overflow-x-hidden`}
                  onClick={() => handleEmailClick(email)}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStar(email.id, email.is_starred);
                        }}
                        className="text-muted-foreground hover:text-warning transition-colors"
                      >
                        <Star className={`w-4 h-4 ${email.is_starred ? "fill-warning text-warning" : ""}`} />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className={`transition-colors ${getPriorityColorClass(email.priority)}`}
                            aria-label="Set priority"
                            title="Set priority"
                          >
                            <Flag className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuLabel>Priority</DropdownMenuLabel>
                          <DropdownMenuRadioGroup
                            value={(email.priority || "normal").toLowerCase()}
                            onValueChange={(v) => updateEmailPriority(email.id, v)}
                          >
                            <DropdownMenuRadioItem value="red">
                              <span className="inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" />Red</span>
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="yellow">
                              <span className="inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-500" />Yellow</span>
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="green">
                              <span className="inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500" />Green</span>
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="brown">
                              <span className="inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-700" />Brown</span>
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="normal">
                              <span className="inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-muted-foreground" />Normal</span>
                            </DropdownMenuRadioItem>
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex-1 min-w-0 max-w-[100ch]">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`font-medium ${!email.is_read ? "font-bold" : ""} break-words whitespace-normal lg:truncate`}>
                            {email.from_name || email.from_email}
                          </span>
                          {(() => {
                            const key = cleanEmail(email.from_email).value || email.from_email?.trim().toLowerCase();
                            const dup = key ? duplicateMap[key] : undefined;
                            if (dup && dup.count > 0) {
                              return (
                                <Badge variant="outline" className="text-[10px] h-4 px-1 border-amber-500 text-amber-700 bg-amber-50">
                                  Duplicate Lead
                                </Badge>
                              );
                            }
                            return null;
                          })()}
                          {email.has_attachments && <Paperclip className="w-4 h-4 text-muted-foreground" />}
                          {email.ai_urgency && email.ai_urgency !== 'low' && (
                            <Badge 
                              variant="outline" 
                              className={`text-[10px] h-4 px-1 ${
                                email.ai_urgency === 'high' ? "border-red-500 text-red-600 bg-red-50" : 
                                email.ai_urgency === 'medium' ? "border-orange-500 text-orange-600 bg-orange-50" : ""
                              }`}
                            >
                              <Flame className="h-3 w-3 mr-1" />
                              {email.ai_urgency.charAt(0).toUpperCase() + email.ai_urgency.slice(1)}
                            </Badge>
                          )}
                          {email.ai_sentiment && (
                            <Badge 
                              variant="outline" 
                              className={`text-[10px] h-4 px-1 ${
                                email.ai_sentiment === 'positive' ? "border-green-500 text-green-600 bg-green-50" : 
                                email.ai_sentiment === 'negative' ? "border-red-500 text-red-600 bg-red-50" : 
                                "border-gray-400 text-gray-600 bg-gray-50"
                              }`}
                            >
                              {email.ai_sentiment === 'positive' ? <Smile className="h-3 w-3 mr-1" /> :
                               email.ai_sentiment === 'negative' ? <Frown className="h-3 w-3 mr-1" /> :
                               <Meh className="h-3 w-3 mr-1" />}
                                  {email.ai_sentiment.charAt(0).toUpperCase() + email.ai_sentiment.slice(1)}
                                </Badge>
                              )}
                              {renderSecurityBadge(email)}
                        </div>
                        <span className="text-xs text-muted-foreground">{format(new Date(email.received_at), "MMM d, h:mm a")}</span>
                      </div>
                      <div className={`text-sm mb-1 ${!email.is_read ? "font-semibold" : ""} break-words whitespace-normal lg:truncate`}>{clampText(email.subject || "", 100)}</div>
                      <div
                        className="text-sm text-muted-foreground break-words whitespace-normal"
                        style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as any}
                      >
                        {clampText(email.snippet || "", 100)}
                      </div>
                      <div className="mt-1">
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 h-auto"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEmailClick(email);
                          }}
                        >
                          Open
                        </Button>
                      </div>
                      {email.labels && email.labels.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {email.labels.map((label, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {label}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Classify + Scan"
                        onClick={(e) => {
                          e.stopPropagation();
                          processEmail(email.id);
                        }}
                      >
                        Process
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Scan for threats"
                        onClick={(e) => {
                          e.stopPropagation();
                          scanEmail(email.id);
                        }}
                      >
                        <Shield className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveToFolder(email.id, "archive");
                        }}
                      >
                        <Archive className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveToFolder(email.id, "trash");
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      }

      <EmailComposeDialog open={showCompose} onOpenChange={setShowCompose} />
      
      {selectedEmail && (
        <EmailDetailDialog
          open={showDetail}
          onOpenChange={setShowDetail}
          email={selectedEmail}
          onRefresh={fetchEmails}
        />
      )}
    </div>
  );
}
  const getPriorityColorClass = (p?: string) => {
    switch ((p || "normal").toLowerCase()) {
      case "red":
        return "text-red-500";
      case "yellow":
        return "text-yellow-500";
      case "green":
        return "text-green-500";
      case "brown":
        return "text-amber-700";
      default:
        return "text-muted-foreground";
    }
  };
