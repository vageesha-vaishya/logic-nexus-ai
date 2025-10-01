import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Store } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCRM } from '@/hooks/useCRM';

export default function Franchises() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { context } = useCRM();
  const [franchises, setFranchises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFranchises();
  }, []);

  const fetchFranchises = async () => {
    try {
      let query = supabase
        .from('franchises')
        .select('*, tenants(name)');

      // Filter by tenant if not platform_admin
      if (!context.isPlatformAdmin && context.tenantId) {
        query = query.eq('tenant_id', context.tenantId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

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
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Franchises</h1>
            <p className="text-muted-foreground">Manage franchise locations</p>
          </div>
          <Button onClick={() => navigate('/dashboard/franchises/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Franchise
          </Button>
        </div>

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
              <div className="text-center py-8 text-muted-foreground">
                No franchises found. Create your first franchise to get started.
              </div>
            ) : (
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
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
