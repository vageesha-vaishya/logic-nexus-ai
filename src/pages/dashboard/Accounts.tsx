import { useState, useEffect } from 'react';
import { Plus, Search, Building2, Phone, Mail, Globe, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHeader, TableRow, SortableHead } from '@/components/ui/table';
import { useSort } from '@/hooks/useSort';
import { ViewToggle, ViewMode } from '@/components/ui/view-toggle';
import { useCRM } from '@/hooks/useCRM';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { FirstScreenTemplate } from '@/components/system/FirstScreenTemplate';
import { EntityCard } from '@/components/system/EntityCard';
import { EmptyState } from '@/components/system/EmptyState';

interface Account {
  id: string;
  name: string;
  account_type: string;
  status: string;
  industry: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  created_at: string;
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const { context, scopedDb } = useCRM();

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const { data, error } = await scopedDb
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccounts(data as unknown as Account[]);
    } catch (error) {
      toast.error('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = accounts.filter(account =>
    account.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    account.industry?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const { sorted: sortedAccounts, sortField, sortDirection, onSort } = useSort<Account>(filteredAccounts, {
    accessors: {
      name: (a: Account) => a.name,
      type: (a: Account) => a.account_type ?? '',
      status: (a: Account) => a.status ?? '',
      industry: (a: Account) => a.industry ?? '',
      phone: (a: Account) => a.phone ?? '',
      email: (a: Account) => a.email ?? '',
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-500';
      case 'inactive': return 'bg-gray-500/10 text-gray-500';
      case 'pending': return 'bg-yellow-500/10 text-yellow-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'customer': return 'bg-blue-500/10 text-blue-500';
      case 'prospect': return 'bg-purple-500/10 text-purple-500';
      case 'partner': return 'bg-teal-500/10 text-teal-500';
      case 'vendor': return 'bg-orange-500/10 text-orange-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  return (
    <DashboardLayout>
      <FirstScreenTemplate
        title="Accounts"
        description="Manage your company accounts"
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Accounts' }]}
        viewMode={viewMode}
        availableModes={['card', 'grid', 'list']}
        onViewModeChange={setViewMode}
        onCreate={() => (window.location.href = '/dashboard/accounts/new')}
        actionsRight={
          <>
            <Button variant="outline" asChild className="mr-2">
              <Link to="/dashboard/accounts/import-export">
                <Download className="mr-2 h-4 w-4" />
                Import/Export
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/dashboard/accounts/pipeline">Pipeline View</Link>
            </Button>
          </>
        }
      >
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading accounts...</p>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-10 w-10" />}
            title="No accounts found"
            description={searchQuery ? 'Try adjusting your search' : 'Get started by creating your first account'}
            actionLabel={!searchQuery ? 'Create Account' : undefined}
            onAction={!searchQuery ? () => (window.location.href = '/dashboard/accounts/new') : undefined}
          />
        ) : viewMode === 'list' ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>All Accounts</CardTitle>
              <CardDescription>Sorted and filterable list</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead field="name" activeField={sortField} direction={sortDirection} onSort={onSort}>
                      Name
                    </SortableHead>
                    <SortableHead field="type" activeField={sortField} direction={sortDirection} onSort={onSort}>
                      Type
                    </SortableHead>
                    <SortableHead field="status" activeField={sortField} direction={sortDirection} onSort={onSort}>
                      Status
                    </SortableHead>
                    <SortableHead field="industry" activeField={sortField} direction={sortDirection} onSort={onSort}>
                      Industry
                    </SortableHead>
                    <SortableHead field="phone" activeField={sortField} direction={sortDirection} onSort={onSort}>
                      Phone
                    </SortableHead>
                    <SortableHead field="email" activeField={sortField} direction={sortDirection} onSort={onSort}>
                      Email
                    </SortableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAccounts.map((account) => (
                    <TableRow
                      key={account.id}
                      className="cursor-pointer"
                      onClick={() => (window.location.href = `/dashboard/accounts/${account.id}`)}
                    >
                      <TableCell className="font-medium">{account.name}</TableCell>
                      <TableCell>{account.account_type}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(account.status)}>{account.status}</Badge>
                      </TableCell>
                      <TableCell>{account.industry || '-'}</TableCell>
                      <TableCell>{account.phone || '-'}</TableCell>
                      <TableCell>{account.email || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredAccounts.map((account) => (
              <EntityCard
                key={account.id}
                title={account.name}
                subtitle={account.industry || undefined}
                meta={[account.phone, account.email, account.website].filter(Boolean).join(' • ')}
                tags={[account.status, account.account_type].filter(Boolean)}
                onClick={() => (window.location.href = `/dashboard/accounts/${account.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredAccounts.map((account) => (
              <EntityCard
                key={account.id}
                title={account.name}
                subtitle={account.industry || undefined}
                meta={[account.phone, account.email, account.website].filter(Boolean).join(' • ')}
                tags={[account.status, account.account_type].filter(Boolean)}
                onClick={() => (window.location.href = `/dashboard/accounts/${account.id}`)}
              />
            ))}
          </div>
        )}
      </FirstScreenTemplate>
    </DashboardLayout>
  );
}
