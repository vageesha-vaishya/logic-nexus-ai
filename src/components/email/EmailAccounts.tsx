import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Mail, Settings, RefreshCw, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { invokeFunction } from "@/lib/supabase-functions";
import { EmailAccountDialog } from "./EmailAccountDialog";
import { EmailDelegationDialog } from "./EmailDelegationDialog";
import { format } from "date-fns";

interface EmailAccount {
  id: string;
  provider: string;
  email_address: string;
  display_name: string;
  is_primary: boolean;
  is_active: boolean;
  last_sync_at: string;
  created_at: string;
  access_token: string | null;
  user_id: string;
}

export function EmailAccounts() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showDelegationDialog, setShowDelegationDialog] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<EmailAccount | null>(null);
  const { toast } = useToast();

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("email_accounts")
        .select("*")
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
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
    fetchAccounts();
  }, []);

  const handleDelete = async (accountId: string) => {
    if (!confirm("Are you sure you want to delete this email account?")) return;

    try {
      const { error } = await supabase
        .from("email_accounts")
        .delete()
        .eq("id", accountId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Email account deleted successfully",
      });
      fetchAccounts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const syncAccount = async (accountId: string) => {
    try {
      // invokeFunction handles Authorization header and 401 retries automatically
      const { data, error } = await invokeFunction("sync-emails-v2", {
        body: { accountId },
      });

      // If edge function returned non-2xx, error is set
      if (error) {
        let msg = error.message;
        if (msg.includes("non-2xx")) {
           const status = (error as any)?.context?.status;
           if (status === 401) {
              console.error("Sync Unauthorized after retry. Full error:", error);
              if ((error as any)?.context) {
                 console.error("Error context:", (error as any).context);
              }
              toast({ title: "Sync Unauthorized", description: "Session expired. Please log out and log in again.", variant: "destructive" });
              return;
           } else if (status === 504) {
              msg = "Sync service timed out. Please try again later.";
           } else {
              msg = `Sync service unavailable (Status: ${status || 'Unknown'}).`;
           }
        }
        throw new Error(msg);
      }

      // If function handled errors itself with success=false
      if (data && (data as any).success === false) {
        const msg = (data as any).error || "Sync failed";
        if ((data as any).code === "AUTH_REQUIRED") {
          toast({
            title: "Authorization Required",
            description: "Please re-authorize your account using the 'Re-authorize' button below.",
            variant: "destructive",
          });
          fetchAccounts();
          return;
        }
        throw new Error(msg);
      }

      const count = (data as any)?.syncedCount ?? (data as any)?.emailCount ?? 0;
      toast({
        title: "Sync Complete",
        description: `Synced ${count} emails`,
      });
      fetchAccounts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message ?? "Edge function failed",
        variant: "destructive",
      });
    }
  };

  const handleReauthorize = async (account: EmailAccount) => {
    try {
      // Store hints for the callback (used when provider doesn't return profile info)
      sessionStorage.setItem("oauth_hint_email", account.email_address || "");
      sessionStorage.setItem("oauth_hint_name", account.display_name || "");
      sessionStorage.setItem("oauth_hint_is_primary", String(account.is_primary || false));
      sessionStorage.setItem("oauth_account_id", account.id);

      if (account.provider === 'gmail') {
        const { initiateGoogleOAuth } = await import('@/lib/oauth');
        await initiateGoogleOAuth(account.user_id);
      } else if (account.provider === 'office365') {
        const { initiateMicrosoftOAuth } = await import('@/lib/oauth');
        await initiateMicrosoftOAuth(account.user_id);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getProviderBadge = (provider: string) => {
    const colors: Record<string, string> = {
      office365: "bg-blue-500/10 text-blue-500",
      gmail: "bg-red-500/10 text-red-500",
      smtp_imap: "bg-purple-500/10 text-purple-500",
      pop3: "bg-amber-500/10 text-amber-600",
      other: "bg-foreground/10 text-foreground/80",
    };
    return colors[provider] || colors.other;
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Connected Accounts</h2>
          <p className="text-sm text-muted-foreground">
            Manage and sync your email accounts across multiple providers
          </p>
        </div>
        <Button onClick={() => setShowDialog(true)} size="lg" className="gap-2" aria-label="Connect Account">
          <Plus className="w-4 h-4" />
          Connect Account
        </Button>
      </div>

      {loading ? (
        <Card className="border-2">
          <CardContent className="flex items-center justify-center p-12">
            <div className="text-center space-y-3">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-primary" />
              <p className="text-muted-foreground">Loading your accounts...</p>
            </div>
          </CardContent>
        </Card>
      ) : accounts.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-16">
            <div className="p-4 rounded-full bg-primary/10 mb-4">
              <Mail className="w-12 h-12 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Accounts Connected</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Connect Gmail or Office 365 via OAuth for full email functionality (send & receive). SMTP/IMAP can only receive emails.
            </p>
            <Button onClick={() => setShowDialog(true)} size="lg" className="gap-2">
              <Plus className="w-4 h-4" />
              Connect Your First Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {accounts.map((account) => (
            <Card key={account.id} className="border-2 hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${
                    account.provider === 'gmail' ? 'bg-red-500/10' :
                    account.provider === 'office365' ? 'bg-blue-500/10' :
                    'bg-purple-500/10'
                  }`}>
                    <Mail className={`w-5 h-5 ${
                      account.provider === 'gmail' ? 'text-red-500' :
                      account.provider === 'office365' ? 'text-blue-500' :
                      'text-purple-500'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-lg truncate">
                        {account.display_name || account.email_address}
                      </CardTitle>
                      {account.is_primary && (
                        <Badge className="bg-primary/20 text-primary hover:bg-primary/30">
                          Primary
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`${getProviderBadge(account.provider)} border-0 font-medium`}
                      >
                        {account.provider.replace("_", " ").toUpperCase()}
                      </Badge>
                      <Badge 
                        variant="outline"
                        className={account.is_active 
                          ? "bg-green-500/10 text-green-600 border-green-200" 
                          : "bg-gray-500/10 text-gray-600 border-gray-200"
                        }
                      >
                        {account.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {account.email_address}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {!account.access_token && (account.provider === 'gmail' || account.provider === 'office365') && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3 mb-2">
                    <p className="text-xs text-yellow-600 dark:text-yellow-500 font-medium">
                      ⚠️ Authorization Required: Click 'Re-authorize' to complete OAuth setup
                    </p>
                  </div>
                )}
                {account.last_sync_at && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                    <RefreshCw className="w-3 h-3" />
                    Last synced: {format(new Date(account.last_sync_at), "MMM d, yyyy 'at' h:mm a")}
                  </div>
                )}
                <div className="flex gap-2">
                  {!account.access_token && (account.provider === 'gmail' || account.provider === 'office365') ? (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleReauthorize(account)}
                      className="flex-1"
                    >
                      <RefreshCw className="w-3 h-3 mr-2" />
                      Re-authorize
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncAccount(account.id)}
                      className="flex-1"
                    >
                      <RefreshCw className="w-3 h-3 mr-2" />
                      Sync
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedAccount(account);
                      setShowDelegationDialog(true);
                    }}
                    title="Share Inbox"
                  >
                    <Users className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedAccount(account);
                      setShowDialog(true);
                    }}
                  >
                    <Settings className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(account.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EmailAccountDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        account={selectedAccount}
        onSuccess={() => {
          setShowDialog(false);
          setSelectedAccount(null);
          fetchAccounts();
        }}
      />
      <EmailDelegationDialog
        open={showDelegationDialog}
        onOpenChange={setShowDelegationDialog}
        account={selectedAccount}
      />
    </div>
  );
}
