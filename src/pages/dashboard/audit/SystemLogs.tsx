import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, subDays } from 'date-fns';
import { Loader2, RefreshCw, FileJson, Search, AlertTriangle, Info, AlertCircle, Download } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { downloadCSV } from '@/utils/csvExport';

const LEVEL_COLORS = {
  INFO: 'bg-blue-100 text-blue-800 border-blue-200',
  WARNING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  ERROR: 'bg-red-100 text-red-800 border-red-200',
  CRITICAL: 'bg-red-200 text-red-900 border-red-300',
  FATAL: 'bg-red-200 text-red-900 border-red-300',
  DEBUG: 'bg-gray-100 text-gray-800 border-gray-200',
  DEFAULT: 'bg-gray-100 text-gray-800 border-gray-200'
};

const maskSensitiveData = (data: any): any => {
  if (!data) return data;
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) return data.map(maskSensitiveData);
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

export function SystemLogs() {
  const [page, setPage] = useState(0);
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 1), // Default to last 24h for system logs
    to: new Date(),
  });
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const pageSize = 50;

  // Fetch Logs
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['system-logs', page, levelFilter, search, dateRange, context.tenantId, context.isPlatformAdmin, context.adminOverrideEnabled],
    queryFn: async () => {
      let query = supabase
        .from('system_logs')
        .select('*', { count: 'exact' });

      // Apply Tenant Scope
      if (!context.isPlatformAdmin && context.tenantId) {
        query = query.eq('tenant_id', context.tenantId);
      } else if (context.isPlatformAdmin && context.adminOverrideEnabled && context.tenantId) {
        query = query.eq('tenant_id', context.tenantId);
      }

      // Filters
      if (levelFilter !== 'ALL') {
        query = query.eq('level', levelFilter);
      }
      
      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte('created_at', dateRange.to.toISOString());
      }
      
      if (search) {
        query = query.or(`message.ilike.%${search}%,component.ilike.%${search}%`);
      }

      // Pagination
      const from = page * pageSize;
      const to = from + pageSize - 1;
      
      const { data: logs, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return { logs, count };
    },
    refetchInterval: 30000 // Refresh every 30s
  });

  const getLevelBadge = (level: string) => {
    const colorClass = LEVEL_COLORS[level as keyof typeof LEVEL_COLORS] || LEVEL_COLORS.DEFAULT;
    const Icon = ['ERROR', 'FATAL', 'CRITICAL'].includes(level) ? AlertCircle : level === 'WARNING' ? AlertTriangle : Info;
    
    return (
      <Badge variant="outline" className={`${colorClass} border flex items-center gap-1 w-fit`}>
        <Icon className="h-3 w-3" />
        {level}
      </Badge>
    );
  };

  const handleExport = () => {
    if (data?.logs) {
      const exportData = data.logs.map(log => ({
        id: log.id,
        timestamp: format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss.SSS'),
        level: log.level,
        component: log.component,
        message: log.message,
        environment: log.environment,
        user_id: log.user_id,
        correlation_id: log.correlation_id,
        metadata: JSON.stringify(log.metadata)
      }));
      downloadCSV(exportData, `system-logs-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-none">
        <CardHeader className="px-0 pb-3">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <CardTitle>System Logs</CardTitle>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search message or component..."
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
                  <SelectItem value="DEBUG">Debug</SelectItem>
                  <SelectItem value="INFO">Info</SelectItem>
                  <SelectItem value="WARNING">Warning</SelectItem>
                  <SelectItem value="ERROR">Error</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="FATAL">Fatal</SelectItem>
                </SelectContent>
              </Select>
              
              <DateRangePicker 
                date={dateRange} 
                onDateChange={setDateRange} 
              />
              
              <Button variant="outline" size="sm" onClick={handleExport} disabled={!data?.logs?.length}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>

              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Timestamp</TableHead>
                      <TableHead className="w-[100px]">Level</TableHead>
                      <TableHead className="w-[150px]">Component</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.logs?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No system logs found matching your criteria.
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
                                {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
                              </TableCell>
                              <TableCell>{getLevelBadge(log.level)}</TableCell>
                              <TableCell className="font-medium text-sm">
                                {log.component || 'Unknown'}
                              </TableCell>
                              <TableCell className="max-w-[400px]">
                                <div className="truncate" title={log.message}>
                                  {log.message}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <FileJson className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          </SheetTrigger>
                          <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
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
                                  <div className="font-medium">{log.component || 'Unknown'}</div>
                                </div>
                                <div>
                                  <Label className="text-muted-foreground">Environment</Label>
                                  <div className="font-medium">{log.environment || 'Unknown'}</div>
                                </div>
                                <div>
                                  <Label className="text-muted-foreground">Correlation ID</Label>
                                  <div className="font-mono text-sm">{log.correlation_id || 'N/A'}</div>
                                </div>
                                <div>
                                  <Label className="text-muted-foreground">User ID</Label>
                                  <div className="font-mono text-sm">{log.user_id || 'System'}</div>
                                </div>
                              </div>

                              <div>
                                <Label className="text-muted-foreground mb-1 block">Message</Label>
                                <div className="p-3 bg-muted/30 rounded border text-sm">
                                  {log.message}
                                </div>
                              </div>

                              {log.metadata && (
                                <div>
                                  <Label className="text-muted-foreground mb-1 block">Metadata / Stack Trace</Label>
                                  <ScrollArea className="h-[300px] w-full rounded-md border p-4 bg-muted/50">
                                    <pre className="text-xs font-mono">
                                      {JSON.stringify(maskSensitiveData(log.metadata), null, 2)}
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
