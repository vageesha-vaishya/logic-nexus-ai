import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AccountForm } from '@/components/crm/AccountForm';
import { EmailClient } from "@/components/email/EmailClient";
import { Trash2, Building2, Phone, Mail, Globe, DollarSign, Users } from 'lucide-react';
import { invokeFunction } from '@/lib/supabase-functions';
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
  EnterpriseTable,
  EnterpriseCard,
  type Column,
} from '@/components/ui/enterprise';

export default function AccountDetailLegacy() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { context, scopedDb } = useCRM();
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [relatedContacts, setRelatedContacts] = useState<any[]>([]);
  const [relatedOpps, setRelatedOpps] = useState<any[]>([]);
  const [parentAccount, setParentAccount] = useState<any>(null);
  const [childAccounts, setChildAccounts] = useState<any[]>([]);
  const [relationships, setRelationships] = useState<any[]>([]);
  const [activeSegments, setActiveSegments] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [tab, setTab] = useState<'details' | 'related' | 'activities' | 'emails'>('details');
  const [isEnriching, setIsEnriching] = useState(false);

  useEffect(() => {
    // Reset UI state when navigating between accounts
    setIsEditing(false);
    setTab('details');
    if (id) fetchAccount();
  }, [id]);

  const fetchAccount = async () => {
    try {
      const { data, error } = await scopedDb
        .from('accounts')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      setAccount(data);
      
      // Fetch parent account if exists
      if (data?.parent_account_id) {
        const { data: parentData } = await scopedDb
          .from('accounts')
          .select('id, name')
          .eq('id', data.parent_account_id)
          .maybeSingle();
        if (parentData) setParentAccount(parentData);
      }
      
      await Promise.all([
        fetchRelatedContacts(id as string),
        fetchRelatedOpportunities(id as string),
        fetchChildAccounts(id as string),
        fetchRelationships(id as string),
        fetchSegments(id as string),
        fetchActivities(id as string),
      ]);
    } catch (error: any) {
      toast.error('Failed to load account');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivities = async (accountId: string) => {
    try {
      const { data, error } = await scopedDb
        .from('activities')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      setActivities(data || []);
    } catch (err) {
      console.error('Failed to load activities', err);
    }
  };

  const fetchRelationships = async (accountId: string) => {
    try {
      // Check if table exists by trying to select 1
      const { data, error } = await scopedDb
        .from('account_relationships' as any)
        .select(`
          id, relationship_type, notes,
          to_account:to_account_id(id, name)
        `)
        .eq('from_account_id', accountId);

      if (!error) setRelationships(data || []);
    } catch (e) {
      console.log('Relationships module not active');
    }
  };

  const fetchSegments = async (accountId: string) => {
    try {
      const { data, error } = await scopedDb
        .from('segment_members' as any)
        .select(`
          segment:segment_id(id, name, description)
        `)
        .eq('entity_id', accountId);

      if (!error && data) {
        setActiveSegments(data.map((d: any) => d.segment));
      }
    } catch (e) {
      console.log('Segments module not active');
    }
  };


  const fetchRelatedContacts = async (accountId: string) => {
    try {
      const { data, error } = await scopedDb
        .from('contacts')
        .select('id, first_name, last_name, email, phone')
        .eq('account_id', accountId)
        .limit(5);
      if (error) throw error;
      console.log('Related contacts fetched:', data);
      setRelatedContacts(data || []);
    } catch (err) {
      console.error('Failed to load related contacts', err);
    }
  };

  const fetchRelatedOpportunities = async (accountId: string) => {
    try {
      const { data, error } = await scopedDb
        .from('opportunities')
        .select('id, name, stage, amount, close_date')
        .eq('account_id', accountId)
        .limit(5);
      if (error) throw error;
      setRelatedOpps(data || []);
    } catch (err) {
      console.error('Failed to load related opportunities', err);
    }
  };

  const fetchChildAccounts = async (accountId: string) => {
    try {
      const { data, error } = await scopedDb
        .from('accounts')
        .select('id, name, account_type, status')
        .eq('parent_account_id', accountId)
        .order('name');
      if (error) throw error;
      setChildAccounts(data || []);
    } catch (err) {
      console.error('Failed to load child accounts', err);
    }
  };

  const handleUpdate = async (formData: any) => {
    try {
      // Normalize and avoid overwriting with empty strings
      const payload: any = {
        ...formData,
        parent_account_id:
          formData.parent_account_id === 'none' || formData.parent_account_id === ''
            ? null
            : formData.parent_account_id || null,
        annual_revenue: formData.annual_revenue ? parseFloat(formData.annual_revenue) : null,
        employee_count: formData.employee_count ? parseInt(formData.employee_count) : null,
      };

      // Remove empty string fields so we don't try to set invalid UUIDs or empty values
      ['tenant_id', 'franchise_id', 'website', 'phone', 'email', 'industry', 'description'].forEach((key) => {
        if (payload[key] === '') delete payload[key];
      });

      const { error } = await scopedDb
        .from('accounts')
        .update(payload)
        .eq('id', id);

      if (error) throw error;

      toast.success('Account updated successfully');
      setIsEditing(false);
      fetchAccount();
    } catch (error: any) {
      toast.error('Failed to update account');
      console.error('Error:', error);
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await scopedDb
        .from('accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Account deleted successfully');
      navigate('/dashboard/accounts');
    } catch (error: any) {
      toast.error('Failed to delete account');
      console.error('Error:', error);
    }
  };

  const handleEnrich = async () => {
    try {
      setIsEnriching(true);
      const { data, error } = await invokeFunction<any>('enrich-company', {
        body: {
          account_id: id,
          name: account?.name || '',
          website: account?.website || '',
          domain: (account?.email || '').split('@')[1] || '',
          tenant_id: context.tenantId || null,
        },
      });
      if (error) throw error;
      const enriched = data || {};
      const payload: any = {
        website: enriched.website || account.website || null,
        email: enriched.email || account.email || null,
        phone: enriched.phone || account.phone || null,
        industry: enriched.industry || account.industry || null,
        annual_revenue: enriched.annual_revenue ?? account.annual_revenue ?? null,
        employee_count: enriched.employee_count ?? account.employee_count ?? null,
        custom_fields: {
          ...(account.custom_fields || {}),
          enrichment: enriched,
        },
      };
      const { error: updateError } = await scopedDb
        .from('accounts')
        .update(payload)
        .eq('id', id);
      if (updateError) throw updateError;
      toast.success('Company enriched');
      fetchAccount();
    } catch (err: any) {
      toast.error(err?.message || 'Enrichment service unavailable');
    } finally {
      setIsEnriching(false);
    }
  };

  // Calculate stats
  const totalOppValue = relatedOpps.reduce((sum, opp) => sum + (opp.amount || 0), 0);

  // Define columns for related contacts table
  const contactColumns: Column<any>[] = [
    { key: 'first_name', label: 'First Name', width: '150px' },
    { key: 'last_name', label: 'Last Name', width: '150px' },
    { key: 'email', label: 'Email', width: '200px' },
    { key: 'phone', label: 'Phone', width: '150px' },
  ];

  // Define columns for child accounts table
  const childAccountColumns: Column<any>[] = [
    { key: 'name', label: 'Name', width: '200px' },
    { key: 'account_type', label: 'Type', width: '120px' },
    { key: 'status', label: 'Status', width: '120px', render: (value) => <Badge>{value}</Badge> },
  ];

  // Define columns for opportunities table
  const opportunityColumns: Column<any>[] = [
    { key: 'name', label: 'Opportunity', width: '200px' },
    { key: 'stage', label: 'Stage', width: '120px', render: (value) => <Badge>{value}</Badge> },
    { key: 'amount', label: 'Amount', width: '150px', render: (value) => `$${value?.toLocaleString() || '0.00'}` },
  ];

  // Define columns for activities table
  const activityColumns: Column<any>[] = [
    { key: 'subject', label: 'Subject', width: '200px' },
    { key: 'activity_type', label: 'Type', width: '120px', render: (value) => <Badge variant="outline">{value}</Badge> },
    { key: 'status', label: 'Status', width: '120px', render: (value) => <Badge variant="secondary">{value?.replace(/_/g, ' ')}</Badge> },
    { key: 'due_date', label: 'Due Date', width: '150px', render: (value) => value ? format(new Date(value), 'PPP') : 'No due date' },
  ];

  // Define columns for relationships table
  const relationshipColumns: Column<any>[] = [
    { key: 'to_account.name', label: 'Account', width: '200px', render: (value, row) => row.to_account?.name || '-' },
    { key: 'relationship_type', label: 'Type', width: '150px', render: (value) => <Badge variant="outline">{value?.replace(/_/g, ' ')}</Badge> },
    { key: 'notes', label: 'Notes', width: '250px', render: (value) => value || '-' },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading account...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!account) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Account not found</p>
          <Button onClick={() => navigate('/dashboard/accounts')} className="mt-4">
            Back to Accounts
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <div className="h-screen w-full bg-[#f9fafb] overflow-hidden">
      <EnterpriseFormLayout
        title={account.name}
        breadcrumbs={[
          { label: 'Accounts', to: '/dashboard/accounts' },
          { label: account.name },
        ]}
        status={account.status}
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
                onClick={handleEnrich}
                disabled={isEnriching}
              >
                {isEnriching ? 'Enriching…' : 'Enrich'}
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
          smartButtons={
            !isEditing && (
              <>
                <EnterpriseStatButton
                  icon={<DollarSign className="h-5 w-5" />}
                  label="Opportunity"
                  value={relatedOpps.length}
                />
                <EnterpriseStatButton
                  icon={<Users className="h-5 w-5" />}
                  label="Contacts"
                  value={relatedContacts.length}
                />
              </>
            )
          }
          header={
            !isEditing && (
              <div className="flex flex-col md:flex-row gap-6 w-full">
                {/* Logo / Image */}
                <div className="w-24 h-24 bg-muted rounded-sm flex items-center justify-center border shadow-sm shrink-0">
                  {account.logo_url ? (
                    <img src={account.logo_url} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <Building2 className="h-10 w-10 text-muted-foreground/50" />
                  )}
                </div>

                <div className="flex-1 flex flex-col gap-4">
                  {/* Title Section */}
                  <div>
                    <div className="flex items-center gap-6 mb-2">
                      <div className="flex items-center gap-2">
                        <input type="radio" checked={account.account_type !== 'individual'} readOnly className="accent-[#714B67] h-4 w-4" />
                        <span className="text-sm font-semibold text-gray-700">Company</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="radio" checked={account.account_type === 'individual'} readOnly className="accent-[#714B67] h-4 w-4" />
                        <span className="text-sm font-semibold text-gray-700">Individual</span>
                      </div>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900">{account.name}</h1>
                  </div>

                  {/* Address & Metadata Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 mt-2">
                    {/* Left Column: Address/Contact */}
                    <div className="space-y-4">
                      <div className="text-[13px] text-gray-900 font-normal leading-relaxed">
                        <div className="flex gap-8 mb-1">
                          <span className="font-bold min-w-[60px]">Address</span>
                          <div className="flex flex-col">
                            <span>{account.billing_street || 'Street...'}</span>
                            <span>{account.billing_city} {account.billing_state} {account.billing_postal_code}</span>
                            <span>{account.billing_country || 'United States'}</span>
                          </div>
                        </div>
                      </div>

                      {account.email && (
                        <div className="flex items-center gap-2 text-[13px]">
                          <Mail className="h-3.5 w-3.5 text-gray-500" />
                          <a href={`mailto:${account.email}`} className="text-[#714B67] hover:underline font-medium">{account.email}</a>
                        </div>
                      )}
                      {account.phone && (
                        <div className="flex items-center gap-2 text-[13px]">
                          <Phone className="h-3.5 w-3.5 text-gray-500" />
                          <span className="text-gray-700">{account.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Metadata */}
                    <div className="space-y-1">
                      <EnterpriseField label="Industry" value={account.industry || '-'} />
                      <EnterpriseField label="Website" value={
                        account.website ? (
                          <a href={account.website} target="_blank" rel="noopener noreferrer" className="text-[#714B67] hover:underline">{account.website}</a>
                        ) : '-'
                      } />
                      <EnterpriseField label="Tags" value={
                        <div className="flex gap-1 flex-wrap">
                          {account.account_type && <Badge variant="secondary" className="rounded-full px-2 font-normal bg-green-100 text-green-800 hover:bg-green-200">{account.account_type}</Badge>}
                          {account.status && <Badge variant="outline" className="rounded-full px-2 font-normal">{account.status}</Badge>}
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
            <AccountForm
              initialData={account}
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
                    description="Account type and status"
                  >
                    <div className="space-y-4">
                      {parentAccount && (
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm font-medium text-muted-foreground">Parent Account</p>
                          <Button
                            variant="link"
                            className="p-0 h-auto text-primary"
                            onClick={() => navigate(`/dashboard/accounts/${parentAccount.id}`)}
                          >
                            {parentAccount.name}
                          </Button>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Type</p>
                        <Badge className="mt-1">{account.account_type}</Badge>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Status</p>
                        <Badge className="mt-1">{account.status}</Badge>
                      </div>
                    </div>
                  </EnterpriseCard>

                  {/* Company Details */}
                  <EnterpriseCard
                    title="Company Details"
                    description="Financial and operational information"
                  >
                    <div className="space-y-4">
                      {account.annual_revenue && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Annual Revenue</p>
                            <p className="text-sm">${parseFloat(account.annual_revenue).toLocaleString()}</p>
                          </div>
                        </div>
                      )}
                      {account.employee_count && (
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Employees</p>
                            <p className="text-sm">{account.employee_count}</p>
                          </div>
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

                  {/* Description */}
                  {account.description && (
                    <EnterpriseCard
                      title="Description"
                      description="Account notes and details"
                    >
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{account.description}</p>
                    </EnterpriseCard>
                  )}

                  {/* Custom Fields */}
                  {account.custom_fields && Object.keys(account.custom_fields).length > 0 && (
                    <EnterpriseCard
                      title="Custom Fields"
                      description="Additional custom data"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        {Object.entries(account.custom_fields).map(([key, value]) => (
                          <div key={key}>
                            <p className="text-sm font-medium text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</p>
                            <p className="text-sm">{String(value)}</p>
                          </div>
                        ))}
                      </div>
                    </EnterpriseCard>
                  )}

                  {/* Metadata */}
                  <EnterpriseCard
                    title="Metadata"
                    description="System timestamps"
                  >
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div>Created: {format(new Date(account.created_at), 'PPpp')}</div>
                      <div>Last Updated: {format(new Date(account.updated_at), 'PPpp')}</div>
                    </div>
                  </EnterpriseCard>
                </div>
              </EnterpriseTab>

              <EnterpriseTab label="Related" value="related">
                <div className="space-y-6">
                  {/* Parent and Child Accounts */}
                  {childAccounts.length > 0 && (
                    <EnterpriseCard
                      title="Child Accounts"
                      description={`${childAccounts.length} subsidiary accounts`}
                    >
                      <EnterpriseTable
                        columns={childAccountColumns}
                        data={childAccounts}
                        rowKey={(row) => row.id}
                        onRowClick={(row) => navigate(`/dashboard/accounts/${row.id}`)}
                        emptyState={<p className="text-center py-8 text-muted-foreground">No child accounts.</p>}
                      />
                    </EnterpriseCard>
                  )}

                  {/* Relationships */}
                  <EnterpriseCard
                    title="Relationships"
                    description={`${relationships.length} defined relationships`}
                  >
                    {relationships.length > 0 ? (
                      <EnterpriseTable
                        columns={relationshipColumns}
                        data={relationships}
                        rowKey={(row) => row.id}
                        onRowClick={(row) => navigate(`/dashboard/accounts/${row.to_account?.id}`)}
                        emptyState={<p className="text-center py-8 text-muted-foreground">No relationships.</p>}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">No defined relationships.</p>
                    )}
                  </EnterpriseCard>
                </div>
              </EnterpriseTab>

              <EnterpriseTab label="Contacts" value="contacts">
                <EnterpriseCard
                  title="Related Contacts"
                  description={`${relatedContacts.length} contacts`}
                >
                  <EnterpriseTable
                    columns={contactColumns}
                    data={relatedContacts}
                    rowKey={(row) => row.id}
                    onRowClick={(row) => navigate(`/dashboard/contacts/${row.id}`)}
                    emptyState={<p className="text-center py-8 text-muted-foreground">No contacts yet. <Button variant="link" onClick={() => navigate('/dashboard/contacts/new')} className="p-0">Create one</Button></p>}
                  />
                </EnterpriseCard>
              </EnterpriseTab>

              <EnterpriseTab label="Opportunities" value="opportunities">
                <EnterpriseCard
                  title="Opportunities"
                  description={`${relatedOpps.length} opportunities · $${totalOppValue.toLocaleString()}`}
                >
                  <EnterpriseTable
                    columns={opportunityColumns}
                    data={relatedOpps}
                    rowKey={(row) => row.id}
                    onRowClick={(row) => navigate(`/dashboard/opportunities/${row.id}`)}
                    emptyState={<p className="text-center py-8 text-muted-foreground">No opportunities yet. <Button variant="link" onClick={() => navigate('/dashboard/opportunities/new')} className="p-0">Create one</Button></p>}
                  />
                </EnterpriseCard>
              </EnterpriseTab>

              <EnterpriseTab label="Activities" value="activities">
                <EnterpriseCard
                  title="Activities"
                  description={`${activities.length} recorded activities`}
                >
                  {activities.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No activities recorded yet. <Button variant="link" onClick={() => navigate(`/dashboard/activities/new?accountId=${id}`)} className="p-0">Create one</Button></p>
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

              <EnterpriseTab label="Emails" value="emails">
                <div className="min-h-[300px]">
                  <EmailClient
                    emailAddress={account.email}
                    entityType="account"
                    entityId={account.id}
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
            <AlertDialogTitle>Delete Account?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. All related contacts and activities will also be affected.</AlertDialogDescription>
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
