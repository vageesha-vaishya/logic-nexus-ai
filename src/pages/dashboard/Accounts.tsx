import { useState, useEffect } from 'react';
import { Plus, Search, Building2, Phone, Mail, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import TitleStrip from '@/components/ui/title-strip';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHeader, TableRow, SortableHead } from '@/components/ui/table';
import { useSort } from '@/hooks/useSort';
import { ViewToggle, ViewMode } from '@/components/ui/view-toggle';
import { useCRM } from '@/hooks/useCRM';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

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
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const { supabase } = useCRM();

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error: any) {
      toast.error('Failed to load accounts');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = accounts.filter(account =>
    account.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    account.industry?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const { sorted: sortedAccounts, sortField, sortDirection, onSort } = useSort<any>(filteredAccounts, {
    accessors: {
      name: (a) => a.name,
      type: (a) => a.account_type ?? '',
      status: (a) => a.status ?? '',
      industry: (a) => a.industry ?? '',
      phone: (a) => a.phone ?? '',
      email: (a) => a.email ?? '',
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
      <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Accounts</h1>
          <p className="text-muted-foreground">Manage your company accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle
            value={viewMode}
            modes={['pipeline','card','grid','list']}
            onChange={(v) => v === 'pipeline' ? navigate('/dashboard/accounts/pipeline') : setViewMode(v)}
          />
          {/* Removed standalone Pipeline View button; use ViewToggle with Pipeline first */}
          <Button asChild>
            <Link to="/dashboard/accounts/new">
              <Plus className="mr-2 h-4 w-4" />
              New Account
            </Link>
          </Button>
        </div>
      </div>

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
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No accounts found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'Try adjusting your search' : 'Get started by creating your first account'}
            </p>
            {!searchQuery && (
              <Button asChild>
                <Link to="/dashboard/accounts/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Account
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        viewMode === 'list' ? (
          <Card>
            <CardHeader className="pb-2">
              <TitleStrip label="All Accounts" />
            </CardHeader>
            <CardContent>
              <Table>
              <TableHeader className="bg-[hsl(var(--title-strip))] [&_th]:text-white [&_th]:font-semibold [&_th]:text-xs [&_th]:px-3 [&_th]:py-2 [&_th]:border-l [&_th]:border-white/60">
                <TableRow className="border-b-2" style={{ borderBottomColor: 'hsl(var(--title-strip))' }}>
                  <SortableHead field="name" activeField={sortField} direction={sortDirection} onSort={onSort}>Name</SortableHead>
                  <SortableHead field="type" activeField={sortField} direction={sortDirection} onSort={onSort}>Type</SortableHead>
                  <SortableHead field="status" activeField={sortField} direction={sortDirection} onSort={onSort}>Status</SortableHead>
                  <SortableHead field="industry" activeField={sortField} direction={sortDirection} onSort={onSort}>Industry</SortableHead>
                  <SortableHead field="phone" activeField={sortField} direction={sortDirection} onSort={onSort}>Phone</SortableHead>
                  <SortableHead field="email" activeField={sortField} direction={sortDirection} onSort={onSort}>Email</SortableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAccounts.map((account) => (
                    <TableRow key={account.id} className="cursor-pointer" onClick={() => {}}>
                      <TableCell>
                        <Link className="font-medium hover:underline" to={`/dashboard/accounts/${account.id}`}>{account.name}</Link>
                      </TableCell>
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
          <div className="space-y-2">
            <TitleStrip label="All Accounts" />
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {filteredAccounts.map((account) => (
                <Link key={account.id} to={`/dashboard/accounts/${account.id}`}>
                  <Card className="hover:shadow transition-shadow cursor-pointer">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base truncate">{account.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between">
                      <Badge className={getTypeColor(account.account_type)}>{account.account_type}</Badge>
                      <Badge className={getStatusColor(account.status)}>{account.status}</Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <TitleStrip label="All Accounts" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredAccounts.map((account) => (
                <Link key={account.id} to={`/dashboard/accounts/${account.id}`}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <Building2 className="h-10 w-10 text-primary" />
                        <div className="flex gap-2">
                          <Badge className={getStatusColor(account.status)}>
                            {account.status}
                          </Badge>
                          <Badge className={getTypeColor(account.account_type)}>
                            {account.account_type}
                          </Badge>
                        </div>
                      </div>
                      <CardTitle className="mt-4">{account.name}</CardTitle>
                      {account.industry && (
                        <CardDescription>{account.industry}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {account.phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          <span>{account.phone}</span>
                        </div>
                      )}
                      {account.email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          <span className="truncate">{account.email}</span>
                        </div>
                      )}
                      {account.website && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Globe className="h-4 w-4" />
                          <span className="truncate">{account.website}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )
      )}
    </div>
    </DashboardLayout>
  );
}
