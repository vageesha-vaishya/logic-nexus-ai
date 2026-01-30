import React from 'react';
import { Truck, Ship, Plane, ArrowRight, Warehouse, MapPin } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Leg {
    from?: string;
    to?: string;
    origin?: string;
    destination?: string;
    mode: 'road' | 'ocean' | 'air' | 'rail' | string;
    carrier?: string;
    transit_time?: string;
    border_crossing?: boolean;
}

interface QuoteLegsVisualizerProps {
    legs: Leg[];
}

export function QuoteLegsVisualizer({ legs }: QuoteLegsVisualizerProps) {
    if (!legs || legs.length === 0) return null;

    // Normalize legs to support both from/to and origin/destination
    const normalizedLegs = legs.map(leg => ({
        ...leg,
        from: leg.from || (leg as any).origin,
        to: leg.to || (leg as any).destination
    }));

    const getIcon = (mode: string) => {
        switch (mode) {
            case 'ocean': return <Ship className="w-4 h-4 text-blue-600" />;
            case 'air': return <Plane className="w-4 h-4 text-sky-600" />;
            case 'road': return <Truck className="w-4 h-4 text-amber-600" />;
            case 'rail': return <Truck className="w-4 h-4 text-orange-600" />; // Fallback icon
            default: return <ArrowRight className="w-4 h-4 text-gray-400" />;
        }
    };

    return (
        <div className="flex items-center gap-2 mt-3 overflow-x-auto p-4 bg-muted/20 rounded-md min-h-[100px]">
            {normalizedLegs.map((leg, index) => (
                <div key={index} className="flex items-center shrink-0">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex flex-col items-center gap-1 cursor-help group relative">
                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                                        <MapPin className="w-3 h-3 text-primary" />
                                        <span className="max-w-[100px] truncate">{leg.from}</span>
                                    </div>
                                    <div className="h-1 w-24 bg-gray-200 relative group-hover:bg-primary/20 transition-colors rounded-full my-2">
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background p-1.5 rounded-full border border-border group-hover:border-primary shadow-sm z-10">
                                            {getIcon(leg.mode)}
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">{leg.transit_time}</div>
                                    
                                    {leg.border_crossing && (
                                        <div className="absolute -top-2 right-0 bg-red-100 text-red-600 text-[9px] px-1 rounded border border-red-200">
                                            CUSTOMS
                                        </div>
                                    )}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="text-xs space-y-1">
                                    <p className="font-semibold text-primary border-b pb-1 mb-1">{leg.mode.toUpperCase()}</p>
                                    <p><span className="text-muted-foreground">From:</span> {leg.from}</p>
                                    <p><span className="text-muted-foreground">To:</span> {leg.to}</p>
                                    <p><span className="text-muted-foreground">Carrier:</span> {leg.carrier || 'N/A'}</p>
                                    <p><span className="text-muted-foreground">Time:</span> {leg.transit_time}</p>
                                    {leg.border_crossing && <p className="text-red-500 font-bold">⚠ Border Crossing</p>}
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {index < legs.length - 1 && (
                        <ArrowRight className="w-4 h-4 text-gray-300 mx-2" />
                    )}
                    
                    {/* Render final destination for the last leg */}
                    {index === legs.length - 1 && (
                        <>
                             <ArrowRight className="w-4 h-4 text-gray-300 mx-2" />
                             <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                                    <Warehouse className="w-3 h-3 text-green-600" />
                                    <span className="max-w-[100px] truncate">{leg.to}</span>
                                </div>
                             </div>
                        </>
                    )}
                </div>
            ))}
        </div>
    );
}
