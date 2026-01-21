import React from 'react';
import { Truck, Ship, Plane, ArrowRight, Warehouse, MapPin } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Leg {
    from: string;
    to: string;
    mode: 'road' | 'ocean' | 'air' | 'rail';
    carrier?: string;
    transit_time?: string;
}

interface QuoteLegsVisualizerProps {
    legs: Leg[];
}

export function QuoteLegsVisualizer({ legs }: QuoteLegsVisualizerProps) {
    if (!legs || legs.length === 0) return null;

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
        <div className="flex items-center gap-2 mt-3 overflow-x-auto p-2 bg-muted/20 rounded-md">
            {legs.map((leg, index) => (
                <div key={index} className="flex items-center shrink-0">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex flex-col items-center gap-1 cursor-help group">
                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                        <MapPin className="w-3 h-3" />
                                        <span className="max-w-[80px] truncate">{leg.from}</span>
                                    </div>
                                    <div className="h-0.5 w-16 bg-gray-300 relative group-hover:bg-primary transition-colors">
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background p-1 rounded-full border border-border group-hover:border-primary">
                                            {getIcon(leg.mode)}
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">{leg.transit_time}</div>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="text-xs">
                                    <p className="font-semibold">{leg.mode.toUpperCase()}</p>
                                    <p>From: {leg.from}</p>
                                    <p>To: {leg.to}</p>
                                    <p>Carrier: {leg.carrier || 'N/A'}</p>
                                    <p>Time: {leg.transit_time}</p>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {index < legs.length - 1 && (
                        <ArrowRight className="w-3 h-3 text-gray-400 mx-1" />
                    )}
                    
                    {/* Render final destination for the last leg */}
                    {index === legs.length - 1 && (
                        <>
                             <ArrowRight className="w-3 h-3 text-gray-400 mx-1" />
                             <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <Warehouse className="w-3 h-3" />
                                    <span className="max-w-[80px] truncate">{leg.to}</span>
                                </div>
                             </div>
                        </>
                    )}
                </div>
            ))}
        </div>
    );
}
