import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import TitleStrip from '@/components/ui/title-strip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

type Stage =
  | 'prospecting'
  | 'qualification'
  | 'needs_analysis'
  | 'value_proposition'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';

const stageColors: Record<Stage, string> = {
  prospecting: 'bg-slate-500',
  qualification: 'bg-blue-500',
  needs_analysis: 'bg-cyan-500',
  value_proposition: 'bg-indigo-500',
  proposal: 'bg-purple-500',
  negotiation: 'bg-orange-500',
  closed_won: 'bg-green-500',
  closed_lost: 'bg-red-500',
};

const stageLabels: Record<Stage, string> = {
  prospecting: 'Prospecting',
  qualification: 'Qualification',
  needs_analysis: 'Needs Analysis',
  value_proposition: 'Value Proposition',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

const stages: Stage[] = [
  'prospecting',
  'qualification',
  'needs_analysis',
  'value_proposition',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
];

export default function OpportunitiesPipeline() {
  const navigate = useNavigate();
  const { supabase } = useCRM();
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
      toast.error('Failed to load pipeline', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  };

  const handleStageChange = async (id: string, newStage: Stage) => {
    try {
      const { error } = await supabase
        .from('opportunities')
        .update({ stage: newStage })
        .eq('id', id);
      if (error) throw error;
      setOpportunities((prev) => prev.map((o) => (o.id === id ? { ...o, stage: newStage } : o)));
      toast.success('Stage updated');
    } catch (error: any) {
      toast.error('Failed to update stage', { description: error.message });
    }
  };

  const grouped = stages.map((stage) => ({
    stage,
    items: opportunities.filter((o) => o.stage === stage),
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Pipeline</h1>
            <p className="text-muted-foreground">Kanban view of opportunity stages</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/dashboard/opportunities')}>Back to List</Button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading pipeline...</div>
        ) : (
          <div className="space-y-2">
            <TitleStrip label="Opportunities Pipeline" />
            <div className="flex gap-4 overflow-x-auto pb-2">
              {grouped.map(({ stage, items }) => (
                <div key={stage} className="min-w-[300px]">
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Badge className={stageColors[stage]}>{stageLabels[stage]}</Badge>
                        </CardTitle>
                        <span className="text-xs text-muted-foreground">{items.length}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {items.length === 0 ? (
                        <div className="text-xs text-muted-foreground py-4">No opportunities</div>
                      ) : (
                        items.map((opp) => (
                          <div key={opp.id} className="border rounded-md p-3 bg-white">
                            <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                <button
                                  className="text-left font-medium hover:underline"
                                  onClick={() => navigate(`/dashboard/opportunities/${opp.id}`)}
                                >
                                  {opp.name}
                                </button>
                                <div className="text-xs text-muted-foreground">
                                  {opp.accounts?.name || '-'}
                                </div>
                              </div>
                              <div className="text-sm font-semibold">
                                {formatCurrency(Number(opp.amount) || 0)}
                              </div>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <div className="text-xs text-muted-foreground">Close: {formatDate(opp.close_date)}</div>
                              <Select onValueChange={(v) => handleStageChange(opp.id, v as Stage)} defaultValue={opp.stage as Stage}>
                                <SelectTrigger className="h-8 w-[160px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {stages.map((s) => (
                                    <SelectItem key={s} value={s}>{stageLabels[s]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}