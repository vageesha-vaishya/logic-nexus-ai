import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Quote, QuoteStatus, stages, statusConfig } from '@/pages/dashboard/quotes-data';
import { useCRM } from "@/hooks/useCRM";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area,
  LineChart,
  Line
} from 'recharts';
import { Loader2, TrendingUp, DollarSign, Activity, Calendar } from "lucide-react";

interface QuoteAnalyticsProps {
  quotes: Quote[];
}

export function QuoteAnalytics({ quotes }: QuoteAnalyticsProps) {
  const { scopedDb } = useCRM();
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);

  // 1. Snapshot Metrics
  const totalValue = quotes.reduce((sum, q) => sum + (q.sell_price || 0), 0);
  const totalMargin = quotes.reduce((sum, q) => sum + (q.margin_amount || 0), 0);
  const avgMargin = totalValue > 0 ? (totalMargin / totalValue) * 100 : 0;
  const winRate = quotes.filter(q => q.status === 'accepted').length / (quotes.filter(q => ['accepted', 'rejected', 'expired'].includes(q.status)).length || 1) * 100;

  // 2. Prepare Chart Data
  const statusDistribution = stages.map(stage => ({
    name: statusConfig[stage].label.replace(/[^a-zA-Z ]/g, "").trim(), // Remove emojis
    count: quotes.filter(q => q.status === stage).length,
    value: quotes.filter(q => q.status === stage).reduce((sum, q) => sum + (q.sell_price || 0), 0),
    color: getColorForStatus(stage)
  })).filter(d => d.count > 0);

  const priorityDistribution = [
    { name: 'High', value: quotes.filter(q => q.priority === 'high').length, color: '#ef4444' },
    { name: 'Medium', value: quotes.filter(q => !q.priority || q.priority === 'medium').length, color: '#f59e0b' },
    { name: 'Low', value: quotes.filter(q => q.priority === 'low').length, color: '#10b981' },
  ].filter(d => d.value > 0);

  // Fetch history for CFD
  useEffect(() => {
    const fetchHistory = async () => {
      if (!scopedDb) return;
      setLoadingHistory(true);
      try {
        // Fetch version history to build CFD
        // Note: This might be heavy for large datasets. In production, use a materialized view or RPC.
        const { data: versions, error } = await scopedDb
          .from('quotation_versions')
          .select('quote_id, status, created_at')
          .order('created_at', { ascending: true });

        if (error) throw error;

        // Process versions into daily buckets for CFD
        if (versions && versions.length > 0) {
          const processed = processCFDData(versions, quotes);
          setHistoryData(processed);
        }
      } catch (err) {
        console.error("Failed to fetch history", err);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [scopedDb, quotes.length]); // Re-fetch if quotes count changes drastically or on mount

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pipeline Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalValue)}
            </div>
            <p className="text-xs text-muted-foreground">Across {quotes.length} active quotes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Margin</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgMargin.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalMargin)} total margin
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{winRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Based on closed quotes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Cycle Time</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-- days</div>
            <p className="text-xs text-muted-foreground">Time to close</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline Health</TabsTrigger>
          <TabsTrigger value="velocity">Velocity & Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Pipeline Distribution</CardTitle>
                <CardDescription>Number of quotes per stage</CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusDistribution}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="name" 
                        stroke="#888888" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                      />
                      <YAxis
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}`}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                        itemStyle={{ color: 'var(--foreground)' }}
                        cursor={{ fill: 'var(--muted)' }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Priority Breakdown</CardTitle>
                <CardDescription>Quotes by priority level</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={priorityDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {priorityDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                         contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                         itemStyle={{ color: 'var(--foreground)' }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="pipeline" className="space-y-4">
          <Card>
            <CardHeader>
               <CardTitle>Cumulative Flow Diagram (CFD)</CardTitle>
               <CardDescription>Visualizing workflow stability and bottlenecks over time</CardDescription>
            </CardHeader>
            <CardContent>
               {loadingHistory ? (
                 <div className="h-[400px] flex items-center justify-center">
                   <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                 </div>
               ) : historyData.length > 0 ? (
                 <div className="h-[400px]">
                   <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={historyData}>
                       <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                       <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                       <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                       <Tooltip contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }} />
                       <Legend />
                       {stages.map((stage) => (
                         <Area 
                           key={stage}
                           type="monotone" 
                           dataKey={stage} 
                           stackId="1" 
                           stroke={getColorForStatus(stage)} 
                           fill={getColorForStatus(stage)} 
                         />
                       ))}
                     </AreaChart>
                   </ResponsiveContainer>
                 </div>
               ) : (
                 <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                   Not enough historical data for CFD
                 </div>
               )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="velocity" className="space-y-4">
             <Card>
                <CardHeader>
                  <CardTitle>Coming Soon: Velocity & Predictive Metrics</CardTitle>
                  <CardDescription>
                    Cycle time analysis and throughput forecasting will appear here once more historical data is gathered.
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[200px] flex items-center justify-center text-muted-foreground">
                   Requires &gt; 7 days of activity data
                </CardContent>
             </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper to process raw version history into CFD daily buckets
function processCFDData(versions: any[], currentQuotes: Quote[]) {
  // 1. Determine date range (min created_at to now)
  if (versions.length === 0) return [];
  
  const startDate = new Date(versions[0].created_at);
  const endDate = new Date();
  const data = [];
  
  // Map of quoteId -> current status at a point in time
  // Initialize with draft for all quotes that existed at that time?
  // Easier approach: Replay the history.
  
  // Group events by day
  const eventsByDay: Record<string, any[]> = {};
  versions.forEach(v => {
      const day = new Date(v.created_at).toISOString().split('T')[0];
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(v);
  });
  
  // Iterate days
  let currentState: Record<string, string> = {}; // quoteId -> status
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dayStr = d.toISOString().split('T')[0];
    
    // Apply events for this day
    if (eventsByDay[dayStr]) {
      eventsByDay[dayStr].forEach(event => {
        currentState[event.quote_id] = event.status;
      });
    }
    
    // Count statuses
    const counts: Record<string, number> = {};
    stages.forEach(s => counts[s] = 0);
    
    Object.values(currentState).forEach(status => {
      if (counts[status] !== undefined) counts[status]++;
    });
    
    data.push({
      date: dayStr,
      ...counts
    });
  }
  
  return data;
}

function getColorForStatus(status: string): string {
  // Map Tailwind classes to Hex for Recharts
  // This is an approximation as Recharts needs explicit hex/rgb
  switch(status) {
    case 'draft': return '#6b7280'; // gray-500
    case 'pricing_review': return '#6366f1'; // indigo-500
    case 'approved': return '#22c55e'; // green-500
    case 'sent': return '#3b82f6'; // blue-500
    case 'customer_reviewing': return '#06b6d4'; // cyan-500
    case 'revision_requested': return '#f59e0b'; // amber-500
    case 'accepted': return '#10b981'; // emerald-500
    case 'rejected': return '#ef4444'; // red-500
    case 'expired': return '#f97316'; // orange-500
    default: return '#888888';
  }
}
