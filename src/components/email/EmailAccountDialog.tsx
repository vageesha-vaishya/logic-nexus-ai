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
  const [pop3Host, setPop3Host] = useState("");
  const [pop3Port, setPop3Port] = useState("995");
  const [pop3Username, setPop3Username] = useState("");
  const [pop3Password, setPop3Password] = useState("");
  const [pop3UseSsl, setPop3UseSsl] = useState(true);
  const [pop3DeletePolicy, setPop3DeletePolicy] = useState<"keep" | "delete_after_fetch">("keep");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpUseTls, setSmtpUseTls] = useState(true);
  const [testingPop3, setTestingPop3] = useState(false);
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [imapUsername, setImapUsername] = useState("");
  const [imapPassword, setImapPassword] = useState("");
  const [imapUseSsl, setImapUseSsl] = useState(true);
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
      setPop3Host(account.pop3_host || "");
      setPop3Port(String(account.pop3_port || "995"));
      setPop3Username(account.pop3_username || "");
      setPop3Password("");
      setPop3UseSsl(account.pop3_use_ssl !== false);
      setPop3DeletePolicy((account.pop3_delete_policy as any) || "keep");
      setSmtpHost(account.smtp_host || "");
      setSmtpPort(String(account.smtp_port || "587"));
      setSmtpUsername(account.smtp_username || "");
      setSmtpUseTls(account.smtp_use_tls !== false);
      setImapHost(account.imap_host || "");
      setImapPort(String(account.imap_port || "993"));
      setImapUsername(account.imap_username || "");
      setImapUseSsl(account.imap_use_ssl !== false);
    } else {
      resetForm();
    }
  }, [account, open]);

  const resetForm = () => {
    setProvider("gmail");
    setEmailAddress("");
    setDisplayName("");
    setIsPrimary(false);
    setPop3Host("");
    setPop3Port("995");
    setPop3Username("");
    setPop3Password("");
    setPop3UseSsl(true);
    setPop3DeletePolicy("keep");
    setSmtpHost("");
    setSmtpPort("587");
    setSmtpUsername("");
    setSmtpPassword("");
    setSmtpUseTls(true);
    setImapHost("");
    setImapPort("993");
    setImapUsername("");
    setImapPassword("");
    setImapUseSsl(true);
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
    if (provider === "pop3" && (!pop3Host || !pop3Username)) {
      toast({
        title: "Error",
        description: "POP3 host and username are required",
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
        pop3_host: provider === "pop3" ? pop3Host : null,
        pop3_port: provider === "pop3" ? parseInt(pop3Port) : null,
        pop3_username: provider === "pop3" ? pop3Username : null,
        pop3_password: provider === "pop3" && pop3Password ? pop3Password : undefined,
        pop3_use_ssl: provider === "pop3" ? pop3UseSsl : true,
        pop3_delete_policy: provider === "pop3" ? pop3DeletePolicy : "keep",
        smtp_host: provider === "smtp_imap" ? smtpHost : null,
        smtp_port: provider === "smtp_imap" ? parseInt(smtpPort) : null,
        smtp_username: provider === "smtp_imap" ? smtpUsername : null,
        smtp_password: provider === "smtp_imap" && smtpPassword ? smtpPassword : undefined,
        smtp_use_tls: provider === "smtp_imap" ? smtpUseTls : true,
        imap_host: provider === "smtp_imap" ? imapHost : null,
        imap_port: provider === "smtp_imap" ? parseInt(imapPort) : null,
        imap_username: provider === "smtp_imap" ? imapUsername : null,
        imap_password: provider === "smtp_imap" && imapPassword ? imapPassword : undefined,
        imap_use_ssl: provider === "smtp_imap" ? imapUseSsl : true,
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="gmail">Gmail</TabsTrigger>
            <TabsTrigger value="office365">Office 365</TabsTrigger>
            <TabsTrigger value="smtp_imap">SMTP/IMAP</TabsTrigger>
            <TabsTrigger value="pop3">POP3</TabsTrigger>
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

              <div className="flex items-center gap-2">
                <Switch checked={smtpUseTls} onCheckedChange={setSmtpUseTls} />
                <Label>Use TLS/SSL</Label>
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
                <Switch checked={imapUseSsl} onCheckedChange={setImapUseSsl} />
                <Label>Use SSL/TLS (IMAP)</Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={isPrimary} onCheckedChange={setIsPrimary} />
                <Label>Set as primary account</Label>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="pop3" className="space-y-4">
            <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 mb-4">
              <p className="text-sm text-yellow-600 dark:text-yellow-500 font-medium">
                POP3 receives emails and optionally deletes them from the server after fetching. Sending requires SMTP configured elsewhere.
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
                  <Label>POP3 Host *</Label>
                  <Input
                    placeholder="pop.example.com"
                    value={pop3Host}
                    onChange={(e) => setPop3Host(e.target.value)}
                  />
                </div>
                <div>
                  <Label>POP3 Port *</Label>
                  <Input
                    placeholder="995"
                    value={pop3Port}
                    onChange={(e) => setPop3Port(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>POP3 Username *</Label>
                <Input
                  placeholder="username"
                  value={pop3Username}
                  onChange={(e) => setPop3Username(e.target.value)}
                />
              </div>
              <div>
                <Label>POP3 Password *</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={pop3Password}
                  onChange={(e) => setPop3Password(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={pop3UseSsl} onCheckedChange={setPop3UseSsl} />
                <Label>Use SSL/TLS</Label>
              </div>
              <div className="space-y-2">
                <Label>Delete Policy</Label>
                <Select value={pop3DeletePolicy} onValueChange={(v) => setPop3DeletePolicy(v as any)}>
                  <SelectTrigger><SelectValue placeholder="Select policy" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keep">Keep on server</SelectItem>
                    <SelectItem value="delete_after_fetch">Delete after fetch</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Delete removes messages from the POP3 server after successful sync.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!pop3Host || !pop3Port || !pop3Username || !pop3Password) {
                      toast({ title: "Error", description: "Enter host, port, username, and password", variant: "destructive" });
                      return;
                    }
                    try {
                      setTestingPop3(true);
                      const { data: { session } } = await supabase.auth.getSession();
                      const { data, error } = await supabase.functions.invoke("sync-emails-v2", {
                        body: {
                          mode: "test_pop3",
                          pop3: {
                            hostname: pop3Host,
                            port: parseInt(pop3Port),
                            username: pop3Username,
                            password: pop3Password,
                            ssl: pop3UseSsl,
                          }
                        },
                        headers: session?.access_token 
                          ? { Authorization: `Bearer ${session.access_token}` }
                          : undefined,
                      });
                      if (error) throw error;
                      const ok = (data as any)?.success;
                      if (ok) {
                        toast({ title: "Connection successful", description: "POP3 credentials validated" });
                      } else {
                        const msg = (data as any)?.error || "Connection failed";
                        toast({ title: "Connection failed", description: msg, variant: "destructive" });
                      }
                    } catch (e: any) {
                      toast({ title: "Error", description: e.message || String(e), variant: "destructive" });
                    } finally {
                      setTestingPop3(false);
                    }
                  }}
                  disabled={testingPop3}
                >
                  {testingPop3 ? "Testing..." : "Test Connection"}
                </Button>
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
