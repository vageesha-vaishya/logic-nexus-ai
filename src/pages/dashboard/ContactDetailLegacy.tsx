import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ContactForm } from '@/components/crm/ContactForm';
import { EmailHistoryPanel } from '@/components/email/EmailHistoryPanel';
import { Edit, Trash2, User, Phone, Mail, Building2, Linkedin } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  EnterpriseSheet,
  EnterpriseField,
  EnterpriseStatButton,
  EnterpriseFormLayout,
  EnterpriseNotebook,
  EnterpriseTab,
  EnterpriseActivityFeed,
  EnterpriseCard,
  EnterpriseTable,
  type Column,
} from '@/components/ui/enterprise';

// Column definitions moved outside component to prevent recreation on every render
const activityColumns: Column<any>[] = [
  { key: 'subject', label: 'Subject', width: '200px' },
  { key: 'activity_type', label: 'Type', width: '120px', render: (value) => <Badge variant="outline">{value}</Badge> },
  { key: 'status', label: 'Status', width: '120px', render: (value) => <Badge variant="secondary">{value?.replace(/_/g, ' ')}</Badge> },
  { key: 'due_date', label: 'Due Date', width: '150px', render: (value) => value ? format(new Date(value), 'PPP') : 'No due date' },
];

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { supabase, context, scopedDb } = useCRM();
  const [contact, setContact] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const [activeSegments, setActiveSegments] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      fetchContact();
      fetchSegments(id);
      fetchActivities(id);
    }
  }, [id, context]);

  const fetchContact = async () => {
    try {
      console.log('Fetching contact with ID:', id);
      console.log('Current context:', context);
      
      const { data, error } = await scopedDb
        .from('contacts')
        .select(`
          *,
          accounts (name)
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Supabase error fetching contact:', error);
        throw error;
      }
      
      console.log('Contact data fetched:', data);
      setContact(data);
    } catch (error: any) {
      toast.error('Failed to load contact');
      console.error('Error in fetchContact:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivities = async (contactId: string) => {
    try {
      const { data, error } = await scopedDb
        .from('activities')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      setActivities(data || []);
    } catch (err) {
      console.error('Failed to load activities', err);
    }
  };

  const fetchSegments = async (contactId: string) => {
    try {
      const { data, error } = await scopedDb
        .from('segment_members' as any) 
        .select(`
          segment:segment_id(id, name, description)
        `)
        .eq('entity_id', contactId);

      if (!error && data) {
        setActiveSegments(data.map((d: any) => d.segment));
      }
    } catch (e) {
      console.log('Segments module not active');
    }
  };

  const handleUpdate = async (formData: any) => {
    try {
      const toUuidOrNull = (v: any) => {
        if (v === undefined || v === null) return null;
        const s = String(v).trim().toLowerCase();
        if (s === '' || s === 'none' || s === 'null') return null;
        return v;
      };

      const parseJsonSafe = (s: any) => {
        if (!s) return {};
        if (typeof s !== 'string') return s;
        const trimmed = s.trim();
        if (!trimmed) return {};
        try {
          return JSON.parse(trimmed);
        } catch {
          return {};
        }
      };

      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        title: formData.title || null,
        department: formData.department || null,
        email: formData.email || null,
        phone: formData.phone || null,
        mobile: formData.mobile || null,
        linkedin_url: formData.linkedin_url || null,
        lifecycle_stage: formData.lifecycle_stage || null,
        lead_source: formData.lead_source || null,
        is_primary: !!formData.is_primary,
        notes: formData.notes || null,
        // IDs
        account_id: toUuidOrNull(formData.account_id),
        franchise_id: toUuidOrNull(formData.franchise_id),
        // NEVER update tenant_id here; keep RLS-owned. Omit from payload.
        // JSON fields
        social_profiles: parseJsonSafe(formData.social_profiles),
        custom_fields: parseJsonSafe(formData.custom_fields),
      };

      const { error } = await scopedDb
        .from('contacts')
        .update(payload)
        .eq('id', id);

      if (error) throw error;

      toast.success('Contact updated successfully');
      setIsEditing(false);
      fetchContact();
    } catch (error: any) {
      toast.error('Failed to update contact');
      console.error('Error:', error);
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await scopedDb
        .from('contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Contact deleted successfully');
      navigate('/dashboard/contacts');
    } catch (error: any) {
      toast.error('Failed to delete contact');
      console.error('Error:', error);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading contact...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!contact) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Contact not found</p>
          <Button onClick={() => navigate('/dashboard/contacts')} className="mt-4">
            Back to Contacts
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const contactName = `${contact.first_name} ${contact.last_name}`;

  return (
    <div className="h-screen w-full bg-[#f9fafb] overflow-hidden">
      <EnterpriseFormLayout
        title={contactName}
        breadcrumbs={[
          { label: 'Contacts', to: '/dashboard/contacts' },
          { label: contactName },
        ]}
        actions={
          !isEditing && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="h-8 border-[#714B67] text-[#714B67] hover:bg-[#714B67]/10"
                onClick={() => setIsEditing(true)}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-500"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )
        }
      >
        {/* Main Sheet */}
        <EnterpriseSheet
          header={
            !isEditing && (
              <div className="flex flex-col gap-4 w-full">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{contactName}</h1>
                </div>

                {/* Contact Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                  {/* Left Column */}
                  <div className="space-y-3">
                    {contact.title && (
                      <div className="flex items-center gap-2 text-[13px]">
                        <User className="h-3.5 w-3.5 text-gray-500" />
                        <span className="text-gray-700">{contact.title}</span>
                      </div>
                    )}
                    {contact.email && (
                      <div className="flex items-center gap-2 text-[13px]">
                        <Mail className="h-3.5 w-3.5 text-gray-500" />
                        <a href={`mailto:${contact.email}`} className="text-[#714B67] hover:underline font-medium">{contact.email}</a>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-2 text-[13px]">
                        <Phone className="h-3.5 w-3.5 text-gray-500" />
                        <span className="text-gray-700">{contact.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Right Column */}
                  <div className="space-y-1">
                    {contact.accounts?.name && (
                      <EnterpriseField
                        label="Account"
                        value={
                          <Button
                            variant="link"
                            className="p-0 h-auto text-[#714B67] hover:underline"
                            onClick={() => navigate(`/dashboard/accounts/${contact.account_id}`)}
                          >
                            {contact.accounts.name}
                          </Button>
                        }
                      />
                    )}
                    {contact.is_primary && (
                      <EnterpriseField label="Status" value={<Badge variant="outline">Primary Contact</Badge>} />
                    )}
                  </div>
                </div>
              </div>
            )
          }
        >
          {isEditing ? (
            <ContactForm
              initialData={contact}
              onSubmit={handleUpdate}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <EnterpriseNotebook>
              <EnterpriseTab label="Details" value="details">
                <div className="space-y-6">
                  {/* Basic Information */}
                  <EnterpriseCard
                    title="Basic Information"
                    description="Contact title and department"
                  >
                    <div className="space-y-4">
                      {contact.title && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Title</p>
                          <p className="text-sm">{contact.title}</p>
                        </div>
                      )}
                      {contact.department && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Department</p>
                          <p className="text-sm">{contact.department}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Tags</p>
                        <div className="flex gap-2 flex-wrap mt-2">
                          {contact.is_primary && (
                            <Badge variant="outline">Primary Contact</Badge>
                          )}
                          {contact.lifecycle_stage && (
                            <Badge variant="secondary" className="capitalize">{contact.lifecycle_stage}</Badge>
                          )}
                          {contact.lead_source && (
                            <Badge variant="outline" className="capitalize">Source: {contact.lead_source}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </EnterpriseCard>

                  {/* Contact Information */}
                  <EnterpriseCard
                    title="Contact Information"
                    description="Email, phone, and social profiles"
                  >
                    <div className="space-y-4">
                      {contact.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <a href={`mailto:${contact.email}`} className="text-sm text-primary hover:underline">
                            {contact.email}
                          </a>
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <a href={`tel:${contact.phone}`} className="text-sm">{contact.phone}</a>
                        </div>
                      )}
                      {contact.mobile && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{contact.mobile} (Mobile)</span>
                        </div>
                      )}
                      {contact.linkedin_url && (
                        <div className="flex items-center gap-2">
                          <Linkedin className="h-4 w-4 text-muted-foreground" />
                          <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                            LinkedIn Profile
                          </a>
                        </div>
                      )}
                      {contact.social_profiles && Object.keys(contact.social_profiles).length > 0 && (
                        <div className="space-y-2 mt-4 pt-4 border-t">
                          <p className="text-sm font-medium text-muted-foreground">Social Profiles</p>
                          {Object.entries(contact.social_profiles).map(([network, url]) => (
                            <div key={network} className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground capitalize w-16">{network}:</span>
                              <a href={String(url)} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate">
                                {String(url)}
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </EnterpriseCard>

                  {/* Segments */}
                  <EnterpriseCard
                    title="Segments"
                    description={`${activeSegments.length} active segments`}
                  >
                    {activeSegments.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {activeSegments.map((seg: any) => (
                          <Badge key={seg.id} variant="secondary">{seg.name}</Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No active segments.</p>
                    )}
                  </EnterpriseCard>

                  {/* Custom Fields */}
                  {contact.custom_fields && Object.keys(contact.custom_fields).length > 0 && (
                    <EnterpriseCard
                      title="Custom Fields"
                      description="Additional custom data"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        {Object.entries(contact.custom_fields).map(([key, value]) => (
                          <div key={key}>
                            <p className="text-sm font-medium text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</p>
                            <p className="text-sm">{String(value)}</p>
                          </div>
                        ))}
                      </div>
                    </EnterpriseCard>
                  )}

                  {/* Notes */}
                  {contact.notes && (
                    <EnterpriseCard
                      title="Notes"
                      description="Contact notes and additional information"
                    >
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contact.notes}</p>
                    </EnterpriseCard>
                  )}

                  {/* Metadata */}
                  <EnterpriseCard
                    title="Metadata"
                    description="System timestamps"
                  >
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div>Created: {format(new Date(contact.created_at), 'PPpp')}</div>
                      <div>Last Updated: {format(new Date(contact.updated_at), 'PPpp')}</div>
                    </div>
                  </EnterpriseCard>
                </div>
              </EnterpriseTab>

              <EnterpriseTab label="Activities" value="activities">
                <EnterpriseCard
                  title="Activities"
                  description={`${activities.length} recorded activities`}
                >
                  {activities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <p className="text-sm text-muted-foreground">No activities recorded yet.</p>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => navigate(`/dashboard/activities/new?contactId=${id}`)}
                        className="mt-2"
                      >
                        Create one
                      </Button>
                    </div>
                  ) : (
                    <EnterpriseTable
                      columns={activityColumns}
                      data={activities}
                      rowKey={(row) => row.id}
                      onRowClick={(row) => navigate(`/dashboard/activities/${row.id}`)}
                      emptyState={<p className="text-center py-8 text-muted-foreground">No activities recorded yet.</p>}
                    />
                  )}
                </EnterpriseCard>
              </EnterpriseTab>

              <EnterpriseTab label="Email History" value="emails">
                <div className="min-h-[300px]">
                  <EmailHistoryPanel
                    emailAddress={contact.email}
                    entityType="contact"
                    entityId={contact.id}
                    tenantId={contact.tenant_id}
                  />
                </div>
              </EnterpriseTab>
            </EnterpriseNotebook>
          )}
        </EnterpriseSheet>

        {/* Activity Sidebar */}
        <EnterpriseActivityFeed className="hidden xl:flex shrink-0 w-[400px]" />
      </EnterpriseFormLayout>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. All related activities will also be affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
