import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCRM } from '@/hooks/useCRM';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, ArrowRight } from 'lucide-react';

export default function BookingNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { scopedDb, context } = useCRM();
  const [loading, setLoading] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>(searchParams.get('quoteId') || '');

  // Update selectedQuoteId if URL param changes
  useEffect(() => {
    const quoteId = searchParams.get('quoteId');
    if (quoteId) {
        setSelectedQuoteId(quoteId);
    }
  }, [searchParams]);

  // Fetch Approved Quotes
  const { data: quotes = [], isLoading: quotesLoading } = useQuery({
    queryKey: ['quotes', 'approved'],
    queryFn: async () => {
      console.log('Fetching approved quotes...');
      const { data, error } = await scopedDb
        .from('quotes')
        .select('id, quote_number, tenant_id, total_amount, currency, accounts(name)')
        .in('status', ['approved', 'accepted'])
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      console.log('Fetched approved quotes:', data?.length);
      return data as any[];
    },
  });

  const selectedQuote = quotes.find(q => q.id === selectedQuoteId);

  // Fallback: If selectedQuoteId is present but not in the list, fetch it individually to debug or allow it
  const { data: fallbackQuote, isLoading: fallbackLoading } = useQuery({
    queryKey: ['quote', selectedQuoteId],
    queryFn: async () => {
        if (!selectedQuoteId) return null;
        // Check if we already have it
        if (quotes.find(q => q.id === selectedQuoteId)) return null;

        console.log('Fetching fallback quote:', selectedQuoteId);
        const { data, error } = await scopedDb
            .from('quotes')
            .select('id, quote_number, tenant_id, total_amount, currency, status, accounts(name)')
            .eq('id', selectedQuoteId)
            .single();
        
        if (error) {
            console.error('Error fetching fallback quote:', error);
            return null;
        }
        return data;
    },
    enabled: !!selectedQuoteId && !quotes.find(q => q.id === selectedQuoteId) && !quotesLoading
  });

  const effectiveQuote = selectedQuote || fallbackQuote;

  const handleCreateManual = async () => {
    setLoading(true);
    try {
        const { data, error } = await scopedDb
            .from('bookings')
            .insert({
                source: 'manual',
                status: 'draft',
                tenant_id: context.tenantId 
            })
            .select()
            .single();

        if (error) throw error;
        toast.success('Booking created successfully');
        navigate(`/dashboard/bookings/${data.id}`);
    } catch (error: any) {
        console.error('Error creating booking:', error);
        toast.error('Failed to create booking: ' + error.message);
    } finally {
        setLoading(false);
    }
  };

  const handleCreateFromQuote = async () => {
    if (!selectedQuoteId) return;
    setLoading(true);
    try {
        if (!effectiveQuote) throw new Error('Quote not found or not loaded yet');
        
        if (effectiveQuote.status && !['approved', 'accepted'].includes(effectiveQuote.status)) {
             throw new Error(`Quote status is ${effectiveQuote.status}. Must be Approved or Accepted.`);
        }

        // Use RPC to convert quote
        const { data: bookingId, error } = await scopedDb.rpc('convert_quote_to_booking', {
            p_quote_id: selectedQuoteId,
            p_tenant_id: effectiveQuote.tenant_id
        });

        if (error) throw error;
        
        toast.success('Booking created from quote');
        navigate(`/dashboard/bookings/${bookingId}`);
    } catch (error: any) {
        console.error('Error creating booking from quote:', error);
        toast.error('Failed to create booking: ' + error.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight">New Booking</h1>
        
        <Card>
          <CardHeader>
            <CardTitle>Create from Quote</CardTitle>
            <CardDescription>Select an approved quote to convert into a booking.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-md border flex flex-col gap-2">
                 <p className="text-sm text-muted-foreground">Use the advanced mapper to select a quote, preview data, and validate business rules before creation.</p>
                 <Button onClick={() => navigate('/dashboard/bookings/map')} className="w-full sm:w-auto" variant="secondary">
                    <ArrowRight className="mr-2 h-4 w-4" /> Open Quote Mapper
                 </Button>
            </div>
             
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                   <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                   <span className="bg-background px-2 text-muted-foreground">Quick Select</span>
                </div>
            </div>

            <div className="space-y-2">
               <Label>Select Quote</Label>
               <Select value={selectedQuoteId} onValueChange={setSelectedQuoteId}>
                 <SelectTrigger>
                   <SelectValue placeholder="Select a quote..." />
                 </SelectTrigger>
                 <SelectContent>
                   {quotesLoading ? (
                     <SelectItem value="loading" disabled>Loading quotes...</SelectItem>
                   ) : quotes.length === 0 ? (
                     <SelectItem value="none" disabled>No approved quotes found</SelectItem>
                   ) : (
                     quotes.map(q => (
                       <SelectItem key={q.id} value={q.id}>
                         {q.quote_number} - {q.accounts?.name || 'Unknown Account'}
                       </SelectItem>
                     ))
                   )}
                 </SelectContent>
               </Select>
               
               {effectiveQuote && (
                 <div className="bg-muted/50 p-4 rounded-md text-sm space-y-1 border">
                   <div className="font-medium">Quote Summary</div>
                   <div className="flex justify-between">
                     <span className="text-muted-foreground">Customer:</span>
                     <span>{effectiveQuote.accounts?.name}</span>
                   </div>
                   <div className="flex justify-between">
                     <span className="text-muted-foreground">Amount:</span>
                     <span>
                       {effectiveQuote.total_amount?.toLocaleString()} {effectiveQuote.currency || 'USD'}
                     </span>
                   </div>
                 </div>
               )}

               <Button 
                 onClick={handleCreateFromQuote} 
                 disabled={loading || !selectedQuoteId || quotesLoading || fallbackLoading} 
                 className="w-full sm:w-auto mt-2"
               >
                 {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                 Create Booking
               </Button>
            </div>
          </CardContent>
        </Card>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or continue manually</span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Manual Creation</CardTitle>
            <CardDescription>Create a blank booking draft.</CardDescription>
          </CardHeader>
          <CardContent>
             <Button onClick={handleCreateManual} disabled={loading} variant="outline" className="w-full sm:w-auto">
               {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
               Create Empty Draft
             </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
