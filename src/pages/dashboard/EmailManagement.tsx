import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailInbox } from "@/components/email/EmailInbox";
import { EmailAccounts } from "@/components/email/EmailAccounts";
import { EmailFilters } from "@/components/email/EmailFilters";
import { EmailTemplates } from "@/components/email/EmailTemplates";
import { OAuthSettings } from "@/components/email/OAuthSettings";
import { Mail, Settings, Filter, FileText, Key, Inbox, Server, Link as LinkIcon, Copy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmailClientSettings } from "@/components/email/EmailClientSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function EmailManagement() {
  const [activeTab, setActiveTab] = useState("inbox");
  const baseUrl = useMemo(() => {
    const env = (import.meta as any).env || {};
    const url = env.VITE_SUPABASE_URL || "http://localhost:54321";
    return String(url).replace(/\/$/, "");
  }, []);
  const endpoint = `${baseUrl}/functions/v1/lead-event-webhook`;
  const sampleCurlEvent = useMemo(
    () =>
      `curl -X POST "${endpoint}" \\\n  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "lead_id": "00000000-0000-0000-0000-000000000000",\n    "type": "form_submission",\n    "metadata": { "form_id": "contact-us" }\n  }'`,
    [endpoint]
  );
  const sampleCurlIntake = useMemo(
    () =>
      `curl -X POST "${endpoint}" \\\n  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "tenant_id": "11111111-1111-1111-1111-111111111111",\n    "first_name": "Ava",\n    "last_name": "Ng",\n    "email": "ava@example.com",\n    "mode": "web_form",\n    "metadata": { "form_id": "contact-us" }\n  }'`,
    [endpoint]
  );
  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Failed to copy ${label.toLowerCase()}`);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-8">
        {/* Header Section */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-lg -z-10" />
          <div className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Email Management</h1>
            </div>
            <p className="text-muted-foreground ml-14">
              Centralize your email communication with intelligent inbox management, account integration, and automation
            </p>
          </div>
        </div>

        {/* Tabs Card */}
        <Card className="overflow-hidden border-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b bg-muted/30">
              <TabsList className="w-full justify-start h-auto p-0 bg-transparent rounded-none flex-wrap">
                <TabsTrigger 
                  value="inbox" 
                  className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3"
                >
                  <Inbox className="w-4 h-4" />
                  <span className="font-medium">Inbox</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="accounts" 
                  className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3"
                >
                  <Settings className="w-4 h-4" />
                  <span className="font-medium">Accounts</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="clients" 
                  className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3"
                >
                  <Server className="w-4 h-4" />
                  <span className="font-medium">Client Settings</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="oauth" 
                  className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3"
                >
                  <Key className="w-4 h-4" />
                  <span className="font-medium">OAuth Settings</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="filters" 
                  className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3"
                >
                  <Filter className="w-4 h-4" />
                  <span className="font-medium">Filters</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="templates" 
                  className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3"
                >
                  <FileText className="w-4 h-4" />
                  <span className="font-medium">Templates</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="integrations" 
                  className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3"
                >
                  <LinkIcon className="w-4 h-4" />
                  <span className="font-medium">Integrations</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="p-6">
              <TabsContent value="inbox" className="mt-0">
                <EmailInbox />
              </TabsContent>

              <TabsContent value="accounts" className="mt-0">
                <EmailAccounts />
              </TabsContent>

              <TabsContent value="clients" className="mt-0">
                <EmailClientSettings />
              </TabsContent>

              <TabsContent value="oauth" className="mt-0">
                <OAuthSettings />
              </TabsContent>

              <TabsContent value="filters" className="mt-0">
                <EmailFilters />
              </TabsContent>

              <TabsContent value="templates" className="mt-0">
                <EmailTemplates />
              </TabsContent>
              
              <TabsContent value="integrations" className="mt-0">
                <div className="grid gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <LinkIcon className="w-5 h-5" />
                        Lead Intake Webhook
                      </CardTitle>
                      <CardDescription>Use this endpoint to log events and capture leads from web forms and chatbots.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Endpoint URL</Label>
                        <div className="flex items-center gap-2">
                          <Input readOnly value={endpoint} />
                          <Button variant="outline" size="icon" onClick={() => copy(endpoint, "Endpoint URL")} title="Copy Endpoint">
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Sample cURL (Event for existing lead)</Label>
                        <div className="flex items-start gap-2">
                          <textarea readOnly className="w-full h-40 rounded-md border bg-muted/30 p-3 font-mono text-xs" value={sampleCurlEvent} />
                          <Button variant="outline" size="icon" onClick={() => copy(sampleCurlEvent, "Sample cURL")} title="Copy cURL">
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Sample cURL (Web form intake)</Label>
                        <div className="flex items-start gap-2">
                          <textarea readOnly className="w-full h-40 rounded-md border bg-muted/30 p-3 font-mono text-xs" value={sampleCurlIntake} />
                          <Button variant="outline" size="icon" onClick={() => copy(sampleCurlIntake, "Sample cURL")} title="Copy cURL">
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </Card>
      </div>
    </DashboardLayout>
  );
}
