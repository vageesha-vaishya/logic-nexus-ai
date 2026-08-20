import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, Package, Sparkles, Plane, Ship, Truck, Train } from 'lucide-react';
import { useContainerRefs } from '@/hooks/useContainerRefs';
import { useRateFetching } from '@/hooks/useRateFetching';
import { LocationAutocomplete } from '@/components/common/LocationAutocomplete';
import { SharedCargoInput } from '@/components/quotation/shared/SharedCargoInput';
import { QuoteResultsList } from '@/components/quotation/shared/QuoteResultsList';
import { QuoteComparisonView } from '@/components/quotation/shared/QuoteComparisonView';
import { QuickQuoteHistory } from '@/components/quotation/shared/QuickQuoteHistory';
import { CargoItem } from '@/types/cargo';
import { QuoteTransferSchema } from '@/lib/schemas/quote-transfer';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import type { RateOption } from '@/types/quote-breakdown';

const smartQuoteFormSchema = z.object({
  mode: z.enum(['air', 'ocean', 'road', 'rail']),
  origin: z.string().min(2, 'Origin is required'),
  destination: z.string().min(2, 'Destination is required'),
});

type SmartQuoteFormValues = z.infer<typeof smartQuoteFormSchema>;

const INITIAL_CARGO_ITEM: CargoItem = {
  id: '1',
  type: 'container',
  quantity: 1,
  dimensions: { l: 0, w: 0, h: 0, unit: 'cm' },
  weight: { value: 0, unit: 'kg' },
  stackable: false,
  containerDetails: { typeId: '', sizeId: '' },
};

function formatCommodityDisplay(commodity?: { description?: string; hts_code?: string }): string {
  if (!commodity) return '';
  const description = (commodity.description || '').trim();
  const htsCode = (commodity.hts_code || '').trim();
  if (description && htsCode) return `${description} - ${htsCode}`;
  return description || htsCode;
}

function deriveSharedPayload(
  values: SmartQuoteFormValues,
  cargoItem: CargoItem,
  originDetails: any,
  destinationDetails: any
) {
  const containerCombos =
    cargoItem.type === 'container'
      ? (cargoItem.containerCombos && cargoItem.containerCombos.length > 0
          ? cargoItem.containerCombos.map((c) => ({ type: c.typeId, size: c.sizeId, qty: c.quantity }))
          : cargoItem.containerDetails?.typeId && cargoItem.containerDetails?.sizeId
            ? [{ type: cargoItem.containerDetails.typeId, size: cargoItem.containerDetails.sizeId, qty: cargoItem.quantity }]
            : [])
      : [];

  return {
    mode: values.mode,
    origin: values.origin,
    destination: values.destination,
    commodity: formatCommodityDisplay(cargoItem.commodity),
    commodity_description: cargoItem.commodity?.description || '',
    htsCode: cargoItem.commodity?.hts_code || '',
    weight: String(cargoItem.weight.value || 0),
    volume: String(cargoItem.volume || 0),
    containerType: containerCombos[0]?.type || '',
    containerSize: containerCombos[0]?.size || '',
    containerQty: String(containerCombos[0]?.qty || cargoItem.quantity || 1),
    containerCombos,
    dangerousGoods: !!cargoItem.hazmat,
    originDetails,
    destinationDetails,
  };
}

