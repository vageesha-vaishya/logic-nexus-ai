
import { useState, useEffect, useCallback } from 'react';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
const supabase = supabaseClient as any;
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus, Loader2, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { logger } from '@/lib/logger';
import { DataFlowMonitor } from '@/lib/data-flow-monitor';

interface ServiceVendorsPanelProps {
  serviceId: string;
}

interface LinkedVendor {
  id: string; // link id (service_vendors.id)
  vendor_id: string;
  vendor_name: string;
  vendor_type: string;
  is_preferred: boolean;
  cost_structure: any;
}

interface VendorOption {
  id: string;
  name: string;
  type: string;
}

export function ServiceVendorsPanel({ serviceId }: ServiceVendorsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [linkedVendors, setLinkedVendors] = useState<LinkedVendor[]>([]);
  const [availableVendors, setAvailableVendors] = useState<VendorOption[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [adding, setAdding] = useState(false);
  
  // Cost Editing State
  const [editingCostLink, setEditingCostLink] = useState<LinkedVendor | null>(null);
  const [costRate, setCostRate] = useState<string>('');
  const [costCurrency, setCostCurrency] = useState<string>('USD');
  const [costUnit, setCostUnit] = useState<string>('');
  const [savingCost, setSavingCost] = useState(false);

  useEffect(() => {
    if (serviceId) {
      fetchData();
    }
  }, [serviceId]);

  const fetchData = async () => {
    setLoading(true);
    const startTime = performance.now();
    try {
      // 1. Fetch linked vendors
      const { data: links, error: linkError } = await supabase
        .from('service_vendors' as any)
        .select(`
          id,
          vendor_id,
          is_preferred,
          cost_structure,
          vendors (
            id,
            name,
            type
          )
        `)
        .eq('service_id', serviceId);

      if (linkError) throw linkError;

      DataFlowMonitor.trackInbound('database', 'fetch_service_vendors', { serviceId, count: links?.length }, performance.now() - startTime);

      const mappedLinks: LinkedVendor[] = (links || []).map((l: any) => ({
        id: l.id,
        vendor_id: l.vendor_id,
        vendor_name: l.vendors?.name || 'Unknown',
        vendor_type: l.vendors?.type || 'Unknown',
        is_preferred: l.is_preferred,
        cost_structure: l.cost_structure,
      }));

      setLinkedVendors(mappedLinks);

      // 2. Fetch all vendors for the dropdown
      const { data: allVendors, error: vendorError } = await supabase
        .from('vendors' as any)
        .select('id, name, type')
        .eq('status', 'active')
        .order('name');

      if (vendorError) throw vendorError;
      setAvailableVendors((allVendors || []) as VendorOption[]);

    } catch (err: any) {
      logger.error('Error fetching service vendors:', { error: err, component: 'ServiceVendorsPanel' });
      toast.error('Failed to load linked vendors');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLink = async () => {
    if (!selectedVendorId) return;
    setAdding(true);
    try {
      const payload = {
          service_id: serviceId,
          vendor_id: selectedVendorId,
          is_preferred: false,
          cost_structure: { rate: 0, currency: 'USD' } // Default structure
        };

      const { error } = await supabase
        .from('service_vendors')
        .insert(payload);

      if (error) {
        if (error.code === '23505') { // Unique violation
          toast.error('This vendor is already linked to the service.');
        } else {
          throw error;
        }
      } else {
        DataFlowMonitor.trackOutbound('database', 'link_vendor', payload);
        toast.success('Vendor linked successfully');
        setSelectedVendorId('');
        await fetchData();
      }
    } catch (err: any) {
      logger.error('Error linking vendor:', { error: err, component: 'ServiceVendorsPanel' });
      toast.error('Failed to link vendor');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveLink = async (linkId: string) => {
    if (!confirm('Are you sure you want to remove this vendor link?')) return;
    try {
      const { error } = await supabase
        .from('service_vendors')
        .delete()
        .eq('id', linkId);

      if (error) throw error;
      
      DataFlowMonitor.trackOutbound('database', 'remove_vendor_link', { linkId });
      toast.success('Vendor removed');
      setLinkedVendors(prev => prev.filter(l => l.id !== linkId));
    } catch (err: any) {
      logger.error('Error removing link:', { error: err, component: 'ServiceVendorsPanel' });
      toast.error('Failed to remove vendor');
    }
  };

  const handleTogglePreferred = async (linkId: string, currentVal: boolean) => {
    try {
      // Optimistic update
      setLinkedVendors(prev => prev.map(l => l.id === linkId ? { ...l, is_preferred: !currentVal } : l));

      const { error } = await supabase
        .from('service_vendors')
        .update({ is_preferred: !currentVal })
        .eq('id', linkId);

      if (error) {
        // Revert
        setLinkedVendors(prev => prev.map(l => l.id === linkId ? { ...l, is_preferred: currentVal } : l));
        throw error;
      }
    } catch (err: any) {
      console.error('Error updating preference:', err);
      toast.error('Failed to update preference');
    }
  };

  const openCostDialog = (link: LinkedVendor) => {
    setEditingCostLink(link);
    setCostRate(link.cost_structure?.rate?.toString() || '');
    setCostCurrency(link.cost_structure?.currency || 'USD');
    setCostUnit(link.cost_structure?.unit || '');
  };

  const handleSaveCost = async () => {
    if (!editingCostLink) return;
    setSavingCost(true);
    try {
      const newCostStructure = {
        ...editingCostLink.cost_structure,
        rate: parseFloat(costRate) || 0,
        currency: costCurrency,
        unit: costUnit
      };

      const { error } = await supabase
        .from('service_vendors' as any)
        .update({ cost_structure: newCostStructure })
        .eq('id', editingCostLink.id);

      if (error) throw error;

      setLinkedVendors(prev => prev.map(l => 
        l.id === editingCostLink.id ? { ...l, cost_structure: newCostStructure } : l
      ));
      toast.success('Cost structure updated');
      setEditingCostLink(null);
    } catch (err: any) {
      console.error('Error saving cost:', err);
      toast.error('Failed to save cost structure');
    } finally {
      setSavingCost(false);
    }
  };

  // Filter out vendors that are already linked
  const unlinkedVendors = availableVendors.filter(
    v => !linkedVendors.some(l => l.vendor_id === v.id)
  );

  if (loading && linkedVendors.length === 0) {
    return <div className="flex justify-center p-4"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-end sm:items-center justify-between border-b pb-4">
        <div className="flex-1 w-full sm:max-w-md flex gap-2">
           <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select vendor to link..." />
            </SelectTrigger>
            <SelectContent>
              {unlinkedVendors.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">No available vendors</div>
              ) : (
                unlinkedVendors.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name} ({v.type})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button onClick={handleAddLink} disabled={!selectedVendorId || adding}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Link
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.open('/dashboard/vendors', '_blank')}>
          Manage Vendors
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Preferred</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linkedVendors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No vendors linked to this service.
                </TableCell>
              </TableRow>
            ) : (
              linkedVendors.map((link) => (
                <TableRow key={link.id}>
                  <TableCell className="font-medium">{link.vendor_name}</TableCell>
                  <TableCell className="capitalize">{link.vendor_type}</TableCell>
                  <TableCell>
                    {link.cost_structure?.rate ? (
                      <span className="text-sm font-medium">
                        {link.cost_structure.currency} {link.cost_structure.rate}
                        {link.cost_structure.unit ? ` / ${link.cost_structure.unit}` : ''}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground italic">Not set</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={link.is_preferred} 
                        onCheckedChange={() => handleTogglePreferred(link.id, link.is_preferred)} 
                      />
                      <span className="text-sm text-muted-foreground">
                        {link.is_preferred ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openCostDialog(link)}
                        title="Manage Cost"
                      >
                        <DollarSign className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleRemoveLink(link.id)}
                        className="text-destructive hover:text-destructive/90"
                        title="Remove Link"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Cost Edit Dialog */}
      <Dialog open={!!editingCostLink} onOpenChange={(v) => !v && setEditingCostLink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Vendor Cost</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
             <div className="space-y-2">
               <Label>Negotiated Rate</Label>
               <Input 
                 type="number" 
                 placeholder="0.00" 
                 value={costRate}
                 onChange={(e) => setCostRate(e.target.value)}
               />
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label>Currency</Label>
                 <Select value={costCurrency} onValueChange={setCostCurrency}>
                   <SelectTrigger>
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="USD">USD</SelectItem>
                     <SelectItem value="EUR">EUR</SelectItem>
                     <SelectItem value="GBP">GBP</SelectItem>
                     <SelectItem value="INR">INR</SelectItem>
                     <SelectItem value="CNY">CNY</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               <div className="space-y-2">
                 <Label>Unit (Optional)</Label>
                 <Input 
                   placeholder="e.g. per container" 
                   value={costUnit}
                   onChange={(e) => setCostUnit(e.target.value)}
                 />
               </div>
             </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCostLink(null)}>Cancel</Button>
            <Button onClick={handleSaveCost} disabled={savingCost}>
              {savingCost ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Cost'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
