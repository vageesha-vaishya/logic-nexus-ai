import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FirstScreenTemplate } from '@/components/system/FirstScreenTemplate';
import { EmptyState } from '@/components/system/EmptyState';
import { DomainService, PlatformDomain } from '@/services/DomainService';

export default function PlatformDomains() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [domains, setDomains] = useState<PlatformDomain[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    try {
      const data = await DomainService.getAllDomains(true);
      setDomains(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <FirstScreenTemplate
        title="Platform Domains"
        description="Manage system-wide business domains"
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Platform Domains' }]}
        viewMode="list"
        availableModes={['list']}
        onCreate={() => navigate('/dashboard/settings/domains/new')}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              All Domains
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : domains.length === 0 ? (
              <EmptyState
                title="No domains found"
                description="Create your first platform domain."
                actionLabel="New Domain"
                onAction={() => navigate('/dashboard/settings/domains/new')}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {domains.map((domain) => (
                    <TableRow
                      key={domain.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/dashboard/settings/domains/${domain.id}`)}
                    >
                      <TableCell className="font-medium">{domain.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {domain.code}
                        </Badge>
                      </TableCell>
                      <TableCell>{domain.description || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={domain.is_active ? 'default' : 'secondary'}>
                          {domain.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </FirstScreenTemplate>
    </DashboardLayout>
  );
}
