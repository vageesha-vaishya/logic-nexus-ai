import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Train, Ship, Plane, Truck } from 'lucide-react';

interface VendorPreferredCarriersProps {
  vendorId: string;
}

interface PreferredCarrier {
  carrier_id: string;
  carrier_name: string;
  scac: string | null;
  iata: string | null;
  mode: string;
  is_preferred: boolean;
}

export function VendorPreferredCarriers({ vendorId }: VendorPreferredCarriersProps) {
  const [carriers, setCarriers] = useState<PreferredCarrier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCarriers() {
      try {
        setLoading(true);
        // Using any cast for RPC as types might be outdated
        const { data, error } = await supabase.rpc('get_vendor_preferred_carriers', {
          p_vendor_id: vendorId
        } as any);

        if (error) throw error;
        setCarriers((data as any) || []);
      } catch (err) {
        console.error('Failed to fetch preferred carriers:', err);
      } finally {
        setLoading(false);
      }
    }

    if (vendorId) {
      fetchCarriers();
    }
  }, [vendorId]);

  const grouped = carriers.reduce((acc, curr) => {
    const m = curr.mode || 'other';
    if (!acc[m]) acc[m] = [];
    // Simple client-side dedupe by carrier_id
    if (!acc[m].find(c => c.carrier_id === curr.carrier_id)) {
      acc[m].push(curr);
    }
    return acc;
  }, {} as Record<string, PreferredCarrier[]>);

  const getIcon = (mode: string) => {
    switch (mode) {
      case 'ocean': return <Ship className="h-4 w-4" />;
      case 'air': return <Plane className="h-4 w-4" />;
      case 'rail': return <Train className="h-4 w-4" />;
      case 'road': return <Truck className="h-4 w-4" />;
      default: return <Truck className="h-4 w-4" />;
    }
  };

  if (loading) return <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>;

  if (carriers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Preferred Carriers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No preferred carriers assigned.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([mode, items]) => (
        <Card key={mode}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              {getIcon(mode)}
              <CardTitle className="text-sm font-medium capitalize">{mode} Carriers</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {items.map(c => (
                <Badge key={c.carrier_id} variant="secondary" className="flex items-center gap-1">
                  {c.carrier_name}
                  {c.scac && <span className="text-xs opacity-70">({c.scac})</span>}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
