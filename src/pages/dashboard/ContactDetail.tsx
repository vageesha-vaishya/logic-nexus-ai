import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { DeleteConfirmDialog } from '@/components/common/DeleteConfirmDialog';
import { UnifiedPartnerForm } from '@/components/crm/UnifiedPartnerForm';
import { EmailHistoryPanel } from '@/features/module-communications/components/email/EmailHistoryPanel';
import { Building2, Phone, Mail, User, Linkedin, Star, Clock } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { 
    EnterpriseSheet, 
    EnterpriseField, 
    EnterpriseStatButton 
} from '@/components/ui/enterprise/EnterpriseComponents';
import { DetailScreenTemplate } from '@/components/system/DetailScreenTemplate';
import { EnterpriseNotebook, EnterpriseTab } from '@/components/ui/enterprise/EnterpriseTabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useStickyActions } from '@/components/layout/StickyActionsContext';
import { logger } from "@/lib/logger";

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { context, scopedDb } = useCRM();
  const [contact, setContact] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [activeSegments, setActiveSegments] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const autoSave = Boolean((location.state as { autoSave?: boolean } | null)?.autoSave);

  useEffect(() => {
    if (id) {
      fetchContact();
      fetchSegments(id);
      fetchActivities(id);
    }
  }, [id]);

  const fetchContact = async () => {
    try {
      // No `accounts(name)` embed: v_contacts was rebuilt on core.parties +
      // crm.contact_extensions (migration 20260529070000) and no longer
      // references the legacy public.accounts table, so PostgREST can't
      // resolve that relationship and returns 400 -- every contact page
      // failed to load. Resolve the account name with a separate lookup
      // against v_accounts instead, keeping `contact.accounts.name` shaped
      // the way the rest of this component expects.
      const { data, error } = await scopedDb
        .from('v_contacts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      let accounts: { name: string } | null = null;
      if (data?.account_id) {
        const { data: account } = await scopedDb
          .from('v_accounts')
          .select('name')
          .eq('id', data.account_id)
          .maybeSingle();
        if (account?.name) accounts = { name: account.name };
      }
      setContact({ ...data, accounts });
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
    } catch (err) { logger.error(err); }
  };

  const fetchSegments = async (contactId: string) => {
    try {
      const { data } = await scopedDb.from('segment_members' as any).select('segment:segment_id(id, name)').eq('entity_id', contactId);
      if (data) setActiveSegments(data.map((d: any) => d.segment));
    } catch (e) {
      // ignore
    }
  };

  const saveContact = async (formData: any, options?: { silent?: boolean; keepEditing?: boolean }) => {
      try {
        // Remove form-specific fields
        const updateData = { ...formData };
        delete updateData.type;

        const { error } = await scopedDb.from('v_contacts').update(updateData).eq('id', id);
        if (error) throw error;
        if (!options?.silent) {
          toast.success('Contact updated');
        }
        if (!options?.keepEditing) {
          setIsEditing(false);
        }
        fetchContact();
      } catch (e) {
        if (!options?.silent) {
          toast.error('Update failed');
        }
      }
  };

  const handleUpdate = async (formData: any) => {
    await saveContact(formData);
  };

  const handleAutoSaveUpdate = async (formData: any) => {
    await saveContact(formData, { silent: true, keepEditing: true });
  };

  const handleDelete = async () => {
      try {
          await scopedDb.from('v_contacts').delete().eq('id', id);
          navigate('/dashboard/contacts');
      } catch (e) { toast.error('Delete failed'); }
  };

  if (loading || !contact) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

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
          <Button key="new-contact" variant="outline" onClick={() => navigate('/dashboard/contacts/new')}>
            New Contact
          </Button>,
          <Button key="edit-contact" variant="outline" onClick={() => setIsEditing(true)}>
            Edit
          </Button>,
          <Button key="delete-contact" variant="destructive" onClick={() => setShowDeleteDialog(true)}>
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
            title={`${contact.first_name} ${contact.last_name}`}
            subtitle={contact.is_primary ? <Badge variant="outline" className="rounded-full px-2 font-normal">Primary</Badge> : undefined}
            breadcrumbs={[
                { label: 'Contacts', to: '/dashboard/contacts' },
                { label: `${contact.first_name} ${contact.last_name}` },
            ]}
            // Edit/New/Delete already live in the sticky bottom action bar
            // (StickyActionsRegister above) -- this used to duplicate the
            // exact same buttons/handlers up here too.
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
                                        <span className="text-sm font-medium text-muted-foreground">
                                            {contact.title || 'Contact'}
                                        </span>
                                    </div>
                                    <h2 className="text-3xl font-bold text-foreground">{contact.first_name} {contact.last_name}</h2>
                                    {contact.accounts && (
                                        <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                                            <Building2 className="h-4 w-4" />
                                            <span className="font-medium text-primary hover:underline cursor-pointer">{contact.accounts.name}</span>
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
                                                {contact.lifecycle_stage && <Badge variant="secondary" className="rounded-full px-2 font-normal bg-status-success text-status-success-foreground hover:bg-status-success/80">{contact.lifecycle_stage}</Badge>}
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
                        onAutoSave={autoSave ? handleAutoSaveUpdate : undefined}
                        onCancel={() => setIsEditing(false)}
                        autoSave={autoSave}
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
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </DetailScreenTemplate>

        <DeleteConfirmDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
            onConfirm={handleDelete}
            title="Delete Contact?"
            description="This action cannot be undone."
        />
    </DashboardLayout>
  );
}
