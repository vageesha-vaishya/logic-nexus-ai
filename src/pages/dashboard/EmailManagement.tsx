import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailInbox } from "@/components/email/EmailInbox";
import { EmailAccounts } from "@/components/email/EmailAccounts";
import { EmailFilters } from "@/components/email/EmailFilters";
import { EmailTemplates } from "@/components/email/EmailTemplates";
import { OAuthSettings } from "@/components/email/OAuthSettings";
import { Mail, Settings, Filter, FileText, Key } from "lucide-react";

export default function EmailManagement() {
  const [activeTab, setActiveTab] = useState("inbox");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Email Management</h1>
          <p className="text-muted-foreground">
            Manage your emails, accounts, filters, and templates
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="inbox" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              <span>Inbox</span>
            </TabsTrigger>
            <TabsTrigger value="accounts" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span>Accounts</span>
            </TabsTrigger>
            <TabsTrigger value="oauth" className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              <span>OAuth</span>
            </TabsTrigger>
            <TabsTrigger value="filters" className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              <span>Filters</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>Templates</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inbox">
            <EmailInbox />
          </TabsContent>

          <TabsContent value="accounts">
            <EmailAccounts />
          </TabsContent>

          <TabsContent value="oauth">
            <OAuthSettings />
          </TabsContent>

          <TabsContent value="filters">
            <EmailFilters />
          </TabsContent>

          <TabsContent value="templates">
            <EmailTemplates />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
