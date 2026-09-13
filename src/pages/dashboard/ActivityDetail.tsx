import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityForm } from '@/components/crm/ActivityForm';
import { Edit, Trash2 } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { DeleteConfirmDialog } from '@/components/common/DeleteConfirmDialog';
import { DetailScreenTemplate } from '@/components/system/DetailScreenTemplate';
import { useStickyActions } from '@/components/layout/StickyActionsContext';
import { formatDate } from '@/lib/utils';
import { logger } from "@/lib/logger";

const typeLabels: Record<string, string> = {
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  task: 'Task',
  note: 'Note',
};

const statusLabels: Record<string, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const priorityLabels: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export default function ActivityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { supabase, context } = useCRM();
  const [activity, setActivity] = useState<any>(null);
  const [rawActivity, setRawActivity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const autoSave = Boolean((location.state as { autoSave?: boolean } | null)?.autoSave);

  useEffect(() => {
    if (id) {
      fetchActivity();
    }
  }, [id]);

  const fetchActivity = async () => {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setRawActivity(data);

      // Flatten custom_fields into top-level for form compatibility
      const flattened = {
        ...data,
        ...(data.custom_fields || {}),
      };

      setActivity(flattened);
    } catch (error: any) {
      toast.error('Failed to load activity');
      logger.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveActivity = async (formData: any, options?: { silent?: boolean; keepEditing?: boolean }) => {
    try {
      let tenantId = context.tenantId || activity?.tenant_id || null;
      let franchiseId = context.franchiseId || activity?.franchise_id || null;

      // For platform admins, get tenant_id from related entity
      if (!tenantId) {
        if (formData.lead_id && formData.lead_id !== 'none') {
          const { data: lead } = await supabase
            .from('leads')
            .select('tenant_id, franchise_id')
            .eq('id', formData.lead_id)
            .single();
          if (lead) {
            tenantId = lead.tenant_id;
            franchiseId = lead.franchise_id;
          }
        } else if (formData.account_id && formData.account_id !== 'none') {
          const { data: account } = await supabase
            .from('v_accounts')
            .select('tenant_id, franchise_id')
            .eq('id', formData.account_id)
            .single();
          if (account) {
            tenantId = account.tenant_id;
            franchiseId = account.franchise_id;
          }
        } else if (formData.contact_id && formData.contact_id !== 'none') {
          const { data: contact } = await supabase
            .from('v_contacts')
            .select('tenant_id, franchise_id')
            .eq('id', formData.contact_id)
            .single();
          if (contact) {
            tenantId = contact.tenant_id;
            franchiseId = contact.franchise_id;
          }
        }
      }

      // Extract extras for custom_fields
      const { service_id, attachments, to, from, send_email, email_body, location, ...rest } = formData;
      const attachmentNames = Array.isArray(attachments)
        ? attachments.map((f: any) => (typeof f?.name === 'string' ? f.name : '')).filter(Boolean)
        : [];
      const mergedCustom = {
        ...(activity?.custom_fields || {}),
        ...(service_id ? { service_id } : {}),
        ...(attachmentNames.length ? { attachments_names: attachmentNames } : {}),
        ...(to ? { to } : {}),
        ...(from ? { from } : {}),
        ...(send_email ? { send_email } : {}),
        ...(email_body ? { email_body } : {}),
        ...(location ? { location } : {}),
      };

      // Normalize payload to avoid NOT NULL and type errors
      const normalized = {
        ...rest,
        tenant_id: tenantId,
        franchise_id: franchiseId,
        account_id: rest.account_id === 'none' ? null : (rest.account_id || null),
        contact_id: rest.contact_id === 'none' ? null : (rest.contact_id || null),
        lead_id: rest.lead_id === 'none' ? null : (rest.lead_id || null),
        due_date: rest.due_date ? new Date(rest.due_date).toISOString() : null,
        custom_fields: mergedCustom,
      };

      const { error } = await supabase
        .from('activities')
        .update(normalized)
        .eq('id', id);

      if (error) throw error;

      if (!options?.silent) {
        toast.success('Activity updated successfully');
      }
      if (!options?.keepEditing) {
        setIsEditing(false);
      }
      fetchActivity();
    } catch (error: any) {
      if (!options?.silent) {
        toast.error('Failed to update activity');
      }
      logger.error('Error:', error);
    }
  };

  const handleUpdate = async (formData: any) => {
    await saveActivity(formData);
  };

  const handleAutoSaveUpdate = async (formData: any) => {
    await saveActivity(formData, { silent: true, keepEditing: true });
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('activities')
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq('id', id);

      if (error) throw error;

      toast.success('Activity deleted successfully');
      navigate('/dashboard/activities');
    } catch (error: any) {
      toast.error('Failed to delete activity');
      logger.error('Error:', error);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Loading activity...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!activity) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Activity not found</p>
        </div>
      </DashboardLayout>
    );
  }

  const customFields = rawActivity?.custom_fields && typeof rawActivity.custom_fields === 'object'
    ? (rawActivity.custom_fields as Record<string, any>)
    : null;
  const emailTo = (customFields?.to ?? (activity?.to as any)) as string | undefined;
  const emailFrom = (customFields?.from ?? (activity?.from as any)) as string | undefined;
  const emailBody = (customFields?.email_body ?? (activity?.email_body as any)) as string | undefined;

  const title = activity.subject || typeLabels[activity.activity_type] || 'Activity';

  const StickyActionsRegister = () => {
    const { setActions, clearActions } = useStickyActions();

    useEffect(() => {
      if (isEditing) {
        setActions({
          right: [
            <Button key="cancel-edit" variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>,
          ],
        });
        return () => clearActions();
      }

      setActions({
        right: [
          <Button key="new-activity" variant="outline" onClick={() => navigate('/dashboard/activities/new')}>
            New Activity
          </Button>,
          <Button key="edit-activity" variant="outline" onClick={() => setIsEditing(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>,
          <Button key="delete-activity" variant="destructive" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>,
        ],
      });

      return () => clearActions();
    }, [clearActions, isEditing, navigate, setActions]);

    return null;
  };

  return (
    <DashboardLayout>
      <StickyActionsRegister />
      <DetailScreenTemplate
        title={title}
        subtitle={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{typeLabels[activity.activity_type] || activity.activity_type}</Badge>
            {activity.status && <Badge variant="outline">{statusLabels[activity.status] || activity.status}</Badge>}
          </div>
        }
        breadcrumbs={[
          { label: 'Activities', to: '/dashboard/activities' },
          { label: title },
        ]}
        // Edit/New/Cancel/Delete now live in the sticky bottom action bar,
        // matching Account/Contact/Opportunity Detail, instead of this
        // page's own top-of-page button row.
      >
        {isEditing ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Activity Details</CardTitle>
              </CardHeader>
              <CardContent>
                <ActivityForm
                  initialData={activity}
                  onSubmit={handleUpdate}
                  onAutoSave={autoSave ? handleAutoSaveUpdate : undefined}
                  onCancel={() => setIsEditing(false)}
                  autoSave={autoSave}
                />
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            {activity.activity_type === 'email' && (emailTo || emailFrom || emailBody) && (
              <Card>
                <CardHeader>
                  <CardTitle>Email</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {emailFrom ? (
                    <div className="space-y-1">
                      <div className="text-sm font-medium">From</div>
                      <div className="text-sm text-muted-foreground">{emailFrom}</div>
                    </div>
                  ) : null}
                  {emailTo ? (
                    <div className="space-y-1">
                      <div className="text-sm font-medium">To</div>
                      <div className="text-sm text-muted-foreground">{emailTo}</div>
                    </div>
                  ) : null}
                  {emailBody ? (
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Body</div>
                      <div className="rounded-md border p-3 text-sm whitespace-pre-wrap break-words">
                        {emailBody}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Activity Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Type</p>
                    <p className="font-medium">{typeLabels[activity.activity_type] || activity.activity_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="font-medium">{statusLabels[activity.status] || activity.status}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Priority</p>
                    <p className="font-medium">{priorityLabels[activity.priority] || activity.priority || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{activity.activity_type === 'meeting' ? 'Start Time' : 'Due Date'}</p>
                    <p className="font-medium">{activity.due_date ? formatDate(activity.due_date) : '-'}</p>
                  </div>
                </div>

                {(activity.lead_id || activity.account_id || activity.contact_id) && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Related To</p>
                    <div className="flex flex-wrap gap-2">
                      {activity.lead_id && (
                        <Button variant="link" className="p-0 h-auto" onClick={() => navigate(`/dashboard/leads/${activity.lead_id}`)}>
                          View Lead
                        </Button>
                      )}
                      {activity.account_id && (
                        <Button variant="link" className="p-0 h-auto" onClick={() => navigate(`/dashboard/accounts/${activity.account_id}`)}>
                          View Account
                        </Button>
                      )}
                      {activity.contact_id && (
                        <Button variant="link" className="p-0 h-auto" onClick={() => navigate(`/dashboard/contacts/${activity.contact_id}`)}>
                          View Contact
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {activity.location && (
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="mt-1">{activity.location}</p>
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground">{activity.activity_type === 'email' ? 'Body' : 'Description / Notes'}</p>
                  <p className="mt-1 whitespace-pre-wrap">{activity.description || 'No description.'}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DetailScreenTemplate>
      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDelete}
        title="Delete Activity"
        description="Are you sure you want to delete this activity? This action cannot be undone."
      />
    </DashboardLayout>
  );
}
