import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Link as LinkIcon } from 'lucide-react';
import { EmptyState } from '@/components/system/EmptyState';

interface Mapping {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
  tenants: {
    name: string;
  };
}

interface TenantFranchiseMappingListProps {
  data: Mapping[];
  loading: boolean;
}

export function TenantFranchiseMappingList({ data, loading }: TenantFranchiseMappingListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredData = data.filter(item => {
    const searchLower = search.toLowerCase();
    const matchesSearch = 
      item.name.toLowerCase().includes(searchLower) || 
      item.tenants?.name?.toLowerCase().includes(searchLower) ||
      item.code.toLowerCase().includes(searchLower);
    
    const matchesStatus = statusFilter === 'all' 
      ? true 
      : statusFilter === 'active' 
        ? item.is_active 
        : !item.is_active;

    return matchesSearch && matchesStatus;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <CardTitle className="flex items-center gap-2">
                    <LinkIcon className="h-5 w-5" />
                    Tenant-Franchisee Mappings
                </CardTitle>
                <CardDescription>
                    View and manage relationships between tenants and franchises
                </CardDescription>
            </div>
            <div className="flex items-center gap-2">
                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search mappings..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8 w-[250px]"
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">Loading mappings...</div>
        ) : filteredData.length === 0 ? (
          <EmptyState
            title={search || statusFilter !== 'all' ? "No matching mappings found" : "No mappings found"}
            description={search || statusFilter !== 'all' ? "Try adjusting your search or filters." : "No tenant-franchise relationships exist."}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Franchise Name</TableHead>
                <TableHead>Franchise Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Association Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.tenants?.name || 'Unknown Tenant'}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {item.code}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.is_active ? 'default' : 'secondary'}>
                      {item.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(item.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
