import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailInbox } from "@/components/email/EmailInbox";
import { EmailAccounts } from "@/components/email/EmailAccounts";
import { EmailFilters } from "@/components/email/EmailFilters";
import { EmailTemplates } from "@/components/email/EmailTemplates";
import { OAuthSettings } from "@/components/email/OAuthSettings";
import { Mail, Settings, Filter, FileText, Key, Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function EmailManagement() {
  const [activeTab, setActiveTab] = useState("inbox");

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
              </TabsList>
            </div>

            <div className="p-6">
              <TabsContent value="inbox" className="mt-0">
                <EmailInbox />
              </TabsContent>

              <TabsContent value="accounts" className="mt-0">
                <EmailAccounts />
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
            </div>
          </Tabs>
        </Card>
      </div>
    </DashboardLayout>
  );
}