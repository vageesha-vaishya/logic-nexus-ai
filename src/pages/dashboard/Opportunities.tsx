import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, TrendingUp } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { ViewToggle, ViewMode } from '@/components/ui/view-toggle';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { matchText, TextOp } from '@/lib/utils';

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

export default function Opportunities() {
  const navigate = useNavigate();
  const { supabase, context } = useCRM();
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Advanced per-column filters
  const [nameQuery, setNameQuery] = useState('');
  const [nameOp, setNameOp] = useState<TextOp>('contains');
  const [accountQuery, setAccountQuery] = useState('');
  const [accountOp, setAccountOp] = useState<TextOp>('contains');
  const [stageAdv, setStageAdv] = useState<string>('');
  const [amountMin, setAmountMin] = useState<string>('');
  const [amountMax, setAmountMax] = useState<string>('');
  const [closeStart, setCloseStart] = useState<string>('');
  const [closeEnd, setCloseEnd] = useState<string>('');
  const [probMin, setProbMin] = useState<string>('');
  const [probMax, setProbMax] = useState<string>('');

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const fetchOpportunities = async () => {
    try {
      const { data, error } = await supabase
        .from('opportunities')
        .select(`
          *,
          accounts:account_id(name),
          contacts:contact_id(first_name, last_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOpportunities(data || []);
    } catch (error: any) {
      toast.error('Failed to load opportunities', {
        description: error.message,
      });
    } finally {
      setLoading(false);
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

  const totalValue = opportunities.reduce((sum, opp) => sum + (Number(opp.amount) || 0), 0);
  const openOpportunities = opportunities.filter(opp => !['closed_won', 'closed_lost'].includes(opp.stage));
  const wonOpportunities = opportunities.filter(opp => opp.stage === 'closed_won');

  // Derived list with advanced filters applied
  const filteredOpportunitiesAdvanced = opportunities.filter((opp) => {
    if (nameQuery && !matchText(opp.name || '', nameQuery, nameOp)) return false;
    if (accountQuery && !matchText(opp.accounts?.name || '', accountQuery, accountOp)) return false;
    if (stageAdv && stageAdv !== 'any' && opp.stage !== stageAdv) return false;

    const amountNum = Number(opp.amount) || 0;
    if (amountMin && amountNum < Number(amountMin)) return false;
    if (amountMax && amountNum > Number(amountMax)) return false;

    const closeDate = opp.close_date ? new Date(opp.close_date) : null;
    if (closeStart && closeDate && closeDate < new Date(closeStart)) return false;
    if (closeEnd && closeDate && closeDate > new Date(closeEnd)) return false;
    if ((closeStart || closeEnd) && !closeDate) return false;

    const probNum = Number(opp.probability) || 0;
    if (probMin && probNum < Number(probMin)) return false;
    if (probMax && probNum > Number(probMax)) return false;

    return true;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Opportunities</h1>
            <p className="text-muted-foreground">Manage your sales pipeline</p>
          </div>
          <div className="flex gap-2 items-center">
            <ViewToggle value={viewMode} onChange={setViewMode} />
            <Button variant="outline" onClick={() => navigate('/dashboard/opportunities/pipeline')}>
              Pipeline View
            </Button>
            <Button onClick={() => navigate('/dashboard/opportunities/new')}>
              <Plus className="mr-2 h-4 w-4" />
              New Opportunity
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pipeline Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
              <p className="text-xs text-muted-foreground">
                {opportunities.length} total opportunities
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Opportunities</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{openOpportunities.length}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(openOpportunities.reduce((sum, opp) => sum + (Number(opp.amount) || 0), 0))} value
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Closed Won</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{wonOpportunities.length}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(wonOpportunities.reduce((sum, opp) => sum + (Number(opp.amount) || 0), 0))} value
              </p>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <Card>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            </CardContent>
          </Card>
        ) : opportunities.length === 0 ? (
          <Card>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                No opportunities yet. Create your first opportunity to get started.
              </div>
            </CardContent>
          </Card>
        ) : viewMode === 'list' ? (
          <Card>
            <CardHeader>
              <CardTitle>All Opportunities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <p className="text-sm text-muted-foreground">Combine any filters below; results intersect across all criteria.</p>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <div className="flex gap-2">
                      <Select value={nameOp} onValueChange={(v) => setNameOp(v as TextOp)}>
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contains">Contains</SelectItem>
                          <SelectItem value="starts_with">Starts with</SelectItem>
                          <SelectItem value="equals">Equals</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input placeholder="Search name" value={nameQuery} onChange={(e) => setNameQuery(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Account</Label>
                    <div className="flex gap-2">
                      <Select value={accountOp} onValueChange={(v) => setAccountOp(v as TextOp)}>
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contains">Contains</SelectItem>
                          <SelectItem value="starts_with">Starts with</SelectItem>
                          <SelectItem value="equals">Equals</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input placeholder="Search account" value={accountQuery} onChange={(e) => setAccountQuery(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Stage</Label>
                    <Select value={stageAdv} onValueChange={setStageAdv}>
                      <SelectTrigger>
                        <SelectValue placeholder="Any stage" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        <SelectItem value="prospecting">Prospecting</SelectItem>
                        <SelectItem value="qualification">Qualification</SelectItem>
                        <SelectItem value="needs_analysis">Needs Analysis</SelectItem>
                        <SelectItem value="value_proposition">Value Proposition</SelectItem>
                        <SelectItem value="proposal">Proposal</SelectItem>
                        <SelectItem value="negotiation">Negotiation</SelectItem>
                        <SelectItem value="closed_won">Closed Won</SelectItem>
                        <SelectItem value="closed_lost">Closed Lost</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Amount range</Label>
                    <div className="flex gap-2">
                      <Input type="number" placeholder="Min" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} />
                      <Input type="number" placeholder="Max" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Close date range</Label>
                    <div className="flex gap-2">
                      <Input type="date" value={closeStart} onChange={(e) => setCloseStart(e.target.value)} />
                      <Input type="date" value={closeEnd} onChange={(e) => setCloseEnd(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Probability range (%)</Label>
                    <div className="flex gap-2">
                      <Input type="number" placeholder="Min" value={probMin} onChange={(e) => setProbMin(e.target.value)} />
                      <Input type="number" placeholder="Max" value={probMax} onChange={(e) => setProbMax(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Close Date</TableHead>
                    <TableHead>Probability</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOpportunitiesAdvanced.map((opportunity) => (
                    <TableRow
                      key={opportunity.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/dashboard/opportunities/${opportunity.id}`)}
                    >
                      <TableCell className="font-medium">{opportunity.name}</TableCell>
                      <TableCell>{opportunity.accounts?.name || '-'}</TableCell>
                      <TableCell>
                        <Badge className={stageColors[opportunity.stage]}>
                          {stageLabels[opportunity.stage]}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(opportunity.amount)}</TableCell>
                      <TableCell>{formatDate(opportunity.close_date)}</TableCell>
                      <TableCell>{opportunity.probability ? `${opportunity.probability}%` : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredOpportunitiesAdvanced.map((opportunity) => (
              <Card key={opportunity.id} className="hover:shadow transition-shadow cursor-pointer" onClick={() => navigate(`/dashboard/opportunities/${opportunity.id}`)}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base truncate">{opportunity.name}</CardTitle>
                    <Badge className={stageColors[opportunity.stage]}>{stageLabels[opportunity.stage]}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground flex items-center justify-between">
                  <span className="truncate">{opportunity.accounts?.name || '-'}</span>
                  <span>{formatCurrency(opportunity.amount)}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredOpportunitiesAdvanced.map((opportunity) => (
              <Card key={opportunity.id} className="hover:shadow-lg transition-shadow cursor-pointer h-full" onClick={() => navigate(`/dashboard/opportunities/${opportunity.id}`)}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <Badge className={stageColors[opportunity.stage]}> {stageLabels[opportunity.stage]} </Badge>
                    <Badge variant="outline">{opportunity.accounts?.name || '-'}</Badge>
                  </div>
                  <CardTitle className="mt-4">{opportunity.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Amount</span>
                    <span className="font-medium">{formatCurrency(opportunity.amount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Close Date</span>
                    <span>{formatDate(opportunity.close_date)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Probability</span>
                    <span>{opportunity.probability ? `${opportunity.probability}%` : '-'}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      }
      </div>
    </DashboardLayout>
  );
}