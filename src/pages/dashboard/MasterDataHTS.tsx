import { DashboardLayout } from '@/components/layout/DashboardLayout';
import AESHTSCodeManager from '@/components/aes-hts-code-manager';
import { VisualHTSBrowser } from '@/components/hts/VisualHTSBrowser';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function MasterDataHTS() {
  return (
    <DashboardLayout>
      <div className="mdm-template-page">
        <div>
          <h1 className="mdm-template-header-title">HTS Master Data</h1>
          <p className="mdm-template-header-subtitle">
            Manage and browse Harmonized Tariff Schedule codes and classifications.
          </p>
        </div>

        <Tabs defaultValue="browser" className="space-y-4">
          <TabsList className="mdm-template-tab-rail h-auto">
            <TabsTrigger value="browser" className="mdm-template-tab data-[state=active]:bg-[hsl(var(--mdm-template-focus))/0.14] data-[state=active]:text-[hsl(var(--mdm-template-heading))]">Visual Browser</TabsTrigger>
            <TabsTrigger value="management" className="mdm-template-tab data-[state=active]:bg-[hsl(var(--mdm-template-focus))/0.14] data-[state=active]:text-[hsl(var(--mdm-template-heading))]">Management & Search</TabsTrigger>
          </TabsList>
          
          <TabsContent value="browser" className="space-y-4">
            <div className="mdm-template-panel p-6">
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
