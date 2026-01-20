import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { matchText, TextOp } from '@/lib/utils';
import { OpportunityForm } from '@/components/crm/OpportunityForm';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { invokeFunction } from '@/lib/supabase-functions';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { OpportunityItemsEditor } from '@/components/crm/OpportunityItemsEditor';
import { EmailHistoryPanel } from '@/components/email/EmailHistoryPanel';
import { OpportunityHistoryTab } from '@/components/crm/OpportunityHistoryTab';
import { Opportunity, OpportunityHistory, OpportunityStage, stageColors, stageLabels } from './opportunities-data';
import type { Database } from '@/integrations/supabase/types';

export default function OpportunityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { supabase, context, scopedDb } = useCRM();
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<OpportunityHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sfIdInput, setSfIdInput] = useState('');
  const [syncing, setSyncing] = useState(false);
  type QuoteRow = Database['public']['Tables']['quotes']['Row'];
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(true);

  // Advanced quote filters
  const [quoteNumberQuery, setQuoteNumberQuery] = useState('');
  const [quoteNumberOp, setQuoteNumberOp] = useState<TextOp>('contains');
  const [quoteStatus, setQuoteStatus] = useState<string>('');
  const [quoteMinTotal, setQuoteMinTotal] = useState<string>('');
  const [quoteMaxTotal, setQuoteMaxTotal] = useState<string>('');
  const [quoteStartDate, setQuoteStartDate] = useState<string>('');
  const [quoteEndDate, setQuoteEndDate] = useState<string>('');

  const fetchOpportunity = useCallback(async () => {
    try {
      const { data, error } = await scopedDb
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
      setOpportunity(data as unknown as Opportunity);
      const extra = data as unknown as { salesforce_opportunity_id?: string | null };
      setSfIdInput(extra?.salesforce_opportunity_id || '');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to load opportunity', {
        description: message,
      });
      navigate('/dashboard/opportunities');
    } finally {
      setLoading(false);
    }
  }, [id, scopedDb, navigate]);

  useEffect(() => {
    fetchOpportunity();
  }, [fetchOpportunity]);

  const fetchHistory = async () => {
    if (!id) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await scopedDb
        .from('opportunity_probability_history' as never)
        .select(`
          *,
          changer:changed_by(first_name, last_name, email)
        `)
        .eq('opportunity_id', id)
        .order('changed_at', { ascending: false });

      if (error) throw error;
      setHistory((data || []) as OpportunityHistory[]);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleUpdate = async (formData: {
    name: string;
    description?: string;
    stage: OpportunityStage;
    amount?: string;
    probability?: string;
    close_date?: string;
    account_id?: string;
    contact_id?: string;
    lead_id?: string;
    lead_source?: Database['public']['Enums']['lead_source'];
    next_step?: string;
    competitors?: string;
    type?: string;
    forecast_category?: string;
    tenant_id?: string;
    franchise_id?: string;
  }) => {
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

      const { error } = await scopedDb
        .from('opportunities')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast.success('Opportunity updated successfully');
      setIsEditing(false);
      fetchOpportunity();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to update opportunity', {
        description: message,
      });
    }
  };

  const saveSalesforceId = async () => {
    try {
      const { error } = await scopedDb
        .from('opportunities')
        .update({ salesforce_opportunity_id: sfIdInput || null } as unknown as Database['public']['Tables']['opportunities']['Update'])
        .eq('id', id);

      if (error) throw error;
      toast.success('SOS Opportunity ID saved');
      fetchOpportunity();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to save SOS ID', { description: message });
    }
  };

  const syncSalesforce = async () => {
    try {
      setSyncing(true);
      // Trigger Salesforce sync via Edge Function
      const { data, error } = await invokeFunction('salesforce-sync-opportunity', {
        body: { opportunity_id: id }
      });
      if (error) throw error;
      toast.success('SOS sync completed');
      fetchOpportunity();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('SOS sync failed', { description: message });
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await scopedDb
        .from('opportunities')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Opportunity deleted successfully');
      navigate('/dashboard/opportunities');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to delete opportunity', {
        description: message,
      });
    }
  };

  useEffect(() => {
    const fetchQuotes = async () => {
      if (!id) return;
      try {
        const { data, error } = await scopedDb
          .from('quotes')
          .select('*')
          .eq('opportunity_id', id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setQuotes((data || []) as QuoteRow[]);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Failed to load related quotes:', message);
      } finally {
        setQuotesLoading(false);
      }
    };
    fetchQuotes();
  }, [id, scopedDb]);

  const makePrimary = async (quoteId: string) => {
    try {
      const { error } = await scopedDb
        .from('quotes')
        .update({ is_primary: true, opportunity_id: id } as unknown as Database['public']['Tables']['quotes']['Update'])
        .eq('id', quoteId);
      if (error) throw error;
      toast.success('Primary quote updated');
      await fetchOpportunity();
      const { data } = await scopedDb
        .from('quotes')
        .select('*')
        .eq('opportunity_id', id)
        .order('created_at', { ascending: false });
      setQuotes((data || []) as QuoteRow[]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Failed to set primary quote', { description: message });
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

  // Derived list: apply advanced filters to related quotes
  const filteredQuotesAdvanced = quotes.filter((q) => {
    const matchesNumber = matchText(
      (q.quote_number || (q.id ? String(q.id).slice(0, 8) : '')),
      quoteNumberQuery,
      quoteNumberOp
    );

    const statusVal = (q.status || '').toLowerCase();
    const matchesStatus = quoteStatus && quoteStatus !== 'any' ? statusVal === quoteStatus : true;

    const totalNum = Number(q.total_amount ?? 0);
    const matchesMin = quoteMinTotal ? totalNum >= Number(quoteMinTotal) : true;
    const matchesMax = quoteMaxTotal ? totalNum <= Number(quoteMaxTotal) : true;

    const created = q.created_at ? new Date(q.created_at) : null;
    const startOk = quoteStartDate ? (created ? created >= new Date(quoteStartDate) : false) : true;
    const endOk = quoteEndDate ? (created ? created <= new Date(quoteEndDate) : false) : true;

    return matchesNumber && matchesStatus && matchesMin && matchesMax && startOk && endOk;
  });

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
          <Tabs defaultValue="details" onValueChange={(val) => {
            if (val === 'history') fetchHistory();
          }}>
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="history">Stage & Probability History</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6">
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
                <Button size="sm" onClick={() => navigate(`/dashboard/quotes/new?opportunityId=${id}`)}>New Quote</Button>
              </CardHeader>
              <CardContent>
                {quotesLoading ? (
                  <div className="text-sm text-muted-foreground">Loading quotes...</div>
                ) : quotes.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No quotes linked to this opportunity.</div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-3 p-3 border rounded-md">
                      <p className="text-sm text-muted-foreground">Filter related quotes by number, status, total, and date.</p>
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Quote number</Label>
                          <div className="flex gap-2">
                            <Select value={quoteNumberOp} onValueChange={(v) => setQuoteNumberOp(v as TextOp)}>
                              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Operator" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="contains">Contains</SelectItem>
                                <SelectItem value="startsWith">Starts With</SelectItem>
                                <SelectItem value="equals">Equals</SelectItem>
                                <SelectItem value="endsWith">Ends With</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input placeholder="Search number" value={quoteNumberQuery} onChange={(e) => setQuoteNumberQuery(e.target.value)} />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Status</Label>
                          <Select value={quoteStatus} onValueChange={setQuoteStatus}>
                            <SelectTrigger><SelectValue placeholder="Any status" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Any</SelectItem>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="sent">Sent</SelectItem>
                              <SelectItem value="accepted">Accepted</SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Total amount</Label>
                          <div className="flex gap-2">
                            <Input type="number" placeholder="Min" value={quoteMinTotal} onChange={(e) => setQuoteMinTotal(e.target.value)} />
                            <Input type="number" placeholder="Max" value={quoteMaxTotal} onChange={(e) => setQuoteMaxTotal(e.target.value)} />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Created range</Label>
                          <div className="flex gap-2">
                            <Input type="date" value={quoteStartDate} onChange={(e) => setQuoteStartDate(e.target.value)} />
                            <Input type="date" value={quoteEndDate} onChange={(e) => setQuoteEndDate(e.target.value)} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {filteredQuotesAdvanced.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No matching quotes.</div>
                    ) : (
                      <div className="space-y-3">
                    {filteredQuotesAdvanced.map((q) => (
                      <div key={q.id} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{q.quote_number || q.id.slice(0,8)}</p>
                          <p className="text-xs text-muted-foreground">Status: {q.status} • Total: {String(q.total_amount ?? 0)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {(q as unknown as { is_primary?: boolean }).is_primary ? (
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
            </TabsContent>

            <TabsContent value="history" className="space-y-6">
              <OpportunityHistoryTab history={history} onRefresh={fetchHistory} />
            </TabsContent>

            <TabsContent value="emails" className="space-y-6">
              <EmailHistoryPanel 
                emailAddress={opportunity.contacts?.email || opportunity.leads?.email} 
                entityType="opportunity" 
                entityId={opportunity.id} 
                tenantId={opportunity.tenant_id}
              />
            </TabsContent>
          </Tabs>
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
