import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Package, CheckCircle, XCircle, Clock, FileText } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHeader, TableRow, SortableHead } from '@/components/ui/table';
import { useSort } from '@/hooks/useSort';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ViewToggle, ViewMode } from '@/components/ui/view-toggle';
import { useCRM } from '@/hooks/useCRM';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { toast } from 'sonner';
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext, PaginationFirst, PaginationLast, PaginationLink } from '@/components/ui/pagination';
import { usePagination } from '@/hooks/usePagination';
import { Database } from '@/integrations/supabase/types';

type MasterCommodity = Database['public']['Tables']['master_commodities']['Row'];

export default function Commodities() {
  const navigate = useNavigate();
  const [commodities, setCommodities] = useState<MasterCommodity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const { supabase } = useCRM();

  const fetchCommodities = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('master_commodities')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setCommodities(data || []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to load commodities', { description: message });
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchCommodities();
  }, [fetchCommodities]);

  const filteredCommodities = commodities.filter(commodity => {
    const matchesSearch = 
      (commodity.name?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (commodity.sku?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (commodity.description?.toLowerCase().includes(searchQuery.toLowerCase()) || false);
    
    const matchesStatus = statusFilter === 'all' || commodity.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const { sorted: sortedCommodities, sortField, sortDirection, onSort } = useSort<MasterCommodity>(filteredCommodities, {
    accessors: {
      name: (c) => c.name || '',
      sku: (c) => c.sku || '',
      status: (c) => c.status || 'draft',
      updated_at: (c) => c.updated_at || '',
    },
    initialSortField: 'updated_at',
    initialSortDirection: 'desc'
  });

  const {
    pageItems: pagedCommodities,
    pageSize,
    setPageSize,
    pageSizeOptions,
    currentPage,
    totalPages,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    canPrev,
    canNext,
  } = usePagination(sortedCommodities, { initialPageSize: 20 });

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'approved':
        return 'bg-green-500/10 text-green-500 hover:bg-green-500/20';
      case 'rejected':
        return 'bg-red-500/10 text-red-500 hover:bg-red-500/20';
      case 'pending_review':
        return 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20';
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-3 w-3 mr-1" />;
      case 'rejected':
        return <XCircle className="h-3 w-3 mr-1" />;
      case 'pending_review':
        return <Clock className="h-3 w-3 mr-1" />;
      default:
        return <FileText className="h-3 w-3 mr-1" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Commodity Catalog</h1>
            <p className="text-muted-foreground mt-2">
              Manage your master product catalog and HTS classifications.
            </p>
          </div>
          <Button onClick={() => navigate('/dashboard/commodities/new')} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Add Commodity
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4 justify-between">
              <div className="flex flex-1 gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search commodities..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending_review">Pending Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {viewMode === 'list' ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHead label="SKU" sortField="sku" currentSortField={sortField} sortDirection={sortDirection} onSort={onSort} />
                      <SortableHead label="Name" sortField="name" currentSortField={sortField} sortDirection={sortDirection} onSort={onSort} />
                      <TableHead>Description</TableHead>
                      <SortableHead label="Status" sortField="status" currentSortField={sortField} sortDirection={sortDirection} onSort={onSort} />
                      <SortableHead label="Last Updated" sortField="updated_at" currentSortField={sortField} sortDirection={sortDirection} onSort={onSort} />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          Loading commodities...
                        </TableCell>
                      </TableRow>
                    ) : pagedCommodities.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          No commodities found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagedCommodities.map((commodity) => (
                        <TableRow 
                          key={commodity.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/dashboard/commodities/${commodity.id}`)}
                        >
                          <TableCell className="font-medium">{commodity.sku}</TableCell>
                          <TableCell>{commodity.name}</TableCell>
                          <TableCell className="max-w-[300px] truncate text-muted-foreground">
                            {commodity.description}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={getStatusColor(commodity.status)}>
                              {getStatusIcon(commodity.status)}
                              {commodity.status?.replace('_', ' ').toUpperCase() || 'DRAFT'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(commodity.updated_at || '').toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pagedCommodities.map((commodity) => (
                  <Card 
                    key={commodity.id} 
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => navigate(`/dashboard/commodities/${commodity.id}`)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg font-medium truncate pr-2">
                          {commodity.name}
                        </CardTitle>
                        <Badge variant="secondary" className={getStatusColor(commodity.status)}>
                          {commodity.status?.replace('_', ' ').toUpperCase() || 'DRAFT'}
                        </Badge>
                      </div>
                      <CardDescription>{commodity.sku}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                        {commodity.description || 'No description provided.'}
                      </p>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>Updated {new Date(commodity.updated_at || '').toLocaleDateString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <div className="mt-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationFirst onClick={firstPage} disabled={!canPrev} />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationPrevious onClick={prevPage} disabled={!canPrev} />
                  </PaginationItem>
                  <div className="flex items-center gap-2 mx-4 text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                  <PaginationItem>
                    <PaginationNext onClick={nextPage} disabled={!canNext} />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLast onClick={lastPage} disabled={!canNext} />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

// Helper for TableHead since it wasn't imported
function TableHead({ children, className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn("h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0", className)} {...props}>
      {children}
    </th>
  )
}
import { cn } from '@/lib/utils';
