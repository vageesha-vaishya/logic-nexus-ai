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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Opportunities</h1>
            <p className="text-muted-foreground">Manage your sales pipeline</p>
          </div>
          <Button onClick={() => navigate('/dashboard/opportunities/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Opportunity
          </Button>
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

        <Card>
          <CardHeader>
            <CardTitle>All Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : opportunities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No opportunities yet. Create your first opportunity to get started.
              </div>
            ) : (
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
                  {opportunities.map((opportunity) => (
                    <TableRow
                      key={opportunity.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/dashboard/opportunities/${opportunity.id}`)}
                    >
                      <TableCell className="font-medium">{opportunity.name}</TableCell>
                      <TableCell>
                        {opportunity.accounts?.name || '-'}
                      </TableCell>
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
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}