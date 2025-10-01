import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Mail, Search, RefreshCw, Star, Archive, Trash2, 
  Plus, Paperclip 
} from "lucide-react";
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
  const { toast } = useToast();
  const { roles } = useAuth();

  const getTenantId = () => {
    const tenantAdmin = roles.find((r) => r.role === "tenant_admin" && r.tenant_id);
    return tenantAdmin?.tenant_id || roles.find((r) => r.tenant_id)?.tenant_id || null;
  };
 
  const fetchEmails = async () => {
    try {
      setLoading(true);

      const looksLikeEmail = /@/.test(searchQuery.trim());
      const tenantId = getTenantId();

      if (searchQuery && looksLikeEmail) {
        const direction = selectedFolder === "inbox" ? "inbound" : selectedFolder === "sent" ? "outbound" : undefined;
        const { data, error } = await supabase.functions.invoke("search-emails", {
          body: { email: searchQuery.trim(), tenantId, direction, page: 1, pageSize: 50 },
        });
        if (error) throw error as any;
        setEmails((data?.data as Email[]) || []);
      } else {
        let query = supabase
          .from("emails")
          .select("*")
          .eq("folder", selectedFolder)
          .order("received_at", { ascending: false })
          .limit(50);

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
  }, [selectedFolder, searchQuery]);

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

  const syncEmails = async () => {
    try {
      setSyncing(true);
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const userId = authData.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const { data: accounts, error: accErr } = await supabase
        .from("email_accounts")
        .select("id, is_primary")
        .eq("user_id", userId)
        .order("is_primary", { ascending: false })
        .limit(1);
      if (accErr) throw accErr;
      if (!accounts || accounts.length === 0) {
        toast({
          title: "No email account",
          description: "Please add an email account first.",
          variant: "destructive",
        });
        return;
      }

      const accountId = accounts[0].id as string;
      const { data, error } = await supabase.functions.invoke("sync-emails", {
        body: { accountId },
      });
      if (error) throw error as any;
      toast({
        title: "Synced",
        description: data?.message || "Email sync complete.",
      });
      await fetchEmails();
    } catch (error: any) {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const syncAllMailboxes = async () => {
    try {
      setSyncing(true);
      const tenantId = getTenantId();
      if (!tenantId) {
        throw new Error("No tenant found for current user");
      }
      const { data, error } = await supabase.functions.invoke("sync-all-mailboxes", {
        body: { tenantId, limit: 100 },
      });
      if (error) throw error as any;
      toast({ title: "Sync triggered", description: `Processed ${data?.accountsProcessed || 0} accounts` });
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

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg border">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-md bg-primary/10">
            <Mail className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Your Inbox</h3>
            <p className="text-xs text-muted-foreground">{emails.length} messages</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={fetchEmails} className="gap-2">
            <RefreshCw className="w-3 h-3" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={syncEmails} disabled={syncing} className="gap-2">
            <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
            Sync One
          </Button>
          <Button variant="outline" size="sm" onClick={syncAllMailboxes} disabled={syncing} className="gap-2">
            <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
            Sync All
          </Button>
          <Button size="sm" onClick={() => setShowCompose(true)} className="gap-2">
            <Plus className="w-3 h-3" />
            Compose
          </Button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by subject, sender, or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 border-2"
          />
        </div>
        <div className="w-full lg:w-auto overflow-x-auto">
          <Tabs value={selectedFolder} onValueChange={setSelectedFolder} className="min-w-max">
            <TabsList className="grid grid-cols-5 h-10">
              <TabsTrigger value="inbox" className="text-xs">Inbox</TabsTrigger>
              <TabsTrigger value="sent" className="text-xs">Sent</TabsTrigger>
              <TabsTrigger value="drafts" className="text-xs">Drafts</TabsTrigger>
              <TabsTrigger value="archive" className="text-xs">Archive</TabsTrigger>
              <TabsTrigger value="trash" className="text-xs">Trash</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Email List */}
      <Card className="border-2">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="text-center space-y-3">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading emails...</p>
            </div>
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Mail className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Emails Found</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              {searchQuery 
                ? "Try adjusting your search query or filters"
                : "Your inbox is empty. Start by syncing your email accounts."
              }
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {emails.map((email) => (
              <div
                key={email.id}
                className={`group p-4 hover:bg-muted/50 cursor-pointer transition-all duration-150 ${
                  !email.is_read ? "bg-primary/5 border-l-4 border-l-primary" : ""
                }`}
                onClick={() => handleEmailClick(email)}
              >
                <div className="flex items-start gap-3">
                  {/* Star Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStar(email.id, email.is_starred);
                    }}
                    className="mt-1 text-muted-foreground hover:text-warning transition-colors"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        email.is_starred ? "fill-warning text-warning" : ""
                      }`}
                    />
                  </button>

                  {/* Email Content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-sm truncate ${!email.is_read ? "font-bold" : "font-medium"}`}>
                          {email.from_name || email.from_email}
                        </span>
                        {email.has_attachments && (
                          <Paperclip className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(email.received_at), "MMM d, h:mm a")}
                      </span>
                    </div>

                    <div className={`text-sm truncate ${!email.is_read ? "font-semibold text-foreground" : "text-muted-foreground"}`}> 
                      {email.subject || "(No Subject)"}
                    </div>

                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {email.snippet}
                    </div>

                    {email.labels && email.labels.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {email.labels.slice(0, 3).map((label: any, idx: number) => (
                          <Badge key={idx} variant="secondary" className="text-[10px] px-2 py-0">
                            {label}
                          </Badge>
                        ))}
                        {email.labels.length > 3 && (
                          <Badge variant="secondary" className="text-[10px] px-2 py-0">
                            +{email.labels.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveToFolder(email.id, "archive");
                      }}
                      className="h-7 w-7 p-0"
                    >
                      <Archive className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveToFolder(email.id, "trash");
                      }}
                      className="h-7 w-7 p-0 hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

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