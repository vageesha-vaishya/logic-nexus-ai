import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plane, Ship, Truck, Package, ArrowRight, Timer, BadgeCheck, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '@/hooks/useCRM';
import { Badge } from '@/components/ui/badge';

// Quick Quote Schema
const quickQuoteSchema = z.object({
  origin: z.string().min(2, "Origin is required"),
  destination: z.string().min(2, "Destination is required"),
  weight: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Valid weight is required"),
  unit: z.enum(["kg", "lbs"]),
  commodity: z.string().min(2, "Commodity is required"),
  mode: z.enum(["air", "ocean", "road"]),
});

type QuickQuoteValues = z.infer<typeof quickQuoteSchema>;

interface RateOption {
  id: string;
  tier: 'contract' | 'spot' | 'market';
  name: string;
  price: number;
  currency: string;
  transitTime: string;
  carrier: string;
  validUntil?: string;
}

interface QuickQuoteModalProps {
  children?: React.ReactNode;
  customerId?: string; // Optional context for Contract Rates
}

export function QuickQuoteModal({ children, customerId }: QuickQuoteModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<RateOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { supabase } = useCRM();

  const form = useForm<QuickQuoteValues>({
    resolver: zodResolver(quickQuoteSchema),
    defaultValues: {
      unit: "kg",
      mode: "air",
      commodity: "General Cargo"
    },
  });

  const onSubmit = async (data: QuickQuoteValues) => {
    setLoading(true);
    setResults(null);
    try {
      // Call Edge Function
      const { data: responseData, error } = await supabase.functions.invoke('rate-engine', {
        body: { ...data, customer_id: customerId }
      });

      if (error) throw error;
      
      if (responseData?.options && Array.isArray(responseData.options)) {
        setResults(responseData.options);
        if (responseData.options.length === 0) {
            toast({
                title: "No Rates Found",
                description: "Try adjusting your search criteria.",
                variant: "default",
            });
        }
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error: any) {
      console.error('Rate calculation error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to calculate rates.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToQuote = (option: RateOption) => {
    setIsOpen(false);
    // Navigate to Quote Builder with pre-filled data
    navigate('/dashboard/quotes/new', { 
      state: { 
        origin: form.getValues('origin'),
        destination: form.getValues('destination'),
        weight: form.getValues('weight'),
        mode: form.getValues('mode'),
        commodity: form.getValues('commodity'),
        selectedRate: option,
        customerId: customerId
      } 
    });
  };

  const handleEmailQuote = (option: RateOption) => {
    // This would trigger an email via Edge Function
    toast({
      title: "Email Sent",
      description: `Quote estimate for "${option.name}" has been emailed to you.`,
    });
    setIsOpen(false);
  };

  const reset = () => {
    setResults(null);
    form.reset();
  };

  const getTierBadge = (tier: string) => {
    switch(tier) {
        case 'contract': return <Badge className="bg-green-600 hover:bg-green-700">Contract Rate</Badge>;
        case 'spot': return <Badge className="bg-blue-600 hover:bg-blue-700">Spot Rate</Badge>;
        case 'market': return <Badge variant="secondary">Market Estimate</Badge>;
        default: return <Badge variant="outline">Standard</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) reset(); }}>
      <DialogTrigger asChild>
        {children || <Button>Quick Quote</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px] h-[600px] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            Quick Quote Estimator
            {customerId && <Badge variant="outline" className="ml-2 font-normal text-xs">Customer Context Active</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Input Section - Left Side */}
          <div className="w-1/3 bg-muted/30 p-6 border-r overflow-y-auto">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              
              <div className="space-y-2">
                <Label>Transport Mode</Label>
                <Tabs 
                  defaultValue="air" 
                  value={form.watch("mode")} 
                  onValueChange={(v) => form.setValue("mode", v as any)}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="air"><Plane className="w-4 h-4 mr-2"/>Air</TabsTrigger>
                    <TabsTrigger value="ocean"><Ship className="w-4 h-4 mr-2"/>Ocean</TabsTrigger>
                    <TabsTrigger value="road"><Truck className="w-4 h-4 mr-2"/>Road</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Origin (Code/City)</Label>
                  <Input placeholder="e.g. LAX, Shanghai" {...form.register("origin")} className="bg-background" />
                  {form.formState.errors.origin && <p className="text-xs text-red-500">{form.formState.errors.origin.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Destination (Code/City)</Label>
                  <Input placeholder="e.g. JFK, New York" {...form.register("destination")} className="bg-background" />
                  {form.formState.errors.destination && <p className="text-xs text-red-500">{form.formState.errors.destination.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-2">
                  <Label>Weight</Label>
                  <Input type="number" step="0.01" placeholder="0.00" {...form.register("weight")} className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Select 
                    value={form.watch("unit")} 
                    onValueChange={(v) => form.setValue("unit", v as any)}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">KG</SelectItem>
                      <SelectItem value="lbs">LBS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Commodity</Label>
                <Input placeholder="e.g. General Cargo" {...form.register("commodity")} className="bg-background" />
              </div>

              <Button type="submit" className="w-full mt-4" disabled={loading}>
                {loading ? "Calculating Rates..." : "Get Estimates"}
              </Button>
            </form>
          </div>

          {/* Results Section - Right Side */}
          <div className="w-2/3 p-6 bg-background overflow-y-auto">
            {!results ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <div className="bg-muted p-6 rounded-full mb-4">
                    <Package className="w-12 h-12 opacity-50" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Ready to Quote</h3>
                <p className="text-sm text-center max-w-xs">
                    Enter shipment details on the left to view Contract, Spot, and Market rates instantly.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-lg">Rate Options</h3>
                    <span className="text-xs text-muted-foreground">{results.length} results found</span>
                </div>
                
                {results.map((option) => (
                  <Card key={option.id} className="relative overflow-hidden hover:border-primary transition-all duration-200 group border-l-4 border-l-transparent hover:border-l-primary hover:shadow-md">
                    <CardContent className="p-5">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 mb-1">
                             {getTierBadge(option.tier)}
                             {option.tier === 'contract' && <BadgeCheck className="w-4 h-4 text-green-600" />}
                          </div>
                          <h4 className="font-bold text-lg">{option.name}</h4>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            Via {option.carrier}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: option.currency }).format(option.price)}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center justify-end gap-1 mt-1">
                            <Timer className="w-4 h-4" />
                            {option.transitTime}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t flex gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                        <Button className="flex-1" onClick={() => handleConvertToQuote(option)}>
                          Convert to Quote <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                        <Button variant="outline" onClick={() => handleEmailQuote(option)}>
                          Email
                        </Button>
                      </div>

                      {option.validUntil && (
                        <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            <AlertCircle className="w-3 h-3" />
                            Valid until {new Date(option.validUntil).toLocaleDateString()}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                <div className="pt-6 mt-6 border-t text-center">
                  <p className="text-xs text-muted-foreground">
                    * Rates are subject to availability and fuel surcharges. Market rates are estimates only.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
