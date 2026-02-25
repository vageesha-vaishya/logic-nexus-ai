import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { UnifiedPartnerForm } from '@/components/crm/UnifiedPartnerForm';
import { EmailHistoryPanel } from '@/components/email/EmailHistoryPanel';
import { Building2, Phone, Mail, User, Linkedin, Star, Clock, Trash2 } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { 
    EnterpriseSheet, 
    EnterpriseField, 
    EnterpriseStatButton 
} from '@/components/ui/enterprise/EnterpriseComponents';
import { EnterpriseFormLayout } from '@/components/ui/enterprise/EnterpriseFormLayout';
import { EnterpriseNotebook, EnterpriseTab } from '@/components/ui/enterprise/EnterpriseTabs';
import { EnterpriseActivityFeed } from '@/components/ui/enterprise/EnterpriseActivityFeed';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { context, scopedDb } = useCRM();
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
      const { data, error } = await scopedDb
        .from('contacts')
        .select('*, accounts(name)')
        .eq('id', id)
        .single();

      if (error) throw error;
      setContact(data);
    } catch (error: any) {
      toast.error('Failed to load contact');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivities = async (contactId: string) => {
    try {
      const { data } = await scopedDb.from('activities').select('*').eq('contact_id', contactId);
      setActivities(data || []);
    } catch (err) { console.error(err); }
  };

  const fetchSegments = async (contactId: string) => {
    try {
      const { data } = await scopedDb.from('segment_members' as any).select('segment:segment_id(id, name)').eq('entity_id', contactId);
      if (data) setActiveSegments(data.map((d: any) => d.segment));
    } catch (e) {}
  };

  const handleUpdate = async (formData: any) => {
      try {
        // Remove form-specific fields
        const updateData = { ...formData };
        delete updateData.type;

        const { error } = await scopedDb.from('contacts').update(updateData).eq('id', id);
        if (error) throw error;
        toast.success('Contact updated');
        setIsEditing(false);
        fetchContact();
      } catch (e) { toast.error('Update failed'); }
  };

  const handleDelete = async () => {
      try {
          await scopedDb.from('contacts').delete().eq('id', id);
          navigate('/dashboard/contacts');
      } catch (e) { toast.error('Delete failed'); }
  };

  if (loading || !contact) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f9fafb]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#f9fafb] overflow-hidden">
        <EnterpriseFormLayout 
            title={`${contact.first_name} ${contact.last_name}`}
            breadcrumbs={[
                { label: 'Contacts', to: '/dashboard/contacts' },
                { label: `${contact.first_name} ${contact.last_name}` },
            ]}
            status={contact.is_primary ? 'Primary' : undefined}
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
                            variant="outline" 
                            className="h-8 text-gray-600"
                            onClick={() => navigate('/dashboard/contacts/new')}
                        >
                            Create
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
            <EnterpriseSheet
                smartButtons={
                    !isEditing && (
                        <>
                            <EnterpriseStatButton 
                                icon={<Clock className="h-5 w-5" />}
                                label="Activities"
                                value={activities.length}
                            />
                            <EnterpriseStatButton 
                                icon={<Mail className="h-5 w-5" />}
                                label="Emails"
                                value="-"
                            />
                        </>
                    )
                }
                header={
                    !isEditing && (
                        <div className="flex flex-col md:flex-row gap-6 w-full">
                            <Avatar className="w-24 h-24 rounded-sm">
                                <AvatarFallback className="text-2xl rounded-sm bg-primary/10 text-primary">
                                    {contact.first_name[0]}{contact.last_name[0]}
                                </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 flex flex-col gap-4">
                                <div>
                                    <div className="flex items-center gap-4 mb-2">
                                        <span className="text-sm font-medium text-gray-500">
                                            {contact.title || 'Contact'}
                                        </span>
                                    </div>
                                    <h1 className="text-3xl font-bold text-gray-900">{contact.first_name} {contact.last_name}</h1>
                                    {contact.accounts && (
                                        <div className="flex items-center gap-2 mt-1 text-gray-500">
                                            <Building2 className="h-4 w-4" />
                                            <span className="font-medium text-[#714B67] hover:underline cursor-pointer">{contact.accounts.name}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 mt-2">
                                    <div className="space-y-4">
                                        <EnterpriseField label="Email" value={contact.email} icon={<Mail className="h-3.5 w-3.5" />} />
                                        <EnterpriseField label="Phone" value={contact.phone} icon={<Phone className="h-3.5 w-3.5" />} />
                                        <EnterpriseField label="Mobile" value={contact.mobile} icon={<Phone className="h-3.5 w-3.5" />} />
                                    </div>
                                    <div className="space-y-3">
                                        <EnterpriseField label="Department" value={contact.department} />
                                        <EnterpriseField label="Language" value="English" />
                                        <EnterpriseField label="Tags" value={
                                            <div className="flex gap-1 flex-wrap">
                                                {contact.lead_source && <Badge variant="outline" className="rounded-full px-2 font-normal">{contact.lead_source}</Badge>}
                                                {contact.lifecycle_stage && <Badge variant="secondary" className="rounded-full px-2 font-normal bg-green-100 text-green-800 hover:bg-green-200">{contact.lifecycle_stage}</Badge>}
                                            </div>
                                        } />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }
            >
                {isEditing ? (
                    <UnifiedPartnerForm 
                        initialData={contact} 
                        entityType="contact"
                        mode="edit"
                        onSubmit={handleUpdate} 
                        onCancel={() => setIsEditing(false)} 
                    />
                ) : (
                    <EnterpriseNotebook>
                        <EnterpriseTab label="Sales & Purchase" value="sales">
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-sm font-semibold mb-3">Segments</h3>
                                    {activeSegments.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {activeSegments.map(s => <Badge key={s.id} variant="secondary">{s.name}</Badge>)}
                                        </div>
                                    ) : <p className="text-sm text-muted-foreground italic">No segments.</p>}
                                </div>
                                
                                {contact.custom_fields && (
                                    <div>
                                        <h3 className="text-sm font-semibold mb-3">Custom Fields</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            {Object.entries(contact.custom_fields).map(([k, v]) => (
                                                <EnterpriseField key={k} label={k} value={String(v)} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </EnterpriseTab>

                        <EnterpriseTab label="Internal Notes" value="notes">
                            <div className="min-h-[200px] p-4 bg-muted/10 rounded-lg border border-dashed">
                                <p className="text-sm whitespace-pre-wrap">{contact.notes || 'No notes.'}</p>
                            </div>
                        </EnterpriseTab>

                        <EnterpriseTab label="Emails" value="emails">
                            <EmailHistoryPanel 
                                emailAddress={contact.email} 
                                entityType="contact" 
                                entityId={contact.id} 
                                tenantId={contact.tenant_id}
                            />
                        </EnterpriseTab>
                    </EnterpriseNotebook>
                )}
            </EnterpriseSheet>

            <EnterpriseActivityFeed className="hidden xl:flex shrink-0 w-[400px]" />
        </EnterpriseFormLayout>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Contact?</AlertDialogTitle>
                    <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
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
