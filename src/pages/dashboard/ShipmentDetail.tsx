import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, MapPin, Calendar, Edit, Paperclip, Download, Upload, CheckCircle2, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CargoForm } from '@/components/logistics/CargoForm';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TrackingTimeline } from '@/components/logistics/TrackingTimeline';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { EmailHistoryPanel } from '@/components/email/EmailHistoryPanel';
import { Shipment, ShipmentStatus, statusConfig, formatShipmentType } from './shipments-data';
import { logger } from '@/lib/logger';

export default function ShipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  type ShipmentAttachment = {
    id?: string;
    path: string;
    name: string;
    size?: number;
    uploaded_at?: string;
    public_url?: string | null;
    resolved_url?: string | null;
    content_type?: string | null;
    document_type?: string | null;
  };
  const [attachments, setAttachments] = useState<ShipmentAttachment[]>([]);
  const [podUploading, setPodUploading] = useState(false);
  const { supabase, context, scopedDb, preferences } = useCRM();
  const [podFile, setPodFile] = useState<File | null>(null);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  
  // Cargo state
  const [cargoItems, setCargoItems] = useState<any[]>([]);
  const [isCargoOpen, setIsCargoOpen] = useState(false);
  const [editingCargo, setEditingCargo] = useState<any>(null);

  const fetchCargo = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await scopedDb
        .from('cargo_details')
        .select(`
          *,
          cargo_types (cargo_type_name),
          aes_hts_codes (hts_code, description)
        `)
        .eq('service_id', id)
        .eq('service_type', 'shipment')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setCargoItems(data || []);
    } catch (error) {
      console.error('Failed to load cargo:', error);
      // toast.error('Failed to load cargo details'); // Optional: don't spam toasts
    }
  }, [id, scopedDb]);

  const fetchShipment = useCallback(async () => {
    try {
      const { data, error } = await scopedDb
        .from('shipments')
        .select('*, accounts(name), contacts(first_name, last_name, email)')
        .eq('id', id)
        .single();

      if (error) throw error;
      setShipment(data as Shipment);
    } catch (error: unknown) {
      toast.error('Failed to load shipment');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase, context, id, toast]);

  const handleCreateInvoice = useCallback(async () => {
    try {
      if (!id) {
        toast.error('Missing shipment id');
        return;
      }
      if (!preferences?.tenant_id) {
        toast.error('Select a tenant scope before creating an invoice');
        return;
      }
      setCreatingInvoice(true);
      const { data: createdId, error } = await supabase
        .rpc('create_invoice_from_shipment', {
          p_shipment_id: id,
          p_tenant_id: preferences.tenant_id,
        });
      if (error) throw error;

      // Fetch invoice number for confirmation
      const { data: inv, error: invErr } = await (scopedDb as any)
        .from('invoices' as any)
        .select('id, invoice_number, status, total')
        .eq('id', createdId)
        .maybeSingle();
      if (invErr) throw invErr;

      toast.success(`Invoice ${inv?.invoice_number || createdId} created`);
      navigate(`/dashboard/finance/invoices/${createdId}`);
    } catch (e: any) {
      logger.error('Failed to create invoice', { component: 'ShipmentDetail', error: e?.message, stack: e?.stack, shipmentId: id });
      toast.error(e?.message || 'Failed to create invoice');
    } finally {
      setCreatingInvoice(false);
    }
  }, [id, preferences?.tenant_id, supabase, scopedDb]);

  const fetchAttachments = useCallback(async () => {
    try {
      const { data, error } = await (scopedDb
        .from('shipment_attachments' as any)
        .select('*')
        .eq('shipment_id', id)
        .order('uploaded_at', { ascending: false }) as any);
      if (error) throw error;
      const rows = (data || []) as ShipmentAttachment[];
      const withUrls = rows.map((att) => {
        const urlRes = supabase.storage.from('shipments').getPublicUrl(att.path);
        const resolved = att.public_url || urlRes?.data?.publicUrl || null;
        return { ...att, resolved_url: resolved };
      });
      setAttachments(withUrls);
    } catch (error: unknown) {
      console.warn('Failed to load attachments', error);
    }
  }, [supabase, context, id]);

  useEffect(() => {
    if (id) {
      fetchShipment();
      fetchAttachments();
      fetchCargo();
    }
  }, [id, fetchShipment, fetchAttachments, fetchCargo]);

  const handleDeleteCargo = async (cargoId: string) => {
    if (!confirm('Are you sure you want to delete this cargo item?')) return;
    try {
      const { error } = await scopedDb
        .from('cargo_details')
        .update({ is_active: false })
        .eq('id', cargoId);
      if (error) throw error;
      toast.success('Cargo item deleted');
      fetchCargo();
    } catch (error: any) {
      toast.error('Failed to delete cargo: ' + error.message);
    }
  };

  const handleUploadPOD = async () => {
    try {
      if (!id || !podFile) {
        toast.error('Select a POD file to upload');
        return;
      }
      setPodUploading(true);
      const safeName = podFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${id}/pod_${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from('shipments')
        .upload(path, podFile, { contentType: podFile.type || 'application/octet-stream', upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('shipments')
        .getPublicUrl(path);
      const publicUrl = urlData?.publicUrl ?? null;

      // Use shipment's tenant/franchise if available, otherwise fallback to context
      // This ensures attachments for tenant-owned shipments are properly scoped even when uploaded by Platform Admin
      const targetTenantId = shipment?.tenant_id || context?.tenantId;
      const targetFranchiseId = shipment?.franchise_id || context?.franchiseId;

      const { error: metaErr } = await (scopedDb
        .from('shipment_attachments' as any)
        .insert([{
          shipment_id: id,
          tenant_id: targetTenantId,
          franchise_id: targetFranchiseId,
          created_by: context?.userId,
          name: podFile.name,
          path,
          size: podFile.size,
          content_type: podFile.type || null,
          public_url: publicUrl,
          document_type: 'proof_of_delivery',
        }]) as any);
      if (metaErr) throw metaErr;

      const { error: updErr } = await scopedDb
        .from('shipments')
        .update({ pod_received: true, pod_received_at: new Date().toISOString() })
        .eq('id', id);
      if (updErr) throw updErr;

      toast.success('POD uploaded and marked as received');
      setPodFile(null);
      await Promise.all([fetchAttachments(), fetchShipment()]);
    } catch (error: unknown) {
      console.error('POD upload failed:', error);
      const msg =
        typeof error === 'object' && error && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Unknown error';
      toast.error('Failed to upload POD: ' + msg);
    } finally {
      setPodUploading(false);
    }
  };

  const getStatusColor = (status: ShipmentStatus) => {
    return statusConfig[status]?.color || 'bg-gray-500/10 text-gray-500';
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">Loading shipment...</div>
      </DashboardLayout>
    );
  }

  if (!shipment) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">Shipment not found</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard/shipments')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{shipment.shipment_number}</h1>
              <p className="text-muted-foreground">
                {formatShipmentType(shipment.shipment_type)}
              </p>
            </div>
            <Badge className={getStatusColor(shipment.status)}>
              {shipment.status.replace('_', ' ')}
            </Badge>
            {shipment.pod_received ? (
              <Badge className="bg-green-500/10 text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> POD Received
              </Badge>
            ) : (
              shipment.status === 'delivered' && (
                <Badge className="bg-red-500/10 text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" /> POD Pending
                </Badge>
              )
            )}
          </div>
          <div className="flex gap-2">
          <Button>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" onClick={handleCreateInvoice} disabled={creatingInvoice}>
            {creatingInvoice ? 'Creating…' : 'Create Invoice'}
          </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Shipment Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Reference Number</p>
                  <p className="font-medium">{shipment.reference_number || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Priority</p>
                  <Badge variant="outline">{shipment.priority_level}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Packages</p>
                  <p className="font-medium">{shipment.total_packages || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Weight</p>
                  <p className="font-medium">{shipment.total_weight_kg ? `${shipment.total_weight_kg} kg` : '-'}</p>
                </div>
              </div>

              {shipment.accounts && (
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-medium">{shipment.accounts.name}</p>
                </div>
              )}

              {shipment.special_instructions && (
                <div>
                  <p className="text-sm text-muted-foreground">Special Instructions</p>
                  <p className="font-medium">{shipment.special_instructions}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dates & Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Pickup Date</p>
                  <p className="font-medium">
                    {shipment.pickup_date ? format(new Date(shipment.pickup_date), 'PPP') : 'Not scheduled'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Estimated Delivery</p>
                  <p className="font-medium">
                    {shipment.estimated_delivery_date ? format(new Date(shipment.estimated_delivery_date), 'PPP') : 'TBD'}
                  </p>
                </div>
              </div>

              {shipment.actual_delivery_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Actual Delivery</p>
                    <p className="font-medium">
                      {format(new Date(shipment.actual_delivery_date), 'PPP')}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <CardTitle>Origin</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p>{(shipment.origin_address as any)?.address || JSON.stringify(shipment.origin_address)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <CardTitle>Destination</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p>{(shipment.destination_address as any)?.address || JSON.stringify(shipment.destination_address)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Cargo Details */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <CardTitle>Cargo Items</CardTitle>
              </div>
              <Dialog open={isCargoOpen} onOpenChange={setIsCargoOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" /> Add Item
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add Cargo Item</DialogTitle>
                  </DialogHeader>
                  <CargoForm
                    serviceId={id}
                    serviceType="shipment"
                    onSuccess={() => {
                      setIsCargoOpen(false);
                      fetchCargo();
                    }}
                    onCancel={() => setIsCargoOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>HTS Code</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cargoItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No cargo items added yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  cargoItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.commodity_description}
                        {item.hazmat && (
                          <Badge variant="destructive" className="ml-2 text-[10px] px-1 py-0 h-4">
                            HAZMAT
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{item.cargo_types?.cargo_type_name || '-'}</TableCell>
                      <TableCell>
                        {item.aes_hts_codes ? (
                          <div className="flex flex-col">
                            <span className="font-mono text-xs font-medium">{item.aes_hts_codes.hts_code}</span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[150px]" title={item.aes_hts_codes.description}>
                              {item.aes_hts_codes.description}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">Unclassified</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div>Pkg: {item.package_count}</div>
                        <div>{item.total_weight_kg} kg / {item.total_volume_cbm} m³</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => setEditingCargo(item)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteCargo(item.id)} className="text-red-500 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editingCargo} onOpenChange={(open) => !open && setEditingCargo(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Cargo Item</DialogTitle>
            </DialogHeader>
            {editingCargo && (
              <CargoForm
                cargoId={editingCargo.id}
                serviceId={id}
                serviceType="shipment"
                defaultValues={{
                  ...editingCargo,
                  aes_hts_id: editingCargo.aes_hts_id || '', // Ensure string
                }}
                onSuccess={() => {
                  setEditingCargo(null);
                  fetchCargo();
                }}
                onCancel={() => setEditingCargo(null)}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Emails */}
        <EmailHistoryPanel 
          emailAddress={shipment.contacts?.email} 
          entityType="shipment" 
          entityId={shipment.id} 
        />

        {/* Attachments */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Paperclip className="h-5 w-5 text-primary" />
              <CardTitle>Attachments</CardTitle>
              <CardDescription>Uploaded documents for this shipment</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {/* POD upload control */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4 p-3 border rounded-md">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Proof of Delivery</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setPodFile(e.target.files?.[0] || null)}
                />
                <Button onClick={handleUploadPOD} disabled={podUploading || !podFile}>
                  {podUploading ? 'Uploading…' : 'Upload POD'}
                </Button>
              </div>
            </div>

            {attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No attachments yet.</p>
            ) : (
              <ul className="space-y-2">
                {/* Show POD attachments first */}
                {attachments
                  .filter((a) => a.document_type === 'proof_of_delivery')
                  .map((att) => {
                    const url = att.resolved_url;
                    return (
                      <li key={`pod-${att.id || att.path}`} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <div>
                            <p className="font-medium leading-tight">POD: {att.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {att.content_type || 'file'} • {att.size ? `${Math.round(att.size / 1024)} KB` : ''}
                            </p>
                          </div>
                        </div>
                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-primary hover:underline"
                          >
                            <Download className="h-4 w-4" />
                            View
                          </a>
                        )}
                      </li>
                    );
                  })}
                {/* Other attachments */}
                {attachments
                  .filter((a) => a.document_type !== 'proof_of_delivery')
                  .map((att) => {
                  const url = att.resolved_url;
                  return (
                    <li key={att.id || att.path} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium leading-tight">{att.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {att.content_type || 'file'} • {att.size ? `${Math.round(att.size / 1024)} KB` : ''}
                          </p>
                        </div>
                      </div>
                      {url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-primary hover:underline"
                        >
                          <Download className="h-4 w-4" />
                          View
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {id && <TrackingTimeline shipmentId={id} />}
      </div>
    </DashboardLayout>
  );
}
