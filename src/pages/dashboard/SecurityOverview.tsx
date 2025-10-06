import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Database, Lock } from 'lucide-react';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function SecurityOverview() {
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

          <Tabs defaultValue="rls" className="w-full">
            <TabsList>
              <TabsTrigger value="rls">RLS Status</TabsTrigger>
              <TabsTrigger value="policies">Policies</TabsTrigger>
              <TabsTrigger value="enums">Enums</TabsTrigger>
            </TabsList>

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
