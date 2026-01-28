
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Landmark } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FirstScreenTemplate } from '@/components/system/FirstScreenTemplate';
import { EmptyState } from '@/components/system/EmptyState';
import { TaxManagementService } from '@/services/taxation/TaxManagementService';
import { TaxJurisdiction } from '@/services/taxation/types';

export default function TaxJurisdictions() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [jurisdictions, setJurisdictions] = useState<TaxJurisdiction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJurisdictions();
  }, []);

  const fetchJurisdictions = async () => {
    try {
      const data = await TaxManagementService.getJurisdictions();
      setJurisdictions(data);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <FirstScreenTemplate
        title="Tax Jurisdictions"
        description="Manage tax jurisdictions (Countries, States, Cities)"
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Tax Jurisdictions' }]}
        viewMode="list"
        availableModes={['list']}
        onCreate={() => navigate('/dashboard/finance/tax-jurisdictions/new')}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5" />
              All Jurisdictions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : jurisdictions.length === 0 ? (
              <EmptyState
                title="No jurisdictions found"
                description="Create your first tax jurisdiction."
                actionLabel="New Jurisdiction"
                onAction={() => navigate('/dashboard/finance/tax-jurisdictions/new')}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Parent ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jurisdictions.map((j) => (
                    <TableRow
                      key={j.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/dashboard/finance/tax-jurisdictions/${j.id}`)}
                    >
                      <TableCell className="font-mono">{j.code}</TableCell>
                      <TableCell className="font-medium">{j.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{j.type}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{j.parentId || '-'}</TableCell>
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
