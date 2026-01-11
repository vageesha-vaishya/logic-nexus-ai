import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, ArrowUp, ArrowDown } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CarrierForm } from '@/components/logistics/CarrierForm';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function Carriers() {
  const navigate = useNavigate();
  const { supabase, context, scopedDb } = useCRM();
  const { roles } = useAuth();
  const [carriers, setCarriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editCarrierId, setEditCarrierId] = useState<string | null>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [tenantNameById, setTenantNameById] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'carrier_name', direction: 'ascending' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const requestSort = (key: string) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const filteredCarriers = carriers.filter(carrier => {
    const searchTerms = searchTerm.toLowerCase().split(' ').filter(term => term.trim() !== '');
    if (searchTerms.length === 0) {
      return true;
    }

    return searchTerms.every(term => {
      const values = [
        carrier.carrier_name,
        context.isPlatformAdmin && (tenantNameById[carrier.tenant_id] || carrier.tenant_id),
        carrier.carrier_code,
        carrier.carrier_type,
        carrier.contact_person,
        carrier.contact_email,
        carrier.rating?.toString(),
        carrier.is_active ? 'active' : 'inactive',
      ];
      return values.some((val) =>
        val?.toString().toLowerCase().includes(term)
      );
    });
  });

  const sortedAndFilteredCarriers = [...filteredCarriers].sort((a, b) => {
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];

    if (sortConfig.key === 'tenant_id') {
      const aTenantName = tenantNameById[a.tenant_id] || '';
      const bTenantName = tenantNameById[b.tenant_id] || '';
      if (aTenantName < bTenantName) {
        return sortConfig.direction === 'ascending' ? -1 : 1;
      }
      if (aTenantName > bTenantName) {
        return sortConfig.direction === 'ascending' ? 1 : -1;
      }
      return 0;
    }

    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const comparison = aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' });
      return sortConfig.direction === 'ascending' ? comparison : -comparison;
    }

    if (aValue < bValue) {
      return sortConfig.direction === 'ascending' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortConfig.direction === 'ascending' ? 1 : -1;
    }
    return 0;
  });

  const totalPages = Math.ceil(sortedAndFilteredCarriers.length / itemsPerPage);
  const paginatedCarriers = sortedAndFilteredCarriers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value, 10));
    setCurrentPage(1);
  };

  const PaginationControls = () => (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">
        {sortedAndFilteredCarriers.length} carriers
      </span>
      <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
        <SelectTrigger className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="10">10 per page</SelectItem>
          <SelectItem value="20">20 per page</SelectItem>
          <SelectItem value="50">50 per page</SelectItem>
          <SelectItem value="100">100 per page</SelectItem>
          <SelectItem value={sortedAndFilteredCarriers.length.toString()}>All</SelectItem>
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePageChange(1)}
        disabled={currentPage === 1}
      >
        First
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        Previous
      </Button>
      <span className="text-sm">
        Page {currentPage} of {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Next
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePageChange(totalPages)}
        disabled={currentPage === totalPages}
      >
        Last
      </Button>
    </div>
  );

  useEffect(() => {
    if (context.isPlatformAdmin) {
      fetchTenants();
    }
    if (context.isPlatformAdmin || context.tenantId || roles?.[0]?.tenant_id) {
      fetchCarriers();
    } else {
      setLoading(false);
    }
  }, [context.isPlatformAdmin, context.tenantId, roles]);

  const fetchTenants = async () => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      const rows = data || [];
      setTenants(rows);
      const map: Record<string, string> = {};
      rows.forEach((t: any) => {
        map[t.id] = t.name;
      });
      setTenantNameById(map);
    } catch (err: any) {
      console.warn('Failed to fetch tenants:', err?.message || err);
    }
  };

  const fetchCarriers = async () => {
    const tenantId = context.tenantId || roles?.[0]?.tenant_id;
    const isPlatform = context.isPlatformAdmin;
    if (!isPlatform && !tenantId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await scopedDb
        .from('carriers')
        .select('*')
        .order('carrier_name');

      if (error) throw error;
      const rows = data || [];
      setCarriers(rows);
    } catch (error: any) {
      toast.error('Failed to load carriers', {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    setDialogOpen(false);
    setEditDialogOpen(false);
    setEditCarrierId(null);
    fetchCarriers();
  };

  const handleEdit = (id: string) => {
    setEditCarrierId(id);
    setEditDialogOpen(true);
  };

  const handleDeleteCarrier = async (id: string) => {
    if (!confirm('Delete this carrier? This action cannot be undone.')) return;
    try {
      const { error } = await scopedDb.from('carriers').delete().eq('id', id);
      if (error) throw error;
      toast.success('Carrier deleted');
      fetchCarriers();
    } catch (e: any) {
      toast.error('Failed to delete carrier', { description: e.message });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Carriers</h1>
            <p className="text-muted-foreground">Manage shipping carriers and service providers</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Carrier
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Carrier</DialogTitle>
              </DialogHeader>
              <CarrierForm onSuccess={handleSuccess} />
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>All Carriers</CardTitle>
            <PaginationControls />
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Input
                placeholder="Search carriers (e.g., name:Maersk type:ocean status:active)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading carriers...</div>
            ) : sortedAndFilteredCarriers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No carriers found.
              </div>
            ) : (
              <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer" onClick={() => requestSort('carrier_name')}>
                      Carrier Name
                      {sortConfig.key === 'carrier_name' && (sortConfig.direction === 'ascending' ? <ArrowUp className="inline h-4 w-4 ml-1" /> : <ArrowDown className="inline h-4 w-4 ml-1" />)}
                    </TableHead>
                    {context.isPlatformAdmin && <TableHead className="cursor-pointer" onClick={() => requestSort('tenant_id')}>
                      Tenant
                      {sortConfig.key === 'tenant_id' && (sortConfig.direction === 'ascending' ? <ArrowUp className="inline h-4 w-4 ml-1" /> : <ArrowDown className="inline h-4 w-4 ml-1" />)}
                      </TableHead>}
                    <TableHead className="cursor-pointer" onClick={() => requestSort('carrier_type')}>
                      Type
                      {sortConfig.key === 'carrier_type' && (sortConfig.direction === 'ascending' ? <ArrowUp className="inline h-4 w-4 ml-1" /> : <ArrowDown className="inline h-4 w-4 ml-1" />)}
                      </TableHead>
                    <TableHead>
                      Contact
                      </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => requestSort('rating')}>
                      Rating
                      {sortConfig.key === 'rating' && (sortConfig.direction === 'ascending' ? <ArrowUp className="inline h-4 w-4 ml-1" /> : <ArrowDown className="inline h-4 w-4 ml-1" />)}
                      </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => requestSort('is_active')}>
                      Status
                      {sortConfig.key === 'is_active' && (sortConfig.direction === 'ascending' ? <ArrowUp className="inline h-4 w-4 ml-1" /> : <ArrowDown className="inline h-4 w-4 ml-1" />)}
                      </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCarriers.map((carrier) => (
                    <TableRow key={carrier.id}>
                      <TableCell className="font-medium">{carrier.carrier_name}</TableCell>
                      {context.isPlatformAdmin && (
                        <TableCell>{tenantNameById[carrier.tenant_id] || carrier.tenant_id || '—'}</TableCell>
                      )}
                      <TableCell>
                        {carrier.carrier_type && (
                          <Badge variant="outline">
                            {carrier.carrier_type.replace('_', ' ').toUpperCase()}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {carrier.contact_person && (
                          <div className="text-sm">
                            <div>{carrier.contact_person}</div>
                            {carrier.contact_email && (
                              <div className="text-muted-foreground">{carrier.contact_email}</div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {carrier.rating ? (
                          <span>{carrier.rating} / 5.0</span>
                        ) : (
                          'N/A'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={carrier.is_active ? 'default' : 'secondary'}>
                          {carrier.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(carrier.id)}>Edit</Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteCarrier(carrier.id)}>Delete</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-end mt-4">
                <PaginationControls />
              </div>
              </>
            )}
          </CardContent>
        </Card>
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Carrier</DialogTitle>
            </DialogHeader>
            {editCarrierId && (
              <CarrierForm carrierId={editCarrierId} onSuccess={handleSuccess} />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
