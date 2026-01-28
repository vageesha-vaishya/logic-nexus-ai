
import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw } from 'lucide-react';
import { DomainService, PlatformDomain } from '@/services/DomainService';
import { useToast } from '@/hooks/use-toast';

export default function DomainManagement() {
  const { toast } = useToast();
  const [domains, setDomains] = useState<PlatformDomain[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDomains = async (force = false) => {
    setLoading(true);
    try {
      if (force) DomainService.invalidateCache();
      const data = await DomainService.getAllDomains(force);
      setDomains(data);
    } catch (error) {
      toast({ 
        title: 'Error loading domains', 
        description: 'Failed to fetch platform domains',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDomains();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Domain Management</h1>
                <p className="text-muted-foreground">Manage platform verticals and business domains.</p>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" onClick={() => loadDomains(true)} disabled={loading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
                <Button onClick={() => toast({ title: 'Not Implemented', description: 'Create Domain modal would open here' })}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Domain
                </Button>
            </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Registered Domains</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains.map((domain) => (
                  <TableRow key={domain.id}>
                    <TableCell className="font-mono">{domain.code}</TableCell>
                    <TableCell className="font-medium">{domain.name}</TableCell>
                    <TableCell>{domain.description}</TableCell>
                    <TableCell>
                      <Badge variant={domain.is_active ? 'default' : 'secondary'}>
                        {domain.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                        <Button variant="ghost" size="sm">Edit</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
