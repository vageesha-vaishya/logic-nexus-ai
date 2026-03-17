import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { FranchiseForm } from '@/components/admin/FranchiseForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Store, Trash2, ArrowLeft, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Papa from 'papaparse';
import { useCRM } from '@/hooks/useCRM';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';

export default function FranchiseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { context, scopedDb, supabase } = useCRM();
  const [franchise, setFranchise] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFranchise();
  }, [id]);

  const fetchFranchise = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || '';
      const search = new URLSearchParams();
      if (id) search.set('franchise_id', id);
      if (!context.isPlatformAdmin && context.tenantId) {
        search.set('tenant_id', context.tenantId);
      }
      const suffix = search.toString() ? `?${search.toString()}` : '';
      const response = await fetch(`/api/v1/franchises${suffix}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(!context.isPlatformAdmin && context.tenantId ? { 'x-tenant-id': context.tenantId } : {}),
        },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load franchise');
      }
      const row = Array.isArray(payload?.data) ? payload.data[0] || null : null;
      setFranchise(row);
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

  const handleDelete = async () => {
    try {
      if (!id) {
        throw new Error('Franchise scope missing');
      }
      if (!context.isPlatformAdmin && context.tenantId && franchise?.tenant_id !== context.tenantId) {
        throw new Error('Forbidden');
      }
      const { error } = await scopedDb
        .from('franchises')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Franchise deleted successfully',
      });
      navigate('/dashboard/franchises');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleExport = () => {
    try {
      const exportData = [{
        name: franchise.name,
        code: franchise.code,
        tenant_id: franchise.tenant_id,
        status: franchise.is_active ? 'Active' : 'Inactive',
        created_at: new Date(franchise.created_at).toLocaleDateString(),
        street: franchise.address?.street || '',
        city: franchise.address?.city || '',
        state: franchise.address?.state || '',
        zip: franchise.address?.zip || '',
        country: franchise.address?.country || '',
        phone: franchise.address?.contact?.phone || '',
        email: franchise.address?.contact?.email || '',
      }];

      const csv = Papa.unparse(exportData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${franchise.name.replace(/\s+/g, '_')}_export.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      
      toast({
        title: 'Success',
        description: 'Franchise exported successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export franchise',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-8">Loading...</div>
      </DashboardLayout>
    );
  }

  if (!franchise) {
    return (
      <DashboardLayout>
        <div className="text-center py-8">Franchise not found</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              <BreadcrumbSeparator />
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard/franchises">Franchises</BreadcrumbLink>
              <BreadcrumbSeparator />
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbPage>Detail</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/franchises')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{franchise.name}</h1>
              <p className="text-muted-foreground">Edit franchise details</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handleExport} title="Export">
              <FileDown className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Franchise</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this franchise? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Franchise Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FranchiseForm franchise={franchise} onSuccess={fetchFranchise} />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
