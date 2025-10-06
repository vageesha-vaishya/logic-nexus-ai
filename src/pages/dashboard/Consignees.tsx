import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ConsigneeForm } from '@/components/logistics/ConsigneeForm';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function Consignees() {
  const navigate = useNavigate();
  const { supabase, context } = useCRM();
  const { roles } = useAuth();
  const [consignees, setConsignees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (context.tenantId || roles?.[0]?.tenant_id) {
      fetchConsignees();
    } else {
      setLoading(false);
    }
  }, [context.tenantId, roles]);

  const fetchConsignees = async () => {
    const tenantId = context.tenantId || roles?.[0]?.tenant_id;
    if (!tenantId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('consignees')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('company_name');

      if (error) throw error;
      setConsignees(data || []);
    } catch (error: any) {
      toast.error('Failed to load consignees', {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    setDialogOpen(false);
    fetchConsignees();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Consignees</h1>
            <p className="text-muted-foreground">Manage shipping consignees and receivers</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Consignee
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Consignee</DialogTitle>
              </DialogHeader>
              <ConsigneeForm onSuccess={handleSuccess} />
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Consignees</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading consignees...</div>
            ) : consignees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No consignees found. Create your first consignee to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Tax ID</TableHead>
                    <TableHead>Customs ID</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consignees.map((consignee) => (
                    <TableRow key={consignee.id}>
                      <TableCell className="font-medium">{consignee.company_name}</TableCell>
                      <TableCell>
                        {consignee.contact_person && (
                          <div className="text-sm">
                            <div>{consignee.contact_person}</div>
                            {consignee.contact_email && (
                              <div className="text-muted-foreground">{consignee.contact_email}</div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{consignee.tax_id || 'N/A'}</TableCell>
                      <TableCell>{consignee.customs_id || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={consignee.is_active ? 'default' : 'secondary'}>
                          {consignee.is_active ? 'Active' : 'Inactive'}
                        </Badge>
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
