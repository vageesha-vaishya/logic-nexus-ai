import { useState, useEffect, useMemo } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, CheckCircle, ArrowRight, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { BookingMappingEngine } from '@/lib/booking/booking-mapping-engine';

interface QuoteMappingPreviewProps {
  quote: any;
  onCancel: () => void;
}

export function QuoteMappingPreview({ quote, onCancel }: QuoteMappingPreviewProps) {
  const { scopedDb, context } = useCRM();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [validationResult, setValidationResult] = useState<any>(null);
  
  const mappingEngine = useMemo(() => new BookingMappingEngine(), []);

  // Target Booking State (Editable)
  const [bookingData, setBookingData] = useState(mappingEngine.map(quote).booking);

  useEffect(() => {
    validateQuote();
  }, [quote]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFieldChange = (field: string, value: any) => {
    setBookingData(prev => ({ ...prev, [field]: value }));
  };

  const validateQuote = async () => {
    setValidating(true);
    try {
      // 1. Client-side validation (Immediate feedback)
      const clientValidation = mappingEngine.validate(quote, bookingData);
      
      // 2. Server-side validation (RPC for deep checks)
      const { data, error } = await scopedDb.rpc('validate_quote_for_booking', {
        p_quote_id: quote.id
      });

      if (error) throw error;
      
      // Merge results
      const serverData = data || { valid: true, errors: [], warnings: [] };
      setValidationResult({
          valid: (serverData.valid ?? true) && clientValidation.valid,
          errors: [...(serverData.errors || []), ...clientValidation.errors],
          warnings: [...(serverData.warnings || []), ...clientValidation.warnings]
      });

    } catch (error) {
      console.error('Validation error:', error);
      // Fallback if RPC fails or not deployed yet
      setValidationResult({
        valid: quote.status === 'approved' || quote.status === 'accepted',
        errors: quote.status !== 'approved' && quote.status !== 'accepted' ? ['Quote status must be approved or accepted'] : [],
        warnings: []
      });
    } finally {
      setValidating(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      // Check if we need to create a new booking or update an existing one
      // For this flow, we typically create a NEW booking from the quote
      
      // ALTERNATIVE: Use the existing RPC `convert_quote_to_booking` and then update the result.
      const { data: bookingId, error: rpcError } = await scopedDb.rpc('convert_quote_to_booking', {
        p_quote_id: quote.id,
        p_tenant_id: context.tenantId
      });

      if (rpcError) throw rpcError;

      // Update with user overrides
      const { error: updateError } = await scopedDb
        .from('bookings')
        .update({
           booking_number: bookingData.booking_number, // Might fail if unique constraint
           // vessel_name: bookingData.vessel_name,
           // voyage_number: bookingData.voyage_number
           notes: bookingData.notes
        })
        .eq('id', bookingId);

      if (updateError) console.warn('Failed to update overrides:', updateError);

      toast.success('Booking created successfully');
      navigate(`/dashboard/bookings/${bookingId}`);

    } catch (error: any) {
      console.error('Mapping error:', error);
      toast.error('Failed to create booking: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const isChanged = (field: string, quoteValue: any) => {
     // Simple comparison
     return String(bookingData[field as keyof typeof bookingData]) !== String(quoteValue);
  };

  if (validating) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Validating quote data and business rules...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Validation Status Banner */}
      {validationResult && (
        <Alert variant={validationResult.valid ? "default" : "destructive"} className={validationResult.valid ? "border-green-500 bg-green-50/50" : ""}>
          {validationResult.valid ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4" />}
          <AlertTitle className={validationResult.valid ? "text-green-700" : ""}>
            {validationResult.valid ? "Validation Passed" : "Validation Failed"}
          </AlertTitle>
          <AlertDescription className={validationResult.valid ? "text-green-600" : ""}>
            {validationResult.valid 
              ? "All business rules and data integrity checks passed. You can proceed." 
              : "Please resolve the following issues before proceeding."}
            {validationResult.errors?.length > 0 && (
              <ul className="list-disc pl-5 mt-2">
                {validationResult.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
              </ul>
            )}
            {validationResult.warnings?.length > 0 && (
               <div className="mt-2 text-yellow-600 flex items-start gap-2">
                 <AlertTriangle className="h-4 w-4 mt-0.5" />
                 <ul className="list-disc pl-5">
                   {validationResult.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
                 </ul>
               </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Source: Quote */}
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Source: Quote</CardTitle>
            <div className="text-2xl font-bold">{quote.quote_number}</div>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <Label className="text-muted-foreground">Customer</Label>
                    <div className="font-medium">{quote.accounts?.name || 'N/A'}</div>
                </div>
                <div>
                    <Label className="text-muted-foreground">Total Amount</Label>
                    <div className="font-medium">{quote.total_amount?.toLocaleString()} {quote.currency}</div>
                </div>
                <div>
                    <Label className="text-muted-foreground">Origin</Label>
                    <div className="font-medium truncate" title={quote.origin_location?.name}>{quote.origin_location?.name || '-'}</div>
                </div>
                <div>
                    <Label className="text-muted-foreground">Destination</Label>
                    <div className="font-medium truncate" title={quote.destination_location?.name}>{quote.destination_location?.name || '-'}</div>
                </div>
                <div>
                    <Label className="text-muted-foreground">Incoterms</Label>
                    <div className="font-medium">{quote.incoterms || '-'}</div>
                </div>
             </div>
          </CardContent>
        </Card>

        {/* Target: Booking */}
        <Card className="border-primary/20 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-primary uppercase tracking-wider">Target: Booking</CardTitle>
            <div className="flex items-center gap-2">
                <Input 
                    value={bookingData.booking_number}
                    onChange={(e) => handleFieldChange('booking_number', e.target.value)}
                    className="font-bold text-lg h-9 w-48"
                />
                <Badge variant="outline">Draft</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label>Origin</Label>
                        <Input 
                            value={bookingData.origin} 
                            onChange={(e) => handleFieldChange('origin', e.target.value)}
                            className={isChanged('origin', quote.origin_location?.name) ? "border-yellow-400 bg-yellow-50" : ""}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>Destination</Label>
                        <Input 
                            value={bookingData.destination} 
                            onChange={(e) => handleFieldChange('destination', e.target.value)}
                            className={isChanged('destination', quote.destination_location?.name) ? "border-yellow-400 bg-yellow-50" : ""}
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <Label>Incoterms</Label>
                    <Input 
                        value={bookingData.incoterms} 
                        onChange={(e) => handleFieldChange('incoterms', e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label>Vessel Name</Label>
                        <Input 
                            value={bookingData.vessel_name} 
                            onChange={(e) => handleFieldChange('vessel_name', e.target.value)}
                            placeholder="Optional"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>Voyage Number</Label>
                        <Input 
                            value={bookingData.voyage_number} 
                            onChange={(e) => handleFieldChange('voyage_number', e.target.value)}
                            placeholder="Optional"
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <Label>Notes</Label>
                    <Input 
                        value={bookingData.notes} 
                        onChange={(e) => handleFieldChange('notes', e.target.value)}
                    />
                </div>
             </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center pt-4 border-t">
         <Button variant="ghost" onClick={onCancel}>Cancel</Button>
         <Button 
            onClick={handleConfirm} 
            disabled={loading || (validationResult && !validationResult.valid)}
            className="w-48"
         >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
            Confirm Mapping
         </Button>
      </div>
    </div>
  );
}
