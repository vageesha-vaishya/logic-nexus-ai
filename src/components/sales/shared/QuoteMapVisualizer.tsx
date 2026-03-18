import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info, MapPin, Plane, Ship, Train, Truck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type QuoteMapLegMode = 'ocean' | 'air' | 'road' | 'rail' | 'other';

interface QuoteMapLegInput {
  from?: string | null;
  to?: string | null;
  origin?: string | null;
  destination?: string | null;
  mode?: string | null;
  transit_time?: string | number | null;
  border_crossing?: boolean | null;
  carrier?: string | null;
}

interface QuoteMapVisualizerProps {
  origin: string;
  destination: string;
  legs: QuoteMapLegInput[];
}

export function QuoteMapVisualizer({ origin, destination, legs }: QuoteMapVisualizerProps) {
  const normalizedLegs = useMemo(() => {
    const toMode = (rawMode: string | null | undefined): QuoteMapLegMode => {
      const value = String(rawMode || '').toLowerCase();
      if (value.includes('ocean') || value.includes('sea')) return 'ocean';
      if (value.includes('air')) return 'air';
      if (value.includes('rail')) return 'rail';
      if (value.includes('road') || value.includes('truck')) return 'road';
      return 'other';
    };

    return legs.map((leg) => ({
      from: String(leg.from || leg.origin || 'Origin'),
      to: String(leg.to || leg.destination || 'Destination'),
      mode: toMode(leg.mode),
      transitTime: leg.transit_time ? String(leg.transit_time) : 'N/A',
      borderCrossing: Boolean(leg.border_crossing),
      carrier: leg.carrier ? String(leg.carrier) : 'N/A',
    }));
  }, [legs]);

  const modeCounts = useMemo(() => {
    return normalizedLegs.reduce(
      (acc, leg) => {
        if (leg.mode === 'ocean') acc.ocean += 1;
        if (leg.mode === 'air') acc.air += 1;
        if (leg.mode === 'road') acc.road += 1;
        if (leg.mode === 'rail') acc.rail += 1;
        return acc;
      },
      { ocean: 0, air: 0, road: 0, rail: 0 },
    );
  }, [normalizedLegs]);

  const iconForMode = (mode: QuoteMapLegMode) => {
    if (mode === 'ocean') return <Ship className="h-4 w-4 text-primary" />;
    if (mode === 'air') return <Plane className="h-4 w-4 text-primary" />;
    if (mode === 'rail') return <Train className="h-4 w-4 text-primary" />;
    return <Truck className="h-4 w-4 text-primary" />;
  };

  return (
    <Card className="w-full min-h-[300px] border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="space-y-1">
          <h4 className="flex items-center gap-2 text-xs font-semibold">
            <MapPin className="h-3 w-3 text-primary" />
            Route Visualization
          </h4>
          <p className="text-[10px] text-muted-foreground">
            {origin} → {destination}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="h-5 text-[10px]">{modeCounts.ocean} Ocean</Badge>
          <Badge variant="outline" className="h-5 text-[10px]">{modeCounts.air} Air</Badge>
          <Badge variant="outline" className="h-5 text-[10px]">{modeCounts.road} Road</Badge>
          <Badge variant="outline" className="h-5 text-[10px]">{modeCounts.rail} Rail</Badge>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center overflow-x-auto rounded-md border border-border bg-muted/20 px-3 py-6">
          <div className="flex items-center gap-3">
            <div className="flex min-w-[120px] flex-col items-center gap-1">
              <div className="h-4 w-4 rounded-full border-2 border-primary bg-background" />
              <span className="max-w-[120px] truncate text-xs font-medium">{origin}</span>
            </div>
            {normalizedLegs.map((leg, index) => (
              <React.Fragment key={`${leg.from}-${leg.to}-${index}`}>
                <div className="h-px w-8 bg-border" />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex min-w-[140px] cursor-default flex-col items-center gap-1 rounded-md border border-border bg-background px-3 py-2">
                        <span className="text-[10px] text-muted-foreground">{leg.from} → {leg.to}</span>
                        <span className="flex items-center gap-1 text-xs font-medium">
                          {iconForMode(leg.mode)}
                          {leg.mode.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{leg.transitTime}</span>
                        {leg.borderCrossing ? (
                          <Badge variant="destructive" className="h-4 px-1 text-[9px]">Customs</Badge>
                        ) : null}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1 text-xs">
                        <p><span className="text-muted-foreground">From:</span> {leg.from}</p>
                        <p><span className="text-muted-foreground">To:</span> {leg.to}</p>
                        <p><span className="text-muted-foreground">Carrier:</span> {leg.carrier}</p>
                        <p><span className="text-muted-foreground">Transit:</span> {leg.transitTime}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </React.Fragment>
            ))}
            <div className="h-px w-8 bg-border" />
            <div className="flex min-w-[120px] flex-col items-center gap-1">
              <div className="h-4 w-4 rounded-full border-2 border-primary bg-background" />
              <span className="max-w-[120px] truncate text-xs font-medium">{destination}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-1 px-4 pb-3 text-[10px] text-muted-foreground">
        <Info className="h-3 w-3" />
        Schematic View • Not to scale
      </div>
    </Card>
  );
}
