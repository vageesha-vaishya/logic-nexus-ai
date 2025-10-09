import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FormLabel, FormControl } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

type Charge = {
  type: string;
  amount: number;
  currency: string;
  note?: string;
};

type CarrierQuote = {
  carrier_id: string;
  mode?: string;
  buying_charges: Charge[];
  selling_charges: Charge[];
};

export function CarrierQuotesSection({
  carriers,
  selectedServiceType,
  carrierQuotes,
  setCarrierQuotes,
}: {
  carriers: any[];
  selectedServiceType: string;
  carrierQuotes: CarrierQuote[];
  setCarrierQuotes: Dispatch<SetStateAction<CarrierQuote[]>>;
}) {
  // Collapsible on mobile, open by default on md+; persist to localStorage
  const [accordionOpen, setAccordionOpen] = useState<boolean>(true);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('carrierQuotesAccordionOpen');
      if (saved !== null) {
        setAccordionOpen(saved === 'true');
      } else {
        setAccordionOpen(window.innerWidth >= 768);
      }
    }
  }, []);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('carrierQuotesAccordionOpen', String(accordionOpen));
    }
  }, [accordionOpen]);
  const addCarrierQuote = () => {
    setCarrierQuotes((prev) => ([
      ...prev,
      { carrier_id: '', mode: selectedServiceType || undefined, buying_charges: [], selling_charges: [] },
    ]));
  };

  const removeCarrierQuote = (index: number) => {
    setCarrierQuotes((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCarrierField = (index: number, field: keyof CarrierQuote, value: any) => {
    setCarrierQuotes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addCharge = (index: number, side: 'buy' | 'sell') => {
    setCarrierQuotes((prev) => {
      const next = [...prev];
      const targetList = side === 'buy' ? next[index].buying_charges : next[index].selling_charges;
      targetList.push({ type: 'freight', amount: 0, currency: 'USD' });
      return next;
    });
  };

  const updateCharge = (
    index: number,
    side: 'buy' | 'sell',
    chargeIndex: number,
    field: keyof Charge,
    value: any,
  ) => {
    setCarrierQuotes((prev) => {
      const next = [...prev];
      const targetList = side === 'buy' ? next[index].buying_charges : next[index].selling_charges;
      targetList[chargeIndex] = { ...targetList[chargeIndex], [field]: value } as Charge;
      return next;
    });
  };

  const removeCharge = (index: number, side: 'buy' | 'sell', chargeIndex: number) => {
    setCarrierQuotes((prev) => {
      const next = [...prev];
      const targetList = side === 'buy' ? next[index].buying_charges : next[index].selling_charges;
      next[index] = {
        ...next[index],
        [side === 'buy' ? 'buying_charges' : 'selling_charges']:
          targetList.filter((_, i) => i !== chargeIndex),
      } as CarrierQuote;
      return next;
    });
  };

  const totalCharges = (charges: Charge[]) => charges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

  return (
    <Card className="ef-card">
      <CardHeader className="ef-header">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <CardTitle className="ef-title">Carrier Quotations</CardTitle>
          <Button type="button" onClick={addCarrierQuote} size="sm" className="ef-hover">
            <Plus className="h-4 w-4 mr-2" />
            Add Carrier Quote
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Accordion type="single" collapsible value={accordionOpen ? 'carrier-quotes' : undefined} onValueChange={(v) => setAccordionOpen(!!v)}>
          <AccordionItem value="carrier-quotes">
            <AccordionTrigger className="text-base transition-colors duration-200">Charges & breakdown</AccordionTrigger>
            <AccordionContent className="space-y-4 transition-all duration-300 ease-in-out">
              {carrierQuotes.length === 0 ? (
                <div className="text-sm text-muted-foreground">No carrier quotations added. Use "Add Carrier Quote" to begin.</div>
              ) : (
                carrierQuotes.map((cq, idx) => (
            <div key={idx} className="border rounded-lg p-4 space-y-4">
              <div className="flex justify-between items-start">
                <span className="font-medium">Carrier Quote {idx + 1}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeCarrierQuote(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="ef-grid">
                <div className="space-y-2">
                  <FormLabel>Transport Mode</FormLabel>
                  <Select value={cq.mode || ''} onValueChange={(v) => updateCarrierField(idx, 'mode', v)}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ocean">Ocean Freight</SelectItem>
                      <SelectItem value="air">Air Freight</SelectItem>
                      <SelectItem value="trucking">Trucking</SelectItem>
                      <SelectItem value="courier">Courier</SelectItem>
                      <SelectItem value="moving">Moving & Packing</SelectItem>
                      <SelectItem value="railway_transport">Railways</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <FormLabel>Carrier</FormLabel>
                  <Select value={cq.carrier_id} onValueChange={(v) => updateCarrierField(idx, 'carrier_id', v)}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select carrier" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {carriers.map((carrier) => (
                        <SelectItem key={carrier.id} value={carrier.id}>
                          {carrier.carrier_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Buying Charges</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => addCharge(idx, 'buy')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Charge
                    </Button>
                  </div>
                  {cq.buying_charges.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No buying charges.</div>
                  ) : (
                    cq.buying_charges.map((ch, cIdx) => (
                      <div key={`buy-${cIdx}`} className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
                        <div>
                          <FormLabel className="text-xs">Type</FormLabel>
                          <Select value={ch.type} onValueChange={(v) => updateCharge(idx, 'buy', cIdx, 'type', v)}>
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="freight">Freight</SelectItem>
                              <SelectItem value="fuel">Fuel</SelectItem>
                              <SelectItem value="handling">Handling</SelectItem>
                              <SelectItem value="documentation">Documentation</SelectItem>
                              <SelectItem value="origin">Origin</SelectItem>
                              <SelectItem value="destination">Destination</SelectItem>
                              <SelectItem value="customs">Customs</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <FormLabel className="text-xs">Amount</FormLabel>
                          <Input type="number" step="0.01" value={ch.amount}
                                 onChange={(e) => updateCharge(idx, 'buy', cIdx, 'amount', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div>
                          <FormLabel className="text-xs">Currency</FormLabel>
                          <Input value={ch.currency} onChange={(e) => updateCharge(idx, 'buy', cIdx, 'currency', e.target.value)} />
                        </div>
                        <div className="flex items-end justify-end">
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeCharge(idx, 'buy', cIdx)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span>Total Buy:</span>
                    <span className="font-medium">${totalCharges(cq.buying_charges).toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Selling Charges</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => addCharge(idx, 'sell')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Charge
                    </Button>
                  </div>
                  {cq.selling_charges.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No selling charges.</div>
                  ) : (
                    cq.selling_charges.map((ch, cIdx) => (
                      <div key={`sell-${cIdx}`} className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
                        <div>
                          <FormLabel className="text-xs">Type</FormLabel>
                          <Select value={ch.type} onValueChange={(v) => updateCharge(idx, 'sell', cIdx, 'type', v)}>
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="freight">Freight</SelectItem>
                              <SelectItem value="fuel">Fuel</SelectItem>
                              <SelectItem value="handling">Handling</SelectItem>
                              <SelectItem value="documentation">Documentation</SelectItem>
                              <SelectItem value="origin">Origin</SelectItem>
                              <SelectItem value="destination">Destination</SelectItem>
                              <SelectItem value="customs">Customs</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <FormLabel className="text-xs">Amount</FormLabel>
                          <Input type="number" step="0.01" value={ch.amount}
                                 onChange={(e) => updateCharge(idx, 'sell', cIdx, 'amount', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div>
                          <FormLabel className="text-xs">Currency</FormLabel>
                          <Input value={ch.currency} onChange={(e) => updateCharge(idx, 'sell', cIdx, 'currency', e.target.value)} />
                        </div>
                        <div className="flex items-end justify-end">
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeCharge(idx, 'sell', cIdx)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span>Total Sell:</span>
                    <span className="font-medium">${totalCharges(cq.selling_charges).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}