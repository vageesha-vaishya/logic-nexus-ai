import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WidgetProps } from '@/types/dashboard';
import { useCRM } from '@/hooks/useCRM';
import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import { Loader2 } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export function CustomChartWidget({ config }: WidgetProps) {
  const { t } = useTranslation();
  const { scopedDb } = useCRM();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const settings = config.settings || {};
  const entity = settings.entity || 'leads';
  const groupBy = settings.groupBy || 'status';
  const chartType = settings.chartType || 'bar';

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Map entity to table name
        const tableMap: Record<string, string> = {
          leads: 'leads',
          opportunities: 'opportunities',
          quotes: 'quotes',
          shipments: 'shipments',
        };

        const tableName = tableMap[entity];
        if (!tableName) {
          throw new Error(`Unknown entity: ${entity}`);
        }

        // Fetch data
        // Optimization: Select only the group by column to minimize data transfer
        const { data: rawData, error: dbError } = await scopedDb
          .from(tableName as any)
          .select(groupBy);

        if (dbError) throw dbError;

        // Aggregate data client-side
        const aggregated = (rawData || []).reduce((acc: Record<string, number>, item: any) => {
          const key = item[groupBy] || 'Unknown';
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});

        // Format for Recharts
        const chartData = Object.entries(aggregated).map(([name, value]) => ({
          name,
          value,
        }));

        setData(chartData);
      } catch (err: any) {
        console.error('Failed to load chart data', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [scopedDb, entity, groupBy]);

  const renderChart = () => {
    if (chartType === 'pie') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'line') {
       return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#8884d8" />
          </LineChart>
        </ResponsiveContainer>
       );
    }

    if (chartType === 'area') {
       return (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="value" stroke="#8884d8" fill="#8884d8" />
          </AreaChart>
        </ResponsiveContainer>
       );
    }

    // Default to Bar
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip cursor={{ fill: 'transparent' }} />
          <Bar dataKey="value" fill="#8884d8">
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">
          {config.title || `${t(entity.charAt(0).toUpperCase() + entity.slice(1))} by ${t(groupBy)}`}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-destructive text-sm">
            {error}
          </div>
        ) : data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            {t('No data available')}
          </div>
        ) : (
          renderChart()
        )}
      </CardContent>
    </Card>
  );
}
