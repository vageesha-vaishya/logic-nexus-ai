import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FirstScreenTemplate } from '@/components/system/FirstScreenTemplate';
import { EmptyState } from '@/components/system/EmptyState';
import { ViewMode } from '@/components/ui/view-toggle';
import { EntityCard } from '@/components/system/EntityCard';

export default function Tenants() {
  const navigate = useNavigate();
  const { toast } = useToast();
  interface Tenant {
    id: string;
    name: string;
    slug: string;
    domain: string | null;
    domain_id?: string; // Added new field
    subscription_tier: string | null;
    is_active: boolean;
    created_at: string;
  }
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTenants(data || []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <FirstScreenTemplate
        title="Tenants"
        description="Manage organization tenants"
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Tenants' }]}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        availableModes={['card', 'grid', 'list']}
        onCreate={() => navigate('/dashboard/tenants/new')}
      >

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              All Tenants
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : tenants.length === 0 ? (
              <EmptyState
                title="No tenants found"
                description="Create your first tenant to get started."
                actionLabel="New Tenant"
                onAction={() => navigate('/dashboard/tenants/new')}
              />
            ) : viewMode === 'list' ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Subscription</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((tenant) => (
                    <TableRow
                      key={tenant.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/dashboard/tenants/${tenant.id}`)}
                    >
                      <TableCell className="font-medium">{tenant.name}</TableCell>
                      <TableCell>{tenant.slug}</TableCell>
                      <TableCell>{tenant.domain || '-'}</TableCell>
                      <TableCell>{tenant.subscription_tier || 'Free'}</TableCell>
                      <TableCell>
                        <Badge variant={tenant.is_active ? 'default' : 'secondary'}>
                          {tenant.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(tenant.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {tenants.map((t) => (
                  <EntityCard
                    key={t.id}
                    title={t.name}
                    subtitle={`${t.slug} • ${t.subscription_tier || 'Free'}`}
                    meta={`Created ${new Date(t.created_at).toLocaleDateString()}`}
                    tags={[t.is_active ? 'Active' : 'Inactive']}
                    onClick={() => navigate(`/dashboard/tenants/${t.id}`)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {tenants.map((t) => (
                  <EntityCard
                    key={t.id}
                    title={t.name}
                    subtitle={`${t.slug} • ${t.subscription_tier || 'Free'}`}
                    meta={`Created ${new Date(t.created_at).toLocaleDateString()}`}
                    tags={[t.is_active ? 'Active' : 'Inactive']}
                    onClick={() => navigate(`/dashboard/tenants/${t.id}`)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </FirstScreenTemplate>
    </DashboardLayout>
  );
}
