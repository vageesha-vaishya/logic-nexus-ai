import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TenantConfigForm from './data-management/TenantConfigForm';
import FranchiseConfigForm from './data-management/FranchiseConfigForm';
import SequencesAndPreview from './data-management/SequencesAndPreview';
import DatabaseExport from './data-management/DatabaseExport';
import { useCRM } from '@/hooks/useCRM';

export default function DataManagement() {
  const { supabase, context } = useCRM();
  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([]);
  const [franchises, setFranchises] = useState<Array<{ id: string; name: string }>>([]);
  const [tenantId, setTenantId] = useState<string | undefined>(context?.tenantId || undefined);
  const [franchiseId, setFranchiseId] = useState<string | undefined>(context?.franchiseId || undefined);

  useEffect(() => {
    const loadTenants = async () => {
      const { data } = await supabase.from('tenants').select('id,name').eq('is_active', true).order('name');
      setTenants(data || []);
    };
    loadTenants();
  }, [supabase]);

  useEffect(() => {
    const loadFranchises = async () => {
      if (!tenantId) { setFranchises([]); return; }
      const { data } = await supabase
        .from('franchises')
        .select('id,name')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name');
      setFranchises(data || []);
    };
    loadFranchises();
  }, [supabase, tenantId]);

  const onTenantChange = (id: string) => {
    setTenantId(id);
    // Reset franchise when tenant changes
    setFranchiseId(undefined);
  };

  const onFranchiseChange = (id: string) => setFranchiseId(id);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Data Management Options</h1>
          <p className="text-muted-foreground">Configure quote numbering and preview sequences</p>
        </div>

        {/* Context selectors to operate when implicit context is unavailable */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-sm font-medium mb-2">Tenant</div>
            <Select onValueChange={onTenantChange} value={tenantId}>
              <SelectTrigger>
                <SelectValue placeholder="Select tenant" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-sm font-medium mb-2">Franchise (optional)</div>
            <Select onValueChange={onFranchiseChange} value={franchiseId}>
              <SelectTrigger>
                <SelectValue placeholder={tenantId ? 'Select franchise' : 'Select tenant first'} />
              </SelectTrigger>
              <SelectContent>
                {franchises.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="tenant">
          <TabsList>
            <TabsTrigger value="tenant">Tenant Config</TabsTrigger>
            <TabsTrigger value="franchise">Franchise Config</TabsTrigger>
            <TabsTrigger value="preview">Sequences & Preview</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>
          <TabsContent value="tenant" className="mt-4">
            <TenantConfigForm tenantIdOverride={tenantId} />
          </TabsContent>
          <TabsContent value="franchise" className="mt-4">
            <FranchiseConfigForm tenantIdOverride={tenantId} franchiseIdOverride={franchiseId} />
          </TabsContent>
          <TabsContent value="preview" className="mt-4">
            <SequencesAndPreview tenantIdOverride={tenantId} franchiseIdOverride={franchiseId} />
          </TabsContent>
          <TabsContent value="export" className="mt-4">
            <DatabaseExport />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}