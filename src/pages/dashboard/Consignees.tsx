import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ConsigneeForm } from '@/components/logistics/ConsigneeForm';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Consignee } from '@/domain/common/types';
import { ScopedDataAccess, DataAccessContext } from '@/lib/db/access';

export default function Consignees() {
  const navigate = useNavigate();
  const { supabase, context } = useCRM();
  const { roles } = useAuth();
  const [consignees, setConsignees] = useState<Consignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingConsigneeId, setEditingConsigneeId] = useState<string | undefined>(undefined);
  const [filterName, setFilterName] = useState('');
  const [filterContact, setFilterContact] = useState('');
  const [filterTaxId, setFilterTaxId] = useState('');
  const [filterCustomsId, setFilterCustomsId] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    fetchConsignees();
  }, [context]);

  const fetchConsignees = async () => {
    try {
      const dao = new ScopedDataAccess(supabase, context as unknown as DataAccessContext);
      const { data, error } = await dao
        .from('consignees')
        .select('id, tenant_id, company_name, contact_person, contact_email, tax_id, customs_id, is_active')
        .order('company_name');

      if (error) throw error;
      const rows = (data || []) as Consignee[];
      
      // Dev-only: auto-seed demo consignees if none exist (only when tenant scoped)
      if (!context.isPlatformAdmin && rows.length === 0 && import.meta.env.DEV) {
        try {
          await dao.from('consignees').insert([
            {
              company_name: 'Acme Imports',
              contact_person: 'Jamie Rivera',
              contact_email: 'jamie@acme-imports.example',
              tax_id: 'ACM-12345',
              customs_id: 'CUS-98765',
              is_active: true,
            },
            {
              company_name: 'Global Retail Ltd',
              contact_person: 'Priya Singh',
              contact_email: 'priya@globalretail.example',
              tax_id: 'GRL-67890',
              customs_id: 'CUS-24680',
              is_active: true,
            },
            {
              company_name: 'Pacific Pharmaceuticals',
              contact_person: 'Ethan Wu',
              contact_email: 'ethan@pacpharma.example',
              tax_id: 'PPH-11223',
              customs_id: 'CUS-13579',
              is_active: false,
            },
          ]);
          toast.success('Seeded demo consignees');
          // Refresh after seeding
          const { data: refreshed } = await dao
            .from('consignees')
            .select('id, tenant_id, company_name, contact_person, contact_email, tax_id, customs_id, is_active')
            .order('company_name');
          setConsignees((refreshed || []) as Consignee[]);
        } catch (seedError) {
          console.error('Auto-seed failed:', seedError);
          // If seeding fails, just show empty
          setConsignees([]);
        }
      } else {
        setConsignees(rows);
      }
    } catch (error: any) {
      toast.error('Failed to load consignees');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    setDialogOpen(false);
    fetchConsignees();
  };

  const handleEditSuccess = () => {
    setEditDialogOpen(false);
    setEditingConsigneeId(undefined);
    fetchConsignees();
  };

  const onEdit = (id: string) => {
    setEditingConsigneeId(id);
    setEditDialogOpen(true);
  };

  const onDelete = async (id: string) => {
    try {
      const dao = new ScopedDataAccess(supabase, context as unknown as DataAccessContext);
      const { error } = await dao.from('consignees').delete().eq('id', id);
      if (error) throw error;
      toast.success('Consignee deleted');
      fetchConsignees();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || 'Failed to delete consignee');
    }
  };

  const filteredConsignees = consignees.filter((c) => {
    const nameMatch = !filterName || (c.company_name || '').toLowerCase().includes(filterName.toLowerCase());
    const contactMatch = !filterContact || ((c.contact_person || '') + ' ' + (c.contact_email || '')).toLowerCase().includes(filterContact.toLowerCase());
    const taxMatch = !filterTaxId || (c.tax_id || '').toLowerCase().includes(filterTaxId.toLowerCase());
    const customsMatch = !filterCustomsId || (c.customs_id || '').toLowerCase().includes(filterCustomsId.toLowerCase());
    const statusMatch = filterStatus === 'all' || (filterStatus === 'active' ? !!c.is_active : !c.is_active);
    return nameMatch && contactMatch && taxMatch && customsMatch && statusMatch;
  });

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
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Company Name</label>
                <Input placeholder="Search name" value={filterName} onChange={(e) => setFilterName(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Contact/Email</label>
                <Input placeholder="Search contact" value={filterContact} onChange={(e) => setFilterContact(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Tax ID</label>
                <Input placeholder="Search tax id" value={filterTaxId} onChange={(e) => setFilterTaxId(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Customs ID</label>
                <Input placeholder="Search customs id" value={filterCustomsId} onChange={(e) => setFilterCustomsId(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Status</label>
                <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as 'all' | 'active' | 'inactive')}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Consignees</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading consignees...</div>
            ) : filteredConsignees.length === 0 ? (
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
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredConsignees.map((consignee) => (
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
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="icon" onClick={() => onEdit(consignee.id)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="icon" onClick={() => onDelete(consignee.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Consignee</DialogTitle>
            </DialogHeader>
            {editingConsigneeId && (
              <ConsigneeForm consigneeId={editingConsigneeId} onSuccess={handleEditSuccess} />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
