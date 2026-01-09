import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ContactForm } from '@/components/crm/ContactForm';
import { ArrowLeft, Edit, Trash2, User, Phone, Mail, Building2, Linkedin } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { supabase } = useCRM();
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
  }, [id]);

  const fetchContact = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          *,
          accounts (name),
          reports_to_contact:reports_to (first_name, last_name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setContact(data);
    } catch (error: any) {
      toast.error('Failed to load contact');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivities = async (contactId: string) => {
    try {
      const { data, error } = await supabase
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
      const { data, error } = await supabase
        .from('segment_members')
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
      const { error } = await supabase
        .from('contacts')
        .update({
          ...formData,
          account_id: formData.account_id === 'none' || formData.account_id === '' ? null : formData.account_id,
          reports_to: formData.reports_to === 'none' || formData.reports_to === '' ? null : formData.reports_to,
        })
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
      const { error } = await supabase
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/contacts')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{contact.first_name} {contact.last_name}</h1>
              <p className="text-muted-foreground">Contact Details</p>
            </div>
          </div>
          {!isEditing && (
            <div className="flex gap-2">
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
        </div>

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
                {contact.reports_to_contact && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Reports To</p>
                    <Button
                      variant="link"
                      className="p-0 h-auto text-primary"
                      onClick={() => navigate(`/dashboard/contacts/${contact.reports_to}`)}
                    >
                      {contact.reports_to_contact.first_name} {contact.reports_to_contact.last_name}
                    </Button>
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
      </div>
    </DashboardLayout>
  );
}
