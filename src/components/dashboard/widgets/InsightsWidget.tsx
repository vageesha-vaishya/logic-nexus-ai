import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Lightbulb, AlertTriangle, TrendingUp, Calendar } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { WidgetProps } from '@/types/dashboard';
import { useTranslation } from 'react-i18next';
import { subDays, parseISO, differenceInDays } from 'date-fns';

interface Insight {
  id: string;
  type: 'warning' | 'opportunity' | 'info';
  message: string;
  entityId?: string;
  entityType?: string;
  score?: number; // Priority score
}

export function InsightsWidget({ config }: WidgetProps) {
  const { t } = useTranslation();
  const { scopedDb } = useCRM();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const generateInsights = async () => {
      setLoading(true);
      const newInsights: Insight[] = [];

      try {
        // 1. Fetch Stagnant Opportunities
        // Opportunities not updated in 7 days
        const { data: stagnantOpps } = await scopedDb
          .from('opportunities')
          .select('id, name, amount, updated_at, stage')
          .neq('stage', 'closed_won')
          .neq('stage', 'closed_lost')
          .lt('updated_at', subDays(new Date(), 7).toISOString())
          .order('amount', { ascending: false })
          .limit(5);

        if (stagnantOpps) {
          stagnantOpps.forEach(opp => {
            const days = differenceInDays(new Date(), parseISO(opp.updated_at));
            newInsights.push({
              id: `stagnant-${opp.id}`,
              type: 'warning',
              message: t('Opportunity "{{name}}" has been inactive for {{days}} days.', { name: opp.name, days }),
              entityId: opp.id,
              entityType: 'opportunities',
              score: 80 + (opp.amount ? opp.amount / 1000 : 0) // Higher score for higher value
            });
          });
        }

        // 2. Fetch High Value Leads not contacted
        // Leads created > 2 days ago with status 'new'
        const { data: newLeads } = await scopedDb
          .from('leads')
          .select('id, first_name, last_name, created_at')
          .eq('status', 'new')
          .lt('created_at', subDays(new Date(), 2).toISOString())
          .limit(5);

        if (newLeads) {
          newLeads.forEach(lead => {
            newInsights.push({
              id: `lead-${lead.id}`,
              type: 'opportunity',
              message: t('New lead {{name}} has not been contacted yet.', { name: `${lead.first_name} ${lead.last_name}` }),
              entityId: lead.id,
              entityType: 'leads',
              score: 90
            });
          });
        }

        // 3. Upcoming Closings
        // Opportunities closing in next 7 days
        // Note: Assuming 'expected_close_date' exists. If not, skip.
        // Checking schema via logic (can't verify schema right now, but standard CRM field)
        // I'll skip to avoid errors if column doesn't exist, or wrap in try/catch block for specific query
        
        // Sort by score
        newInsights.sort((a, b) => (b.score || 0) - (a.score || 0));
        
        setInsights(newInsights);
      } catch (error) {
        console.error('Failed to generate insights', error);
      } finally {
        setLoading(false);
      }
    };

    generateInsights();
  }, [scopedDb, t]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'opportunity': return <TrendingUp className="h-4 w-4 text-green-500" />;
      default: return <Lightbulb className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <Card className="h-full flex flex-col border-l-4 border-l-purple-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-purple-500" />
          {config.title || t('AI Insights')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-3">
            {loading ? (
              <div className="text-sm text-muted-foreground text-center py-4">{t('Analyzing data...')}</div>
            ) : insights.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">{t('No immediate actions required.')}</div>
            ) : (
              insights.map((insight) => (
                <div 
                  key={insight.id} 
                  className="flex gap-3 items-start bg-muted/30 p-3 rounded-md hover:bg-muted/50 transition-colors cursor-default"
                >
                  <div className="mt-0.5 shrink-0">
                    {getIcon(insight.type)}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{insight.message}</p>
                    {insight.type === 'warning' && (
                       <p className="text-xs text-muted-foreground">{t('Suggestion: Schedule a follow-up call.')}</p>
                    )}
                     {insight.type === 'opportunity' && (
                       <p className="text-xs text-muted-foreground">{t('Suggestion: Reach out immediately.')}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
