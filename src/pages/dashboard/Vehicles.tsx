import { useState, useEffect } from 'react';
import { Plus, Search, Truck } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ViewToggle, ViewMode } from '@/components/ui/view-toggle';
import { useCRM } from '@/hooks/useCRM';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { toast } from 'sonner';

interface Vehicle {
  id: string;
  vehicle_number: string;
  vehicle_type: string;
  make: string | null;
  model: string | null;
  year: number | null;
  capacity_kg: number | null;
  capacity_cbm: number | null;
  status: string;
  is_active: boolean;
}

export default function Vehicles() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const { supabase } = useCRM();

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('vehicle_number');

      if (error) throw error;
      setVehicles(data || []);
    } catch (error: any) {
      toast.error('Failed to load vehicles');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredVehicles = vehicles.filter(vehicle =>
    vehicle.vehicle_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vehicle.vehicle_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      available: 'bg-green-500/10 text-green-500',
      in_use: 'bg-blue-500/10 text-blue-500',
      maintenance: 'bg-yellow-500/10 text-yellow-500',
      out_of_service: 'bg-red-500/10 text-red-500',
    };
    return colors[status] || 'bg-gray-500/10 text-gray-500';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Vehicles</h1>
            <p className="text-muted-foreground">Manage your fleet and vehicle assignments</p>
          </div>
          <div className="flex gap-2 items-center">
            <ViewToggle value={viewMode} onChange={setViewMode} />
            <Button asChild>
              <Link to="/dashboard/vehicles/new">
                <Plus className="mr-2 h-4 w-4" />
                New Vehicle
              </Link>
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search vehicles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading vehicles...</p>
          </div>
        ) : filteredVehicles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Truck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No vehicles found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'Try adjusting your search' : 'Start by adding your first vehicle'}
              </p>
              {!searchQuery && (
                <Button asChild>
                  <Link to="/dashboard/vehicles/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Vehicle
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
                  <TableHead>Vehicle #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Make/Model</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Capacity (kg)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVehicles.map((vehicle) => (
                  <TableRow 
                    key={vehicle.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/dashboard/vehicles/${vehicle.id}`)}
                  >
                    <TableCell className="font-medium">{vehicle.vehicle_number}</TableCell>
                    <TableCell>{vehicle.vehicle_type}</TableCell>
                    <TableCell>
                      {vehicle.make && vehicle.model ? `${vehicle.make} ${vehicle.model}` : '-'}
                    </TableCell>
                    <TableCell>{vehicle.year || '-'}</TableCell>
                    <TableCell>
                      {vehicle.capacity_kg ? vehicle.capacity_kg.toLocaleString() : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(vehicle.status)}>
                        {vehicle.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={vehicle.is_active ? 'default' : 'secondary'}>
                        {vehicle.is_active ? 'Yes' : 'No'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <div className={viewMode === 'grid' ? 'grid gap-4 md:grid-cols-2 lg:grid-cols-4' : 'grid gap-4 md:grid-cols-2 lg:grid-cols-3'}>
            {filteredVehicles.map((vehicle) => (
              <Link key={vehicle.id} to={`/dashboard/vehicles/${vehicle.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <Truck className="h-10 w-10 text-primary" />
                      <Badge className={getStatusColor(vehicle.status)}>
                        {vehicle.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <CardTitle className="mt-4">{vehicle.vehicle_number}</CardTitle>
                    <CardDescription>{vehicle.vehicle_type}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {vehicle.make && vehicle.model && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Model: </span>
                        <span className="font-medium">{vehicle.make} {vehicle.model}</span>
                      </div>
                    )}
                    {vehicle.capacity_kg && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Capacity: </span>
                        <span className="font-medium">{vehicle.capacity_kg.toLocaleString()} kg</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      {vehicle.year && (
                        <Badge variant="outline">{vehicle.year}</Badge>
                      )}
                      <Badge variant={vehicle.is_active ? 'default' : 'secondary'}>
                        {vehicle.is_active ? 'Active' : 'Inactive'}
                      </Badge>
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