import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts';
import { Lead } from "@/pages/dashboard/leads-data";
import { formatDistanceToNow, differenceInDays } from 'date-fns';

interface PipelineAnalyticsProps {
  leads: Lead[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export function PipelineAnalytics({ leads }: PipelineAnalyticsProps) {
  
  // 1. Velocity Analysis (Average Age by Stage)
  const velocityData = useMemo(() => {
    const stageAge: Record<string, { totalDays: number; count: number }> = {};
    
    leads.forEach(lead => {
      const days = differenceInDays(new Date(), new Date(lead.created_at));
      if (!stageAge[lead.status]) {
        stageAge[lead.status] = { totalDays: 0, count: 0 };
      }
      stageAge[lead.status].totalDays += days;
      stageAge[lead.status].count += 1;
    });

    return Object.entries(stageAge).map(([stage, data]) => ({
      stage: stage.charAt(0).toUpperCase() + stage.slice(1),
      avgDays: Math.round(data.totalDays / data.count) || 0,
      count: data.count
    })).sort((a, b) => b.avgDays - a.avgDays); // Sort by longest wait
  }, [leads]);

  // 2. Cohort Analysis (Source Performance)
  const sourcePerformance = useMemo(() => {
    const sources: Record<string, { won: number; lost: number; active: number; total: number }> = {};

    leads.forEach(lead => {
      const source = lead.source || 'Unknown';
      if (!sources[source]) sources[source] = { won: 0, lost: 0, active: 0, total: 0 };
      
      sources[source].total += 1;
      if (lead.status === 'won') sources[source].won += 1;
      else if (lead.status === 'lost') sources[source].lost += 1;
      else sources[source].active += 1;
    });

    return Object.entries(sources)
      .map(([source, data]) => ({
        source,
        ...data,
        winRate: data.total > 0 ? Math.round((data.won / data.total) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10); // Top 10 sources
  }, [leads]);

  // 3. Conversion Overview (Won vs Lost vs Open)
  const conversionData = useMemo(() => {
    let won = 0, lost = 0, open = 0;
    leads.forEach(l => {
      if (l.status === 'won') won++;
      else if (l.status === 'lost') lost++;
      else open++;
    });
    return [
      { name: 'Won', value: won, color: '#10b981' }, // emerald-500
      { name: 'Lost', value: lost, color: '#ef4444' }, // red-500
      { name: 'Open', value: open, color: '#3b82f6' }, // blue-500
    ];
  }, [leads]);

  // 4. Trend Analysis (Leads Created over time - Last 6 months)
  const trendData = useMemo(() => {
     // Simplified: Group by month
     const months: Record<string, number> = {};
     leads.forEach(l => {
        const date = new Date(l.created_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        months[key] = (months[key] || 0) + 1;
     });

     return Object.entries(months)
       .sort((a, b) => a[0].localeCompare(b[0]))
       .map(([date, count]) => ({ date, count }));
  }, [leads]);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Velocity Chart */}
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>Pipeline Velocity</CardTitle>
          <CardDescription>Average age of leads in each stage (Days)</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={velocityData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="stage" type="category" width={100} tick={{ fontSize: 12 }} />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="avgDays" fill="#8884d8" radius={[0, 4, 4, 0]} name="Avg Days">
                 {velocityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                 ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Conversion Pie Chart */}
      <Card className="col-span-3">
        <CardHeader>
          <CardTitle>Conversion Overview</CardTitle>
          <CardDescription>Current distribution of lead outcomes</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={conversionData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {conversionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Source Performance */}
      <Card className="col-span-7">
        <CardHeader>
          <CardTitle>Source Performance</CardTitle>
          <CardDescription>Win/Loss ratio by lead source</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sourcePerformance} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="source" />
              <YAxis />
              <Tooltip 
                 contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend />
              <Bar dataKey="won" stackId="a" fill="#10b981" name="Won" radius={[0, 0, 4, 4]} />
              <Bar dataKey="active" stackId="a" fill="#3b82f6" name="Open" />
              <Bar dataKey="lost" stackId="a" fill="#ef4444" name="Lost" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

    </div>
  );
}
