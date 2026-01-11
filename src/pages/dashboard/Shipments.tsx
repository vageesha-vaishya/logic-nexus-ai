import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Package, Filter } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHeader, TableRow, SortableHead } from '@/components/ui/table';
import { useSort } from '@/hooks/useSort';
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext, PaginationFirst, PaginationLast, PaginationLink } from '@/components/ui/pagination';
import { usePagination } from '@/hooks/usePagination';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ViewToggle, ViewMode } from '@/components/ui/view-toggle';
import { useCRM } from '@/hooks/useCRM';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ShipmentStats } from '@/components/logistics/ShipmentStats';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { matchText, TextOp } from '@/lib/utils';
import { Shipment, ShipmentStatus, statusConfig, normalizeShipmentType, formatShipmentType } from './shipments-data';

export default function Shipments() {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const { supabase, context, scopedDb } = useCRM();

  // Advanced per-column filters
  const [filterShipmentNo, setFilterShipmentNo] = useState('');
  const [filterShipmentNoOp, setFilterShipmentNoOp] = useState<TextOp>('contains');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterCustomerOp, setFilterCustomerOp] = useState<TextOp>('contains');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterPriorityOp, setFilterPriorityOp] = useState<TextOp>('contains');
  const [packagesMin, setPackagesMin] = useState<string>('');
  const [packagesMax, setPackagesMax] = useState<string>('');
  const [etaStart, setEtaStart] = useState<string>('');
  const [etaEnd, setEtaEnd] = useState<string>('');

  useEffect(() => {
    fetchShipments();
  }, []);

  const fetchShipments = async () => {
    try {
      const { data, error } = await scopedDb
        .from('shipments')
        .select('*, accounts(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setShipments(data as unknown as Shipment[]);
    } catch (error: unknown) {
      toast.error('Failed to load shipments');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredShipments = shipments.filter(shipment => {
    const globalQuery = searchQuery.trim().toLowerCase();
    const matchesGlobal = !globalQuery || [
      shipment.shipment_number,
      shipment.accounts?.name || '',
      shipment.priority_level || '',
      shipment.shipment_type || '',
      shipment.status || ''
    ].some(v => (v || '').toLowerCase().includes(globalQuery));

    const matchesStatus = statusFilter === 'all' || shipment.status === statusFilter;
    const matchesType = typeFilter === 'all' || normalizeShipmentType(shipment.shipment_type) === normalizeShipmentType(typeFilter);

    const matchesShipmentNo = matchText(shipment.shipment_number, filterShipmentNo, filterShipmentNoOp);
    const matchesCustomer = matchText(shipment.accounts?.name ?? '', filterCustomer, filterCustomerOp);
    const matchesPriority = matchText(shipment.priority_level, filterPriority, filterPriorityOp);

    const min = packagesMin ? Number(packagesMin) : undefined;
    const max = packagesMax ? Number(packagesMax) : undefined;
    const total = shipment.total_packages ?? undefined;
    const matchesPackages = (
      (min === undefined || (total !== undefined && total >= min)) &&
      (max === undefined || (total !== undefined && total <= max))
    );

    const eta = shipment.estimated_delivery_date ? new Date(shipment.estimated_delivery_date) : null;
    const start = etaStart ? new Date(etaStart) : null;
    const end = etaEnd ? new Date(etaEnd) : null;
    const matchesETA = (
      (!start || (eta && eta >= start)) &&
      (!end || (eta && eta <= end))
    );

    return matchesGlobal && matchesStatus && matchesType &&
      matchesShipmentNo && matchesCustomer && matchesPriority &&
      matchesPackages && matchesETA;
  });

  const { sorted: sortedShipments, sortField, sortDirection, onSort } = useSort<Shipment>(filteredShipments, {
    accessors: {
      shipment_number: (s) => s.shipment_number,
      type: (s) => s.shipment_type,
      customer: (s) => s.accounts?.name ?? '',
      status: (s) => s.status,
      priority: (s) => s.priority_level ?? '',
      packages: (s) => s.total_packages ?? 0,
      eta: (s) => s.estimated_delivery_date ?? '',
    },
  });

  const {
    pageItems: pagedShipments,
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
  } = usePagination(sortedShipments, { initialPageSize: 20 });

  const totalShipments = shipments.length;
  const inTransit = shipments.filter(s => s.status === 'in_transit').length;
  const delivered = shipments.filter(s => s.status === 'delivered').length;
  const pending = shipments.filter(s => ['draft', 'confirmed'].includes(s.status)).length;

  const getStatusColor = (status: ShipmentStatus) => {
    return statusConfig[status]?.color || 'bg-gray-500/10 text-gray-500';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Shipments</h1>
            <p className="text-muted-foreground">Track and manage all shipments</p>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="text-xs text-muted-foreground">Cards per page</div>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(v === 'ALL' ? 'ALL' : Number(v))}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Cards" />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((opt) => (
                    <SelectItem key={String(opt)} value={String(opt)}>{String(opt)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Pagination className="justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationFirst onClick={firstPage} className={!canPrev ? 'pointer-events-none opacity-50' : ''} />
                </PaginationItem>
                <PaginationItem>
                  <PaginationPrevious onClick={prevPage} className={!canPrev ? 'pointer-events-none opacity-50' : ''} />
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink isActive size="default">Page {currentPage} of {totalPages}</PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext onClick={nextPage} className={!canNext ? 'pointer-events-none opacity-50' : ''} />
                </PaginationItem>
                <PaginationItem>
                  <PaginationLast onClick={lastPage} className={!canNext ? 'pointer-events-none opacity-50' : ''} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
          <div className="flex gap-2 items-center">
            <ViewToggle
              value={viewMode}
              modes={['pipeline','card','grid','list']}
              onChange={(v) => v === 'pipeline' ? navigate('/dashboard/shipments/pipeline') : setViewMode(v)}
            />
            {/* Removed standalone Pipeline View button; use ViewToggle with Pipeline first */}
            <Button asChild>
              <Link to="/dashboard/shipments/new">
                <Plus className="mr-2 h-4 w-4" />
                New Shipment
              </Link>
            </Button>
          </div>
        </div>

        <ShipmentStats
          totalShipments={totalShipments}
          inTransit={inTransit}
          delivered={delivered}
          pending={pending}
        />

        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search shipments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="in_transit">In Transit</SelectItem>
              <SelectItem value="customs">Customs</SelectItem>
              <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <Package className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="ocean">Ocean</SelectItem>
              <SelectItem value="air">Air</SelectItem>
              <SelectItem value="inland_trucking">Inland Trucking</SelectItem>
              <SelectItem value="rail">Rail</SelectItem>
              <SelectItem value="courier">Courier</SelectItem>
              <SelectItem value="movers_packers">Movers & Packers</SelectItem>
            </SelectContent>
          </Select>

          {/* Advanced per-column filters */}
          <div className="flex items-center gap-2">
            <Select value={filterShipmentNoOp} onValueChange={(v) => setFilterShipmentNoOp(v as TextOp)}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Shipment # op" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">Contains</SelectItem>
                <SelectItem value="equals">Equals</SelectItem>
                <SelectItem value="startsWith">Starts With</SelectItem>
                <SelectItem value="endsWith">Ends With</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Shipment #"
              value={filterShipmentNo}
              onChange={(e) => setFilterShipmentNo(e.target.value)}
              className="w-[180px]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={filterCustomerOp} onValueChange={(v) => setFilterCustomerOp(v as TextOp)}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Customer op" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">Contains</SelectItem>
                <SelectItem value="equals">Equals</SelectItem>
                <SelectItem value="startsWith">Starts With</SelectItem>
                <SelectItem value="endsWith">Ends With</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Customer"
              value={filterCustomer}
              onChange={(e) => setFilterCustomer(e.target.value)}
              className="w-[180px]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={filterPriorityOp} onValueChange={(v) => setFilterPriorityOp(v as TextOp)}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Priority op" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">Contains</SelectItem>
                <SelectItem value="equals">Equals</SelectItem>
                <SelectItem value="startsWith">Starts With</SelectItem>
                <SelectItem value="endsWith">Ends With</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Priority"
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="w-[160px]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Packages min"
              value={packagesMin}
              onChange={(e) => setPackagesMin(e.target.value)}
              className="w-[140px]"
            />
            <Input
              type="number"
              placeholder="Packages max"
              value={packagesMax}
              onChange={(e) => setPackagesMax(e.target.value)}
              className="w-[140px]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Input
              type="date"
              placeholder="ETA from"
              value={etaStart}
              onChange={(e) => setEtaStart(e.target.value)}
              className="w-[160px]"
            />
            <Input
              type="date"
              placeholder="ETA to"
              value={etaEnd}
              onChange={(e) => setEtaEnd(e.target.value)}
              className="w-[160px]"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading shipments...</p>
          </div>
        ) : filteredShipments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No shipments found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'Try adjusting your search' : 'Start tracking your first shipment'}
              </p>
              {!searchQuery && (
                <Button asChild>
                  <Link to="/dashboard/shipments/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Shipment
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : viewMode === 'list' ? (
          <Card>
            <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead field="shipment_number" activeField={sortField} direction={sortDirection} onSort={onSort}>Shipment #</SortableHead>
                    <SortableHead field="type" activeField={sortField} direction={sortDirection} onSort={onSort}>Type</SortableHead>
                    <SortableHead field="customer" activeField={sortField} direction={sortDirection} onSort={onSort}>Customer</SortableHead>
                    <SortableHead field="status" activeField={sortField} direction={sortDirection} onSort={onSort}>Status</SortableHead>
                    <SortableHead field="priority" activeField={sortField} direction={sortDirection} onSort={onSort}>Priority</SortableHead>
                    <SortableHead field="packages" activeField={sortField} direction={sortDirection} onSort={onSort}>Packages</SortableHead>
                    <SortableHead field="eta" activeField={sortField} direction={sortDirection} onSort={onSort}>ETA</SortableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedShipments.map((shipment) => (
                  <TableRow 
                    key={shipment.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/dashboard/shipments/${shipment.id}`)}
                  >
                    <TableCell className="font-medium">{shipment.shipment_number}</TableCell>
                    <TableCell>{formatShipmentType(shipment.shipment_type)}</TableCell>
                    <TableCell>{shipment.accounts?.name || '-'}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(shipment.status)}>
                        {shipment.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{shipment.priority_level}</Badge>
                    </TableCell>
                    <TableCell>{shipment.total_packages || '-'}</TableCell>
                    <TableCell>
                      {shipment.estimated_delivery_date 
                        ? format(new Date(shipment.estimated_delivery_date), 'MMM dd, yyyy')
                        : '-'
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="text-xs text-muted-foreground">Rows per page</div>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(v === 'ALL' ? 'ALL' : Number(v))}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Rows" />
                  </SelectTrigger>
                  <SelectContent>
                    {pageSizeOptions.map((opt) => (
                      <SelectItem key={String(opt)} value={String(opt)}>{String(opt)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Pagination className="justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationFirst onClick={firstPage} className={!canPrev ? 'pointer-events-none opacity-50' : ''} />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationPrevious onClick={prevPage} className={!canPrev ? 'pointer-events-none opacity-50' : ''} />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink isActive size="default">Page {currentPage} of {totalPages}</PaginationLink>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext onClick={nextPage} className={!canNext ? 'pointer-events-none opacity-50' : ''} />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLast onClick={lastPage} className={!canNext ? 'pointer-events-none opacity-50' : ''} />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </Card>
        ) : (
          <div className={viewMode === 'grid' ? 'grid gap-4 md:grid-cols-2 lg:grid-cols-4' : 'grid gap-4 md:grid-cols-2 lg:grid-cols-3'}>
            {pagedShipments.map((shipment) => (
              <Link key={shipment.id} to={`/dashboard/shipments/${shipment.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <Package className="h-10 w-10 text-primary" />
                      <Badge className={getStatusColor(shipment.status)}>
                        {shipment.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <CardTitle className="mt-4">{shipment.shipment_number}</CardTitle>
                    <CardDescription>{formatShipmentType(shipment.shipment_type)}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {shipment.accounts?.name && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Customer: </span>
                        <span className="font-medium">{shipment.accounts.name}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{shipment.priority_level}</Badge>
                      {shipment.total_packages && (
                        <span className="text-sm text-muted-foreground">
                          {shipment.total_packages} packages
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
