import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TenantConfigForm from './data-management/TenantConfigForm';
import FranchiseConfigForm from './data-management/FranchiseConfigForm';
import SequencesAndPreview from './data-management/SequencesAndPreview';

export default function DataManagement() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Data Management Options</h1>
          <p className="text-muted-foreground">Configure quote numbering and preview sequences</p>
        </div>

        <Tabs defaultValue="tenant">
          <TabsList>
            <TabsTrigger value="tenant">Tenant Config</TabsTrigger>
            <TabsTrigger value="franchise">Franchise Config</TabsTrigger>
            <TabsTrigger value="preview">Sequences & Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="tenant" className="mt-4">
            <TenantConfigForm />
          </TabsContent>
          <TabsContent value="franchise" className="mt-4">
            <FranchiseConfigForm />
          </TabsContent>
          <TabsContent value="preview" className="mt-4">
            <SequencesAndPreview />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}