import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OpportunityForm } from '@/components/crm/OpportunityForm';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OpportunityItemsEditor } from '@/components/crm/OpportunityItemsEditor';

const stageColors: Record<string, string> = {
  prospecting: 'bg-slate-500',
  qualification: 'bg-blue-500',
  needs_analysis: 'bg-cyan-500',
  value_proposition: 'bg-indigo-500',
  proposal: 'bg-purple-500',
  negotiation: 'bg-orange-500',
  closed_won: 'bg-green-500',
  closed_lost: 'bg-red-500',
};

const stageLabels: Record<string, string> = {
  prospecting: 'Prospecting',
  qualification: 'Qualification',
  needs_analysis: 'Needs Analysis',
  value_proposition: 'Value Proposition',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

export default function OpportunityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { supabase } = useCRM();
  const [opportunity, setOpportunity] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sfIdInput, setSfIdInput] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(true);

  useEffect(() => {
    fetchOpportunity();
  }, [id]);

  const fetchOpportunity = async () => {
    try {
      const { data, error } = await supabase
        .from('opportunities')
        .select(`
          *,
          accounts:account_id(name),
          contacts:contact_id(first_name, last_name),
          leads:lead_id(first_name, last_name, company)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setOpportunity(data);
      // Cast to any for newly added fields not yet in generated Supabase types
      setSfIdInput((data as any)?.salesforce_opportunity_id || '');
    } catch (error: any) {
      toast.error('Failed to load opportunity', {
        description: error.message,
      });
      navigate('/dashboard/opportunities');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (formData: any) => {
    try {
      const updateData = {
        name: formData.name,
        description: formData.description || null,
        stage: formData.stage,
        amount: formData.amount ? parseFloat(formData.amount) : null,
        probability: formData.probability ? parseInt(formData.probability) : null,
        close_date: formData.close_date || null,
        account_id: formData.account_id || null,
        contact_id: formData.contact_id || null,
        lead_id: formData.lead_id || null,
        lead_source: formData.lead_source || null,
        next_step: formData.next_step || null,
        competitors: formData.competitors || null,
        type: formData.type || null,
        forecast_category: formData.forecast_category || null,
        closed_at: ['closed_won', 'closed_lost'].includes(formData.stage) ? new Date().toISOString() : null,
      };

      const { error } = await supabase
        .from('opportunities')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast.success('Opportunity updated successfully');
      setIsEditing(false);
      fetchOpportunity();
    } catch (error: any) {
      toast.error('Failed to update opportunity', {
        description: error.message,
      });
    }
  };

  const saveSalesforceId = async () => {
    try {
      const { error } = await supabase
        .from('opportunities')
        // Cast payload to any since generated types may not include new column yet
        .update({ salesforce_opportunity_id: sfIdInput || null } as any)
        .eq('id', id);

      if (error) throw error;
      toast.success('SOS Opportunity ID saved');
      fetchOpportunity();
    } catch (error: any) {
      toast.error('Failed to save SOS ID', { description: error.message });
    }
  };

  const syncSalesforce = async () => {
    try {
      setSyncing(true);
      const { data, error } = await supabase.functions.invoke('salesforce-sync-opportunity', {
        body: { opportunity_id: id },
      });
      if (error) throw error;
      toast.success('SOS sync completed');
      fetchOpportunity();
    } catch (error: any) {
      toast.error('SOS sync failed', { description: error.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('opportunities')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Opportunity deleted successfully');
      navigate('/dashboard/opportunities');
    } catch (error: any) {
      toast.error('Failed to delete opportunity', {
        description: error.message,
      });
    }
  };

  useEffect(() => {
    const fetchQuotes = async () => {
      if (!id) return;
      try {
        const { data, error } = await supabase
          .from('quotes')
          .select('*')
          .eq('opportunity_id', id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setQuotes(data || []);
      } catch (err: any) {
        console.error('Failed to load related quotes:', err.message);
      } finally {
        setQuotesLoading(false);
      }
    };
    fetchQuotes();
  }, [id]);

  const makePrimary = async (quoteId: string) => {
    try {
      const { error } = await supabase
        .from('quotes')
        .update({ is_primary: true, opportunity_id: id } as any)
        .eq('id', quoteId);
      if (error) throw error;
      toast.success('Primary quote updated');
      await fetchOpportunity();
      const { data } = await supabase
        .from('quotes')
        .select('*')
        .eq('opportunity_id', id)
        .order('created_at', { ascending: false });
      setQuotes(data || []);
    } catch (err: any) {
      toast.error('Failed to set primary quote', { description: err.message });
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </DashboardLayout>
    );
  }

  if (!opportunity) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/opportunities')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{opportunity.name}</h1>
              <p className="text-muted-foreground">Opportunity Details</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditing(!isEditing)}>
              <Edit className="mr-2 h-4 w-4" />
              {isEditing ? 'Cancel' : 'Edit'}
            </Button>
            <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        {isEditing ? (
          <>
          <Card>
            <CardHeader>
              <CardTitle>Edit Opportunity</CardTitle>
            </CardHeader>
            <CardContent>
              <OpportunityForm
                opportunity={opportunity}
                onSubmit={handleUpdate}
                onCancel={() => setIsEditing(false)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SOS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Sync Status</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {opportunity.salesforce_sync_status || 'pending'}
                    </Badge>
                    {opportunity.salesforce_last_synced && (
                      <span className="text-xs text-muted-foreground">
                        Last: {formatDate(opportunity.salesforce_last_synced)}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="sf-id">SOS Opportunity ID</Label>
                  <div className="flex gap-2 mt-1">
                    <Input id="sf-id" value={sfIdInput} onChange={(e) => setSfIdInput(e.target.value)} placeholder="006XXXXXXXXXXXX" />
                    <Button variant="outline" onClick={saveSalesforceId}>Save</Button>
                  </div>
                </div>
              </div>
              {opportunity.salesforce_error && (
                <div>
                  <p className="text-sm text-muted-foreground">Last Error</p>
                  <p className="mt-1 text-sm text-red-600 break-words">{opportunity.salesforce_error}</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={syncSalesforce} disabled={!sfIdInput || syncing}>
                  {syncing ? 'Syncing…' : 'Sync to SOS'}
                </Button>
              </div>
            </CardContent>
          </Card>
          </>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Opportunity Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Stage</p>
                    <Badge className={stageColors[opportunity.stage]}>
                      {stageLabels[opportunity.stage]}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p className="text-lg font-semibold">{formatCurrency(opportunity.amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Probability</p>
                    <p className="font-medium">{opportunity.probability ? `${opportunity.probability}%` : '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Expected Close Date</p>
                    <p className="font-medium">{formatDate(opportunity.close_date)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Account</p>
                    <p className="font-medium">{opportunity.accounts?.name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Primary Contact</p>
                    <p className="font-medium">
                      {opportunity.contacts
                        ? `${opportunity.contacts.first_name} ${opportunity.contacts.last_name}`
                        : '-'}
                    </p>
                  </div>
                  {opportunity.lead_source && (
                    <div>
                      <p className="text-sm text-muted-foreground">Lead Source</p>
                      <p className="font-medium capitalize">{opportunity.lead_source.replace('_', ' ')}</p>
                    </div>
                  )}
                  {opportunity.type && (
                    <div>
                      <p className="text-sm text-muted-foreground">Type</p>
                      <p className="font-medium">{opportunity.type}</p>
                    </div>
                  )}
                </div>

                {opportunity.description && (
                  <div>
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="mt-1">{opportunity.description}</p>
                  </div>
                )}

                {opportunity.next_step && (
                  <div>
                    <p className="text-sm text-muted-foreground">Next Step</p>
                    <p className="mt-1">{opportunity.next_step}</p>
                  </div>
                )}

                {opportunity.competitors && (
                  <div>
                    <p className="text-sm text-muted-foreground">Competitors</p>
                    <p className="mt-1">{opportunity.competitors}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Quotes</CardTitle>
                <Button size="sm" onClick={() => navigate('/dashboard/quotes/new')}>New Quote</Button>
              </CardHeader>
              <CardContent>
                {quotesLoading ? (
                  <div className="text-sm text-muted-foreground">Loading quotes...</div>
                ) : quotes.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No quotes linked to this opportunity.</div>
                ) : (
                  <div className="space-y-3">
                    {quotes.map((q) => (
                      <div key={q.id} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{q.quote_number || q.id.slice(0,8)}</p>
                          <p className="text-xs text-muted-foreground">Status: {q.status} • Total: {String(q.total ?? q.total_amount ?? 0)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {q.is_primary ? (
                            <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">Primary</span>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => makePrimary(q.id)}>Make Primary</Button>
                          )}
                          <Button size="sm" onClick={() => navigate(`/dashboard/quotes/${q.id}`)}>View</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Opportunity Items Editor */}
            <OpportunityItemsEditor opportunityId={id!} />

            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">{formatDate(opportunity.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p className="font-medium">{formatDate(opportunity.updated_at)}</p>
                </div>
                {opportunity.closed_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Closed</p>
                    <p className="font-medium">{formatDate(opportunity.closed_at)}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the opportunity.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}