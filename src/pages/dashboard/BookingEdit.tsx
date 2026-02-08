import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCRM } from '@/hooks/useCRM';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Save } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type Booking = Database['public']['Tables']['bookings']['Row'] & {
  vessel_name?: string | null;
  voyage_number?: string | null;
  pol_code?: string | null;
  pod_code?: string | null;
  container_qty?: number | null;
};

export default function BookingEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { scopedDb } = useCRM();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Booking>>({});

  useEffect(() => {
    if (id) fetchBooking(id);
  }, [id]);

  const fetchBooking = async (bookingId: string) => {
    try {
      const { data, error } = await scopedDb
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single();

      if (error) throw error;
      setFormData(data);
    } catch (error) {
      console.error('Error fetching booking:', error);
      toast.error('Failed to load booking details');
      navigate('/dashboard/bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const { error } = await scopedDb
        .from('bookings')
        .update({
          booking_number: formData.booking_number,
          status: formData.status,
          carrier_booking_status: formData.carrier_booking_status,
          vessel_name: formData.vessel_name,
          voyage_number: formData.voyage_number,
          pol_code: formData.pol_code,
          pod_code: formData.pod_code,
          container_qty: formData.container_qty
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Booking updated successfully');
      navigate(`/dashboard/bookings/${id}`);
    } catch (error: any) {
      console.error('Error updating booking:', error);
      toast.error('Failed to update booking: ' + error.message);
    } finally {
      setSaving(false);
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

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/dashboard/bookings/${id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Edit Booking</h1>
            <p className="text-muted-foreground">{formData.booking_number || 'Draft Booking'}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
            <CardDescription>Update booking information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Booking Number</Label>
                <Input 
                  value={formData.booking_number || ''} 
                  onChange={e => setFormData({...formData, booking_number: e.target.value})}
                  placeholder="Carrier Booking Ref"
                />
              </div>
              <div className="space-y-2">
                <Label>Internal Status</Label>
                <Select 
                  value={formData.status || 'draft'} 
                  onValueChange={val => setFormData({...formData, status: val})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Carrier Status</Label>
                 <Select 
                  value={formData.carrier_booking_status || 'pending'} 
                  onValueChange={val => setFormData({...formData, carrier_booking_status: val})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="split">Split</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Container Qty</Label>
                <Input 
                  type="number"
                  value={formData.container_qty || ''} 
                  onChange={e => setFormData({...formData, container_qty: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                <Label>Vessel Name</Label>
                <Input 
                  value={formData.vessel_name || ''} 
                  onChange={e => setFormData({...formData, vessel_name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Voyage Number</Label>
                <Input 
                  value={formData.voyage_number || ''} 
                  onChange={e => setFormData({...formData, voyage_number: e.target.value})}
                />
              </div>
               <div className="space-y-2">
                <Label>POL Code</Label>
                <Input 
                  value={formData.pol_code || ''} 
                  onChange={e => setFormData({...formData, pol_code: e.target.value})}
                />
              </div>
               <div className="space-y-2">
                <Label>POD Code</Label>
                <Input 
                  value={formData.pod_code || ''} 
                  onChange={e => setFormData({...formData, pod_code: e.target.value})}
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => navigate(`/dashboard/bookings/${id}`)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
