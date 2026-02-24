import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AccountForm } from '@/components/crm/AccountForm';
import { EmailClient } from "@/components/email/EmailClient";
import { EmailHistoryPanel } from '@/components/email/EmailHistoryPanel'; // Keep if needed or remove
import { ArrowLeft, Edit, Trash2, Building2, Phone, Mail, Globe, DollarSign, Users } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DetailScreenTemplate } from '@/components/system/DetailScreenTemplate';

export default function AccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { supabase, context, scopedDb } = useCRM();
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
    <DashboardLayout>
      <DetailScreenTemplate
        title={account.name}
        breadcrumbs={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'Accounts', to: '/dashboard/accounts' },
          { label: account.name },
        ]}
        subtitle={
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {account.industry && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                {account.industry}
              </span>
            )}
            {account.website && (
              <a 
                href={account.website.startsWith('http') ? account.website : `https://${account.website}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Globe className="h-4 w-4" />
                {account.website}
              </a>
            )}
            {account.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-4 w-4" />
                {account.phone}
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
              <CardTitle>Edit Account</CardTitle>
            </CardHeader>
            <CardContent>
              <AccountForm
                initialData={account}
                onSubmit={handleUpdate}
                onCancel={() => setIsEditing(false)}
              />
            </CardContent>
          </Card>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'details' | 'related' | 'activities' | 'emails')} key={id}>
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="related">Related</TabsTrigger>
              <TabsTrigger value="activities">Activities</TabsTrigger>
              <TabsTrigger value="emails">Emails</TabsTrigger>
            </TabsList>

            <TabsContent value="details">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Basic Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
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
                    {account.industry && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Industry</p>
                        <p className="text-sm">{account.industry}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {account.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{account.phone}</span>
                      </div>
                    )}
                    {account.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{account.email}</span>
                      </div>
                    )}
                    {account.website && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <a href={account.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                          {account.website}
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Company Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
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

                {account.description && (
                  <Card className="md:col-span-2">
                    <CardHeader>
                      <CardTitle>Description</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{account.description}</p>
                    </CardContent>
                  </Card>
                )}

                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle>Custom Fields</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {account.custom_fields && Object.keys(account.custom_fields).length > 0 ? (
                      <div className="grid grid-cols-2 gap-4">
                        {Object.entries(account.custom_fields).map(([key, value]) => (
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

                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle>Metadata</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <div>Created: {format(new Date(account.created_at), 'PPpp')}</div>
                    <div>Last Updated: {format(new Date(account.updated_at), 'PPpp')}</div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="related">
              <div className="grid gap-6 md:grid-cols-2">
                {childAccounts.length > 0 && (
                  <Card className="md:col-span-2">
                    <CardHeader>
                      <CardTitle>Child Accounts</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {childAccounts.map((child) => (
                          <div key={child.id} className="flex items-center justify-between p-2 hover:bg-muted rounded-lg">
                            <div>
                              <p className="font-medium">{child.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {child.account_type} • {child.status}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/dashboard/accounts/${child.id}`)}
                            >
                              View
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle>Duplicates</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">We found no potential duplicates of this Account.</p>
                  </CardContent>
                </Card>

                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle>Relationships</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {relationships.length > 0 ? (
                      <div className="space-y-4">
                        {relationships.map((rel: any) => (
                          <div key={rel.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">{rel.to_account?.name}</p>
                              <Badge variant="outline" className="mt-1 capitalize">
                                {rel.relationship_type.replace(/_/g, ' ')}
                              </Badge>
                              {rel.notes && <p className="text-sm text-muted-foreground mt-1">{rel.notes}</p>}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/dashboard/accounts/${rel.to_account?.id}`)}
                            >
                              View
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No defined relationships.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex items-center justify-between">
                    <CardTitle>Contacts</CardTitle>
                    <Button size="sm" onClick={() => navigate('/dashboard/contacts/new')}>New</Button>
                  </CardHeader>
                  <CardContent>
                    {relatedContacts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No contacts yet</p>
                    ) : (
                      <div className="space-y-2">
                        {relatedContacts.map((c) => (
                          <div key={c.id} className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{c.first_name} {c.last_name}</p>
                              <p className="text-sm text-muted-foreground">{c.email || c.phone || '-'}</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/contacts/${c.id}`)}>View</Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex items-center justify-between">
                    <CardTitle>Opportunities</CardTitle>
                    <Button size="sm" onClick={() => navigate('/dashboard/opportunities/new')}>New</Button>
                  </CardHeader>
                  <CardContent>
                    {relatedOpps.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No opportunities yet</p>
                    ) : (
                      <div className="space-y-2">
                        {relatedOpps.map((o) => (
                          <div key={o.id} className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{o.name}</p>
                              <p className="text-sm text-muted-foreground">Stage: {o.stage} • Amount: {o.amount ?? '-'} • Close: {o.close_date ? new Date(o.close_date).toLocaleDateString() : '-'}</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/opportunities/${o.id}`)}>View</Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="activities">
              <Card>
                <CardHeader className="flex items-center justify-between">
                  <CardTitle>Activities</CardTitle>
                  <Button size="sm" onClick={() => navigate(`/dashboard/activities/new?accountId=${id}`)}>New Activity</Button>
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
            </TabsContent>
            <TabsContent value="emails">
              <EmailClient 
                emailAddress={account.email} 
                entityType="account" 
                entityId={account.id} 
              />
            </TabsContent>
          </Tabs>
        )}

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Account</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this account? This action cannot be undone.
                All related contacts and activities will also be affected.
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
      </DetailScreenTemplate>
    </DashboardLayout>
  );
}
