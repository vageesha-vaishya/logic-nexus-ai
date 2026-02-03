import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WidgetProps, FinancialMetric } from '@/types/dashboard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useEffect, useState } from 'react';
import { dashboardAnalyticsService } from '@/services/dashboardAnalytics';
import { Loader2 } from 'lucide-react';

export function FinancialWidget({ config }: WidgetProps) {
  const [data, setData] = useState<FinancialMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const metrics = await dashboardAnalyticsService.getFinancialMetrics();
        setData(metrics);
      } catch (error) {
        console.error('Failed to load financial data', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">{config.title || 'Financial Performance'}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{config.title || 'Financial Performance'}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        <div className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(value) => `$${value}`} />
                <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }} 
                    itemStyle={{ color: 'var(--foreground)' }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, undefined]}
                />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cost" name="Cost" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            </BarChart>
            </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
