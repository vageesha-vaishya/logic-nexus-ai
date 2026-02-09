import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCRM } from '@/hooks/useCRM';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Database } from '@/integrations/supabase/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Booking = Database['public']['Tables']['bookings']['Row'] & {
  carriers: { name: string } | null;
  quotes: { quote_number: string } | null;
  franchises: { name: string } | null;
};

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { scopedDb } = useCRM();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchBooking(id);
  }, [id]);

  const fetchBooking = async (bookingId: string) => {
    try {
      const { data, error } = await scopedDb
        .from('bookings')
        .select('*, carriers(name), quotes(quote_number), franchises(name)')
        .eq('id', bookingId)
        .single();

      if (error) throw error;
      setBooking(data as any);
    } catch (error) {
      console.error('Error fetching booking:', error);
      toast.error('Failed to load booking details');
      navigate('/dashboard/bookings');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!booking) return null;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/bookings')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Booking {booking.booking_number}</h1>
            <p className="text-muted-foreground">
              Created on {booking.created_at ? format(new Date(booking.created_at), 'PPP') : 'Unknown'}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/bookings/${id}/edit`)}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the booking.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => {
                    scopedDb.from('bookings').delete().eq('id', id!).then(({ error }) => {
                      if (error) {
                        toast.error('Failed to delete booking');
                      } else {
                        toast.success('Booking deleted');
                        navigate('/dashboard/bookings');
                      }
                    });
                  }}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Badge variant="outline" className="text-lg py-1">{booking.status}</Badge>
            <Badge variant={booking.carrier_booking_status === 'confirmed' ? 'default' : 'secondary'} className="text-lg py-1">
               {booking.carrier_booking_status}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <Card>
            <CardHeader>
              <CardTitle>Booking Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Carrier</div>
                  <div>{booking.carriers?.name || '-'}</div>
                </div>
                 <div>
                  <div className="text-sm font-medium text-muted-foreground">Quote Reference</div>
                  <div>{booking.quotes?.quote_number || '-'}</div>
                </div>
                 <div>
                  <div className="text-sm font-medium text-muted-foreground">Source</div>
                  <div className="capitalize">{booking.source || '-'}</div>
                </div>
                 <div>
                  <div className="text-sm font-medium text-muted-foreground">Franchise</div>
                  <div>{booking.franchises?.name || '-'}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Carrier Details</CardTitle>
            </CardHeader>
            <CardContent>
               <div className="text-sm text-muted-foreground">
                  Integration details will appear here.
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
