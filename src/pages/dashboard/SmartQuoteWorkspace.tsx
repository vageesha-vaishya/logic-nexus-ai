import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Package, Sparkles, Plane, Ship, Truck, Train } from 'lucide-react';
import { useContainerRefs } from '@/hooks/useContainerRefs';
import { LocationAutocomplete } from '@/components/common/LocationAutocomplete';
import { SharedCargoInput } from '@/components/quotation/shared/SharedCargoInput';
import { CargoItem } from '@/types/cargo';

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

export default function SmartQuoteWorkspace() {
  const navigate = useNavigate();
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
            </form>
          </div>
          <div className="flex-1 p-6 bg-background border rounded-lg overflow-y-auto">
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <Package className="w-12 h-12 mb-4 opacity-20" />
              <p>Fill out the form to generate quotes</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
