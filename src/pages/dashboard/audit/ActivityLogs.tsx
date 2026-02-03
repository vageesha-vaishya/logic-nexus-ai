import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCRM } from '@/hooks/useCRM';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, subDays } from 'date-fns';
import { Loader2, RefreshCw, FileJson, ArrowRight, Search, User, Download } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { downloadCSV } from '@/utils/csvExport';

const ACTION_COLORS = {
  INSERT: 'bg-green-100 text-green-800 border-green-200',
  UPDATE: 'bg-blue-100 text-blue-800 border-blue-200',
  DELETE: 'bg-red-100 text-red-800 border-red-200',
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

export function ActivityLogs() {
  const { context } = useCRM();
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [resourceFilter, setResourceFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const pageSize = 50;

  // Fetch Logs
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', page, actionFilter, resourceFilter, search, dateRange, context.tenantId, context.isPlatformAdmin, context.adminOverrideEnabled],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' });

      // Apply Tenant Scope
      if (!context.isPlatformAdmin && context.tenantId) {
        query = query.eq('tenant_id', context.tenantId);
      } else if (context.isPlatformAdmin && context.adminOverrideEnabled && context.tenantId) {
        query = query.eq('tenant_id', context.tenantId);
      }

      // Filters
      if (actionFilter !== 'ALL') {
        query = query.eq('action', actionFilter);
      }
      
      if (resourceFilter !== 'ALL') {
        query = query.eq('resource_type', resourceFilter);
      }

      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte('created_at', dateRange.to.toISOString());
      }
      
      // Basic search on resource_id or details (text search on jsonb is tricky without dedicated index/rpc, so limiting to ID for now)
      if (search) {
        query = query.or(`resource_type.ilike.%${search}%,action.ilike.%${search}%`);
      }

      // Pagination
      const from = page * pageSize;
      const to = from + pageSize - 1;
      
      const { data: logs, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Fetch user profiles for these logs
      const userIds = Array.from(new Set(logs?.map(l => l.user_id).filter(Boolean)));
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .in('id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]));

      const enrichedLogs = logs?.map(log => ({
        ...log,
        user: profileMap.get(log.user_id) || { email: 'Unknown', first_name: 'Unknown', last_name: '' }
      }));

      return { logs: enrichedLogs, count };
    },
    refetchInterval: 30000 // Refresh every 30s
  });

  const getActionBadge = (action: string) => {
    const colorClass = ACTION_COLORS[action as keyof typeof ACTION_COLORS] || ACTION_COLORS.DEFAULT;
    return <Badge variant="outline" className={`${colorClass} border`}>{action}</Badge>;
  };

  const formatDiff = (details: any) => {
    if (!details) return null;
    
    const changedFields = details.changed_fields || {};
    const oldValues = details.old_values || {};
    const newValues = details.new_values || {};

    // Standard update format
    if (Object.keys(changedFields).length > 0) {
      return (
        <div className="space-y-2 mt-2">
          {Object.entries(changedFields).map(([key, value]) => (
            <div key={key} className="text-sm grid grid-cols-[1fr,auto,1fr] gap-2 items-center p-2 bg-muted/30 rounded">
              <span className="font-mono text-muted-foreground">{key}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="line-through text-xs text-muted-foreground opacity-70">
                  {JSON.stringify(oldValues[key])}
                </span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {JSON.stringify(value)}
                </span>
              </div>
            </div>
          ))}
        </div>
      );
    }
    
    // Fallback for other formats or full dumps
    return (
      <ScrollArea className="h-[200px] w-full rounded-md border p-4 bg-muted/50 mt-2">
        <pre className="text-xs font-mono">
          {JSON.stringify(maskSensitiveData(details), null, 2)}
        </pre>
      </ScrollArea>
    );
  };

  const handleExport = () => {
    if (data?.logs) {
      const exportData = data.logs.map(log => ({
        id: log.id,
        timestamp: format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
        action: log.action,
        resource_type: log.resource_type,
        resource_id: log.resource_id,
        user: log.user?.email || 'System',
        details: JSON.stringify(log.details)
      }));
      downloadCSV(exportData, `activity-logs-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-none">
        <CardHeader className="px-0 pb-3">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <CardTitle>Activity Log</CardTitle>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search resource or action..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>

              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Actions</SelectItem>
                  <SelectItem value="INSERT">Insert</SelectItem>
                  <SelectItem value="UPDATE">Update</SelectItem>
                  <SelectItem value="DELETE">Delete</SelectItem>
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
                      <TableHead className="w-[100px]">Action</TableHead>
                      <TableHead className="w-[150px]">Resource</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.logs?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No audit logs found matching your criteria.
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
                              <TableCell>{getActionBadge(log.action)}</TableCell>
                              <TableCell className="font-medium text-sm">
                                {log.resource_type}
                                {log.resource_id && (
                                  <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate w-[120px]">
                                    {log.resource_id.split('-')[0]}...
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-sm">
                                    {log.user?.email || log.user_id?.split('-')[0] || 'System'}
                                  </span>
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
                                {getActionBadge(log.action)}
                                <span>Change Details</span>
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
                                  <Label className="text-muted-foreground">Resource Type</Label>
                                  <div className="font-medium">{log.resource_type}</div>
                                </div>
                                <div>
                                  <Label className="text-muted-foreground">User</Label>
                                  <div className="font-medium">{log.user?.first_name} {log.user?.last_name}</div>
                                  <div className="text-xs text-muted-foreground">{log.user?.email}</div>
                                </div>
                                <div>
                                  <Label className="text-muted-foreground">Resource ID</Label>
                                  <div className="font-mono text-sm">{log.resource_id || 'N/A'}</div>
                                </div>
                              </div>

                              <div>
                                <Label className="text-muted-foreground mb-1 block">Changes</Label>
                                {formatDiff(log.details)}
                              </div>

                              {log.details && (
                                <div>
                                  <Label className="text-muted-foreground mb-1 block">Full Payload</Label>
                                  <ScrollArea className="h-[200px] w-full rounded-md border p-4 bg-muted/50">
                                    <pre className="text-xs font-mono">
                                      {JSON.stringify(maskSensitiveData(log.details), null, 2)}
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
