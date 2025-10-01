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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Email Accounts</h2>
          <p className="text-muted-foreground">
            Connect and manage your email accounts
          </p>
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Account
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Loading accounts...
          </CardContent>
        </Card>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Mail className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">No email accounts connected</p>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg">
                        {account.display_name || account.email_address}
                      </CardTitle>
                      {account.is_primary && (
                        <Badge variant="default">Primary</Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={getProviderBadge(account.provider)}
                      >
                        {account.provider.replace("_", " ").toUpperCase()}
                      </Badge>
                      <Badge variant={account.is_active ? "default" : "secondary"}>
                        {account.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {account.email_address}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncAccount(account.id)}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedAccount(account);
                        setShowDialog(true);
                      }}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(account.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {account.last_sync_at && (
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Last synced: {format(new Date(account.last_sync_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </CardContent>
              )}
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
