import { useState, useEffect } from 'react';
import { Plus, Search, Warehouse as WarehouseIcon } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ViewToggle, ViewMode } from '@/components/ui/view-toggle';
import { useCRM } from '@/hooks/useCRM';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { toast } from 'sonner';
import { matchText, TextOp } from '@/lib/utils';

interface Warehouse {
  id: string;
  name: string;
  code: string;
  warehouse_type: string | null;
  address: any;
  contact_person: string | null;
  contact_phone: string | null;
  capacity_sqft: number | null;
  current_utilization: number;
  is_active: boolean;
}

export default function Warehouses() {
  const navigate = useNavigate();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const { supabase } = useCRM();

  // Advanced filters
  const [filterName, setFilterName] = useState('');
  const [filterNameOp, setFilterNameOp] = useState<TextOp>('contains');
  const [filterCode, setFilterCode] = useState('');
  const [filterCodeOp, setFilterCodeOp] = useState<TextOp>('contains');
  const [filterType, setFilterType] = useState('');
  const [filterTypeOp, setFilterTypeOp] = useState<TextOp>('contains');
  const [filterContact, setFilterContact] = useState('');
  const [filterContactOp, setFilterContactOp] = useState<TextOp>('contains');
  const [capacityMin, setCapacityMin] = useState<string>('');
  const [capacityMax, setCapacityMax] = useState<string>('');
  const [utilMin, setUtilMin] = useState<string>('');
  const [utilMax, setUtilMax] = useState<string>('');
  const [statusActive, setStatusActive] = useState<string>('all');

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .order('name');

      if (error) throw error;
      setWarehouses(data || []);
    } catch (error: any) {
      toast.error('Failed to load warehouses');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredWarehouses = warehouses.filter(warehouse => {
    const globalQuery = searchQuery.trim().toLowerCase();
    const matchesGlobal = !globalQuery || [
      warehouse.name,
      warehouse.code,
      warehouse.warehouse_type || '',
      warehouse.contact_person || ''
    ].some(v => (v || '').toLowerCase().includes(globalQuery));

    const matchesName = matchText(warehouse.name, filterName, filterNameOp);
    const matchesCode = matchText(warehouse.code, filterCode, filterCodeOp);
    const matchesType = matchText(warehouse.warehouse_type ?? '', filterType, filterTypeOp);
    const matchesContact = matchText(warehouse.contact_person ?? '', filterContact, filterContactOp);

    const capMin = capacityMin ? Number(capacityMin) : undefined;
    const capMax = capacityMax ? Number(capacityMax) : undefined;
    const cap = warehouse.capacity_sqft ?? undefined;
    const matchesCapacity = (
      (capMin === undefined || (cap !== undefined && cap >= capMin)) &&
      (capMax === undefined || (cap !== undefined && cap <= capMax))
    );

    const uMin = utilMin ? Number(utilMin) : undefined;
    const uMax = utilMax ? Number(utilMax) : undefined;
    const util = warehouse.current_utilization ?? undefined;
    const matchesUtil = (
      (uMin === undefined || (util !== undefined && util >= uMin)) &&
      (uMax === undefined || (util !== undefined && util <= uMax))
    );

    const matchesStatus = statusActive === 'all' || (statusActive === 'active' ? warehouse.is_active : !warehouse.is_active);

    return matchesGlobal && matchesName && matchesCode && matchesType && matchesContact && matchesCapacity && matchesUtil && matchesStatus;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Warehouses</h1>
            <p className="text-muted-foreground">Manage warehouse locations and inventory</p>
          </div>
          <div className="flex gap-2 items-center">
            <ViewToggle value={viewMode} onChange={setViewMode} />
            <Button asChild>
              <Link to="/dashboard/warehouses/new">
                <Plus className="mr-2 h-4 w-4" />
                New Warehouse
              </Link>
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search warehouses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Advanced filters */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Select value={filterNameOp} onValueChange={(v) => setFilterNameOp(v as TextOp)}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Name op" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">Contains</SelectItem>
                <SelectItem value="equals">Equals</SelectItem>
                <SelectItem value="startsWith">Starts With</SelectItem>
                <SelectItem value="endsWith">Ends With</SelectItem>
              </SelectContent>
            </Select>
            <Input className="w-[170px]" placeholder="Name" value={filterName} onChange={(e) => setFilterName(e.target.value)} />
          </div>

          <div className="flex items-center gap-2">
            <Select value={filterCodeOp} onValueChange={(v) => setFilterCodeOp(v as TextOp)}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Code op" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">Contains</SelectItem>
                <SelectItem value="equals">Equals</SelectItem>
                <SelectItem value="startsWith">Starts With</SelectItem>
                <SelectItem value="endsWith">Ends With</SelectItem>
              </SelectContent>
            </Select>
            <Input className="w-[150px]" placeholder="Code" value={filterCode} onChange={(e) => setFilterCode(e.target.value)} />
          </div>

          <div className="flex items-center gap-2">
            <Select value={filterTypeOp} onValueChange={(v) => setFilterTypeOp(v as TextOp)}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Type op" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">Contains</SelectItem>
                <SelectItem value="equals">Equals</SelectItem>
                <SelectItem value="startsWith">Starts With</SelectItem>
                <SelectItem value="endsWith">Ends With</SelectItem>
              </SelectContent>
            </Select>
            <Input className="w-[170px]" placeholder="Type" value={filterType} onChange={(e) => setFilterType(e.target.value)} />
          </div>

          <div className="flex items-center gap-2">
            <Select value={filterContactOp} onValueChange={(v) => setFilterContactOp(v as TextOp)}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Contact op" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">Contains</SelectItem>
                <SelectItem value="equals">Equals</SelectItem>
                <SelectItem value="startsWith">Starts With</SelectItem>
                <SelectItem value="endsWith">Ends With</SelectItem>
              </SelectContent>
            </Select>
            <Input className="w-[170px]" placeholder="Contact" value={filterContact} onChange={(e) => setFilterContact(e.target.value)} />
          </div>

          <div className="flex items-center gap-2">
            <Input type="number" className="w-[140px]" placeholder="Capacity min" value={capacityMin} onChange={(e) => setCapacityMin(e.target.value)} />
            <Input type="number" className="w-[140px]" placeholder="Capacity max" value={capacityMax} onChange={(e) => setCapacityMax(e.target.value)} />
          </div>

          <div className="flex items-center gap-2">
            <Input type="number" className="w-[140px]" placeholder="Utilization min" value={utilMin} onChange={(e) => setUtilMin(e.target.value)} />
            <Input type="number" className="w-[140px]" placeholder="Utilization max" value={utilMax} onChange={(e) => setUtilMax(e.target.value)} />
          </div>

          <Select value={statusActive} onValueChange={setStatusActive}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading warehouses...</p>
          </div>
        ) : filteredWarehouses.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <WarehouseIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No warehouses found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'Try adjusting your search' : 'Start by adding your first warehouse'}
              </p>
              {!searchQuery && (
                <Button asChild>
                  <Link to="/dashboard/warehouses/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Warehouse
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
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Utilization</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWarehouses.map((warehouse) => (
                  <TableRow 
                    key={warehouse.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/dashboard/warehouses/${warehouse.id}`)}
                  >
                    <TableCell className="font-medium">{warehouse.name}</TableCell>
                    <TableCell>{warehouse.code}</TableCell>
                    <TableCell>{warehouse.warehouse_type || '-'}</TableCell>
                    <TableCell>{warehouse.contact_person || '-'}</TableCell>
                    <TableCell>
                      {warehouse.capacity_sqft ? `${warehouse.capacity_sqft.toLocaleString()} sq ft` : '-'}
                    </TableCell>
                    <TableCell>{warehouse.current_utilization}%</TableCell>
                    <TableCell>
                      <Badge variant={warehouse.is_active ? 'default' : 'secondary'}>
                        {warehouse.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <div className={viewMode === 'grid' ? 'grid gap-4 md:grid-cols-2 lg:grid-cols-4' : 'grid gap-4 md:grid-cols-2 lg:grid-cols-3'}>
            {filteredWarehouses.map((warehouse) => (
              <Link key={warehouse.id} to={`/dashboard/warehouses/${warehouse.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <WarehouseIcon className="h-10 w-10 text-primary" />
                      <Badge variant={warehouse.is_active ? 'default' : 'secondary'}>
                        {warehouse.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <CardTitle className="mt-4">{warehouse.name}</CardTitle>
                    <CardDescription>{warehouse.code}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {warehouse.warehouse_type && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Type: </span>
                        <span className="font-medium">{warehouse.warehouse_type}</span>
                      </div>
                    )}
                    {warehouse.capacity_sqft && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Capacity: </span>
                        <span className="font-medium">{warehouse.capacity_sqft.toLocaleString()} sq ft</span>
                      </div>
                    )}
                    <div className="text-sm">
                      <span className="text-muted-foreground">Utilization: </span>
                      <span className="font-medium">{warehouse.current_utilization}%</span>
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