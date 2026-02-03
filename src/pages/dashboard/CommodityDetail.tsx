import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Save, CheckCircle, XCircle, AlertTriangle, FileText } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

type MasterCommodity = Database['public']['Tables']['master_commodities']['Row'];

const commoditySchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  unit_value: z.coerce.number().min(0).optional(),
  hazmat_class: z.string().optional(),
});

type CommodityFormValues = z.infer<typeof commoditySchema>;

export default function CommodityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { supabase, user } = useCRM();
  const queryClient = useQueryClient();
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const isNew = id === 'new';

  const { data: commodity, isLoading } = useQuery({
    queryKey: ['commodity', id],
    queryFn: async () => {
      if (isNew) return null;
      const { data, error } = await supabase
        .from('master_commodities')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as MasterCommodity;
    },
    enabled: !!id,
  });

  const form = useForm<CommodityFormValues>({
    resolver: zodResolver(commoditySchema),
    defaultValues: {
      sku: '',
      name: '',
      description: '',
      unit_value: 0,
      hazmat_class: '',
    },
  });

  // Reset form when data loads
  useEffect(() => {
    if (commodity) {
      form.reset({
        sku: commodity.sku || '',
        name: commodity.name || '',
        description: commodity.description || '',
        unit_value: commodity.unit_value || 0,
        hazmat_class: commodity.hazmat_class || '',
      });
    }
  }, [commodity, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: CommodityFormValues) => {
      const dataToSave = {
        sku: values.sku,
        name: values.name,
        description: values.description,
        unit_value: values.unit_value,
        hazmat_class: values.hazmat_class,
        tenant_id: (await supabase.auth.getUser()).data.user?.user_metadata.tenant_id // Fallback if needed, but RLS handles it usually
      };

      if (isNew) {
        const { data, error } = await supabase
          .from('master_commodities')
          .insert(dataToSave)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('master_commodities')
          .update(dataToSave)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data) => {
      toast.success(isNew ? 'Commodity created' : 'Commodity updated');
      queryClient.invalidateQueries({ queryKey: ['commodity', id] });
      if (isNew) {
        navigate(`/dashboard/commodities/${data.id}`);
      }
    },
    onError: (error) => {
      toast.error('Failed to save commodity', { description: error.message });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ status, reason }: { status: string; reason?: string }) => {
      const updates: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'approved') {
        updates.approved_by = user?.id;
        updates.approved_at = new Date().toISOString();
        updates.rejection_reason = null; // Clear rejection reason
      } else if (status === 'rejected') {
        updates.rejection_reason = reason;
        updates.approved_by = null;
        updates.approved_at = null;
      } else if (status === 'pending_review') {
         // Reset approval info if re-submitting
         updates.approved_by = null;
         updates.approved_at = null;
      }

      const { error } = await supabase
        .from('master_commodities')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(`Commodity ${variables.status.replace('_', ' ')}`);
      queryClient.invalidateQueries({ queryKey: ['commodity', id] });
      setIsRejectDialogOpen(false);
    },
    onError: (error) => {
      toast.error('Failed to update status', { description: error.message });
    },
  });

  const onSubmit = (values: CommodityFormValues) => {
    saveMutation.mutate(values);
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle className="w-3 h-3 mr-1" /> Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
      case 'pending_review':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600"><AlertTriangle className="w-3 h-3 mr-1" /> Pending Review</Badge>;
      default:
        return <Badge variant="secondary"><FileText className="w-3 h-3 mr-1" /> Draft</Badge>;
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/commodities')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {isNew ? 'New Commodity' : commodity?.name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-muted-foreground">
                  {isNew ? 'Create a new master commodity' : commodity?.sku}
                </p>
                {!isNew && getStatusBadge(commodity?.status || 'draft')}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!isNew && (
              <>
                {/* Workflow Actions */}
                {(commodity?.status === 'draft' || commodity?.status === 'rejected') && (
                  <Button 
                    variant="outline" 
                    onClick={() => statusMutation.mutate({ status: 'pending_review' })}
                    disabled={statusMutation.isPending}
                  >
                    Submit for Review
                  </Button>
                )}
                
                {commodity?.status === 'pending_review' && (
                  <>
                    <Button 
                      variant="destructive" 
                      onClick={() => setIsRejectDialogOpen(true)}
                      disabled={statusMutation.isPending}
                    >
                      Reject
                    </Button>
                    <Button 
                      className="bg-green-600 hover:bg-green-700" 
                      onClick={() => statusMutation.mutate({ status: 'approved' })}
                      disabled={statusMutation.isPending}
                    >
                      Approve
                    </Button>
                  </>
                )}
              </>
            )}
            <Button onClick={form.handleSubmit(onSubmit)} disabled={saveMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </div>

        {/* Rejection Reason Display */}
        {commodity?.status === 'rejected' && commodity.rejection_reason && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 flex gap-3 items-start">
            <XCircle className="h-5 w-5 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-semibold">Rejected</h4>
              <p className="text-sm mt-1">{commodity.rejection_reason}</p>
            </div>
          </div>
        )}

        {/* Approval Info Display */}
        {commodity?.status === 'approved' && commodity.approved_at && (
           <div className="bg-green-50 border border-green-200 text-green-800 rounded-md p-4 flex gap-3 items-center">
             <CheckCircle className="h-5 w-5 shrink-0" />
             <div className="text-sm">
               Approved on <strong>{format(new Date(commodity.approved_at), 'PPP')}</strong>
             </div>
           </div>
        )}

        <Tabs defaultValue="details" className="space-y-4">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="documents" disabled={isNew}>Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <div className="grid gap-6 md:grid-cols-3">
              {/* Main Form */}
              <div className="md:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Commodity Details</CardTitle>
                    <CardDescription>Basic information about the product.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="sku"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>SKU / Part Number</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g. ELEC-001" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="Product Name" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Detailed description for customs..." 
                                  className="min-h-[100px]"
                                  {...field} 
                                />
                              </FormControl>
                              <FormDescription>
                                This description will be used for AI classification and customs declarations.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="unit_value"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Unit Value (USD)</FormLabel>
                                <FormControl>
                                  <Input type="number" min="0" step="0.01" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="hazmat_class"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Hazmat Class</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g. 3, 8, UN1234" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar / Metadata */}
              <div className="space-y-6">
                 <Card>
                   <CardHeader>
                     <CardTitle>Classification</CardTitle>
                     <CardDescription>HTS and Schedule B codes.</CardDescription>
                   </CardHeader>
                   <CardContent className="space-y-4">
                     <div className="text-sm text-muted-foreground">
                       <p>Assigned HTS: <strong>{commodity?.aes_hts_id ? 'Assigned' : 'None'}</strong></p>
                       {/* In a real implementation, we would add the SmartCargoInput here to select HTS */}
                       <Button variant="outline" className="w-full mt-2" disabled>
                         Manage Classification (Coming Soon)
                       </Button>
                     </div>
                   </CardContent>
                 </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="documents">
             <CommodityDocuments commodityId={id!} />
          </TabsContent>
        </Tabs>

        {/* Reject Dialog */}
        <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Commodity</DialogTitle>
              <DialogDescription>
                Please provide a reason for rejecting this commodity. This will be visible to the submitter.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                placeholder="Reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>Cancel</Button>
              <Button 
                variant="destructive" 
                onClick={() => statusMutation.mutate({ status: 'rejected', reason: rejectionReason })}
                disabled={!rejectionReason.trim()}
              >
                Reject Commodity
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}
