import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AccountForm } from '@/components/crm/AccountForm';
import { ArrowLeft, Edit, Trash2, Building2, Phone, Mail, Globe, DollarSign, Users } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { supabase, context } = useCRM();
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [relatedContacts, setRelatedContacts] = useState<any[]>([]);
  const [relatedOpps, setRelatedOpps] = useState<any[]>([]);

  useEffect(() => {
    if (id) fetchAccount();
  }, [id]);

  const fetchAccount = async () => {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select(`
          *,
          parent:parent_account_id(id, name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setAccount(data);
      await Promise.all([
        fetchRelatedContacts(id as string),
        fetchRelatedOpportunities(id as string),
      ]);
    } catch (error: any) {
      toast.error('Failed to load account');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedContacts = async (accountId: string) => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, phone')
        .eq('account_id', accountId)
        .limit(5);
      if (error) throw error;
      setRelatedContacts(data || []);
    } catch (err) {
      console.error('Failed to load related contacts', err);
    }
  };

  const fetchRelatedOpportunities = async (accountId: string) => {
    try {
      const { data, error } = await supabase
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

  const handleUpdate = async (formData: any) => {
    try {
      const { error } = await supabase
        .from('accounts')
        .update({
          ...formData,
          parent_account_id: formData.parent_account_id === 'none' ? null : (formData.parent_account_id || null),
          annual_revenue: formData.annual_revenue ? parseFloat(formData.annual_revenue) : null,
          employee_count: formData.employee_count ? parseInt(formData.employee_count) : null,
        })
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
      const { error } = await supabase
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/accounts')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{account.name}</h1>
              <p className="text-muted-foreground">Account Details</p>
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
          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="related">Related</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="news">News</TabsTrigger>
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
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Type</p>
                      <Badge className="mt-1">{account.account_type}</Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Status</p>
                      <Badge className="mt-1">{account.status}</Badge>
                    </div>
                    {account.parent?.name && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Parent Account</p>
                        <p className="text-sm">
                          <Link to={`/dashboard/accounts/${account.parent.id}`} className="text-primary hover:underline">
                            {account.parent.name}
                          </Link>
                        </p>
                      </div>
                    )}
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

                {account.description && (
                  <Card>
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
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle>Duplicates</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">We found no potential duplicates of this Account.</p>
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

            <TabsContent value="news">
              <Card>
                <CardHeader>
                  <CardTitle>News</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Company/industry news will appear here.</p>
                </CardContent>
              </Card>
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
      </div>
    </DashboardLayout>
  );
}
