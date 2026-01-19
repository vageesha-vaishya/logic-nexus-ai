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
  Plus, Reply, Forward, MoreVertical, Paperclip, Flag, Circle, ArrowUpDown
} from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
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
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<"received_at" | "from_email" | "subject" | "priority">("received_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [conversationView, setConversationView] = useState(false);
  const [threads, setThreads] = useState<any[]>([]);
  const { toast } = useToast();
  const { roles } = useAuth();

  const autoSyncedRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (selectedAccountId && !autoSyncedRef.current[selectedAccountId]) {
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
        const { data, error } = await supabase.functions.invoke("search-emails", {
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
        const { data, error } = await supabase.functions.invoke("search-emails", {
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
        let query = supabase
          .from("emails")
          .select("*")
          .eq("folder", selectedFolder)
          .order(sortField, { ascending: sortDirection === "asc" })
          .limit(50);

        if (selectedAccountId) {
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
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, [selectedFolder, searchQuery, selectedAccountId, sortField, sortDirection, conversationView]);

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
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
      const { error } = await supabase
        .from("emails")
        .update({ is_read: true })
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

  const toggleStar = async (emailId: string, isStarred: boolean) => {
    try {
      const { error } = await supabase
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
      const { error } = await supabase
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
      const accountId = selectedAccountId as string | null;
      if (!accountId) {
        toast({ title: "Select a mailbox", description: "Please choose a mailbox from the selector before syncing.", variant: "destructive" });
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("sync-emails", {
        body: { accountId },
        headers: session?.access_token 
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined,
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
          message = "Email sync service is not reachable. Check that the sync-emails Edge Function is deployed and accessible.";
        } else if (rawMessage?.includes("Failed to fetch")) {
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
        const { data: { session } } = await supabase.auth.getSession();
        const { data, error } = await supabase.functions.invoke("sync-all-mailboxes", {
          body: { tenantId, limit: 100 },
          headers: session?.access_token 
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined,
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

      const { data: userAccounts, error: accErr } = await supabase
        .from("email_accounts")
        .select("id")
        .eq("user_id", userId)
        .eq("is_active", true);
      if (accErr) throw accErr;
      if (!userAccounts || userAccounts.length === 0) {
        toast({ title: "No accounts", description: "Add an email account first.", variant: "destructive" });
        return;
      }

      let totalSynced = 0;
      const { data: { session } } = await supabase.auth.getSession();
      for (const acc of userAccounts) {
        const { data, error } = await supabase.functions.invoke("sync-emails", {
          body: { accountId: acc.id },
          headers: session?.access_token 
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined,
        });
        if (error) {
          console.error("Sync error for account", acc.id, error);
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

  const updateEmailPriority = async (emailId: string, priority: string) => {
    try {
      const { error } = await supabase
        .from("emails")
        .update({ priority })
        .eq("id", emailId);
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
          <Select onValueChange={(v) => setSelectedAccountId(v)} value={selectedAccountId ?? undefined}>
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
                          {email.has_attachments && <Paperclip className="w-4 h-4 text-muted-foreground" />}
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