export default function SmartQuoteWorkspace() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { containerTypes, containerSizes } = useContainerRefs();
  const [smartMode, setSmartMode] = useState(true);
  const [cargoItem, setCargoItem] = useState<CargoItem>(INITIAL_CARGO_ITEM);
  const [originDetails, setOriginDetails] = useState<any>(null);
  const [destinationDetails, setDestinationDetails] = useState<any>(null);

  const form = useForm<SmartQuoteFormValues>({
    resolver: zodResolver(smartQuoteFormSchema),
    defaultValues: { mode: 'ocean' },
  });
  const mode = form.watch('mode');

  const containerResolver = useMemo(() => ({
    resolveContainerInfo: (typeId: string, sizeId: string) => {
      const typeObj = containerTypes.find((t: any) => t.id === typeId);
      const sizeObj = containerSizes.find((s: any) => s.id === sizeId);
      return {
        type: typeObj?.code || typeObj?.name || typeId,
        size: sizeObj?.name || sizeId,
        iso_code: sizeObj?.iso_code,
      };
    },
  }), [containerTypes, containerSizes]);

  const rateFetching = useRateFetching();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'compare'>('list');

  const handleGenerate = form.handleSubmit(async (values) => {
    setSelectedIds([]);
    const shared = deriveSharedPayload(values, cargoItem, originDetails, destinationDetails);
    await rateFetching.fetchRates(
      { ...shared, smartMode, account_id: undefined } as any,
      containerResolver
    );
  });

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleConvertToQuote = (option: RateOption | RateOption[]) => {
    const selectedOptions = Array.isArray(option) ? option : [option];
    const values = form.getValues();
    const shared = deriveSharedPayload(values, cargoItem, originDetails, destinationDetails);
    const transferPayload = {
      ...shared,
      // deriveSharedPayload defaults these to `null` (from useState<any>(null)) when the user
      // never picked a location-autocomplete suggestion. QuoteTransferSchema's LocationDetailsSchema
      // is `.optional()` but not `.nullable()`, so normalize null -> undefined before validating.
      originDetails: shared.originDetails ?? undefined,
      destinationDetails: shared.destinationDetails ?? undefined,
      selectedRates: selectedOptions,
      marketAnalysis: rateFetching.marketAnalysis,
      confidenceScore: rateFetching.confidenceScore,
      anomalies: rateFetching.anomalies,
    };

    try {
      const validatedData = QuoteTransferSchema.parse(transferPayload);
      logger.info('Smart Quote hand-off to New Quote', {
        origin: validatedData.origin,
        destination: validatedData.destination,
        mode: validatedData.mode,
        optionsCount: validatedData.selectedRates.length,
      });
      navigate('/dashboard/quotes/new', {
        state: { ...validatedData, selectedRate: selectedOptions[0] },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join('\n');
        toast({ title: 'Data Validation Error', description: `Cannot proceed. Missing or invalid fields:\n${errorMessages}`, variant: 'destructive' });
      } else {
        toast({ title: 'Transfer Error', description: 'An unexpected error occurred preparing the quote.', variant: 'destructive' });
      }
    }
  };

  const handleConvertSelected = () => {
    if (!rateFetching.results) return;
    const selectedOptions = rateFetching.results.filter((r) => selectedIds.includes(r.id));
    if (selectedOptions.length > 0) handleConvertToQuote(selectedOptions);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-140px)] gap-6">
        <div className="flex-none flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/quotes/pipeline')} aria-label="Back to Quotes">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                Smart Quote
              </h1>
              <p className="text-sm text-muted-foreground">
                Generate instant quotes with AI-powered market analysis and route optimization.
              </p>
            </div>
          </div>
          <QuickQuoteHistory
            onSelect={(payload) => {
              navigate('/dashboard/quotes/new', { state: payload });
            }}
          />
        </div>

        <div className="flex flex-1 overflow-hidden gap-6">
          <div className="w-[400px] shrink-0 bg-muted/30 p-6 border rounded-lg overflow-y-auto">
            <form className="space-y-6">
              <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-950/30 p-3 rounded-md border border-purple-100 dark:border-purple-900">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-purple-900 dark:text-purple-200">Smart Quote Mode</span>
                    <span className="text-[10px] text-purple-600 dark:text-purple-400">AI-optimized routes & pricing</span>
                  </div>
                </div>
                <Switch checked={smartMode} onCheckedChange={setSmartMode} data-testid="smart-mode-switch" />
              </div>

              <div className="space-y-2">
                <Label>Transport Mode</Label>
                <Tabs value={mode} onValueChange={(v) => form.setValue('mode', v as SmartQuoteFormValues['mode'])} className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="ocean"><Ship className="w-4 h-4 mr-2" />Ocean</TabsTrigger>
                    <TabsTrigger value="air"><Plane className="w-4 h-4 mr-2" />Air</TabsTrigger>
                    <TabsTrigger value="road"><Truck className="w-4 h-4 mr-2" />Road</TabsTrigger>
                    <TabsTrigger value="rail"><Train className="w-4 h-4 mr-2" />Rail</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="space-y-2">
                <Label>Origin</Label>
                <LocationAutocomplete
                  value={form.watch('origin') || ''}
                  onChange={(value: string, location?: any) => {
                    form.setValue('origin', value);
                    if (location) {
                      setOriginDetails({
                        id: location.id,
                        name: location.location_name,
                        formatted_address: [location.city, location.country].filter(Boolean).join(', '),
                        code: location.location_code,
                      });
                    }
                  }}
                  placeholder="Origin port, airport, or city"
                />
              </div>

              <div className="space-y-2">
                <Label>Destination</Label>
                <LocationAutocomplete
                  value={form.watch('destination') || ''}
                  onChange={(value: string, location?: any) => {
                    form.setValue('destination', value);
                    if (location) {
                      setDestinationDetails({
                        id: location.id,
                        name: location.location_name,
                        formatted_address: [location.city, location.country].filter(Boolean).join(', '),
                        code: location.location_code,
                      });
                    }
                  }}
                  placeholder="Destination port, airport, or city"
                />
              </div>

              <SharedCargoInput
                value={cargoItem}
                onChange={setCargoItem}
              />

              <Button type="button" onClick={handleGenerate} disabled={rateFetching.loading} className="w-full">
                {rateFetching.loading ? 'Generating...' : 'Generate Smart Quotes'}
              </Button>
            </form>
          </div>
          <div className="flex-1 p-6 bg-background border rounded-lg overflow-y-auto">
            {!rateFetching.results ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <Package className="w-12 h-12 mb-4 opacity-20" />
                <p>Fill out the form to generate quotes</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">Rate Options</h3>
                    <Badge variant="outline" className="text-xs">{rateFetching.results.length} Options</Badge>
                  </div>
                  <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'list' | 'compare')} className="w-auto">
                    <TabsList className="h-8">
                      <TabsTrigger value="list" className="text-xs h-7 px-2">Browse</TabsTrigger>
                      <TabsTrigger value="compare" className="text-xs h-7 px-2">Compare</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                {viewMode === 'list' ? (
                  <QuoteResultsList
                    results={rateFetching.results}
                    onSelect={handleConvertToQuote}
                    selectedIds={selectedIds}
                    onToggleSelection={toggleSelection}
                    onGenerateSmartOptions={smartMode ? handleGenerate : undefined}
                    marketAnalysis={rateFetching.marketAnalysis}
                    confidenceScore={rateFetching.confidenceScore}
                    anomalies={rateFetching.anomalies}
                  />
                ) : (
                  <QuoteComparisonView
                    options={rateFetching.results}
                    onSelect={handleConvertToQuote}
                    selectedIds={selectedIds}
                    onToggleSelection={toggleSelection}
                    onGenerateSmartOptions={smartMode ? handleGenerate : undefined}
                  />
                )}
                {selectedIds.length > 0 && (
                  <div className="sticky bottom-0 left-0 right-0 p-4 bg-background border-t shadow-lg flex justify-between items-center">
                    <div className="text-sm font-medium">
                      <Badge variant="secondary" className="mr-2">{selectedIds.length}</Badge>
                      options selected
                    </div>
                    <Button onClick={handleConvertSelected} className="gap-2">
                      Create Quote with Selected <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
