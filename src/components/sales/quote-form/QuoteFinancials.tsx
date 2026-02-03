import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DollarSign, Percent, FileText, Lock, Info, Receipt, Server, CheckCircle2, AlertCircle, Calculator } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useCRM } from '@/hooks/useCRM';
import { invokeFunction } from '@/lib/supabase-functions';
import { toast } from 'sonner';
import { PluginRegistry } from '@/services/plugins/PluginRegistry';
import { LogisticsPlugin } from '@/plugins/logistics/LogisticsPlugin';
import { RequestContext, QuoteResult } from '@/services/quotation/types';

export function QuoteFinancials() {
  const { control, setValue } = useFormContext();
  // const { supabase } = useCRM();
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [serverVerification, setServerVerification] = useState<{ verified: boolean; match: boolean } | null>(null);
  const [calculationResult, setCalculationResult] = useState<QuoteResult | null>(null);

  // Watch values for real-time calculation preview
  const shippingAmount = useWatch({ control, name: 'shipping_amount' }) || 0;
  const taxPercent = useWatch({ control, name: 'tax_percent' }) || 0;
  
  const formItems = useWatch({ control, name: 'items' });
  const formMode = useWatch({ control, name: 'service_type_id' }); // Assuming this maps to mode temporarily
  const incoterms = useWatch({ control, name: 'incoterms' });

  const subtotal = parseFloat(shippingAmount) || 0;
  const taxAmount = (subtotal * parseFloat(taxPercent || '0')) / 100;
  const total = subtotal + taxAmount;

  const handleCalculateEstimate = async () => {
    setIsCalculating(true);
    setCalculationResult(null);
    try {
        const logisticsPlugin = PluginRegistry.getPlugin('plugin-logistics-core') as LogisticsPlugin;

        if (!logisticsPlugin) {
            throw new Error('Logistics plugin not initialized or not found');
        }

        const engine = logisticsPlugin.getQuotationEngine();

        const context: RequestContext = {
            tenantId: 'current-tenant', // Should come from auth context
            domainId: 'logistics',
            currency: 'USD',
            metadata: {
                mode: formMode || 'ocean', // Default or map from service_type_id
                incoterms: incoterms || 'EXW'
            }
        };

        // Map form items to engine items
        // Ensure attributes are present and numbers
        const engineItems = (formItems || []).map((item: any) => ({
            description: item.product_name,
            quantity: Number(item.quantity) || 1,
            attributes: {
                weight: Number(item.attributes?.weight) || 0,
                volume: Number(item.attributes?.volume) || 0
            }
        }));

        if (engineItems.length === 0) {
            toast.warning('Please add items to calculate charges');
            setIsCalculating(false);
            return;
        }

        const result = await engine.calculate(context, engineItems);
        setCalculationResult(result);
        
        // Auto-fill shipping amount if empty or user confirms?
        // For now, let's just show the result and let user apply it
        toast.success(`Calculated Estimate: $${result.totalAmount.toFixed(2)}`);

    } catch (err: any) {
        console.error('Calculation failed:', err);
        toast.error(err.message || 'Failed to calculate estimate');
    } finally {
        setIsCalculating(false);
    }
  };

  const applyCalculation = () => {
      if (calculationResult) {
          setValue('shipping_amount', calculationResult.breakdown.freight.toFixed(2));
          // Could also set surcharges to notes or a breakdown field if available
          toast.success('Applied calculated freight to Shipping Amount');
      }
  };

  const handleVerifyCalculation = async () => {
    setIsVerifying(true);
    setServerVerification(null);
    try {
      // Ensure values are numbers before sending
      // Handle potentially formatted strings (e.g. "3,324.00" or "$3,324")
      const cleanSubtotal = String(subtotal).replace(/[^0-9.-]+/g, '');
      const shippingAmountVal = cleanSubtotal ? parseFloat(cleanSubtotal) : 0;
      
      // Handle taxPercent
      const cleanTax = String(taxPercent).replace(/[^0-9.-]+/g, '');
      const taxRate = cleanTax ? parseFloat(cleanTax) : 0;
      
      console.log('Verifying financials:', { 
        originalSubtotal: subtotal,
        originalTax: taxPercent,
        sentShipping: shippingAmountVal, 
        sentTax: taxRate 
      });

      const { data, error } = await invokeFunction('calculate-quote-financials', {
        body: { shipping_amount: shippingAmountVal, tax_percent: taxRate }
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
    } catch (err: any) {
      console.error('Verification failed:', err);
      toast.error(err.message || 'Failed to verify calculation');
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
                            <FormLabel className="flex items-center justify-between text-foreground/80">
                                <div className="flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                                    Shipping Amount
                                </div>
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 text-xs gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    onClick={handleCalculateEstimate}
                                    disabled={isCalculating}
                                >
                                    <Calculator className="h-3 w-3" />
                                    {isCalculating ? 'Calculating...' : 'Calculate Estimate'}
                                </Button>
                            </FormLabel>
                            {calculationResult && (
                                <div className="absolute z-10 top-8 right-0 w-64 p-3 bg-white border rounded-md shadow-lg animate-in fade-in slide-in-from-top-1">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-semibold">Est. Freight:</span>
                                        <span className="text-sm font-bold text-green-600">${calculationResult.breakdown.freight.toFixed(2)}</span>
                                    </div>
                                    <Button 
                                        type="button" 
                                        size="sm" 
                                        variant="secondary" 
                                        className="w-full h-7 text-xs"
                                        onClick={() => {
                                            applyCalculation();
                                            setCalculationResult(null);
                                        }}
                                    >
                                        Apply Amount
                                    </Button>
                                </div>
                            )}
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
              <div className="lg:col-span-5 space-y-6">
                  {calculationResult && (
                      <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100 animate-in fade-in slide-in-from-top-2">
                          <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-semibold text-blue-900 flex items-center gap-2">
                                  <Calculator className="h-4 w-4" />
                                  Estimated Breakdown
                              </h4>
                              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs text-blue-700 hover:text-blue-800" onClick={() => setCalculationResult(null)}>Clear</Button>
                          </div>
                          <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                  <span className="text-muted-foreground">Base Freight:</span>
                                  <span className="font-medium">${calculationResult.breakdown.freight?.toFixed(2) || '0.00'}</span>
                              </div>
                              {Object.entries(calculationResult.breakdown.surcharges || {}).map(([key, value]) => (
                                  <div key={key} className="flex justify-between text-xs">
                                      <span className="text-muted-foreground">{key}:</span>
                                      <span>${Number(value).toFixed(2)}</span>
                                  </div>
                              ))}
                              <Separator className="bg-blue-200 my-2" />
                              <div className="flex justify-between font-bold text-blue-900">
                                  <span>Total Estimate:</span>
                                  <span>${calculationResult.totalAmount.toFixed(2)}</span>
                              </div>
                              <Button 
                                  type="button"
                                  size="sm" 
                                  className="w-full mt-3 bg-blue-600 hover:bg-blue-700"
                                  onClick={applyCalculation}
                              >
                                  Apply to Shipping Amount
                              </Button>
                          </div>
                      </div>
                  )}

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
                            <span>Tax ({String(taxPercent)}%)</span>
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
