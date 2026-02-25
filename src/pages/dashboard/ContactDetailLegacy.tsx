import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ContactForm } from '@/components/crm/ContactForm';
import { EmailHistoryPanel } from '@/components/email/EmailHistoryPanel';
import { ArrowLeft, Edit, Trash2, User, Phone, Mail, Building2, Linkedin } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { DetailScreenTemplate } from '@/components/system/DetailScreenTemplate';

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

  return (
    <DashboardLayout>
      <DetailScreenTemplate
        title={`${contact.first_name} ${contact.last_name}`}
        breadcrumbs={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'Contacts', to: '/dashboard/contacts' },
          { label: `${contact.first_name} ${contact.last_name}` },
        ]}
        subtitle={
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {contact.title && (
              <span className="inline-flex items-center gap-1">
                <User className="h-4 w-4" />
                {contact.title}
              </span>
            )}
            {contact.accounts?.name && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                {contact.accounts.name}
              </span>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                <Mail className="h-4 w-4" />
                {contact.email}
              </a>
            )}
            {contact.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-4 w-4" />
                {contact.phone}
              </span>
            )}
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            {!isEditing && (
              <>
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </>
            )}
          </div>
        }
      >
        {isEditing ? (
          <Card>
            <CardHeader>
              <CardTitle>Edit Contact</CardTitle>
            </CardHeader>
            <CardContent>
              <ContactForm
                initialData={contact}
                onSubmit={handleUpdate}
                onCancel={() => setIsEditing(false)}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                {contact.accounts && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Account</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{contact.accounts.name}</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                  <div className="space-y-1 mt-2 pt-2 border-t">
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Segments</CardTitle>
              </CardHeader>
              <CardContent>
                {activeSegments.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {activeSegments.map((seg: any) => (
                      <Badge key={seg.id} variant="secondary">{seg.name}</Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No active segments.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Custom Fields</CardTitle>
              </CardHeader>
              <CardContent>
                {contact.custom_fields && Object.keys(contact.custom_fields).length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(contact.custom_fields).map(([key, value]) => (
                      <div key={key}>
                        <p className="text-sm font-medium text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</p>
                        <p className="text-sm">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No custom fields defined.</p>
                )}
              </CardContent>
            </Card>

            <div className="md:col-span-2">
              <EmailHistoryPanel 
                emailAddress={contact.email} 
                entityType="contact" 
                entityId={contact.id} 
                tenantId={contact.tenant_id}
              />
            </div>

            {contact.notes && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contact.notes}</p>
                </CardContent>
              </Card>
            )}

            <Card className="md:col-span-2">
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Activities</CardTitle>
                <Button size="sm" onClick={() => navigate(`/dashboard/activities/new?contactId=${id}`)}>New Activity</Button>
              </CardHeader>
              <CardContent>
                {activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activities recorded yet.</p>
                ) : (
                  <div className="space-y-4">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/dashboard/activities/${activity.id}`)}>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{activity.subject}</p>
                            <Badge variant="outline" className="text-xs capitalize">{activity.activity_type}</Badge>
                            <Badge variant="secondary" className="text-xs capitalize">{activity.status.replace(/_/g, ' ')}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{activity.description || 'No description'}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Due: {activity.due_date ? format(new Date(activity.due_date), 'PPP') : 'No due date'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div>Created: {format(new Date(contact.created_at), 'PPpp')}</div>
                <div>Last Updated: {format(new Date(contact.updated_at), 'PPpp')}</div>
              </CardContent>
            </Card>
          </div>
        )}
      </DetailScreenTemplate>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this contact? This action cannot be undone.
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
    </DashboardLayout>
  );
}
