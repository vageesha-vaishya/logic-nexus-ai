import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Quote, QuoteStatus, statusConfig } from '@/pages/dashboard/quotes-data';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface QuoteStatusChartProps {
  quotes: Quote[];
}

const STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: '#6b7280', // gray-500
  pricing_review: '#6366f1', // indigo-500
  approved: '#22c55e', // green-500
  sent: '#3b82f6', // blue-500
  customer_reviewing: '#06b6d4', // cyan-500
  revision_requested: '#f59e0b', // amber-500
  accepted: '#10b981', // emerald-500
  rejected: '#ef4444', // red-500
  expired: '#f97316', // orange-500
};

export function QuoteStatusChart({ quotes }: QuoteStatusChartProps) {
  const chartData = useMemo(() => {
    if (!quotes.length) return [];

    const statusCounts = quotes.reduce((acc, quote) => {
      const status = quote.status;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<QuoteStatus, number>);

    return Object.entries(statusCounts)
      .map(([status, count]) => ({
        name: statusConfig[status as QuoteStatus]?.label || status,
        value: count,
        fill: STATUS_COLORS[status as QuoteStatus] || '#8884d8'
      }))
      .sort((a, b) => b.value - a.value);
  }, [quotes]);

  if (!quotes.length) return null;

  return (
    <Card className="col-span-1">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Quotes by Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [value, 'Quotes']}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
