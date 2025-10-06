import { useState } from 'react';
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
import { useToast } from '@/hooks/use-toast';

export default function SecurityOverview() {
  const { toast } = useToast();
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM leads LIMIT 10;');
  const [queryResult, setQueryResult] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const executeQuery = async () => {
    setIsExecuting(true);
    try {
      const { data, error } = await supabase.rpc('execute_sql_query' as any, { 
        query_text: sqlQuery 
      });
      
      if (error) throw error;
      
      setQueryResult(data);
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

          <Tabs defaultValue="sql" className="w-full">
            <TabsList>
              <TabsTrigger value="sql">SQL Editor</TabsTrigger>
              <TabsTrigger value="rls">RLS Status</TabsTrigger>
              <TabsTrigger value="policies">Policies</TabsTrigger>
              <TabsTrigger value="enums">Enums</TabsTrigger>
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
                      <h4 className="font-semibold mb-2">Results:</h4>
                      {queryResult.error ? (
                        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
                          {queryResult.error}
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
          </Tabs>
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
