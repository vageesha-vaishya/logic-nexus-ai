import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format, subHours } from 'date-fns';
import { Loader2, RefreshCw, BarChart3, List, Download, Calendar as CalendarIcon, Pause, Activity, X, FileJson, FileText, AlertTriangle, Search } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useDebug } from '@/hooks/useDebug';

const COLORS = {
  CRITICAL: '#ef4444', // red-500
  ERROR: '#f97316',    // orange-500
  WARNING: '#eab308',  // yellow-500
  INFO: '#3b82f6',     // blue-500
  DEBUG: '#6b7280',    // gray-500
  DEFAULT: '#94a3b8'   // slate-400
};

// Helper to mask sensitive data
const maskSensitiveData = (data: any): any => {
  if (!data) return data;
  if (typeof data === 'string') {
    return data; 
  }
  if (Array.isArray(data)) {
    return data.map(maskSensitiveData);
  }
  if (typeof data === 'object') {
    const masked = { ...data };
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth', 'credential', 'ssn', 'credit_card'];
    Object.keys(masked).forEach(key => {
      if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
        masked[key] = '********';
      } else {
        masked[key] = maskSensitiveData(masked[key]);
      }
    });
    return masked;
  }
  return data;
};

export default function SystemLogs() {
  const queryClient = useQueryClient();
  const debug = useDebug('Monitoring', 'SystemLogs');
  const [page, setPage] = useState(0);
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [traceFilter, setTraceFilter] = useState<string | null>(null);
  const [componentFilter, setComponentFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'analytics'>('list');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subHours(new Date(), 24),
    to: new Date(),
  });
  const [isRealtime, setIsRealtime] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const pageSize = 50;

  // Real-time Subscription
  useEffect(() => {
    let channel: any;

    if (isRealtime) {
      channel = supabase
        .channel('system_logs_realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'system_logs'
          },
          (payload) => {
            const newLog = payload.new;
            
            // Check filters
            const matchesLevel = levelFilter === 'ALL' || newLog.level === levelFilter;
            const matchesComponent = !componentFilter || (newLog.component && newLog.component.toLowerCase().includes(componentFilter.toLowerCase()));
            const matchesSearch = !search || (newLog.message && newLog.message.toLowerCase().includes(search.toLowerCase()));
            
            if (matchesLevel && matchesComponent && matchesSearch) {
              queryClient.setQueryData(['system-logs', page, levelFilter, search, traceFilter, componentFilter, dateRange], (old: any) => {
                if (!old) return { logs: [newLog], count: 1 };
                return {
                  ...old,
                  logs: [newLog, ...old.logs],
                  count: (old.count || 0) + 1
                };
              });
            }
          }
        )
        .subscribe();
    } else {
      if (channel) supabase.removeChannel(channel);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [isRealtime, levelFilter, componentFilter, search, page, traceFilter, dateRange, queryClient]);

  // Stats Query
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['system-log-stats', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_system_log_stats', {
        time_range_start: dateRange?.from?.toISOString() || subHours(new Date(), 24).toISOString(),
        time_range_end: dateRange?.to?.toISOString() || new Date().toISOString()
      });
      if (error) {
        debug.error('Stats error:', error);
        return null;
      }
      return data as {
        by_level: { level: string; count: number }[];
        by_component: { component: string; count: number }[];
        by_hour: { hour: string; count: number }[];
      };
    }
  });

  // Logs Query
  const { tenant } = useCRM();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['system-logs', page, levelFilter, search, traceFilter, componentFilter, dateRange, tenant?.id],
    queryFn: async () => {
      let query = supabase
        .from('system_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      // Filter by tenant if available
      if (tenant?.id) {
        query = query.eq('tenant_id', tenant.id);
      }

      if (levelFilter !== 'ALL') {
        query = query.eq('level', levelFilter);
      }
      
      if (search) {
        query = query.ilike('message', `%${search}%`);
      }

      if (traceFilter) {
        query = query.eq('correlation_id', traceFilter);
      }

      if (componentFilter) {
        query = query.ilike('component', `%${componentFilter}%`);
      }

      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }
      
      if (dateRange?.to) {
        query = query.lte('created_at', dateRange.to.toISOString());
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { logs: data, count };
    }
  });

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'CRITICAL': return <Badge variant="destructive" className="animate-pulse">{level}</Badge>;
      case 'ERROR': return <Badge variant="destructive">{level}</Badge>;
      case 'WARNING': return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200">{level}</Badge>;
      case 'INFO': return <Badge variant="secondary">{level}</Badge>;
      default: return <Badge variant="outline">{level}</Badge>;
    }
  };

  const formatHour = (dateStr: string) => {
    return format(new Date(dateStr), 'HH:mm');
  };

  const handleExportJSON = () => {
    if (!data?.logs) return;
    const jsonString = JSON.stringify(maskSensitiveData(data.logs), null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `system_logs_${new Date().toISOString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCSV = () => {
    if (!data?.logs) return;
    
    let csv = 'Timestamp,Level,Component,Message,Trace ID,User ID,Metadata\n';
    
    data.logs.forEach((log: any) => {
      const cleanMessage = log.message.replace(/,/g, ' ');
      const cleanMetadata = JSON.stringify(log.metadata || {}).replace(/"/g, '""');
      csv += `${log.created_at},${log.level},${log.component || ''},"${cleanMessage}",${log.correlation_id || ''},${log.user_id || ''},"${cleanMetadata}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'system_logs_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Logs & Analytics</h2>
          <p className="text-muted-foreground mt-1">
            Monitor system health, debug errors, and analyze trends.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center space-x-2 mr-4 bg-secondary/50 p-2 rounded-lg">
            <Switch 
              id="realtime-mode" 
              checked={isRealtime}
              onCheckedChange={setIsRealtime}
            />
            <Label htmlFor="realtime-mode" className="flex items-center gap-2 cursor-pointer">
              {isRealtime ? <Activity className="h-4 w-4 text-green-500 animate-pulse" /> : <Pause className="h-4 w-4" />}
              <span className={isRealtime ? "text-green-600 font-medium" : ""}>Live Stream</span>
            </Label>
          </div>

          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="w-[240px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} -{" "}
                      {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-40">
              <div className="flex flex-col gap-2">
                <Button variant="ghost" size="sm" className="justify-start" onClick={handleExportCSV}>
                  <FileText className="mr-2 h-4 w-4" /> CSV
                </Button>
                <Button variant="ghost" size="sm" className="justify-start" onClick={handleExportJSON}>
                  <FileJson className="mr-2 h-4 w-4" /> JSON
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as 'list' | 'analytics')} className="space-y-4">
        <TabsList>
          <TabsTrigger value="list" className="flex items-center gap-2">
            <List className="h-4 w-4" /> Logs
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <CardTitle>Log Entries</CardTitle>
                <div className="flex flex-wrap gap-2 items-center">
                  {traceFilter && (
                    <Badge variant="secondary" className="gap-1 pl-1 pr-2">
                      <X 
                        className="h-3 w-3 hover:text-destructive cursor-pointer" 
                        onClick={() => setTraceFilter(null)}
                      />
                      Trace: {traceFilter.slice(0, 8)}...
                    </Badge>
                  )}
                  
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search messages..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>

                  <Select value={levelFilter} onValueChange={setLevelFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Levels</SelectItem>
                      <SelectItem value="CRITICAL">Critical</SelectItem>
                      <SelectItem value="ERROR">Error</SelectItem>
                      <SelectItem value="WARNING">Warning</SelectItem>
                      <SelectItem value="INFO">Info</SelectItem>
                      <SelectItem value="DEBUG">Debug</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input 
                    placeholder="Component..." 
                    value={componentFilter}
                    onChange={(e) => setComponentFilter(e.target.value)}
                    className="w-[140px]"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Timestamp</TableHead>
                      <TableHead className="w-[100px]">Level</TableHead>
                      <TableHead className="w-[150px]">Component</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead className="w-[120px]">Trace ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : data?.logs?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                          No logs found matching your filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data?.logs?.map((log: any) => (
                        <Sheet key={log.id}>
                          <SheetTrigger asChild>
                            <TableRow 
                              className="cursor-pointer hover:bg-muted/50 transition-colors group"
                              onClick={() => setSelectedLog(log)}
                            >
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss.SSS')}
                              </TableCell>
                              <TableCell>{getLevelBadge(log.level)}</TableCell>
                              <TableCell className="font-medium text-xs">{log.component || '-'}</TableCell>
                              <TableCell className="max-w-[500px] truncate group-hover:whitespace-normal group-hover:overflow-visible group-hover:z-10 relative">
                                {log.message}
                              </TableCell>
                              <TableCell>
                                {log.correlation_id ? (
                                  <div 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTraceFilter(log.correlation_id);
                                    }}
                                    className="text-xs font-mono text-primary hover:underline cursor-pointer"
                                    title={`Filter by Trace ID: ${log.correlation_id}`}
                                  >
                                    {log.correlation_id.slice(0, 8)}...
                                  </div>
                                ) : '-'}
                              </TableCell>
                            </TableRow>
                          </SheetTrigger>
                          <SheetContent className="w-[800px] sm:max-w-[800px] overflow-y-auto">
                            <SheetHeader className="mb-6">
                              <SheetTitle className="flex items-center gap-2">
                                {getLevelBadge(log.level)}
                                <span>Log Details</span>
                              </SheetTitle>
                              <SheetDescription>
                                ID: {log.id}
                              </SheetDescription>
                            </SheetHeader>
                            
                            <div className="space-y-6">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-muted-foreground">Timestamp</Label>
                                  <div className="font-mono text-sm">{format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss.SSS')}</div>
                                </div>
                                <div>
                                  <Label className="text-muted-foreground">Component</Label>
                                  <div className="font-medium">{log.component || 'N/A'}</div>
                                </div>
                                <div>
                                  <Label className="text-muted-foreground">Environment</Label>
                                  <div className="font-medium">{log.environment}</div>
                                </div>
                                <div>
                                  <Label className="text-muted-foreground">Trace ID</Label>
                                  <div className="font-mono text-sm">{log.correlation_id || 'N/A'}</div>
                                </div>
                                <div>
                                  <Label className="text-muted-foreground">User ID</Label>
                                  <div className="font-mono text-sm">{log.user_id || 'Anonymous'}</div>
                                </div>
                                <div>
                                  <Label className="text-muted-foreground">Tenant ID</Label>
                                  <div className="font-mono text-sm">{log.tenant_id || 'N/A'}</div>
                                </div>
                              </div>

                              <div>
                                <Label className="text-muted-foreground mb-1 block">Message</Label>
                                <div className="p-3 bg-muted rounded-md text-sm">{log.message}</div>
                              </div>

                              {log.metadata && Object.keys(log.metadata).length > 0 && (
                                <div>
                                  <Label className="text-muted-foreground mb-1 block">Metadata</Label>
                                  <ScrollArea className="h-[200px] w-full rounded-md border p-4 bg-muted/50">
                                    <pre className="text-xs font-mono">
                                      {JSON.stringify(maskSensitiveData(log.metadata), null, 2)}
                                    </pre>
                                  </ScrollArea>
                                </div>
                              )}

                              {(log.metadata?.stack || log.metadata?.stack_trace || log.metadata?.error?.stack) && (
                                <div>
                                  <Label className="text-muted-foreground mb-1 block text-destructive font-medium">Stack Trace</Label>
                                  <ScrollArea className="h-[200px] w-full rounded-md border p-4 bg-destructive/10 text-destructive-foreground">
                                    <pre className="text-xs font-mono whitespace-pre-wrap">
                                      {log.metadata?.stack || log.metadata?.stack_trace || log.metadata?.error?.stack}
                                    </pre>
                                  </ScrollArea>
                                </div>
                              )}
                            </div>
                          </SheetContent>
                        </Sheet>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-between items-center mt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0 || isLoading}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page + 1}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setPage(p => p + 1)}
                  disabled={(!data?.logs || data.logs.length < pageSize) || isLoading}
                >
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.by_level.reduce((acc, curr) => acc + curr.count, 0) || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  In selected period
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {(() => {
                    const total = stats?.by_level.reduce((acc, curr) => acc + curr.count, 0) || 1;
                    const errors = stats?.by_level
                      .filter(x => ['ERROR', 'CRITICAL'].includes(x.level))
                      .reduce((acc, curr) => acc + curr.count, 0) || 0;
                    return total > 0 ? ((errors / total) * 100).toFixed(1) + '%' : '0.0%';
                  })()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Critical & Error level
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Log Volume by Level</CardTitle>
                <CardDescription>Distribution of log severity</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {statsLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats?.by_level}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="level" />
                      <YAxis />
                      <RechartsTooltip />
                      <Bar dataKey="count">
                        {stats?.by_level.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[entry.level as keyof typeof COLORS] || COLORS.DEFAULT} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Top Components</CardTitle>
                <CardDescription>Sources generating the most logs</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {statsLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats?.by_component}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="count"
                        nameKey="component"
                      >
                        {stats?.by_component.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={Object.values(COLORS)[index % Object.values(COLORS).length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Activity Over Time</CardTitle>
                <CardDescription>Log volume per hour</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {statsLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats?.by_hour}>
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="hour" 
                        tickFormatter={formatHour}
                        minTickGap={30}
                      />
                      <YAxis />
                      <CartesianGrid strokeDasharray="3 3" />
                      <RechartsTooltip labelFormatter={(label) => format(new Date(label), 'MMM dd, HH:mm')} />
                      <Area type="monotone" dataKey="count" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCount)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
