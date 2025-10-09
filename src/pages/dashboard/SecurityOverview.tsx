import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Database, Lock, Terminal } from 'lucide-react';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useCRM } from '@/hooks/useCRM';
import TenantConfigForm from './data-management/TenantConfigForm';
import FranchiseConfigForm from './data-management/FranchiseConfigForm';
import SequencesAndPreview from './data-management/SequencesAndPreview';

export default function SecurityOverview() {
  const { toast } = useToast();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const tabParam = params.get('tab');
  const initialTab = tabParam ?? 'sql';
  const { supabase: crmSupabase, context } = useCRM();
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM leads LIMIT 10;');
  const [queryResult, setQueryResult] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [minWidthCh, setMinWidthCh] = useState(8);
  const [maxWidthCh, setMaxWidthCh] = useState(40);
  const [stickyHeader, setStickyHeader] = useState(true);
  // Horizontal scroll sync between top scrollbar and the main table container
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const [topScrollWidth, setTopScrollWidth] = useState<number>(0);

  // Data Management local state
  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([]);
  const [franchises, setFranchises] = useState<Array<{ id: string; name: string }>>([]);
  const [tenantId, setTenantId] = useState<string | undefined>(context?.tenantId || undefined);
  const [franchiseId, setFranchiseId] = useState<string | undefined>(context?.franchiseId || undefined);

  useEffect(() => {
    const loadTenants = async () => {
      const { data } = await crmSupabase.from('tenants').select('id,name').eq('is_active', true).order('name');
      setTenants(data || []);
    };
    loadTenants();
  }, [crmSupabase]);

  useEffect(() => {
    const loadFranchises = async () => {
      if (!tenantId) { setFranchises([]); return; }
      const { data } = await crmSupabase
        .from('franchises')
        .select('id,name')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name');
      setFranchises(data || []);
    };
    loadFranchises();
  }, [crmSupabase, tenantId]);

  const onTenantChange = (id: string) => {
    setTenantId(id);
    setFranchiseId(undefined);
  };
  const onFranchiseChange = (id: string) => setFranchiseId(id);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    // Mirror the table content width to the top scrollbar spacer
    setTopScrollWidth(el.scrollWidth);
  }, [queryResult, pageSize, currentPage, minWidthCh, maxWidthCh]);

  const executeQuery = async () => {
    setIsExecuting(true);
    try {
      const { data, error } = await supabase.rpc('execute_sql_query' as any, { 
        query_text: sqlQuery 
      });
      
      if (error) throw error;
      
      setQueryResult(data);
      setCurrentPage(1);
      toast({
        title: 'Query executed',
        description: `Returned ${Array.isArray(data) ? data.length : 0} rows`,
      });
    } catch (error: any) {
      toast({
        title: 'Query failed',
        description: error.message,
        variant: 'destructive',
      });
      setQueryResult({ error: error.message });
    } finally {
      setIsExecuting(false);
    }
  };

  const { data: enums, isLoading: enumsLoading } = useQuery({
    queryKey: ['security-enums'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_database_enums' as any);
      if (error) throw error;
      return data as unknown as Array<{ enum_type: string; labels: string }>;
    }
  });

  const { data: rlsStatus, isLoading: rlsLoading } = useQuery({
    queryKey: ['rls-status'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_rls_status' as any);
      if (error) throw error;
      return data as unknown as Array<{ table_name: string; rls_enabled: boolean; policy_count: number }>;
    }
  });

  const { data: policies, isLoading: policiesLoading } = useQuery({
    queryKey: ['rls-policies'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_rls_policies' as any);
      if (error) throw error;
      return data as unknown as Array<{
        table_name: string;
        policy_name: string;
        command: string;
        roles: string;
        using_expression: string;
      }>;
    }
  });

  const { data: schema, isLoading: schemaLoading } = useQuery({
    queryKey: ['database-schema'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_database_schema' as any);
      if (error) throw error;
      return data as unknown as Array<{
        table_name: string;
        column_name: string;
        data_type: string;
        is_nullable: boolean;
        column_default: string | null;
        is_primary_key: boolean;
        is_foreign_key: boolean;
        references_table: string | null;
        references_column: string | null;
      }>;
    }
  });

  const { data: schemaTables, isLoading: schemaTablesLoading } = useQuery({
    queryKey: ['database-tables'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_database_tables' as any);
      if (error) throw error;
      return data as unknown as Array<{
        table_name: string;
        table_type: string;
        rls_enabled: boolean | null;
        policy_count: number;
        column_count: number;
        index_count: number;
        row_estimate: number | null;
      }>;
    }
  });

  const { data: schemaConstraints, isLoading: schemaConstraintsLoading } = useQuery({
    queryKey: ['database-constraints'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_table_constraints' as any);
      if (error) throw error;
      return data as unknown as Array<{
        table_name: string;
        constraint_name: string;
        constraint_type: string;
        constraint_details: string;
      }>;
    }
  });

  const { data: schemaIndexes, isLoading: schemaIndexesLoading } = useQuery({
    queryKey: ['database-indexes'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_table_indexes' as any);
      if (error) throw error;
      return data as unknown as Array<{
        table_name: string;
        index_name: string;
        is_unique: boolean;
        index_columns: string;
        index_definition: string;
      }>;
    }
  });

  const { data: dbFunctions, isLoading: functionsLoading, error: functionsError } = useQuery({
    queryKey: ['database-functions'],
    queryFn: async () => {
      // Primary: use dedicated RPC for listing functions
      const { data, error } = await supabase.rpc('get_database_functions' as any);
      if (!error) {
        return (data ?? []) as unknown as Array<{
          name: string;
          schema: string;
          kind: string;
          return_type: string;
          argument_types: string;
          language: string;
          volatility: string;
          security_definer: boolean;
          description: string | null;
        }>;
      }

      // Fallback: query pg_catalog via safe read-only SQL RPC if the function isn’t cached yet
      const sql = `
        SELECT
          p.proname::text AS name,
          n.nspname::text AS schema,
          CASE p.prokind 
            WHEN 'f' THEN 'function' 
            WHEN 'p' THEN 'procedure' 
            WHEN 'a' THEN 'aggregate' 
            WHEN 'w' THEN 'window' 
            ELSE p.prokind::text 
          END AS kind,
          pg_catalog.format_type(p.prorettype, NULL)::text AS return_type,
          pg_catalog.pg_get_function_identity_arguments(p.oid)::text AS argument_types,
          l.lanname::text AS language,
          CASE p.provolatile 
            WHEN 'i' THEN 'immutable' 
            WHEN 's' THEN 'stable' 
            WHEN 'v' THEN 'volatile' 
            ELSE p.provolatile::text 
          END AS volatility,
          p.prosecdef AS security_definer,
          pg_catalog.obj_description(p.oid, 'pg_proc')::text AS description
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        JOIN pg_language l ON l.oid = p.prolang
        WHERE n.nspname = 'public'
        ORDER BY n.nspname, p.proname;
      `;

      const { data: fallbackData, error: fallbackError } = await supabase.rpc('execute_sql_query' as any, { query_text: sql });
      if (fallbackError) {
        // Surface the original error to the UI for clarity
        throw error;
      }

      const rows = Array.isArray(fallbackData) ? fallbackData : [];
      return rows as unknown as Array<{
        name: string;
        schema: string;
        kind: string;
        return_type: string;
        argument_types: string;
        language: string;
        volatility: string;
        security_definer: boolean;
        description: string | null;
      }>;
    },
    staleTime: 60_000,
    retry: 1
  });

  return (
    <RoleGuard roles={['platform_admin', 'tenant_admin']} fallback={<div>Access denied</div>}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Security Overview</h1>
              <p className="text-muted-foreground">Database security configuration and policies</p>
            </div>
          </div>

          <Tabs defaultValue={initialTab} className="w-full">
            <TabsList>
              <TabsTrigger value="sql">SQL Editor</TabsTrigger>
              <TabsTrigger value="rls">RLS Status</TabsTrigger>
              <TabsTrigger value="policies">Policies</TabsTrigger>
              <TabsTrigger value="functions">Functions</TabsTrigger>
              <TabsTrigger value="enums">Enums</TabsTrigger>
              <TabsTrigger value="schema">Schema</TabsTrigger>
              <TabsTrigger value="data-management">Data Management</TabsTrigger>
            </TabsList>

            <TabsContent value="sql" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Terminal className="h-5 w-5" />
                    SQL Query Editor
                  </CardTitle>
                  <CardDescription>
                    Execute read-only SQL queries (SELECT only)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Textarea
                      value={sqlQuery}
                      onChange={(e) => setSqlQuery(e.target.value)}
                      placeholder="Enter your SQL query here..."
                      className="font-mono min-h-[200px]"
                    />
                  </div>
                  <Button 
                    onClick={executeQuery} 
                    disabled={isExecuting}
                    className="w-full"
                  >
                    {isExecuting ? 'Executing...' : 'Execute Query'}
                  </Button>
                  
                  {queryResult && (
                    <div className="mt-4">
                      <h4 className="font-semibold mb-2">Database Query Result</h4>
                      {queryResult.error ? (
                        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
                          {queryResult.error}
                        </div>
                      ) : Array.isArray(queryResult) ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="text-sm text-muted-foreground">
                                Showing {(queryResult.length === 0) ? 0 : Math.min(queryResult.length, (currentPage - 1) * pageSize + queryResult.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize).length)} of {queryResult.length} rows
                              </div>
                              <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>Prev</Button>
                                <span className="text-sm">Page {currentPage} of {Math.max(1, Math.ceil((queryResult?.length || 0) / pageSize))}</span>
                                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(Math.ceil((queryResult?.length || 0) / pageSize), p + 1))} disabled={currentPage >= Math.ceil((queryResult?.length || 0) / pageSize)}>Next</Button>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Rows per page</span>
                                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                                  <SelectTrigger className="w-[100px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="25">25</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                    <SelectItem value="100">100</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Sticky header</span>
                                <Switch checked={stickyHeader} onCheckedChange={setStickyHeader} />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Min col width</span>
                                <Select value={String(minWidthCh)} onValueChange={(v) => { setMinWidthCh(Number(v)); }}>
                                  <SelectTrigger className="w-[100px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="6">6ch</SelectItem>
                                    <SelectItem value="8">8ch</SelectItem>
                                    <SelectItem value="10">10ch</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Max col width</span>
                                <Select value={String(maxWidthCh)} onValueChange={(v) => { setMaxWidthCh(Number(v)); }}>
                                  <SelectTrigger className="w-[110px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="30">30ch</SelectItem>
                                    <SelectItem value="40">40ch</SelectItem>
                                    <SelectItem value="60">60ch</SelectItem>
                                    <SelectItem value="80">80ch</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                            </div>
                          </div>
                          {/* Top horizontal scrollbar synced with the table */}
                          <div
                            className="overflow-x-auto h-4 mt-2"
                            ref={topScrollRef}
                            onScroll={(e) => {
                              const src = e.currentTarget;
                              if (tableScrollRef.current && Math.abs(tableScrollRef.current.scrollLeft - src.scrollLeft) > 1) {
                                tableScrollRef.current.scrollLeft = src.scrollLeft;
                              }
                            }}
                            aria-label="Horizontal scroll for result table"
                          >
                            <div style={{ width: topScrollWidth }} />
                          </div>
                          <div
                            className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[400px]"
                            ref={tableScrollRef}
                            onScroll={(e) => {
                              const src = e.currentTarget;
                              if (topScrollRef.current && Math.abs(topScrollRef.current.scrollLeft - src.scrollLeft) > 1) {
                                topScrollRef.current.scrollLeft = src.scrollLeft;
                              }
                            }}
                          >
                            {(() => {
                              const rows = queryResult as Array<Record<string, any>>;
                              const headerSet = new Set<string>();
                              rows.forEach(r => Object.keys(r || {}).forEach(k => headerSet.add(k)));
                              const headers = Array.from(headerSet);
                              const start = (currentPage - 1) * pageSize;
                              const end = start + pageSize;
                              const pageRows = rows.slice(start, end);

                              // Compute dynamic column widths (in ch) based on longest content
                              const minCh = minWidthCh;
                              const maxCh = maxWidthCh;
                              const widths: Record<string, number> = {};
                              headers.forEach(h => {
                                let longest = String(h).length;
                                for (const row of rows) {
                                  const v = row?.[h];
                                  const s = v === null || v === undefined
                                    ? ''
                                    : typeof v === 'object'
                                      ? JSON.stringify(v)
                                      : String(v);
                                  if (s.length > longest) longest = s.length;
                                }
                                widths[h] = Math.min(maxCh, Math.max(minCh, longest + 2));
                              });
                              return (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      {headers.length === 0 ? (
                                        <TableHead>—</TableHead>
                                      ) : headers.map((h) => (
                                        <TableHead 
                                          key={h} 
                                          className={`whitespace-nowrap ${stickyHeader ? 'sticky top-0 z-10 bg-muted' : ''}`}
                                          style={{ width: `${widths[h]}ch` }}
                                        >
                                          {h}
                                        </TableHead>
                                      ))}
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {pageRows.length === 0 ? (
                                      <TableRow>
                                        <TableCell colSpan={Math.max(1, headers.length)} className="text-center text-muted-foreground">No rows</TableCell>
                                      </TableRow>
                                    ) : (
                                      pageRows.map((row, idx) => (
                                        <TableRow key={idx}>
                                          {headers.map((h) => (
                                            <TableCell 
                                              key={h} 
                                              className="text-xs whitespace-nowrap"
                                              style={{ width: `${widths[h]}ch` }}
                                            >
                                              {row[h] === null || row[h] === undefined
                                                ? '—'
                                                : typeof row[h] === 'object'
                                                  ? JSON.stringify(row[h])
                                                  : String(row[h])}
                                            </TableCell>
                                          ))}
                                        </TableRow>
                                      ))
                                    )}
                                  </TableBody>
                                </Table>
                              );
                            })()}
                          </div>
                        </div>
                      ) : (
                        <div className="border rounded-lg overflow-auto max-h-[400px]">
                          <pre className="p-4 text-xs">
                            {JSON.stringify(queryResult, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="data-management" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Data Management Options
                  </CardTitle>
                  <CardDescription>
                    Configure quote numbering and preview sequences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Context selectors */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="text-sm font-medium mb-2">Tenant</div>
                      <Select onValueChange={onTenantChange} value={tenantId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select tenant" />
                        </SelectTrigger>
                        <SelectContent>
                          {tenants.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-2">Franchise (optional)</div>
                      <Select onValueChange={onFranchiseChange} value={franchiseId}>
                        <SelectTrigger>
                          <SelectValue placeholder={tenantId ? 'Select franchise' : 'Select tenant first'} />
                        </SelectTrigger>
                        <SelectContent>
                          {franchises.map((f) => (
                            <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Tabs defaultValue="tenant">
                    <TabsList>
                      <TabsTrigger value="tenant">Tenant Config</TabsTrigger>
                      <TabsTrigger value="franchise">Franchise Config</TabsTrigger>
                      <TabsTrigger value="preview">Sequences & Preview</TabsTrigger>
                    </TabsList>
                    <TabsContent value="tenant" className="mt-4">
                      <TenantConfigForm tenantIdOverride={tenantId} />
                    </TabsContent>
                    <TabsContent value="franchise" className="mt-4">
                      <FranchiseConfigForm tenantIdOverride={tenantId} franchiseIdOverride={franchiseId} />
                    </TabsContent>
                    <TabsContent value="preview" className="mt-4">
                      <SequencesAndPreview tenantIdOverride={tenantId} franchiseIdOverride={franchiseId} />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="functions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Database Functions & Procedures
                  </CardTitle>
                  <CardDescription>
                    Implemented functions and procedures in the `public` schema
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {functionsLoading ? (
                    <div>Loading...</div>
                  ) : functionsError ? (
                    <div className="text-destructive">Failed to load functions: {(functionsError as any)?.message ?? 'Unknown error'}</div>
                  ) : !dbFunctions || dbFunctions.length === 0 ? (
                    <div className="text-muted-foreground">No functions found</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Kind</TableHead>
                          <TableHead>Return Type</TableHead>
                          <TableHead>Arguments</TableHead>
                          <TableHead>Language</TableHead>
                          <TableHead>Volatility</TableHead>
                          <TableHead>Security</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dbFunctions?.map((fn) => (
                          <TableRow key={`${fn.schema}.${fn.name}(${fn.argument_types})`}>
                            <TableCell className="font-medium">{fn.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{fn.kind}</Badge>
                            </TableCell>
                            <TableCell className="text-xs">{fn.return_type}</TableCell>
                            <TableCell className="text-xs break-all">{fn.argument_types || '—'}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{fn.language}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{fn.volatility}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={fn.security_definer ? 'default' : 'secondary'}>
                                {fn.security_definer ? 'SECURITY DEFINER' : 'SECURITY INVOKER'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs break-all">{fn.description ?? '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rls" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    Row Level Security Status
                  </CardTitle>
                  <CardDescription>
                    Tables with RLS enabled and policy counts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {rlsLoading ? (
                    <div>Loading...</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Table Name</TableHead>
                          <TableHead>RLS Enabled</TableHead>
                          <TableHead>Policy Count</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rlsStatus?.map((table) => (
                          <TableRow key={table.table_name}>
                            <TableCell className="font-medium">{table.table_name}</TableCell>
                            <TableCell>
                              <Badge variant={table.rls_enabled ? 'default' : 'destructive'}>
                                {table.rls_enabled ? 'Enabled' : 'Disabled'}
                              </Badge>
                            </TableCell>
                            <TableCell>{table.policy_count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="policies" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    RLS Policies
                  </CardTitle>
                  <CardDescription>
                    All Row Level Security policies by table
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {policiesLoading ? (
                    <div>Loading...</div>
                  ) : (
                    <div className="space-y-6">
                      <div className="border rounded-lg">
                        <div className="px-4 py-3 border-b bg-muted/30">
                          <span className="font-semibold">Tables</span>
                        </div>
                        <div className="p-3 overflow-x-auto">
                          {schemaTablesLoading ? (
                            <div>Loading...</div>
                          ) : !schemaTables || schemaTables.length === 0 ? (
                            <div className="text-muted-foreground">No tables found</div>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Name</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead>RLS</TableHead>
                                  <TableHead>Policies</TableHead>
                                  <TableHead>Columns</TableHead>
                                  <TableHead>Indexes</TableHead>
                                  <TableHead>Row Estimate</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {schemaTables?.map((t) => (
                                  <TableRow key={t.table_name}>
                                    <TableCell className="font-medium">{t.table_name}</TableCell>
                                    <TableCell><Badge variant="outline">{t.table_type}</Badge></TableCell>
                                    <TableCell>
                                      {t.rls_enabled === null ? (
                                        <span className="text-muted-foreground">—</span>
                                      ) : (
                                        <Badge variant={t.rls_enabled ? 'default' : 'destructive'}>
                                          {t.rls_enabled ? 'Enabled' : 'Disabled'}
                                        </Badge>
                                      )}
                                    </TableCell>
                                    <TableCell>{t.policy_count}</TableCell>
                                    <TableCell>{t.column_count}</TableCell>
                                    <TableCell>{t.index_count}</TableCell>
                                    <TableCell>{t.row_estimate ?? '—'}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      </div>

                      <div className="border rounded-lg">
                        <div className="px-4 py-3 border-b bg-muted/30">
                          <span className="font-semibold">Constraints</span>
                        </div>
                        <div className="p-3 overflow-x-auto">
                          {schemaConstraintsLoading ? (
                            <div>Loading...</div>
                          ) : !schemaConstraints || schemaConstraints.length === 0 ? (
                            <div className="text-muted-foreground">No constraints found</div>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Table</TableHead>
                                  <TableHead>Name</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead>Details</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {schemaConstraints?.map((c, idx) => (
                                  <TableRow key={`${c.table_name}-${c.constraint_name}-${idx}`}>
                                    <TableCell className="font-medium">{c.table_name}</TableCell>
                                    <TableCell>{c.constraint_name}</TableCell>
                                    <TableCell><Badge variant="outline">{c.constraint_type}</Badge></TableCell>
                                    <TableCell className="text-xs break-all">{c.constraint_details}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      </div>

                      <div className="border rounded-lg">
                        <div className="px-4 py-3 border-b bg-muted/30">
                          <span className="font-semibold">Indexes</span>
                        </div>
                        <div className="p-3 overflow-x-auto">
                          {schemaIndexesLoading ? (
                            <div>Loading...</div>
                          ) : !schemaIndexes || schemaIndexes.length === 0 ? (
                            <div className="text-muted-foreground">No indexes found</div>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Table</TableHead>
                                  <TableHead>Index</TableHead>
                                  <TableHead>Unique</TableHead>
                                  <TableHead>Columns</TableHead>
                                  <TableHead>Definition</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {schemaIndexes?.map((i, idx) => (
                                  <TableRow key={`${i.table_name}-${i.index_name}-${idx}`}>
                                    <TableCell className="font-medium">{i.table_name}</TableCell>
                                    <TableCell>{i.index_name}</TableCell>
                                    <TableCell>
                                      <Badge variant={i.is_unique ? 'default' : 'secondary'}>
                                        {i.is_unique ? 'Yes' : 'No'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs">{i.index_columns}</TableCell>
                                    <TableCell className="text-xs break-all">{i.index_definition}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      </div>
                      <div className="border rounded-lg">
                        <div className="px-4 py-3 border-b bg-muted/30">
                          <span className="font-semibold">Tables</span>
                        </div>
                        <div className="p-3 overflow-x-auto">
                          {schemaTablesLoading ? (
                            <div>Loading...</div>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Name</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead>RLS</TableHead>
                                  <TableHead>Policies</TableHead>
                                  <TableHead>Columns</TableHead>
                                  <TableHead>Indexes</TableHead>
                                  <TableHead>Row Estimate</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {schemaTables?.map((t) => (
                                  <TableRow key={t.table_name}>
                                    <TableCell className="font-medium">{t.table_name}</TableCell>
                                    <TableCell><Badge variant="outline">{t.table_type}</Badge></TableCell>
                                    <TableCell>
                                      {t.rls_enabled === null ? (
                                        <span className="text-muted-foreground">—</span>
                                      ) : (
                                        <Badge variant={t.rls_enabled ? 'default' : 'destructive'}>
                                          {t.rls_enabled ? 'Enabled' : 'Disabled'}
                                        </Badge>
                                      )}
                                    </TableCell>
                                    <TableCell>{t.policy_count}</TableCell>
                                    <TableCell>{t.column_count}</TableCell>
                                    <TableCell>{t.index_count}</TableCell>
                                    <TableCell>{t.row_estimate ?? '—'}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      </div>

                      <div className="border rounded-lg">
                        <div className="px-4 py-3 border-b bg-muted/30">
                          <span className="font-semibold">Constraints</span>
                        </div>
                        <div className="p-3 overflow-x-auto">
                          {schemaConstraintsLoading ? (
                            <div>Loading...</div>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Table</TableHead>
                                  <TableHead>Name</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead>Details</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {schemaConstraints?.map((c, idx) => (
                                  <TableRow key={`${c.table_name}-${c.constraint_name}-${idx}`}>
                                    <TableCell className="font-medium">{c.table_name}</TableCell>
                                    <TableCell>{c.constraint_name}</TableCell>
                                    <TableCell><Badge variant="outline">{c.constraint_type}</Badge></TableCell>
                                    <TableCell className="text-xs break-all">{c.constraint_details}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      </div>

                      <div className="border rounded-lg">
                        <div className="px-4 py-3 border-b bg-muted/30">
                          <span className="font-semibold">Indexes</span>
                        </div>
                        <div className="p-3 overflow-x-auto">
                          {schemaIndexesLoading ? (
                            <div>Loading...</div>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Table</TableHead>
                                  <TableHead>Index</TableHead>
                                  <TableHead>Unique</TableHead>
                                  <TableHead>Columns</TableHead>
                                  <TableHead>Definition</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {schemaIndexes?.map((i, idx) => (
                                  <TableRow key={`${i.table_name}-${i.index_name}-${idx}`}>
                                    <TableCell className="font-medium">{i.table_name}</TableCell>
                                    <TableCell>{i.index_name}</TableCell>
                                    <TableCell>
                                      <Badge variant={i.is_unique ? 'default' : 'secondary'}>
                                        {i.is_unique ? 'Yes' : 'No'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs">{i.index_columns}</TableCell>
                                    <TableCell className="text-xs break-all">{i.index_definition}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      </div>
                      {Object.entries(
                        policies?.reduce((acc, policy) => {
                          if (!acc[policy.table_name]) acc[policy.table_name] = [];
                          acc[policy.table_name].push(policy);
                          return acc;
                        }, {} as Record<string, typeof policies>) || {}
                      ).map(([tableName, tablePolicies]) => (
                        <div key={tableName} className="border rounded-lg p-4">
                          <h3 className="font-semibold text-lg mb-3">{tableName}</h3>
                          <div className="space-y-3">
                            {tablePolicies.map((policy, idx) => (
                              <div key={idx} className="border-l-2 border-primary pl-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium">{policy.policy_name}</span>
                                  <Badge variant="outline">{policy.command}</Badge>
                                  <Badge variant="secondary">{policy.roles}</Badge>
                                </div>
                                <code className="text-xs text-muted-foreground block">
                                  {policy.using_expression}
                                </code>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="enums" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Database Enums
                  </CardTitle>
                  <CardDescription>
                    Custom enum types and their values
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {enumsLoading ? (
                    <div>Loading...</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Enum Type</TableHead>
                          <TableHead>Values</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {enums?.map((enumType) => (
                          <TableRow key={enumType.enum_type}>
                            <TableCell className="font-medium">{enumType.enum_type}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {enumType.labels.split(', ').map((label) => (
                                  <Badge key={label} variant="outline">{label}</Badge>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="schema" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Database Schema
                  </CardTitle>
                  <CardDescription>
                    Tables, columns, constraints, and indexes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {schemaLoading ? (
                    <div>Loading...</div>
                  ) : (
                    <div className="space-y-6">
                      {Object.entries(
                        (schema || []).reduce((acc, col) => {
                          if (!acc[col.table_name]) acc[col.table_name] = [];
                          acc[col.table_name].push(col);
                          return acc;
                        }, {} as Record<string, typeof schema>)
                      ).map(([tableName, columns]) => (
                        <div key={tableName} className="border rounded-lg">
                          <div className="px-4 py-3 border-b bg-muted/30">
                            <span className="font-semibold">{tableName}</span>
                          </div>
                          <div className="p-3 overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Column</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead>Nullable</TableHead>
                                  <TableHead>Default</TableHead>
                                  <TableHead>Keys</TableHead>
                                  <TableHead>References</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {columns?.map((col, idx) => (
                                  <TableRow key={`${tableName}-${col.column_name}-${idx}`}>
                                    <TableCell className="font-medium">{col.column_name}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline">{col.data_type}</Badge>
                                    </TableCell>
                                    <TableCell>{col.is_nullable ? 'YES' : 'NO'}</TableCell>
                                    <TableCell className="text-xs break-all">{col.column_default ?? ''}</TableCell>
                                    <TableCell>
                                      <div className="flex gap-1 flex-wrap">
                                        {col.is_primary_key && (
                                          <Badge variant="default">PK</Badge>
                                        )}
                                        {col.is_foreign_key && (
                                          <Badge variant="secondary">FK</Badge>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      {col.references_table ? (
                                        <div className="flex items-center gap-1">
                                          <Badge variant="outline">{col.references_table}</Badge>
                                          <span className="text-xs text-muted-foreground">{col.references_column}</span>
                                        </div>
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
