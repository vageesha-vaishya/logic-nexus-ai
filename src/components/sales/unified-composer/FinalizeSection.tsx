import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { QuoteComposerValues } from './schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Save, FileText, Plus, ChevronDown, ChevronUp, Ship, Plane, Truck, TrainFront, Package, BarChart3, ArrowRight, Pencil, Check, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { RateOption, TransportLeg, Charge } from '@/types/quote-breakdown';
import { ChargeRow } from '@/components/sales/composer/ChargeRow';
import { ChargesAnalysisGraph } from '@/components/sales/common/ChargesAnalysisGraph';
import { ChargeBreakdown } from '@/components/sales/common/ChargeBreakdown';
import { useChargesManager, ManagedCharge, UseChargesManagerParams } from '@/hooks/useChargesManager';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FinalizeSectionProps {
  selectedOption: RateOption;
  onSaveQuote: (charges: ManagedCharge[], marginPercent: number, notes: string) => void;
  onGeneratePdf?: () => void;
  saving?: boolean;
  draft?: {
    legs?: TransportLeg[];
    charges?: ManagedCharge[];
    autoMargin?: boolean;
    marginPercent?: number;
  };
  onDraftChange?: (draft: {
    legs: TransportLeg[];
    charges: ManagedCharge[];
    autoMargin: boolean;
    marginPercent: number;
  }) => void;
  onRenameOption?: (optionId: string, newName: string) => void;
  referenceData?: {
    chargeCategories: any[];
    chargeBases: any[];
    currencies: any[];
    chargeSides: any[];
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_REF_DATA = {
  chargeCategories: [
    { id: 'freight', code: 'freight', name: 'Freight' },
    { id: 'handling', code: 'handling', name: 'Handling' },
    { id: 'fee', code: 'fee', name: 'Fee' },
    { id: 'surcharge', code: 'surcharge', name: 'Surcharge' },
    { id: 'other', code: 'other', name: 'Other' },
  ],
  chargeBases: [
    { id: 'shipment', code: 'shipment', name: 'Per Shipment' },
    { id: 'kg', code: 'kg', name: 'Per KG' },
    { id: 'cbm', code: 'cbm', name: 'Per CBM' },
    { id: 'container', code: 'container', name: 'Per Container' },
  ],
  currencies: [
    { id: 'usd', code: 'USD', name: 'USD' },
    { id: 'eur', code: 'EUR', name: 'EUR' },
  ],
  chargeSides: [
    { id: 'buy', code: 'buy', name: 'Buy' },
    { id: 'sell', code: 'sell', name: 'Sell' },
  ],
};

function getModeIcon(mode?: string) {
  switch (mode?.toLowerCase()) {
    case 'ocean':
    case 'sea':
      return <Ship className="w-3.5 h-3.5" />;
    case 'air':
      return <Plane className="w-3.5 h-3.5" />;
    case 'road':
    case 'truck':
      return <Truck className="w-3.5 h-3.5" />;
    case 'rail':
      return <TrainFront className="w-3.5 h-3.5" />;
    default:
      return <Package className="w-3.5 h-3.5" />;
  }
}

import { CarrierComparisonPanel } from '@/components/sales/composer/CarrierComparisonPanel';
import { LegManager } from '@/components/sales/composer/LegManager';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FinalizeSection({ 
  selectedOption,
  onSaveQuote,
  onGeneratePdf,
  saving = false,
  draft,
  onDraftChange,
  onRenameOption,
  referenceData,
}: FinalizeSectionProps) {
  const { t } = useTranslation();
  const manualQuoteLabel = t('quotation.manualQuote', { defaultValue: 'Manual Quotation' });
  const selectedCarrier = (() => {
    const carrier = selectedOption?.carrier || '';
    const source = selectedOption?.source_attribution || '';
    const isManual = !!selectedOption?.is_manual || source === 'Manual Entry' || source === 'Manual Quote' || carrier === 'Manual Entry' || carrier.startsWith('Manual Quote');
    if (!isManual) return carrier || 'N/A';
    // If it's manual, we prefer to show the raw carrier string if it's customized, 
    // but if it matches "Manual Quote X", we localize it.
    // However, if we are allowing renaming, we should just show carrier as is, unless it's the default "Manual Quote X" pattern which we want to localize.
    // For now, let's keep localization logic but apply it only if it matches standard pattern.
    const match = carrier.match(/Manual (Entry|Quote|Option) (\d+)$/i);
    return match ? `${manualQuoteLabel} ${match[2]}` : carrier;
  })();

  const [expanded, setExpanded] = useState(true);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(selectedCarrier);
  const [activeFilter, setActiveFilter] = useState<{ type: 'category' | 'mode' | 'leg', value: string } | null>(null);

  useEffect(() => {
    setTempName(selectedCarrier);
  }, [selectedCarrier]);

  const handleNameSave = () => {
    if (tempName.trim() && onRenameOption) {
      onRenameOption(selectedOption.id, tempName.trim());
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleNameSave();
    if (e.key === 'Escape') {
      setTempName(selectedCarrier);
      setIsEditingName(false);
    }
  };

  const form = useFormContext<QuoteComposerValues>();

  const refData = referenceData && referenceData.chargeCategories?.length > 0
    ? referenceData
    : DEFAULT_REF_DATA;

  const {
    legs,
    setLegs,
    chargesByLeg,
    allCharges,
    addCharge,
    updateCharge,
    removeCharge,
    autoMargin,
    setAutoMargin,
    marginPercent,
    setMarginPercent,
    totals,
    getChargesForSave,
  } = useChargesManager({
    selectedOption,
    referenceData: refData as UseChargesManagerParams['referenceData'],
    defaultMarginPercent: form.getValues('marginPercent') || 15,
    initialCharges: draft?.charges,
    initialLegs: draft?.legs,
    initialAutoMargin: draft?.autoMargin,
    initialMarginPercent: draft?.marginPercent,
    resetKey: selectedOption.id,
    onStateChange: onDraftChange,
  });

  // Sync charges manager state to form
  useEffect(() => {
    form.setValue('marginPercent', marginPercent);
    form.setValue('autoMargin', autoMargin);
    // Phase 4: Sync allCharges to form.charges if we want to fully migrate
  }, [marginPercent, autoMargin, form]);

  // Build tab keys: one per leg + combined
  // If manual, we want a 'manual' tab if no legs defined
  const isManual = selectedOption.is_manual;
  const legTabKeys = legs.map((l) => l.id);
  const hasCombined = (chargesByLeg['combined']?.length || 0) > 0 || legs.length === 0 || isManual;
  const defaultTab = legTabKeys.length > 0 ? legTabKeys[0] : 'combined';

  const handleSave = () => {
    const { charges: savableCharges, marginPercent: mp } = getChargesForSave();
    onSaveQuote(savableCharges, mp, form.getValues('notes') || '');
  };

  // Convert managed charges to TransportLeg[] + Charge[] for visualization
  const { vizLegs, vizGlobalCharges } = useMemo(() => {
    const mapCharge = (mc: ManagedCharge): Charge => ({
      category: mc.categoryName,
      name: mc.categoryName,
      amount: mc.sell.amount,
      currency: mc.currencyCode,
      basis: mc.basisName,
      unit: mc.unit,
      quantity: mc.sell.quantity,
      rate: mc.sell.rate,
      note: mc.note,
      leg_id: mc.legId || undefined,
    });

    const vLegs: TransportLeg[] = legs.map((leg) => ({
      ...leg,
      charges: (chargesByLeg[leg.id] || []).map(mapCharge),
    }));

    const vGlobal = (chargesByLeg['combined'] || []).map(mapCharge);

    return { vizLegs: vLegs, vizGlobalCharges: vGlobal };
  }, [legs, chargesByLeg]);

  // Render a charge table for a given set of charges
  const renderChargeTable = (charges: ManagedCharge[], legId: string | null) => (
    <div className="space-y-2">
      {charges.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground text-xs">
                <th className="text-left p-2 font-medium">Category</th>
                <th className="text-left p-2 font-medium">Basis</th>
                <th className="text-left p-2 font-medium">Unit</th>
                <th className="text-left p-2 font-medium">Currency</th>
                <th className="text-right p-2 font-medium">Buy Qty</th>
                <th className="text-right p-2 font-medium">Buy Rate</th>
                <th className="text-right p-2 font-medium">Buy Amt</th>
                <th className="text-center p-2 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {charges.map((charge) => (
                <ChargeRow
                  key={charge.id}
                  charge={charge}
                  categories={refData.chargeCategories}
                  bases={refData.chargeBases}
                  currencies={refData.currencies}
                  onUpdate={(field, value) => updateCharge(charge.id, field, value)}
                  onRemove={() => removeCharge(charge.id)}
                  onConfigureBasis={() => {/* BasisConfigModal integration deferred */}}
                  showBuySell={true}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground text-sm">
          No charges yet. Click "Add Charge" to start.
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => addCharge(legId)}
        className="mt-1"
      >
        <Plus className="w-3 h-3 mr-1" /> Add Charge
      </Button>
    </div>
  );

  return (
    <Card className="border-primary/20" data-testid="finalize-section">
      <CardHeader className="cursor-pointer" onClick={(e) => {
        // Prevent collapsing when clicking input or buttons
        if ((e.target as HTMLElement).closest('.no-collapse')) return;
        setExpanded(!expanded);
      }}>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Finalize Quote — 
            {isEditingName ? (
              <div className="flex items-center gap-1 no-collapse" onClick={(e) => e.stopPropagation()}>
                <Input 
                  value={tempName} 
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  className="h-7 w-[200px] text-sm"
                  autoFocus
                />
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleNameSave}>
                  <Check className="w-4 h-4 text-green-600" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setIsEditingName(false); setTempName(selectedCarrier); }}>
                  <X className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <span>{selectedCarrier || 'Selected Option'}</span>
                {onRenameOption && selectedOption.is_manual && (
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 w-6 p-0 opacity-50 group-hover:opacity-100 transition-opacity no-collapse"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditingName(true);
                    }}
                  >
                    <Pencil className="w-3 h-3 text-muted-foreground" />
                  </Button>
                )}
              </div>
            )}
          </span>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">{formatCurrency(totals.totalSell, selectedOption.currency || 'USD')}</Badge>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </CardTitle>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-6">
          {/* Leg Management (Manual Mode Only) */}
          {selectedOption.is_manual && (
            <>
              <LegManager legs={legs} onChange={setLegs} />
              <Separator />
            </>
          )}

          {/* Option Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Carrier</span>
              <p className="font-medium">{selectedCarrier}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Transit</span>
              <p className="font-medium">{selectedOption.transitTime || 'N/A'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Mode</span>
              <p className="font-medium capitalize">{selectedOption.transport_mode || 'N/A'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Tier</span>
              <p className="font-medium capitalize">{selectedOption.tier || 'standard'}</p>
            </div>
          </div>

          <Separator />

          {/* Dynamic Charge Configuration Panel */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4" /> Cost & Charge Configuration
              </h4>
              {/* Add Charge Button (Global) */}
               <Button size="sm" variant="outline" onClick={() => addCharge(null)} className="h-7 text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Global Charge
               </Button>
            </div>

            <Tabs defaultValue={defaultTab} className="w-full">
               <div className="flex items-center gap-2 overflow-x-auto pb-2">
                 <TabsList className="flex h-auto p-1 bg-muted/50 rounded-lg">
                    {/* Render tabs for each leg */}
                    {legs.map((leg, idx) => (
                      <TabsTrigger 
                        key={leg.id} 
                        value={leg.id}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                      >
                         {getModeIcon(leg.mode)}
                         <div className="flex flex-col items-start text-left leading-tight">
                            <span className="font-medium">Leg {idx + 1}</span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                              {leg.origin} → {leg.destination}
                            </span>
                         </div>
                         <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                            {(chargesByLeg[leg.id] || []).length}
                         </Badge>
                      </TabsTrigger>
                    ))}

                    {/* Combined/Global Tab */}
                    {(hasCombined || legs.length === 0) && (
                      <TabsTrigger 
                        value="combined"
                        className="flex items-center gap-2 px-3 py-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                      >
                         <Package className="w-3.5 h-3.5" />
                         <div className="flex flex-col items-start text-left leading-tight">
                            <span className="font-medium">Global</span>
                            <span className="text-[10px] text-muted-foreground">General Charges</span>
                         </div>
                         <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                            {(chargesByLeg['combined'] || []).length}
                         </Badge>
                      </TabsTrigger>
                    )}
                 </TabsList>
               </div>

               {/* Tab Contents */}
               {legs.map((leg) => (
                 <TabsContent key={leg.id} value={leg.id} className="mt-4 space-y-4 animate-in fade-in-50 duration-200">
                    <div className="flex items-center justify-between bg-muted/30 p-2 rounded-md border">
                       <div className="flex items-center gap-3">
                          <Badge variant="outline" className="uppercase bg-background">{leg.mode}</Badge>
                          <span className="text-sm font-medium">{leg.origin} <ArrowRight className="w-3 h-3 inline mx-1" /> {leg.destination}</span>
                       </div>
                       <Button size="sm" variant="secondary" onClick={() => addCharge(leg.id)} className="h-7 text-xs">
                          <Plus className="w-3 h-3 mr-1" /> Add Charge
                       </Button>
                    </div>

                    {/* Ocean Leg Carrier Comparison (Only for Manual Ocean Legs) */}
                    {leg.mode === 'ocean' && selectedOption.is_manual && (
                       <CarrierComparisonPanel leg={leg} />
                    )}

                    {/* Charge Table */}
                    <Card>
                      <CardContent className="p-0">
                         {renderChargeTable(chargesByLeg[leg.id] || [], leg.id)}
                      </CardContent>
                    </Card>
                 </TabsContent>
               ))}

               {/* Global/Combined Content */}
               {(hasCombined || legs.length === 0) && (
                 <TabsContent value="combined" className="mt-4 space-y-4 animate-in fade-in-50 duration-200">
                    <div className="flex items-center justify-between bg-muted/30 p-2 rounded-md border">
                       <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Global / General Charges</span>
                       </div>
                       <Button size="sm" variant="secondary" onClick={() => addCharge(null)} className="h-7 text-xs">
                          <Plus className="w-3 h-3 mr-1" /> Add Charge
                       </Button>
                    </div>
                    <Card>
                      <CardContent className="p-0">
                         {renderChargeTable(chargesByLeg['combined'] || [], null)}
                      </CardContent>
                    </Card>
                 </TabsContent>
               )}
            </Tabs>
          </div>

          {/* Charge Analysis Visualization */}
          {allCharges.length > 0 && (
            <Collapsible open={showAnalysis} onOpenChange={setShowAnalysis}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full" data-testid="toggle-analysis">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  {showAnalysis ? 'Hide' : 'Show'} Charge Analysis
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4" data-testid="charge-analysis">
                  <ChargesAnalysisGraph
                    legs={vizLegs}
                    globalCharges={vizGlobalCharges}
                    currency={selectedOption.currency || 'USD'}
                    onSegmentClick={(type, value) => setActiveFilter({ type, value })}
                  />
                  <ChargeBreakdown
                    legs={vizLegs}
                    globalCharges={vizGlobalCharges}
                    currency={selectedOption.currency || 'USD'}
                    activeFilter={activeFilter}
                    onClearFilter={() => setActiveFilter(null)}
                    enableAdvancedFeatures={false}
                    containerHeight="400px"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          <Separator />

          {/* Margin Controls */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Margin</Label>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Auto-Margin</Label>
                <Switch checked={autoMargin} onCheckedChange={setAutoMargin} />
              </div>
            </div>
            {autoMargin && (
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  value={marginPercent}
                  onChange={(e) => setMarginPercent(Number(e.target.value))}
                  className="w-24 h-8 text-sm"
                  min={0}
                  max={100}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            )}
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Sell Price</span>
                <p className="font-semibold">{formatCurrency(totals.totalSell, selectedOption.currency || 'USD')}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Buy Price</span>
                <p className="font-semibold">{formatCurrency(totals.totalBuy, selectedOption.currency || 'USD')}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Margin</span>
                <p className="font-semibold text-green-600">{formatCurrency(totals.marginAmount, selectedOption.currency || 'USD')}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Customer Notes */}
          <div className="space-y-2">
            <Label className="text-sm">Customer Notes</Label>
            <Textarea
              {...form.register('notes')}
              placeholder="Additional notes for the customer..."
              rows={3}
              className="text-sm"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} className="flex-1" disabled={saving} data-testid="save-quote-btn">
              {saving ? (
                <><Save className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" /> Save Quote</>
              )}
            </Button>
            {onGeneratePdf && (
              <Button type="button" variant="outline" onClick={onGeneratePdf} disabled={saving}>
                <FileText className="w-4 h-4 mr-1" /> Generate PDF
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
