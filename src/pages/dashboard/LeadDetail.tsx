import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { LeadForm } from '@/components/crm/LeadForm';
import type { LeadFormData } from '@/components/crm/LeadForm';
import type { Json } from '@/integrations/supabase/types';
import { LeadConversionDialog } from '@/components/crm/LeadConversionDialog';
import { LeadActivitiesTimeline } from '@/components/crm/LeadActivitiesTimeline';
import { EmailHistoryPanel } from '@/components/email/EmailHistoryPanel';
import { LeadScoringCard } from '@/components/crm/LeadScoringCard';
import { ManualAssignment } from '@/components/assignment/ManualAssignment';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Edit, Trash2, UserPlus, DollarSign, Calendar, Mail, Phone, Building2, GitBranch, Users as UsersIcon } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Lead, statusConfig } from './leads-data';

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { supabase, context, scopedDb } = useCRM();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showConversionDialog, setShowConversionDialog] = useState(false);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);

  const fetchLead = useCallback(async () => {
    try {
      const { data, error } = await scopedDb
        .from('leads')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setLead(data as unknown as Lead);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to load lead', { description: message });
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [id, supabase]);

  useEffect(() => {
    if (id) {
      fetchLead();

      // Real-time subscription for lead updates (e.g. score changes)
      const channel = supabase
        .channel(`lead-detail-${id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'leads',
            filter: `id=eq.${id}`
          },
          (payload) => {
            setLead(payload.new as unknown as Lead);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [id, fetchLead, supabase]);

  const handleUpdate = async (formData: LeadFormData) => {
    try {
      // Extract extras and merge into custom_fields
      const { service_id, attachments, ...rest } = formData || ({} as LeadFormData);
      const attachmentList = Array.isArray(attachments) ? attachments : [];
      const attachmentNames = attachmentList
        .map((f) => {
          if (f && typeof f === 'object' && 'name' in f) {
            const name = (f as { name?: unknown }).name;
            if (typeof name === 'string') return name;
          }
          return undefined;
        })
        .filter((n): n is string => !!n);
      const mergedCustomFields: Json = {
        ...(lead?.custom_fields || {}),
        ...(service_id ? { service_id } : {}),
        ...(attachmentNames.length ? { attachments_names: attachmentNames } : {}),
      };

      const { error } = await supabase
        .from('leads')
        .update({
          ...rest,
          estimated_value: formData.estimated_value ? parseFloat(formData.estimated_value) : null,
          custom_fields: Object.keys(mergedCustomFields as Record<string, unknown>).length ? mergedCustomFields : null,
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Lead updated successfully');
      setIsEditing(false);
      fetchLead();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to update lead', { description: message });
      console.error('Error:', error);
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await scopedDb
        .from('leads')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Lead deleted successfully');
      navigate('/dashboard/leads');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to delete lead', { description: message });
      console.error('Error:', error);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading lead...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!lead) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Lead not found</p>
          <Button onClick={() => navigate('/dashboard/leads')} className="mt-4">
            Back to Leads
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-500/10 text-blue-500',
      contacted: 'bg-purple-500/10 text-purple-500',
      qualified: 'bg-teal-500/10 text-teal-500',
      proposal: 'bg-yellow-500/10 text-yellow-500',
      negotiation: 'bg-orange-500/10 text-orange-500',
      won: 'bg-green-500/10 text-green-500',
      lost: 'bg-red-500/10 text-red-500',
    };
    return colors[status] || 'bg-gray-500/10 text-gray-500';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/leads')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{lead.first_name} {lead.last_name}</h1>
              <p className="text-muted-foreground">Lead Details</p>
            </div>
          </div>
          {!isEditing && !lead.converted_at && (
            <div className="flex gap-2">
              <Dialog open={showAssignmentDialog} onOpenChange={setShowAssignmentDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <UsersIcon className="mr-2 h-4 w-4" />
                    Assign Lead
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Assign Lead</DialogTitle>
                    <DialogDescription>
                      Manually assign this lead to a user
                    </DialogDescription>
                  </DialogHeader>
                  <ManualAssignment
                    leadId={lead.id}
                    currentOwnerId={lead.owner_id}
                    onAssigned={() => {
                      setShowAssignmentDialog(false);
                      fetchLead();
                    }}
                  />
                </DialogContent>
              </Dialog>
              <Button onClick={() => setShowConversionDialog(true)}>
                <GitBranch className="mr-2 h-4 w-4" />
                Convert Lead
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          )}
          {lead.converted_at && (
            <Badge className="bg-green-500/10 text-green-500">
              Converted on {format(new Date(lead.converted_at), 'PPP')}
            </Badge>
          )}
        </div>

        {isEditing ? (
          <Card>
            <CardHeader>
              <CardTitle>Edit Lead</CardTitle>
            </CardHeader>
            <CardContent>
              <LeadForm
                initialData={{
                  id: lead.id,
                  first_name: lead.first_name,
                  last_name: lead.last_name,
                  company: lead.company ?? '',
                  title: lead.title ?? '',
                  email: lead.email ?? '',
                  phone: lead.phone ?? '',
                  status: (lead.status === 'converted' ? 'new' : lead.status) as LeadFormData['status'],
                  source: (['website','referral','email','phone','social','event','other'].includes(lead.source)
                    ? (lead.source as LeadFormData['source'])
                    : 'other'),
                  estimated_value: lead.estimated_value != null ? String(lead.estimated_value) : '',
                  expected_close_date: lead.expected_close_date ?? '',
                  description: lead.description ?? '',
                  notes: lead.notes ?? '',
                  tenant_id: lead.tenant_id,
                  franchise_id: lead.franchise_id ?? '',
                }}
                onSubmit={handleUpdate}
                onCancel={() => setIsEditing(false)}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <LeadScoringCard
                  leadId={lead.id}
                  score={lead.lead_score || 0}
                  status={lead.status}
                  estimatedValue={lead.estimated_value}
                  lastActivityDate={lead.last_activity_date}
                  source={lead.source}
                  title={lead.title}
                />
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Lead Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge className={`mt-1 ${getStatusColor(lead.status)}`}>
                    {lead.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Source</p>
                  <Badge variant="outline" className="mt-1">{lead.source}</Badge>
                </div>
                {lead.company && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Company</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{lead.company}</span>
                    </div>
                  </div>
                )}
                {lead.title && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Title</p>
                    <p className="text-sm">{lead.title}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {lead.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${lead.email}`} className="text-sm text-primary hover:underline">
                      {lead.email}
                    </a>
                  </div>
                )}
                {lead.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${lead.phone}`} className="text-sm">{lead.phone}</a>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Opportunity Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {lead.estimated_value && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Estimated Value</p>
                      <p className="text-sm font-semibold text-green-600">
                        {lead.estimated_value?.toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
                {lead.expected_close_date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Expected Close Date</p>
                      <p className="text-sm">{format(new Date(lead.expected_close_date), 'PPP')}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {(lead.description || lead.notes) && (
              <Card>
                <CardHeader>
                  <CardTitle>Additional Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {lead.description && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Description</p>
                      <p className="text-sm whitespace-pre-wrap">{lead.description}</p>
                    </div>
                  )}
                  {lead.notes && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Notes</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{lead.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="md:col-span-2">
              <EmailHistoryPanel 
                emailAddress={lead.email} 
                entityType="lead" 
                entityId={lead.id} 
                className="mb-6"
              />
              <LeadActivitiesTimeline leadId={lead.id} />
            </div>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div>Created: {format(new Date(lead.created_at), 'PPpp')}</div>
                <div>Last Updated: {format(new Date(lead.updated_at), 'PPpp')}</div>
                {lead.lead_score && <div>Lead Score: {lead.lead_score}/100</div>}
                {lead.qualification_status && <div>Qualification: {lead.qualification_status}</div>}
              </CardContent>
            </Card>
          </div>
        )}

        {lead && (
          <LeadConversionDialog
            open={showConversionDialog}
            onOpenChange={setShowConversionDialog}
            lead={lead}
            onConversionComplete={fetchLead}
          />
        )}

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Lead</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this lead? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
