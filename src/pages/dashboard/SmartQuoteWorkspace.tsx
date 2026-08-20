import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, ArrowRight, Compass, Package, Sparkles, Plane, Ship, Truck, Train } from 'lucide-react';
import { useContainerRefs } from '@/hooks/useContainerRefs';
import { useRateFetching } from '@/hooks/useRateFetching';
import { LocationAutocomplete } from '@/components/common/LocationAutocomplete';
import { SharedCargoInput } from '@/components/quotation/shared/SharedCargoInput';
import { QuoteDetailView } from '@/components/quotation/shared/QuoteDetailView';
import { QuickQuoteHistory } from '@/components/quotation/shared/QuickQuoteHistory';
import { SmartQuoteRateCard } from '@/components/quotation/smart-quote/SmartQuoteRateCard';
import { ShipmentRecapStrip } from '@/components/quotation/smart-quote/ShipmentRecapStrip';
import { mapOptionToQuote } from '@/lib/quote-mapper';
import { CargoItem } from '@/types/cargo';
import { QuoteTransferSchema } from '@/lib/schemas/quote-transfer';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import type { RateOption } from '@/types/quote-breakdown';

// No .css suffix on these three (unlike the ibm-plex-* imports below): this package's
// installed exports map lacks a "./*.css" identity mapping, so "/600.css" fails to resolve —
// only the extension-less form works. See @fontsource/big-shoulders-display/package.json.
import '@fontsource/big-shoulders-display/600';
import '@fontsource/big-shoulders-display/700';
import '@fontsource/big-shoulders-display/800';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@/components/quotation/smart-quote/smart-quote-identity.css';

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

