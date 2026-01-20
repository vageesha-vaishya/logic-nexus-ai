import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plane, Ship, Truck, Package, ArrowRight, Timer, DollarSign, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '@/hooks/useCRM';

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
  name: string;
  price: number;
  transitTime: string;
  carrier: string;
  type: 'economy' | 'standard' | 'express';
}

export function QuickQuoteModal({ children }: { children?: React.ReactNode }) {
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
    },
  });

  const onSubmit = async (data: QuickQuoteValues) => {
    setLoading(true);
    try {
      // Call Edge Function
      const { data: responseData, error } = await supabase.functions.invoke('rate-engine', {
        body: data
      });

      if (error) throw error;
      
      if (responseData?.options) {
        setResults(responseData.options);
      } else {
        throw new Error('No rates found');
      }
    } catch (error: any) {
      console.error('Rate calculation error:', error);
      toast({
        title: "Error",
        description: "Failed to calculate rates. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToQuote = (option: RateOption) => {
    setIsOpen(false);
    navigate('/dashboard/quotes/new', { 
      state: { 
        origin: form.getValues('origin'),
        destination: form.getValues('destination'),
        weight: form.getValues('weight'),
        mode: form.getValues('mode'),
        commodity: form.getValues('commodity'),
        selectedRate: option
      } 
    });
  };

  const handleEmailQuote = (option: RateOption) => {
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) reset(); }}>
      <DialogTrigger asChild>
        {children || <Button>Quick Quote</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Quick Quote Estimator</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-4">
          {/* Input Section */}
          <div className="md:col-span-5 space-y-4 border-r pr-6">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Origin</Label>
                  <Input placeholder="City or Airport" {...form.register("origin")} />
                  {form.formState.errors.origin && <p className="text-xs text-red-500">{form.formState.errors.origin.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Destination</Label>
                  <Input placeholder="City or Airport" {...form.register("destination")} />
                  {form.formState.errors.destination && <p className="text-xs text-red-500">{form.formState.errors.destination.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Weight</Label>
                  <Input type="number" placeholder="0.00" {...form.register("weight")} />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Select 
                    value={form.watch("unit")} 
                    onValueChange={(v) => form.setValue("unit", v as any)}
                  >
                    <SelectTrigger>
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
                <Input placeholder="e.g. Electronics" {...form.register("commodity")} />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Calculating..." : "Get Estimates"}
              </Button>
            </form>
          </div>

          {/* Results Section */}
          <div className="md:col-span-7">
            {!results ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/30 rounded-lg p-8">
                <Package className="w-12 h-12 mb-4 opacity-20" />
                <p>Enter shipment details to view rates</p>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Estimated Options</h3>
                
                {results.map((option) => (
                  <Card key={option.id} className="relative overflow-hidden hover:border-primary transition-colors cursor-pointer group">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-bold text-base">{option.name}</h4>
                          <p className="text-xs text-muted-foreground">{option.carrier}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-primary">${option.price}</div>
                          <div className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                            <Timer className="w-3 h-3" />
                            {option.transitTime}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" className="w-full" onClick={() => handleConvertToQuote(option)}>
                          Convert to Quote <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                        <Button size="sm" variant="outline" className="w-full" onClick={() => handleEmailQuote(option)}>
                          Email Now
                        </Button>
                      </div>
                    </CardContent>
                    {option.type === 'standard' && (
                      <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-bl">
                        Recommended
                      </div>
                    )}
                  </Card>
                ))}

                <div className="pt-4 border-t mt-4">
                  <p className="text-xs text-muted-foreground text-center">
                    * Rates are estimated based on current market data. Final quote may vary.
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
