/**
 * Audit Dashboard - Performance Testing Page
 * Loads and displays audit logs with filtering and basic statistics
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabaseClient } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { format } from 'date-fns';
import { History, RefreshCw, TrendingUp } from 'lucide-react';

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, any>;
  created_at: string;
}

const RESOURCE_TYPES = ['lead', 'contact', 'opportunity', 'quote', 'invoice', 'interaction'];
const ACTIONS = ['create', 'update', 'delete', 'view', 'approve', 'reject', 'move', 'merge'];

export function AuditDashboard() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resourceType, setResourceType] = useState('');
  const [action, setAction] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [loadTime, setLoadTime] = useState<number | null>(null);

  // Fetch audit logs
  const fetchLogs = async () => {
    const fetchStart = performance.now();
    setLoading(true);
    setError(null);

    try {
      // Build query
      let query = supabaseClient
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500); // Default limit

      // Apply filters
      if (resourceType) {
        query = query.eq('resource_type', resourceType);
      }
      if (action) {
        query = query.eq('action', action);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        setError(queryError.message);
        logger.error('Failed to fetch audit logs:', queryError);
        setLogs([]);
      } else {
        setLogs(data as AuditLog[]);
        const fetchEnd = performance.now();
        const elapsed = fetchEnd - fetchStart;
        setLoadTime(elapsed);
        logger.info(`Audit logs loaded in ${elapsed.toFixed(2)}ms`);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errMsg);
      logger.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load logs on mount and when filters change
  useEffect(() => {
    fetchLogs();
  }, [resourceType, action]);

  // Filter data client-side (for search)
  const filteredLogs = logs.filter((log) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        log.resource_id.toLowerCase().includes(query) ||
        log.user_id.toLowerCase().includes(query) ||
        log.action.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Calculate statistics
  const uniqueUsers = new Set(logs.map((l) => l.user_id)).size;
  const uniqueResources = new Set(logs.map((l) => l.resource_id)).size;
  const actionCounts = logs.reduce(
    (acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const topAction = Object.entries(actionCounts).sort(([, a], [, b]) => b - a)[0];

  return (
    <div className="space-y-6 p-6 min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Audit Dashboard</h1>
          {loadTime && (
            <span className="text-sm text-muted-foreground ml-4">
              Loaded in {loadTime.toFixed(2)}ms
            </span>
          )}
        </div>
        <Button onClick={fetchLogs} disabled={loading} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {/* Error message */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 text-red-800">Error: {error}</CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Resource Type</label>
              <Select value={resourceType} onValueChange={setResourceType}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  {RESOURCE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Action</label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All actions</SelectItem>
                  {ACTIONS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Search</label>
              <Input
                placeholder="Search resource or user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Total Logs</p>
              <p className="text-3xl font-bold">{logs.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Unique Users</p>
              <p className="text-3xl font-bold">{uniqueUsers}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Unique Resources</p>
              <p className="text-3xl font-bold">{uniqueResources}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Top Action</p>
              <p className="text-2xl font-bold capitalize">{topAction?.[0] || '-'}</p>
              <p className="text-xs text-muted-foreground">{topAction?.[1] || 0} times</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Audit Logs ({filteredLogs.length} of {logs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading audit logs...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No audit logs found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted">
                  <tr>
                    <th className="text-left p-3 font-medium">Timestamp</th>
                    <th className="text-left p-3 font-medium">User</th>
                    <th className="text-left p-3 font-medium">Action</th>
                    <th className="text-left p-3 font-medium">Resource Type</th>
                    <th className="text-left p-3 font-medium">Resource ID</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-muted/50">
                      <td className="p-3 text-xs font-mono whitespace-nowrap">
                        {format(new Date(log.created_at), 'MMM dd, HH:mm:ss')}
                      </td>
                      <td className="p-3 text-xs truncate">{log.user_id?.slice(0, 8) || 'system'}</td>
                      <td className="p-3">
                        <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 text-xs">{log.resource_type}</td>
                      <td className="p-3 text-xs font-mono truncate">{log.resource_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance metrics */}
      {loadTime && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="text-green-800">
            <ul className="space-y-2">
              <li>Load Time: {loadTime.toFixed(2)}ms</li>
              <li>
                Status: {loadTime < 2000 ? '✓ PASS (< 2s)' : '✗ FAIL (> 2s)'}
              </li>
              <li>Logs Displayed: {filteredLogs.length} of {logs.length}</li>
              <li>
                Query Efficiency: {logs.length > 0 ? ((filteredLogs.length / logs.length) * 100).toFixed(1) : 0}%
              </li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default AuditDashboard;
