import { useState, useMemo } from 'react';
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
import { Save, FileText, Plus, ChevronDown, ChevronUp, Ship, Plane, Truck, TrainFront, Package, BarChart3 } from 'lucide-react';
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FinalizeSection({
  selectedOption,
  onSaveQuote,
  onGeneratePdf,
  saving = false,
  referenceData,
}: FinalizeSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [notes, setNotes] = useState('');
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [activeFilter, setActiveFilter] = useState<{ type: 'category' | 'mode' | 'leg'; value: string } | null>(null);

  const refData = referenceData && referenceData.chargeCategories?.length > 0
    ? referenceData
    : DEFAULT_REF_DATA;

  const {
    legs,
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
    defaultMarginPercent: 15,
  });

  // Build tab keys: one per leg + combined
  const legTabKeys = legs.map((l) => l.id);
  const hasCombined = (chargesByLeg['combined']?.length || 0) > 0 || legs.length === 0;
  const defaultTab = legTabKeys[0] || 'combined';

  const handleSave = () => {
    const { charges: savableCharges, marginPercent: mp } = getChargesForSave();
    onSaveQuote(savableCharges, mp, notes);
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
      <CardHeader className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Finalize Quote — {selectedOption.carrier || 'Selected Option'}
          </span>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">{formatCurrency(totals.totalSell, selectedOption.currency || 'USD')}</Badge>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </CardTitle>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-6">
          {/* Option Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Carrier</span>
              <p className="font-medium">{selectedOption.carrier || 'N/A'}</p>
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

          {/* Per-Leg Charges Editor with Tabs */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Charges by Leg</h4>

            {legs.length > 0 ? (
              <Tabs defaultValue={defaultTab} className="w-full">
                <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-transparent p-0">
                  {legs.map((leg) => (
                    <TabsTrigger
                      key={leg.id}
                      value={leg.id}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md border"
                    >
                      {getModeIcon(leg.mode)}
                      <span className="truncate max-w-[120px]">
                        {leg.origin} → {leg.destination}
                      </span>
                      <Badge variant="outline" className="ml-1 h-4 px-1 text-[10px]">
                        {chargesByLeg[leg.id]?.length || 0}
                      </Badge>
                    </TabsTrigger>
                  ))}
                  {hasCombined && (
                    <TabsTrigger
                      value="combined"
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md border"
                    >
                      <Package className="w-3.5 h-3.5" />
                      Combined
                      <Badge variant="outline" className="ml-1 h-4 px-1 text-[10px]">
                        {chargesByLeg['combined']?.length || 0}
                      </Badge>
                    </TabsTrigger>
                  )}
                </TabsList>

                {legs.map((leg) => (
                  <TabsContent key={leg.id} value={leg.id} className="mt-3">
                    <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      {getModeIcon(leg.mode)}
                      <span className="capitalize">{leg.mode}</span> — {leg.origin} → {leg.destination}
                      {leg.carrier && <span className="ml-1">({leg.carrier})</span>}
                    </div>
                    {renderChargeTable(chargesByLeg[leg.id] || [], leg.id)}
                  </TabsContent>
                ))}

                {hasCombined && (
                  <TabsContent value="combined" className="mt-3">
                    <div className="text-xs text-muted-foreground mb-2">
                      Global charges not tied to a specific transport leg
                    </div>
                    {renderChargeTable(chargesByLeg['combined'] || [], null)}
                  </TabsContent>
                )}
              </Tabs>
            ) : (
              // No legs — single combined view
              <div>
                <div className="text-xs text-muted-foreground mb-2">
                  All charges
                </div>
                {renderChargeTable(allCharges, null)}
              </div>
            )}
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
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
