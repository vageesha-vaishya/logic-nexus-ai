import { DashboardLayout } from '@/components/layout/DashboardLayout';
import AESHTSCodeManager from '@/components/aes-hts-code-manager';
import { VisualHTSBrowser } from '@/components/hts/VisualHTSBrowser';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function MasterDataHTS() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">HTS Master Data</h1>
          <p className="text-muted-foreground">
            Manage and browse Harmonized Tariff Schedule codes and classifications.
          </p>
        </div>

        <Tabs defaultValue="browser" className="space-y-4">
          <TabsList>
            <TabsTrigger value="browser">Visual Browser</TabsTrigger>
            <TabsTrigger value="management">Management & Search</TabsTrigger>
          </TabsList>
          
          <TabsContent value="browser" className="space-y-4">
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <VisualHTSBrowser />
            </div>
          </TabsContent>
          
          <TabsContent value="management" className="space-y-4">
            <AESHTSCodeManager />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}