import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { VendorForm } from '@/components/logistics/VendorForm';
import { ClauseLibraryDialog } from './vendors/components/ClauseLibraryDialog';
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

import { logger } from '@/lib/logger';

export default function Vendors() {
  const navigate = useNavigate();
  const { supabase } = useCRM();
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clauseLibraryOpen, setClauseLibraryOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    logger.info('Vendors page mounted', { component: 'Vendors' });
  }, []);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      logger.debug('Fetching vendors', { filter: typeFilter, search: searchTerm, component: 'Vendors' });
      let query = supabase
        .from('vendors')
        .select('*')
        .order('name');
      
      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter);
      }

      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      logger.debug('Vendors fetched successfully', { count: data?.length, component: 'Vendors' });
      setVendors(data || []);
    } catch (error: any) {
      logger.error('Error fetching vendors:', error);
      toast.error('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, [typeFilter, searchTerm]); // Debounce search in production, simplified here

  const handleEdit = (vendor: any) => {
    setEditingVendor(vendor);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this vendor?')) return;
    try {
      const isUUID = (v: any) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
      if (!isUUID(id)) {
        toast.error('Invalid vendor identifier');
        return;
      }
      const { error } = await supabase.from('vendors').delete().eq('id', id);
      if (error) throw error;
      toast.success('Vendor deleted');
      fetchVendors();
    } catch (error: any) {
      toast.error('Failed to delete vendor');
    }
  };

  const handleSuccess = () => {
    setDialogOpen(false);
    setEditingVendor(null);
    fetchVendors();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Vendor Management</h1>
            <p className="text-muted-foreground">
              Manage your suppliers, carriers, and service providers.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setClauseLibraryOpen(true)}>
              Clause Library
            </Button>
            <Button onClick={() => {
              setEditingVendor(null);
              setDialogOpen(true);
            }}>
              <Plus className="mr-2 h-4 w-4" /> Add Vendor
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Vendors Directory</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search vendors..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="carrier">Carrier (General)</SelectItem>
                  <SelectItem value="ocean_carrier">Ocean Carrier</SelectItem>
                  <SelectItem value="air_carrier">Air Carrier</SelectItem>
                  <SelectItem value="trucker">Trucking Company</SelectItem>
                  <SelectItem value="rail_carrier">Rail Carrier</SelectItem>
                  <SelectItem value="freight_forwarder">Freight Forwarder</SelectItem>
                  <SelectItem value="courier">Courier / Express</SelectItem>
                  <SelectItem value="3pl">3PL Provider</SelectItem>
                  <SelectItem value="warehouse">Warehouse</SelectItem>
                  <SelectItem value="customs_broker">Customs Broker</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="broker">Broker</SelectItem>
                  <SelectItem value="technology">Technology Provider</SelectItem>
                  <SelectItem value="manufacturing">Manufacturing</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="wholesaler">Wholesaler</SelectItem>
                  <SelectItem value="consulting">Consulting</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Loading vendors...
                      </TableCell>
                    </TableRow>
                  ) : vendors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No vendors found. Add one to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    vendors.map((vendor) => (
                      <TableRow key={vendor.id}>
                        <TableCell className="font-medium">{vendor.name}</TableCell>
                        <TableCell>{vendor.code || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {vendor.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={vendor.status === 'active' ? 'default' : 'secondary'}
                            className="capitalize"
                          >
                            {vendor.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {vendor.contact_info?.email && <div>{vendor.contact_info.email}</div>}
                            {vendor.contact_info?.phone && <div className="text-muted-foreground">{vendor.contact_info.phone}</div>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/vendors/${vendor.id}`)}>
                              Manage
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(vendor)}>
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(vendor.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingVendor ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle>
            </DialogHeader>
            <VendorForm
              initialData={editingVendor}
              onSuccess={handleSuccess}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
        <ClauseLibraryDialog 
          open={clauseLibraryOpen} 
          onOpenChange={setClauseLibraryOpen} 
        />
      </div>
    </DashboardLayout>
  );
}
