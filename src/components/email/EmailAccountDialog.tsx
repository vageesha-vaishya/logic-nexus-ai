import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { invokeFunction } from "@/lib/supabase-functions";
import { Loader2, ArrowLeft } from "lucide-react";
import { useCRM } from "@/hooks/useCRM";
import { initiateGoogleOAuth, initiateMicrosoftOAuth, handleOAuthCallback } from "@/lib/oauth";
import { emailPluginRegistry } from "@/services/email/EmailPluginRegistry";
import { EmailAccountForm } from "./EmailAccountForm";
import { EmailAutoSetup } from "./EmailAutoSetup";

interface EmailAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: any;
  onSuccess: () => void;
}

export function EmailAccountDialog({ open, onOpenChange, account, onSuccess }: EmailAccountDialogProps) {
  const [providerId, setProviderId] = useState("gmail");
  const [formConfig, setFormConfig] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
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
      const { data, error } = await invokeFunction("exchange-oauth-token", {
        body: {
          code,
          provider,
          userId: context.userId,
          emailAddress: sessionStorage.getItem("oauth_hint_email"),
          displayName: sessionStorage.getItem("oauth_hint_name"),
          isPrimary: sessionStorage.getItem("oauth_hint_is_primary") === "true",
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

  useEffect(() => {
    if (account) {
      setMode('manual');
      setProviderId(account.provider);
      setFormConfig({
          ...account,
          is_primary: account.is_primary,
          smtp_use_tls: account.smtp_use_tls !== false,
          imap_use_ssl: account.imap_use_ssl !== false,
      });
    } else {
      setMode('auto');
      setFormConfig({});
    }
  }, [account, open]);

  const handleConnect = async (provider: string) => {
    const { email_address, display_name, is_primary } = formConfig;

    if (!email_address) {
      toast({
        title: "Error",
        description: "Please enter your email address first",
        variant: "destructive",
      });
      return;
    }

    try {
      // Store hints for callback
      sessionStorage.setItem("oauth_hint_email", email_address);
      sessionStorage.setItem("oauth_hint_name", display_name || email_address.split('@')[0]);
      sessionStorage.setItem("oauth_hint_is_primary", String(is_primary));

      if (provider === "gmail") {
        initiateGoogleOAuth(context.userId || (supabase.auth.getUser() as any)?.id);
      } else if (provider === "office365") {
        initiateMicrosoftOAuth(context.userId || (supabase.auth.getUser() as any)?.id);
      } else {
        // Manual/Other
        setMode('manual');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    const provider = emailPluginRegistry.getPlugin(providerId);
    if (!provider) return;

    // Validate config
    const validation = await provider.validateConfig(formConfig);
    if (!validation.isValid) {
        toast({
            title: "Error",
            description: validation.error || "Invalid configuration",
            variant: "destructive"
        });
        return;
    }

    setSaving(true);
    try {
      const accountData = {
        user_id: context.userId,
        tenant_id: context.tenantId,
        franchise_id: context.franchiseId,
        provider: providerId,
        ...formConfig
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
          <DialogTitle>
             {mode === 'manual' && !account && (
               <Button variant="ghost" size="sm" onClick={() => setMode('auto')} className="mr-2 -ml-2">
                 <ArrowLeft className="w-4 h-4" />
               </Button>
             )}
             {account ? "Edit" : (mode === 'auto' ? "Add" : "Manual Configure")} Email Account
          </DialogTitle>
        </DialogHeader>

        {mode === 'auto' && !account ? (
          <EmailAutoSetup 
            onSuccess={() => {
              onSuccess();
            }}
            onManual={() => setMode('manual')}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <Tabs value={providerId} onValueChange={setProviderId}>
            <TabsList className="w-full flex flex-wrap h-auto">
               {emailPluginRegistry.getAllPlugins().map(p => (
                  <TabsTrigger key={p.id} value={p.id} className="flex-1 min-w-[100px]">{p.name}</TabsTrigger>
               ))}
            </TabsList>

            {emailPluginRegistry.getAllPlugins().map(p => (
              <TabsContent key={p.id} value={p.id} className="space-y-4 mt-4">
                 <p className="text-sm text-muted-foreground">{p.description}</p>
                 <EmailAccountForm 
                    providerId={p.id}
                    onChange={setFormConfig}
                    initialValues={formConfig}
                 />
                 
                 <div className="pt-4">
                   {p.requiresOAuth ? (
                      <Button onClick={() => handleConnect(p.id)} className="w-full">
                         Connect with {p.name}
                      </Button>
                   ) : (
                      <Button onClick={handleSave} className="w-full" disabled={saving}>
                         {saving ? <Loader2 className="animate-spin mr-2" /> : null}
                         Save Account
                      </Button>
                   )}
                 </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
