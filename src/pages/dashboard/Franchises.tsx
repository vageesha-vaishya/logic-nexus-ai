import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Store, FileDown, FileUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCRM } from '@/hooks/useCRM';
import { ImportFranchiseModal } from '@/components/admin/ImportFranchiseModal';
import Papa from 'papaparse';
import { FirstScreenTemplate } from '@/components/system/FirstScreenTemplate';
import { EmptyState } from '@/components/system/EmptyState';
import { ViewMode } from '@/components/ui/view-toggle';
import { EntityCard } from '@/components/system/EntityCard';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TenantFranchiseMappingList } from "@/components/franchise/TenantFranchiseMappingList";

export default function Franchises() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { context, scopedDb } = useCRM();
  const [franchises, setFranchises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const fetchFranchises = useCallback(async () => {
    try {
      const { data, error } = await scopedDb
        .from('franchises')
        // Disambiguate embed: direct FK franchises.tenant_id -> tenants.id
        // Avoid PostgREST error: more than one relationship between franchises and tenants
        .select('*, tenants:tenants!franchises_tenant_id_fkey(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFranchises(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [scopedDb, toast]);

  useEffect(() => {
    fetchFranchises();
  }, [fetchFranchises]);

  const handleExport = () => {
    try {
      const exportData = franchises.map(f => ({
        name: f.name,
        code: f.code,
        tenant: f.tenants?.name,
        status: f.is_active ? 'Active' : 'Inactive',
        created_at: new Date(f.created_at).toLocaleDateString(),
        street: f.address?.street || '',
        city: f.address?.city || '',
        state: f.address?.state || '',
        zip: f.address?.zip || '',
        country: f.address?.country || '',
        phone: f.address?.contact?.phone || '',
        email: f.address?.contact?.email || '',
      }));

      const csv = Papa.unparse(exportData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `franchises_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      
      toast({
        title: 'Success',
        description: 'Franchises exported successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export franchises',
        variant: 'destructive',
      });
    }
  };

  return (
    <DashboardLayout>
      <FirstScreenTemplate
        title="Franchises"
        description="Manage franchise locations"
        breadcrumbs={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'Franchises' },
        ]}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        availableModes={['card', 'grid', 'list']}
        onImport={() => setIsImportModalOpen(true)}
        onExport={handleExport}
        onCreate={() => navigate('/dashboard/franchises/new')}
      >

        <ImportFranchiseModal 
          open={isImportModalOpen} 
          onOpenChange={setIsImportModalOpen}
          onImportComplete={fetchFranchises}
        />

        <Tabs defaultValue="franchises" className="space-y-4">
          <TabsList>
            <TabsTrigger value="franchises">Franchises</TabsTrigger>
            <TabsTrigger value="mappings">Tenant Mappings</TabsTrigger>
          </TabsList>

          <TabsContent value="franchises">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  All Franchises
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : franchises.length === 0 ? (
                  <EmptyState
                    title="No franchises found"
                    description="Create your first franchise to get started."
                    actionLabel="New Franchise"
                    onAction={() => navigate('/dashboard/franchises/new')}
                  />
                ) : viewMode === 'list' ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {franchises.map((franchise) => (
                        <TableRow
                          key={franchise.id}
                          className="cursor-pointer"
                          onClick={() => navigate(`/dashboard/franchises/${franchise.id}`)}
                        >
                          <TableCell className="font-medium">{franchise.name}</TableCell>
                          <TableCell>{franchise.code}</TableCell>
                          <TableCell>{franchise.tenants?.name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={franchise.is_active ? 'default' : 'secondary'}>
                              {franchise.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(franchise.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {franchises.map((f) => (
                      <EntityCard
                        key={f.id}
                        title={f.name}
                        subtitle={`${f.code} • ${f.tenants?.name || '—'}`}
                        meta={`Created ${new Date(f.created_at).toLocaleDateString()}`}
                        tags={[f.is_active ? 'Active' : 'Inactive']}
                        onClick={() => navigate(`/dashboard/franchises/${f.id}`)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {franchises.map((f) => (
                      <EntityCard
                        key={f.id}
                        title={f.name}
                        subtitle={`${f.code} • ${f.tenants?.name || '—'}`}
                        meta={`Created ${new Date(f.created_at).toLocaleDateString()}`}
                        tags={[f.is_active ? 'Active' : 'Inactive']}
                        onClick={() => navigate(`/dashboard/franchises/${f.id}`)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mappings">
            <TenantFranchiseMappingList data={franchises} loading={loading} />
          </TabsContent>
        </Tabs>
      </FirstScreenTemplate>
    </DashboardLayout>
  );
}
