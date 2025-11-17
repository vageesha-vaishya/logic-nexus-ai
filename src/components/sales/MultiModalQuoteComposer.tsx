import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Save, MapPin, DollarSign, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TransportModeSelector } from './composer/TransportModeSelector';
import { BasisConfigModal } from './composer/BasisConfigModal';
import { ChargeRow } from './composer/ChargeRow';

interface Leg {
  id: string;
  mode: string;
  serviceTypeId: string;
  origin: string;
  destination: string;
  charges: any[];
}

interface MultiModalQuoteComposerProps {
  quoteId: string;
  versionId: string;
  optionId?: string;
}

export function MultiModalQuoteComposer({ quoteId, versionId, optionId: initialOptionId }: MultiModalQuoteComposerProps) {
  const { toast } = useToast();
  const [optionId, setOptionId] = useState<string | null>(initialOptionId || null);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [currentLegId, setCurrentLegId] = useState<string | null>(null);
  const [autoMargin, setAutoMargin] = useState(false);
  const [marginPercent, setMarginPercent] = useState(0);

  // Reference data
  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
  const [chargeCategories, setChargeCategories] = useState<any[]>([]);
  const [chargeBases, setChargeBases] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [tradeDirections, setTradeDirections] = useState<any[]>([]);
  const [containerTypes, setContainerTypes] = useState<any[]>([]);
  const [containerSizes, setContainerSizes] = useState<any[]>([]);

  // Basis configuration modal
  const [basisModalOpen, setBasisModalOpen] = useState(false);
  const [currentBasisConfig, setCurrentBasisConfig] = useState({
    tradeDirection: '',
    containerType: '',
    containerSize: '',
    quantity: 1
  });
  const [basisChargeIndex, setBasisChargeIndex] = useState<{ legId: string; chargeIdx: number } | null>(null);

  useEffect(() => {
    loadReferenceData();
    if (optionId) {
      loadOptionData();
    }
  }, [optionId]);

  const loadReferenceData = async () => {
    const [st, cc, cb, cu, td, ct, cs] = await Promise.all([
      supabase.from('service_types').select('*').eq('is_active', true),
      supabase.from('charge_categories').select('*').eq('is_active', true),
      supabase.from('charge_bases').select('*').eq('is_active', true),
      supabase.from('currencies').select('*').eq('is_active', true),
      supabase.from('trade_directions').select('*').eq('is_active', true),
      supabase.from('container_types').select('*').eq('is_active', true),
      supabase.from('container_sizes').select('*').eq('is_active', true),
    ]);

    setServiceTypes(st.data || []);
    setChargeCategories(cc.data || []);
    setChargeBases(cb.data || []);
    setCurrencies(cu.data || []);
    setTradeDirections(td.data || []);
    setContainerTypes(ct.data || []);
    setContainerSizes(cs.data || []);
  };

  const loadOptionData = async () => {
    // Load existing legs and charges
    const { data: legData } = await supabase
      .from('quote_legs')
      .select('*')
      .eq('quote_option_id', optionId);

    if (legData && legData.length > 0) {
      const legsWithCharges = await Promise.all(
        legData.map(async (leg) => {
          const { data: charges } = await supabase
            .from('quote_charges')
            .select('*')
            .eq('leg_id', leg.id);
          
          return {
            id: leg.id,
            mode: leg.mode || 'ocean',
            serviceTypeId: leg.service_type_id || '',
            origin: leg.origin_location || '',
            destination: leg.destination_location || '',
            charges: charges || []
          };
        })
      );
      setLegs(legsWithCharges);
      if (legsWithCharges.length > 0) {
        setCurrentLegId(legsWithCharges[0].id);
      }
    }
  };

  const addLeg = (mode: string) => {
    const newLeg: Leg = {
      id: `leg-${Date.now()}`,
      mode,
      serviceTypeId: '',
      origin: '',
      destination: '',
      charges: []
    };
    setLegs([...legs, newLeg]);
    setCurrentLegId(newLeg.id);
  };

  const updateLeg = (legId: string, updates: Partial<Leg>) => {
    setLegs(legs.map(leg => leg.id === legId ? { ...leg, ...updates } : leg));
  };

  const addCharge = (legId: string) => {
    setLegs(legs.map(leg => {
      if (leg.id === legId) {
        return {
          ...leg,
          charges: [
            ...leg.charges,
            {
              id: `charge-${Date.now()}`,
              category_id: '',
              basis_id: '',
              unit: '',
              currency_id: currencies[0]?.id || '',
              buy: { quantity: 1, rate: 0 },
              sell: { quantity: 1, rate: 0 },
              note: ''
            }
          ]
        };
      }
      return leg;
    }));
  };

  const updateCharge = (legId: string, chargeIdx: number, field: string, value: any) => {
    setLegs(legs.map(leg => {
      if (leg.id === legId) {
        const charges = [...leg.charges];
        const charge = { ...charges[chargeIdx] };
        
        if (field.includes('.')) {
          const [parent, child] = field.split('.');
          charge[parent] = { ...charge[parent], [child]: value };
        } else {
          charge[field] = value;
        }

        // Apply auto margin if enabled
        if (autoMargin && marginPercent > 0 && field.startsWith('buy.')) {
          const buyAmount = (charge.buy?.quantity || 1) * (charge.buy?.rate || 0);
          const sellRate = (charge.buy?.rate || 0) * (1 + marginPercent / 100);
          charge.sell = {
            quantity: charge.buy?.quantity || 1,
            rate: sellRate
          };
        }

        charges[chargeIdx] = charge;
        return { ...leg, charges };
      }
      return leg;
    }));
  };

  const removeCharge = (legId: string, chargeIdx: number) => {
    setLegs(legs.map(leg => {
      if (leg.id === legId) {
        return {
          ...leg,
          charges: leg.charges.filter((_, idx) => idx !== chargeIdx)
        };
      }
      return leg;
    }));
  };

  const openBasisModal = (legId: string, chargeIdx: number) => {
    setBasisChargeIndex({ legId, chargeIdx });
    setBasisModalOpen(true);
  };

  const saveBasisConfig = (config: any) => {
    if (!basisChargeIndex) return;
    
    const { legId, chargeIdx } = basisChargeIndex;
    const size = containerSizes.find(s => s.id === config.containerSize);
    
    setLegs(legs.map(leg => {
      if (leg.id === legId) {
        const charges = [...leg.charges];
        charges[chargeIdx] = {
          ...charges[chargeIdx],
          unit: `${config.quantity}x${size?.name || ''}`,
          buy: { ...charges[chargeIdx].buy, quantity: config.quantity },
          sell: { ...charges[chargeIdx].sell, quantity: config.quantity },
          basisDetails: config
        };
        return { ...leg, charges };
      }
      return leg;
    }));
    
    setBasisModalOpen(false);
    setCurrentBasisConfig({ tradeDirection: '', containerType: '', containerSize: '', quantity: 1 });
  };

  const saveQuotation = async () => {
    try {
      // Save or create option if needed
      let currentOptionId = optionId;
      if (!currentOptionId) {
        const { data: newOption, error: optError } = await supabase
          .from('quotation_version_options')
          .insert({
            quotation_version_id: versionId,
            tenant_id: (await supabase.auth.getUser()).data.user?.user_metadata?.tenant_id
          })
          .select()
          .single();
        
        if (optError) throw optError;
        currentOptionId = newOption.id;
        setOptionId(currentOptionId);
      }

      // Save legs and charges
      for (const leg of legs) {
        let legId = leg.id;
        
        if (leg.id.startsWith('leg-')) {
          // New leg
          const { data: newLeg, error: legError } = await supabase
            .from('quote_legs')
            .insert({
              quote_option_id: currentOptionId,
              mode: leg.mode,
              service_type_id: leg.serviceTypeId || null,
              origin_location: leg.origin,
              destination_location: leg.destination,
              tenant_id: (await supabase.auth.getUser()).data.user?.user_metadata?.tenant_id
            })
            .select()
            .single();
          
          if (legError) throw legError;
          legId = newLeg.id;
        }

        // Save charges
        for (const charge of leg.charges) {
          if (charge.id.startsWith('charge-')) {
            // New charge - need to insert buy and sell sides
            const buySide = await supabase.from('charge_sides').select('id').eq('code', 'buy').single();
            const sellSide = await supabase.from('charge_sides').select('id').eq('code', 'sell').single();

            // Insert buy side
            await supabase.from('quote_charges').insert({
              quote_option_id: currentOptionId,
              leg_id: legId,
              charge_side_id: buySide.data?.id,
              category_id: charge.category_id || null,
              basis_id: charge.basis_id || null,
              quantity: charge.buy?.quantity || 1,
              rate: charge.buy?.rate || 0,
              amount: (charge.buy?.quantity || 1) * (charge.buy?.rate || 0),
              currency_id: charge.currency_id || null,
              unit: charge.unit || null,
              note: charge.note || null,
              tenant_id: (await supabase.auth.getUser()).data.user?.user_metadata?.tenant_id
            });

            // Insert sell side
            await supabase.from('quote_charges').insert({
              quote_option_id: currentOptionId,
              leg_id: legId,
              charge_side_id: sellSide.data?.id,
              category_id: charge.category_id || null,
              basis_id: charge.basis_id || null,
              quantity: charge.sell?.quantity || 1,
              rate: charge.sell?.rate || 0,
              amount: (charge.sell?.quantity || 1) * (charge.sell?.rate || 0),
              currency_id: charge.currency_id || null,
              unit: charge.unit || null,
              note: charge.note || null,
              tenant_id: (await supabase.auth.getUser()).data.user?.user_metadata?.tenant_id
            });
          }
        }
      }

      toast({ title: 'Success', description: 'Quotation saved successfully' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const currentLeg = legs.find(l => l.id === currentLegId);
  const totals = currentLeg?.charges.reduce((acc, charge) => ({
    buy: acc.buy + ((charge.buy?.quantity || 1) * (charge.buy?.rate || 0)),
    sell: acc.sell + ((charge.sell?.quantity || 1) * (charge.sell?.rate || 0))
  }), { buy: 0, sell: 0 }) || { buy: 0, sell: 0 };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Multi-Modal Quotation Composer</span>
            <Button onClick={saveQuotation}>
              <Save className="mr-2 h-4 w-4" />
              Save Quotation
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Transport Mode Selection */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Select Transport Mode</Label>
            <TransportModeSelector
              selectedMode={null}
              onSelect={addLeg}
            />
          </div>

          {/* Auto Margin Settings */}
          <div className="flex items-center gap-4 p-4 bg-accent/20 rounded-lg">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoMargin}
                onChange={(e) => setAutoMargin(e.target.checked)}
                id="auto-margin"
                className="h-4 w-4"
              />
              <Label htmlFor="auto-margin">Auto Margin</Label>
            </div>
            {autoMargin && (
              <div className="flex items-center gap-2">
                <Label>Margin %:</Label>
                <Input
                  type="number"
                  value={marginPercent}
                  onChange={(e) => setMarginPercent(Number(e.target.value))}
                  className="w-24"
                  min={0}
                  max={100}
                />
              </div>
            )}
          </div>

          {/* Legs Tabs */}
          {legs.length > 0 && (
            <Tabs value={currentLegId || ''} onValueChange={setCurrentLegId}>
              <TabsList className="w-full">
                {legs.map((leg, idx) => (
                  <TabsTrigger key={leg.id} value={leg.id}>
                    Leg {idx + 1} - {leg.mode}
                  </TabsTrigger>
                ))}
              </TabsList>

              {legs.map((leg) => (
                <TabsContent key={leg.id} value={leg.id} className="space-y-4">
                  {/* Leg Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Service Type</Label>
                      <Select
                        value={leg.serviceTypeId}
                        onValueChange={(val) => updateLeg(leg.id, { serviceTypeId: val })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select service" />
                        </SelectTrigger>
                        <SelectContent>
                          {serviceTypes.map((st) => (
                            <SelectItem key={st.id} value={st.id}>
                              {st.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Origin</Label>
                      <div className="relative">
                        <MapPin className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={leg.origin}
                          onChange={(e) => updateLeg(leg.id, { origin: e.target.value })}
                          placeholder="Origin location"
                          className="pl-8"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Destination</Label>
                      <div className="relative">
                        <MapPin className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={leg.destination}
                          onChange={(e) => updateLeg(leg.id, { destination: e.target.value })}
                          placeholder="Destination location"
                          className="pl-8"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Charges Table */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-base font-semibold">Charges</Label>
                      <Button onClick={() => addCharge(leg.id)} size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Charge
                      </Button>
                    </div>

                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-2 text-left text-sm">Category</th>
                            <th className="p-2 text-left text-sm">Basis</th>
                            <th className="p-2 text-left text-sm">Unit</th>
                            <th className="p-2 text-left text-sm">Currency</th>
                            <th className="p-2 text-right text-sm">Buy Qty</th>
                            <th className="p-2 text-right text-sm">Buy Rate</th>
                            <th className="p-2 text-right text-sm">Buy Amount</th>
                            <th className="p-2 text-right text-sm">Sell Qty</th>
                            <th className="p-2 text-right text-sm">Sell Rate</th>
                            <th className="p-2 text-right text-sm">Sell Amount</th>
                            <th className="p-2 text-right text-sm">Margin</th>
                            <th className="p-2 text-left text-sm">Notes</th>
                            <th className="p-2 text-center text-sm">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leg.charges.map((charge, idx) => (
                            <ChargeRow
                              key={charge.id}
                              charge={charge}
                              categories={chargeCategories}
                              bases={chargeBases}
                              currencies={currencies}
                              onUpdate={(field, value) => updateCharge(leg.id, idx, field, value)}
                              onRemove={() => removeCharge(leg.id, idx)}
                              onConfigureBasis={() => openBasisModal(leg.id, idx)}
                              showBuySell={true}
                            />
                          ))}
                        </tbody>
                        <tfoot className="bg-muted font-bold">
                          <tr>
                            <td colSpan={6} className="p-2 text-right">Totals:</td>
                            <td className="p-2 text-right">{totals.buy.toFixed(2)}</td>
                            <td colSpan={2} className="p-2"></td>
                            <td className="p-2 text-right">{totals.sell.toFixed(2)}</td>
                            <td className={`p-2 text-right ${
                              totals.sell - totals.buy >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {(totals.sell - totals.buy).toFixed(2)}
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}

          {legs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>Select a transport mode above to start building your quotation</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Basis Configuration Modal */}
      <BasisConfigModal
        open={basisModalOpen}
        onClose={() => setBasisModalOpen(false)}
        onSave={saveBasisConfig}
        config={currentBasisConfig}
        onChange={(updates) => setCurrentBasisConfig({ ...currentBasisConfig, ...updates })}
        tradeDirections={tradeDirections}
        containerTypes={containerTypes}
        containerSizes={containerSizes}
      />
    </div>
  );
}
