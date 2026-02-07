import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '@/hooks/useCRM';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHeader, TableRow, SortableHead } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Database } from '@/integrations/supabase/types';

type Booking = Database['public']['Tables']['bookings']['Row'] & {
  carriers: { name: string } | null;
  quotes: { quote_number: string } | null;
};

export default function Bookings() {
  const navigate = useNavigate();
  const { scopedDb } = useCRM();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchBookings();
  }, [sortField, sortDirection]);

  const fetchBookings = async () => {
    try {
      const { data, error } = await scopedDb
        .from('bookings')
        .select('*, carriers(name), quotes(quote_number)')
        .order(sortField, { ascending: sortDirection === 'asc' });

      if (error) throw error;
      setBookings(data as any);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredBookings = bookings.filter(booking => 
    booking.booking_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    booking.carriers?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    booking.status?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Bookings</h1>
            <p className="text-muted-foreground">Manage your freight bookings</p>
          </div>
          <Button onClick={() => navigate('/dashboard/bookings/new')}>
            <Plus className="mr-2 h-4 w-4" /> New Booking
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Bookings</CardTitle>
            <CardDescription>
              View and manage bookings with carriers.
            </CardDescription>
            <div className="flex items-center gap-2 pt-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search bookings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead 
                    label="Booking #" 
                    field="booking_number" 
                    activeField={sortField} 
                    direction={sortDirection} 
                    onSort={handleSort} 
                  />
                  <SortableHead 
                    label="Carrier" 
                    field="carriers.name" 
                    activeField={sortField} 
                    direction={sortDirection} 
                    onSort={handleSort} 
                  />
                  <SortableHead 
                    label="Quote #" 
                    field="quotes.quote_number" 
                    activeField={sortField} 
                    direction={sortDirection} 
                    onSort={handleSort} 
                  />
                  <SortableHead 
                    label="Status" 
                    field="status" 
                    activeField={sortField} 
                    direction={sortDirection} 
                    onSort={handleSort} 
                  />
                  <SortableHead 
                    label="Carrier Status" 
                    field="carrier_booking_status" 
                    activeField={sortField} 
                    direction={sortDirection} 
                    onSort={handleSort} 
                  />
                  <SortableHead 
                    label="Created" 
                    field="created_at" 
                    activeField={sortField} 
                    direction={sortDirection} 
                    onSort={handleSort} 
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                   <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredBookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No bookings found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBookings.map((booking) => (
                    <TableRow 
                      key={booking.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/dashboard/bookings/${booking.id}`)}
                    >
                      <TableCell className="font-medium">{booking.booking_number || 'Draft'}</TableCell>
                      <TableCell>{booking.carriers?.name || '-'}</TableCell>
                      <TableCell>{booking.quotes?.quote_number || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{booking.status}</Badge>
                      </TableCell>
                      <TableCell>
                         <Badge variant={booking.carrier_booking_status === 'confirmed' ? 'default' : 'secondary'}>
                            {booking.carrier_booking_status}
                         </Badge>
                      </TableCell>
                      <TableCell>{booking.created_at ? format(new Date(booking.created_at), 'MMM d, yyyy') : '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
