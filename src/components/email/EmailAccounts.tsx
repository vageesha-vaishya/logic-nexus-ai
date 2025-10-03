import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Mail, Settings, RefreshCw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EmailAccountDialog } from "./EmailAccountDialog";
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
}

export function EmailAccounts() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
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
      const { error } = await supabase.functions.invoke("sync-emails", {
        body: { accountId },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Email sync started",
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

  const getProviderBadge = (provider: string) => {
    const colors: Record<string, string> = {
      office365: "bg-blue-500/10 text-blue-500",
      gmail: "bg-red-500/10 text-red-500",
      smtp_imap: "bg-purple-500/10 text-purple-500",
      other: "bg-gray-500/10 text-gray-500",
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
        <Button onClick={() => setShowDialog(true)} size="lg" className="gap-2">
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
                {account.last_sync_at && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                    <RefreshCw className="w-3 h-3" />
                    Last synced: {format(new Date(account.last_sync_at), "MMM d, yyyy 'at' h:mm a")}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncAccount(account.id)}
                    className="flex-1"
                  >
                    <RefreshCw className="w-3 h-3 mr-2" />
                    Sync
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
    </div>
  );
}