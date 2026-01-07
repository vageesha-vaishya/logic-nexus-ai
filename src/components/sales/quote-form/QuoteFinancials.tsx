import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DollarSign, Percent, FileText, Lock, Info, Receipt, Server, CheckCircle2, AlertCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

export function QuoteFinancials() {
  const { control } = useFormContext();
  const { supabase } = useCRM();
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [serverVerification, setServerVerification] = useState<{ verified: boolean; match: boolean } | null>(null);

  // Watch values for real-time calculation preview
  const shippingAmount = useWatch({ control, name: 'shipping_amount' }) || 0;
  const taxPercent = useWatch({ control, name: 'tax_percent' }) || 0;
  
  const subtotal = parseFloat(shippingAmount) || 0;
  const taxAmount = (subtotal * parseFloat(taxPercent || '0')) / 100;
  const total = subtotal + taxAmount;

  const handleVerifyCalculation = async () => {
    setIsVerifying(true);
    setServerVerification(null);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-quote-financials', {
        body: { shipping_amount: subtotal, tax_percent: parseFloat(taxPercent || '0') }
      });

      if (error) throw error;

      const serverTotal = data.total_amount;
      const isMatch = Math.abs(serverTotal - total) < 0.01; // Float tolerance

      setServerVerification({ verified: true, match: isMatch });
      
      if (isMatch) {
        toast.success('Financials verified by server');
      } else {
        toast.warning(`Server calculation differs: $${serverTotal}`);
      }
    } catch (err) {
      console.error('Verification failed:', err);
      toast.error('Failed to verify calculation');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Pricing & Calculation */}
      <Card className="shadow-sm border-t-4 border-t-green-600">
        <CardHeader>
          <div className="flex items-center gap-3">
              <div className="p-2.5 bg-green-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-700" />
              </div>
              <div>
                  <CardTitle className="text-xl text-green-950">Pricing Details</CardTitle>
                  <CardDescription>Calculate shipping costs, taxes, and final totals.</CardDescription>
              </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Input Fields */}
              <div className="lg:col-span-7 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                        control={control}
                        name="shipping_amount"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center gap-2 text-foreground/80">
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                Shipping Amount
                            </FormLabel>
                            <FormControl>
                            <div className="relative group">
                                 <span className="absolute left-3 top-2.5 text-muted-foreground group-focus-within:text-green-600 transition-colors">$</span>
                                 <Input 
                                    type="number" 
                                    step="0.01" 
                                    className="pl-7 text-lg font-medium h-11 bg-background focus:ring-green-500/20 focus:border-green-500 transition-all" 
                                    placeholder="0.00"
                                    {...field} 
                                 />
                            </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />

                    <FormField
                        control={control}
                        name="tax_percent"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center gap-2 text-foreground/80">
                                <Percent className="h-4 w-4 text-muted-foreground" />
                                Tax Rate
                            </FormLabel>
                            <FormControl>
                             <div className="relative group">
                                 <Input 
                                    type="number" 
                                    step="0.01" 
                                    className="pr-8 text-lg font-medium h-11 bg-background focus:ring-green-500/20 focus:border-green-500 transition-all" 
                                    placeholder="0"
                                    {...field} 
                                 />
                                 <span className="absolute right-3 top-2.5 text-muted-foreground group-focus-within:text-green-600 transition-colors">%</span>
                            </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                  </div>

                  <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 flex gap-3 text-sm text-blue-800">
                    <Info className="h-5 w-5 text-blue-600 shrink-0" />
                    <p>Enter the base shipping cost and applicable tax rate. The total is calculated automatically and displayed in the summary.</p>
                  </div>
              </div>

              {/* Summary Box */}
              <div className="lg:col-span-5">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-xl border shadow-sm space-y-4">
                    <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2 uppercase tracking-wide">
                        <Receipt className="h-4 w-4 text-gray-500" /> 
                        Quote Summary
                    </h4>
                    <Separator className="bg-gray-200" />
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm text-gray-600">
                            <span>Subtotal</span>
                            <span className="font-medium text-gray-900">${subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-600">
                            <span>Tax ({taxPercent}%)</span>
                            <span className="font-medium text-gray-900">${taxAmount.toFixed(2)}</span>
                        </div>
                        <Separator className="bg-gray-200 border-dashed my-2" />
                        <div className="flex justify-between items-end">
                            <span className="text-base font-bold text-gray-900">Total Estimate</span>
                            <span className="text-2xl font-bold text-green-700 tracking-tight">
                                ${total.toFixed(2)}
                            </span>
                        </div>

                         {/* Server Verification */}
                         <div className="pt-4">
                            <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                className="w-full gap-2 text-muted-foreground hover:text-primary border-dashed"
                                onClick={handleVerifyCalculation}
                                disabled={isVerifying || total === 0}
                            >
                                {isVerifying ? (
                                    <Server className="h-4 w-4 animate-pulse" />
                                ) : serverVerification?.verified ? (
                                     serverVerification.match ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-amber-600" />
                                ) : (
                                    <Server className="h-4 w-4" />
                                )}
                                {isVerifying ? 'Verifying...' : serverVerification?.verified ? (serverVerification.match ? 'Verified by Server' : 'Mismatch') : 'Verify Calculation'}
                            </Button>
                        </div>
                    </div>
                  </div>
              </div>
          </div>
        </CardContent>
      </Card>

      {/* Terms & Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Terms & Conditions
                </CardTitle>
            </CardHeader>
            <CardContent>
                <FormField
                    control={control}
                    name="terms_conditions"
                    render={({ field }) => (
                        <FormItem>
                        <FormControl>
                            <Textarea 
                                placeholder="Enter standard terms, payment details, or validity period..." 
                                className="min-h-[150px] font-mono text-sm resize-none focus:ring-primary/20" 
                                {...field} 
                            />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </CardContent>
        </Card>

        <Card className="shadow-sm bg-amber-50/30 border-amber-100">
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-amber-900">
                    <Lock className="h-4 w-4 text-amber-600" />
                    Internal Notes
                </CardTitle>
            </CardHeader>
            <CardContent>
                <FormField
                    control={control}
                    name="notes"
                    render={({ field }) => (
                        <FormItem>
                        <FormControl>
                            <Textarea 
                                placeholder="Private notes for the team (not visible to customer)..." 
                                className="min-h-[150px] bg-white/80 border-amber-200 focus:border-amber-400 focus:ring-amber-400/20 resize-none" 
                                {...field} 
                            />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