function summarizeCargo(cargoItem: CargoItem): string {
  if (cargoItem.type !== 'container') return cargoItem.commodity?.description || '';
  const combo = cargoItem.containerCombos?.[0];
  const typeId = combo?.typeId || cargoItem.containerDetails?.typeId;
  const sizeId = combo?.sizeId || cargoItem.containerDetails?.sizeId;
  const qty = combo?.quantity || cargoItem.quantity || 1;
  if (!typeId && !sizeId) return '';
  return `${qty} x ${[sizeId, typeId].filter(Boolean).join(' ')}`.trim();
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
  const [viewDetailsId, setViewDetailsId] = useState<string | null>(null);

  const form = useForm<SmartQuoteFormValues>({
    resolver: zodResolver(smartQuoteFormSchema),
    defaultValues: { mode: 'ocean' },
  });
  const mode = form.watch('mode');
  const origin = form.watch('origin') || '';
  const destination = form.watch('destination') || '';

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

  const handleGenerate = form.handleSubmit(
    async (values) => {
      setSelectedIds([]);
      const shared = deriveSharedPayload(values, cargoItem, originDetails, destinationDetails);
      await rateFetching.fetchRates(
        { ...shared, smartMode, account_id: undefined } as any,
        containerResolver
      );
    },
    (errors) => {
      // Without this callback a failed validation is completely silent — the Generate button just
      // does nothing. Surface the first message(s) so the user knows what to fix.
      const messages = Object.values(errors)
        .map((err: any) => err?.message)
        .filter((message): message is string => typeof message === 'string' && message.length > 0);
      toast({
        title: 'Missing shipment details',
        description: messages.length > 0 ? messages.join('\n') : 'Please complete the required fields before generating quotes.',
        variant: 'destructive',
      });
    }
  );

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
      // These three come straight off the edge-function response with no runtime guarantees. They are
      // cosmetic metadata, so coerce them to schema-safe fallbacks rather than let a malformed AI
      // response make QuoteTransferSchema.parse() throw and block the entire hand-off.
      marketAnalysis: typeof rateFetching.marketAnalysis === 'string' ? rateFetching.marketAnalysis : null,
      confidenceScore:
        typeof rateFetching.confidenceScore === 'number' && Number.isFinite(rateFetching.confidenceScore)
          ? rateFetching.confidenceScore
          : null,
      anomalies: Array.isArray(rateFetching.anomalies)
        ? rateFetching.anomalies.filter((anomaly): anomaly is string => typeof anomaly === 'string')
        : [],
    };

    try {
      const validatedData = QuoteTransferSchema.parse(transferPayload);
      logger.info('Smart Quote hand-off to New Quote', {
        origin: validatedData.origin,
        destination: validatedData.destination,
        mode: validatedData.mode,
        optionsCount: validatedData.selectedRates.length,
      });
      // IMPORTANT: navigate with the RAW selectedOptions, not validatedData.selectedRates.
      // QuoteTransferSchema is used purely as a validation gate here — Zod strips unknown keys, and
      // RateLegSchema has no `charges` key, so the parsed output silently loses every leg-level charge
      // array. The composer's flattenOptionCharges reads option.legs[].charges to build the charge grid
      // that gets persisted, so handing it the parsed copy would save degraded financials.
      navigate('/dashboard/quotes/new', {
        state: { ...validatedData, selectedRates: selectedOptions, selectedRate: selectedOptions[0] },
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

  const manualQuoteLabel = 'Manual Quotation';
  const viewDetailsOption = rateFetching.results?.find((r) => r.id === viewDetailsId) || null;

  return (
    <DashboardLayout>
      <div className="smart-quote-identity flex flex-col h-[calc(100vh-140px)] gap-4 transition-colors duration-300 p-4 rounded-lg">
        <Breadcrumb className="flex-none">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link to="/dashboard">Dashboard</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link to="/dashboard/quotes">Quotes</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>Smart Quote</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex-none flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/quotes/pipeline')} aria-label="Back to Quotes">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1
                className="text-2xl font-bold tracking-tight flex items-center gap-2"
                style={{ fontFamily: 'var(--sq-font-display)', color: 'var(--sq-ink)' }}
              >
                <Compass className="h-5 w-5" style={{ color: 'var(--sq-tide)' }} />
                Smart Quote
              </h1>
              <p className="text-sm" style={{ color: 'var(--sq-ink)', opacity: 0.65 }}>
                Generate instant quotes with AI-powered market analysis and route optimization.
              </p>
            </div>
          </div>
          <QuickQuoteHistory
            className="border-[color:var(--sq-border)] text-[color:var(--sq-ink)]"
            onSelect={(payload) => navigate('/dashboard/quotes/new', { state: payload })}
          />
        </div>

        <div className="flex flex-1 overflow-hidden gap-6">
          <div
            className="w-[400px] shrink-0 p-6 border rounded-lg overflow-y-auto"
            style={{ background: 'var(--sq-surface)', borderColor: 'var(--sq-border)' }}
          >
            {/* onSubmit is required: without it, pressing Enter in any input triggers a native form
                submission and a full page reload. handleGenerate is form.handleSubmit(...), which
                calls preventDefault() internally. */}
            <form className="space-y-6" onSubmit={handleGenerate}>
              <div
                className="flex items-center justify-between p-3 rounded-md border"
                style={{ background: 'color-mix(in srgb, var(--sq-tide) 10%, transparent)', borderColor: 'var(--sq-tide)' }}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: 'var(--sq-tide)' }} />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium" style={{ color: 'var(--sq-ink)' }}>Smart Quote Mode</span>
                    <span className="text-[10px]" style={{ color: 'var(--sq-tide)' }}>AI-optimized routes & pricing</span>
                  </div>
                </div>
                <Switch checked={smartMode} onCheckedChange={setSmartMode} data-testid="smart-mode-switch" />
              </div>

              <div className="space-y-2">
                <Label style={{ color: 'var(--sq-ink)' }}>Transport Mode</Label>
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
                <Label style={{ color: 'var(--sq-ink)' }}>Origin</Label>
                <LocationAutocomplete
                  value={origin}
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
                <Label style={{ color: 'var(--sq-ink)' }}>Destination</Label>
                <LocationAutocomplete
                  value={destination}
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

              <SharedCargoInput value={cargoItem} onChange={setCargoItem} />

              <ShipmentRecapStrip mode={mode} origin={origin} destination={destination} cargoSummary={summarizeCargo(cargoItem)} />

              <Button
                type="button"
                onClick={handleGenerate}
                disabled={rateFetching.loading}
                className="w-full"
                style={{ background: 'var(--sq-accent)', color: 'var(--sq-accent-ink)' }}
              >
                {rateFetching.loading ? 'Generating...' : 'Generate Smart Quotes'}
              </Button>
            </form>
          </div>

          <div
            className="flex-1 p-6 border rounded-lg overflow-y-auto"
            style={{ background: 'var(--sq-surface)', borderColor: 'var(--sq-border)' }}
          >
            {rateFetching.loading ? (
              <div
                className="h-full flex flex-col items-center justify-center gap-3"
                style={{ color: 'var(--sq-tide)' }}
                role="status"
                aria-live="polite"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full motion-safe:animate-pulse"
                  style={{ background: 'var(--sq-tide)' }}
                  aria-hidden="true"
                />
                <p>Ranking carriers on cost, transit time, and reliability&hellip;</p>
              </div>
            ) : rateFetching.error ? (
              <div className="h-full flex flex-col items-center justify-center gap-2" style={{ color: 'var(--sq-rust)' }} role="alert">
                <p className="font-medium">{rateFetching.error}</p>
                <p className="text-sm" style={{ opacity: 0.8 }}>Adjust the shipment details and try again.</p>
              </div>
            ) : !rateFetching.results ? (
              <div className="h-full flex flex-col items-center justify-center" style={{ color: 'var(--sq-ink)', opacity: 0.5 }}>
                <Package className="w-12 h-12 mb-4 opacity-20" />
                <p>Fill out the form to generate quotes</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg" style={{ fontFamily: 'var(--sq-font-display)', color: 'var(--sq-ink)' }}>
                      Rate Options
                    </h3>
                    <Badge variant="outline" className="text-xs">{rateFetching.results.length} Options</Badge>
                  </div>
                  {smartMode && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      style={{ borderColor: 'var(--sq-tide)', color: 'var(--sq-tide)' }}
                      onClick={handleGenerate}
                    >
                      <Sparkles className="h-3 w-3" />
                      Generate Smart Options
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  {rateFetching.results.map((option) => (
                    <SmartQuoteRateCard
                      key={option.id}
                      option={option}
                      isSelected={selectedIds.includes(option.id)}
                      onToggleSelection={() => toggleSelection(option.id)}
                      onSelect={() => handleConvertToQuote(option)}
                      onViewDetails={() => setViewDetailsId(option.id)}
                    />
                  ))}
                </div>

                {selectedIds.length > 0 && (
                  <div
                    className="sticky bottom-0 left-0 right-0 p-4 border-t shadow-lg flex justify-between items-center"
                    style={{ background: 'var(--sq-surface)', borderColor: 'var(--sq-border)' }}
                  >
                    <div className="text-sm font-medium" style={{ color: 'var(--sq-ink)' }}>
                      <Badge variant="secondary" className="mr-2">{selectedIds.length}</Badge>
                      options selected
                    </div>
                    <Button
                      onClick={handleConvertSelected}
                      className="gap-2"
                      style={{ background: 'var(--sq-accent)', color: 'var(--sq-accent-ink)' }}
                    >
                      Create Quote with Selected <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={!!viewDetailsOption} onOpenChange={(open) => !open && setViewDetailsId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewDetailsOption?.carrier || manualQuoteLabel}{viewDetailsOption?.name ? ` - ${viewDetailsOption.name}` : ''}</DialogTitle>
          </DialogHeader>
          {viewDetailsOption && (
            <div className="py-4">
              <QuoteDetailView
                quote={mapOptionToQuote(viewDetailsOption)}
                defaultAnalysisView={viewDetailsOption.source_attribution === 'AI Smart Engine' ? 'mode' : 'category'}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
