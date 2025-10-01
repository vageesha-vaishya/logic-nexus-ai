import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCRM } from "@/hooks/useCRM";
import { Info, Save } from "lucide-react";

interface OAuthConfig {
  id?: string;
  provider: string;
  client_id: string;
  client_secret: string;
  tenant_id?: string;
  redirect_uri: string;
  is_active: boolean;
}

export function OAuthSettings() {
  const [office365Config, setOffice365Config] = useState<OAuthConfig>({
    provider: "office365",
    client_id: "",
    client_secret: "",
    tenant_id: "",
    redirect_uri: `${window.location.origin}/dashboard/email-management`,
    is_active: true,
  });

  const [gmailConfig, setGmailConfig] = useState<OAuthConfig>({
    provider: "gmail",
    client_id: "",
    client_secret: "",
    redirect_uri: `${window.location.origin}/dashboard/email-management`,
    is_active: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { context } = useCRM();

  useEffect(() => {
    fetchOAuthConfigs();
  }, []);

  const fetchOAuthConfigs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("oauth_configurations")
        .select("*")
        .eq("user_id", context.userId)
        .in("provider", ["office365", "gmail"]);

      if (error) throw error;

      if (data) {
        const office365 = data.find(c => c.provider === "office365");
        const gmail = data.find(c => c.provider === "gmail");

        if (office365) {
          setOffice365Config({
            ...office365Config,
            id: office365.id,
            client_id: office365.client_id || "",
            client_secret: office365.client_secret || "",
            tenant_id: office365.tenant_id || "",
            is_active: office365.is_active,
          });
        }

        if (gmail) {
          setGmailConfig({
            ...gmailConfig,
            id: gmail.id,
            client_id: gmail.client_id || "",
            client_secret: gmail.client_secret || "",
            is_active: gmail.is_active,
          });
        }
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

  const saveOAuthConfig = async (config: OAuthConfig, isOffice365: boolean) => {
    if (!config.client_id || !config.client_secret) {
      toast({
        title: "Error",
        description: "Client ID and Client Secret are required",
        variant: "destructive",
      });
      return;
    }

    if (isOffice365 && !config.tenant_id) {
      toast({
        title: "Error",
        description: "Tenant ID is required for Office 365",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const configData = {
        user_id: context.userId,
        tenant_id: context.tenantId,
        provider: config.provider,
        client_id: config.client_id,
        client_secret: config.client_secret,
        tenant_id_provider: isOffice365 ? config.tenant_id : null,
        redirect_uri: config.redirect_uri,
        is_active: config.is_active,
      };

      let error;
      if (config.id) {
        const { error: updateError } = await supabase
          .from("oauth_configurations")
          .update(configData)
          .eq("id", config.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from("oauth_configurations")
          .insert(configData);
        error = insertError;
      }

      if (error) throw error;

      toast({
        title: "Success",
        description: "OAuth configuration saved successfully",
      });

      fetchOAuthConfigs();
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

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading OAuth configurations...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">OAuth Settings</h2>
        <p className="text-muted-foreground">
          Configure OAuth credentials for email providers
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          These credentials are required to enable "Connect with Microsoft" and "Connect with Google" buttons.
          Keep your client secrets secure and never share them publicly.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="office365" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="office365">Office 365</TabsTrigger>
          <TabsTrigger value="gmail">Gmail</TabsTrigger>
        </TabsList>

        <TabsContent value="office365">
          <Card>
            <CardHeader>
              <CardTitle>Office 365 OAuth Configuration</CardTitle>
              <CardDescription>
                Configure your Azure AD app registration credentials
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <p className="font-semibold mb-2">How to get these credentials:</p>
                  <ol className="list-decimal ml-4 space-y-1">
                    <li>Go to Azure Portal → Azure Active Directory → App registrations</li>
                    <li>Create or select your app</li>
                    <li>Copy the "Application (client) ID"</li>
                    <li>Copy the "Directory (tenant) ID"</li>
                    <li>Go to "Certificates & secrets" → Create new client secret</li>
                    <li>Add redirect URI: <code className="bg-muted px-1 py-0.5 rounded">{office365Config.redirect_uri}</code></li>
                  </ol>
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <Label>Client ID (Application ID) *</Label>
                  <Input
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={office365Config.client_id}
                    onChange={(e) => setOffice365Config({ ...office365Config, client_id: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Client Secret *</Label>
                  <Input
                    type="password"
                    placeholder="Your client secret value"
                    value={office365Config.client_secret}
                    onChange={(e) => setOffice365Config({ ...office365Config, client_secret: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Tenant ID (Directory ID) *</Label>
                  <Input
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={office365Config.tenant_id}
                    onChange={(e) => setOffice365Config({ ...office365Config, tenant_id: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Redirect URI (Read-only)</Label>
                  <Input
                    value={office365Config.redirect_uri}
                    readOnly
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Add this exact URL to your Azure AD app's redirect URIs
                  </p>
                </div>

                <Button
                  onClick={() => saveOAuthConfig(office365Config, true)}
                  disabled={saving}
                  className="w-full"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Saving..." : "Save Office 365 Configuration"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gmail">
          <Card>
            <CardHeader>
              <CardTitle>Gmail OAuth Configuration</CardTitle>
              <CardDescription>
                Configure your Google Cloud Console OAuth credentials
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <p className="font-semibold mb-2">How to get these credentials:</p>
                  <ol className="list-decimal ml-4 space-y-1">
                    <li>Go to Google Cloud Console → APIs & Services → Credentials</li>
                    <li>Create OAuth 2.0 Client ID (Web application)</li>
                    <li>Copy the "Client ID"</li>
                    <li>Copy the "Client Secret"</li>
                    <li>Add authorized redirect URI: <code className="bg-muted px-1 py-0.5 rounded">{gmailConfig.redirect_uri}</code></li>
                    <li>Enable Gmail API in your project</li>
                  </ol>
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <Label>Client ID *</Label>
                  <Input
                    placeholder="xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com"
                    value={gmailConfig.client_id}
                    onChange={(e) => setGmailConfig({ ...gmailConfig, client_id: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Client Secret *</Label>
                  <Input
                    type="password"
                    placeholder="Your client secret value"
                    value={gmailConfig.client_secret}
                    onChange={(e) => setGmailConfig({ ...gmailConfig, client_secret: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Redirect URI (Read-only)</Label>
                  <Input
                    value={gmailConfig.redirect_uri}
                    readOnly
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Add this exact URL to your Google Cloud Console authorized redirect URIs
                  </p>
                </div>

                <Button
                  onClick={() => saveOAuthConfig(gmailConfig, false)}
                  disabled={saving}
                  className="w-full"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Saving..." : "Save Gmail Configuration"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
