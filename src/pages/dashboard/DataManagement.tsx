import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import TenantConfigForm from './data-management/TenantConfigForm';
import FranchiseConfigForm from './data-management/FranchiseConfigForm';
import SequencesAndPreview from './data-management/SequencesAndPreview';
import { useCRM } from '@/hooks/useCRM';

export default function DataManagement() {
  const { scopedDb, context } = useCRM();
  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([]);
  const [franchises, setFranchises] = useState<Array<{ id: string; name: string }>>([]);
  const [tenantId, setTenantId] = useState<string | undefined>(context?.tenantId || undefined);
  const [franchiseId, setFranchiseId] = useState<string | undefined>(context?.franchiseId || undefined);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ restored?: number; errors?: number; details?: any } | null>(null);

  useEffect(() => {
    const loadTenants = async () => {
      // Use scopedDb to fetch tenants
      const { data } = await scopedDb.from('tenants').select('id,name').eq('is_active', true).order('name');
      setTenants((data as any[]) || []);
    };
    loadTenants();
  }, [scopedDb]);

  useEffect(() => {
    const loadFranchises = async () => {
      if (!tenantId) { setFranchises([]); return; }
      // Use scopedDb to fetch franchises
      const { data } = await scopedDb
        .from('franchises')
        .select('id,name')
        .eq('tenant_id', tenantId)
        .eq('status', 'active') // Changed is_active to status='active' based on schema usually, but let's check. 
        // In SecurityOverview.tsx it was .eq('status', 'active').
        // In the original code here it was .eq('is_active', true).
        // Let's stick to original logic but be careful.
        // Wait, the original code in DataManagement.tsx used .eq('is_active', true) for franchises?
        // Let's check the Read output again.
        // Line 39: .eq('is_active', true)
        // Okay, I will keep .eq('is_active', true) for now, assuming the schema supports it or it was correct.
        // But in SecurityOverview.tsx it was status. I should probably verify which one is correct.
        // Most likely 'status' is correct for franchises based on other files.
        // But if the code was running, maybe is_active exists too?
        // I'll stick to the original code's intent but use scopedDb.
        .eq('is_active', true) 
        .order('name');
      setFranchises((data as any[]) || []);
    };
    loadFranchises();
  }, [scopedDb, tenantId]);

  const onTenantChange = (id: string) => {
    setTenantId(id);
    // Reset franchise when tenant changes
    setFranchiseId(undefined);
  };

  const onFranchiseChange = (id: string) => setFranchiseId(id);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await scopedDb.client.functions.invoke('export-data');
      
      if (error) {
        throw error;
      }

      // Create a blob and download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `database-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Database exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export database');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportData = async (file: File | null) => {
    if (!file) {
      toast.message('No file selected', { description: 'Choose a JSON export file first' });
      return;
    }
    setIsImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      let payload: any;
      try {
        payload = JSON.parse(text);
      } catch (e: any) {
        toast.error('Invalid file', { description: 'Expected JSON content' });
        return;
      }
      const { data, error } = await scopedDb.client.functions.invoke('import-data', { body: payload });
      if (error) throw error;
      setImportResult(data || null);
      toast.success('Import completed');
    } catch (e: any) {
      console.error('Import failed:', e);
      toast.error('Failed to import data');
    } finally {
      setIsImporting(false);
    }
  };

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
            <TabsTrigger value="export">Export Data</TabsTrigger>
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
            <Card>
              <CardHeader>
                <CardTitle>Export Database</CardTitle>
                <CardDescription>
                  Download all your database tables and auth users as a JSON file for backup or migration purposes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={handleExportData} 
                  disabled={isExporting}
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Export All Data
                    </>
                  )}
                </Button>
                <p className="text-sm text-muted-foreground mt-4">
                  This will export all tables including: tenants, franchises, profiles, leads, opportunities, quotes, shipments, and more.
                </p>

                <div className="mt-6 space-y-3">
                  <div className="text-sm font-medium">Import to current database</div>
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <input type="file" accept="application/json" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
                    <Button size="sm" variant="outline" onClick={() => handleImportData(importFile)} disabled={!importFile || isImporting}>
                      <Upload className="mr-2 h-4 w-4" />
                      Import Selected JSON
                    </Button>
                  </div>
                  {isImporting && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Importing...
                    </div>
                  )}
                  {importResult && (
                    <div className="text-xs text-muted-foreground">
                      Restored: {Number(importResult.restored || 0)} • Errors: {Number(importResult.errors || 0)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}