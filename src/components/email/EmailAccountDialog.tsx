import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCRM } from "@/hooks/useCRM";
import { initiateGoogleOAuth, initiateMicrosoftOAuth, handleOAuthCallback } from "@/lib/oauth";

interface EmailAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: any;
  onSuccess: () => void;
}

export function EmailAccountDialog({ open, onOpenChange, account, onSuccess }: EmailAccountDialogProps) {
  const [provider, setProvider] = useState("gmail");
  const [emailAddress, setEmailAddress] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [imapUsername, setImapUsername] = useState("");
  const [imapPassword, setImapPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { context } = useCRM();

  // Handle OAuth callback on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("code")) {
      handleOAuthCallbackFlow();
    }
  }, []);

  const handleOAuthCallbackFlow = async () => {
    try {
      const { code, provider } = await handleOAuthCallback();
      
      // Exchange code for tokens via edge function
      const { data, error } = await supabase.functions.invoke("exchange-oauth-token", {
        body: {
          code,
          provider,
          userId: context.userId,
          emailAddress,
          displayName,
          isPrimary,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Email account connected successfully",
      });

      // Clean up URL and close dialog
      window.history.replaceState({}, document.title, window.location.pathname);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleGoogleConnect = async () => {
    if (!emailAddress) {
      toast({
        title: "Error",
        description: "Please enter your email address first",
        variant: "destructive",
      });
      return;
    }

    try {
      // Persist hints for callback and for MSA tenant detection
      sessionStorage.setItem("oauth_hint_email", emailAddress);
      sessionStorage.setItem("oauth_hint_name", displayName || "");
      sessionStorage.setItem("oauth_hint_is_primary", String(isPrimary));
      sessionStorage.removeItem("oauth_account_id");
      await initiateGoogleOAuth(context.userId);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleMicrosoftConnect = async () => {
    if (!emailAddress) {
      toast({
        title: "Error",
        description: "Please enter your email address first",
        variant: "destructive",
      });
      return;
    }

    try {
      // Persist hints for callback and for MSA tenant detection in authorize step
      sessionStorage.setItem("oauth_hint_email", emailAddress);
      sessionStorage.setItem("oauth_hint_name", displayName || "");
      sessionStorage.setItem("oauth_hint_is_primary", String(isPrimary));
      sessionStorage.removeItem("oauth_account_id");
      await initiateMicrosoftOAuth(context.userId);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (account) {
      setProvider(account.provider);
      setEmailAddress(account.email_address);
      setDisplayName(account.display_name || "");
      setIsPrimary(account.is_primary);
      setSmtpHost(account.smtp_host || "");
      setSmtpPort(String(account.smtp_port || "587"));
      setSmtpUsername(account.smtp_username || "");
      setImapHost(account.imap_host || "");
      setImapPort(String(account.imap_port || "993"));
      setImapUsername(account.imap_username || "");
    } else {
      resetForm();
    }
  }, [account, open]);

  const resetForm = () => {
    setProvider("gmail");
    setEmailAddress("");
    setDisplayName("");
    setIsPrimary(false);
    setSmtpHost("");
    setSmtpPort("587");
    setSmtpUsername("");
    setSmtpPassword("");
    setImapHost("");
    setImapPort("993");
    setImapUsername("");
    setImapPassword("");
  };

  const handleSave = async () => {
    if (!emailAddress) {
      toast({
        title: "Error",
        description: "Email address is required",
        variant: "destructive",
      });
      return;
    }

    if (provider === "smtp_imap" && (!smtpHost || !imapHost)) {
      toast({
        title: "Error",
        description: "SMTP and IMAP settings are required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const accountData = {
        user_id: context.userId,
        tenant_id: context.tenantId,
        franchise_id: context.franchiseId,
        provider,
        email_address: emailAddress,
        display_name: displayName,
        is_primary: isPrimary,
        smtp_host: provider === "smtp_imap" ? smtpHost : null,
        smtp_port: provider === "smtp_imap" ? parseInt(smtpPort) : null,
        smtp_username: provider === "smtp_imap" ? smtpUsername : null,
        smtp_password: provider === "smtp_imap" && smtpPassword ? smtpPassword : undefined,
        imap_host: provider === "smtp_imap" ? imapHost : null,
        imap_port: provider === "smtp_imap" ? parseInt(imapPort) : null,
        imap_username: provider === "smtp_imap" ? imapUsername : null,
        imap_password: provider === "smtp_imap" && imapPassword ? imapPassword : undefined,
      };

      let error;
      if (account) {
        const { error: updateError } = await supabase
          .from("email_accounts")
          .update(accountData)
          .eq("id", account.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from("email_accounts")
          .insert(accountData);
        error = insertError;
      }

      if (error) throw error;

      toast({
        title: "Success",
        description: account ? "Account updated successfully" : "Account added successfully",
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{account ? "Edit" : "Add"} Email Account</DialogTitle>
        </DialogHeader>

        <Tabs value={provider} onValueChange={setProvider}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="gmail">Gmail</TabsTrigger>
            <TabsTrigger value="office365">Office 365</TabsTrigger>
            <TabsTrigger value="smtp_imap">SMTP/IMAP</TabsTrigger>
          </TabsList>

          <TabsContent value="gmail" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connect your Gmail account using OAuth authentication
            </p>
            <div className="space-y-4">
              <div>
                <Label>Email Address *</Label>
                <Input
                  type="email"
                  placeholder="you@gmail.com"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                />
              </div>
              <div>
                <Label>Display Name</Label>
                <Input
                  placeholder="Your Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={isPrimary} onCheckedChange={setIsPrimary} />
                <Label>Set as primary account</Label>
              </div>
              <Button variant="outline" className="w-full" onClick={handleGoogleConnect}>
                Connect with Google
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="office365" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connect your Office 365 account using OAuth authentication
            </p>
            <div className="space-y-4">
              <div>
                <Label>Email Address *</Label>
                <Input
                  type="email"
                  placeholder="you@company.com"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                />
              </div>
              <div>
                <Label>Display Name</Label>
                <Input
                  placeholder="Your Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={isPrimary} onCheckedChange={setIsPrimary} />
                <Label>Set as primary account</Label>
              </div>
              <Button variant="outline" className="w-full" onClick={handleMicrosoftConnect}>
                Connect with Microsoft
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="smtp_imap" className="space-y-4">
            <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 mb-4">
              <p className="text-sm text-yellow-600 dark:text-yellow-500 font-medium">
                ⚠️ SMTP/IMAP Limitation: Direct SMTP sending is blocked in cloud environments. This configuration can only receive emails (IMAP). For full send/receive capabilities, use Gmail or Office 365 OAuth above.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Email Address *</Label>
                <Input
                  type="email"
                  placeholder="you@domain.com"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                />
              </div>
              <div>
                <Label>Display Name</Label>
                <Input
                  placeholder="Your Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>SMTP Host *</Label>
                  <Input
                    placeholder="smtp.example.com"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                  />
                </div>
                <div>
                  <Label>SMTP Port *</Label>
                  <Input
                    placeholder="587"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>SMTP Username *</Label>
                <Input
                  placeholder="username"
                  value={smtpUsername}
                  onChange={(e) => setSmtpUsername(e.target.value)}
                />
              </div>

              <div>
                <Label>SMTP Password *</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>IMAP Host *</Label>
                  <Input
                    placeholder="imap.example.com"
                    value={imapHost}
                    onChange={(e) => setImapHost(e.target.value)}
                  />
                </div>
                <div>
                  <Label>IMAP Port *</Label>
                  <Input
                    placeholder="993"
                    value={imapPort}
                    onChange={(e) => setImapPort(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>IMAP Username *</Label>
                <Input
                  placeholder="username"
                  value={imapUsername}
                  onChange={(e) => setImapUsername(e.target.value)}
                />
              </div>

              <div>
                <Label>IMAP Password *</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={imapPassword}
                  onChange={(e) => setImapPassword(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={isPrimary} onCheckedChange={setIsPrimary} />
                <Label>Set as primary account</Label>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Account"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
