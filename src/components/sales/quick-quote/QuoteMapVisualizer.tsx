import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Plane, Ship, Truck, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface QuoteMapVisualizerProps {
    origin: string;
    destination: string;
    legs: any[];
}

export function QuoteMapVisualizer({ origin, destination, legs }: QuoteMapVisualizerProps) {
    // Helper to normalize leg data
    const normalizedLegs = legs.map(leg => ({
        ...leg,
        from: leg.from || leg.origin,
        to: leg.to || leg.destination,
        mode: (leg.mode || 'road').toLowerCase()
    }));

    // Simplified World Map SVG Path (Mercator-ish)
    // This is a very rough approximation for visual context
    const worldMapPath = "M50,50 L100,50 L100,100 L50,100 Z"; // Placeholder if I can't find a good path string quickly. 
    // Actually, let's use a schematic approach instead of a real geo-map if we don't have tiles.
    // Or we can use a static image background if we had one.
    
    // Better approach: "Schematic Route Map" 
    // We will draw a connection line with nodes on a canvas/SVG that looks like a transit map.

    return (
        <Card className="w-full h-[300px] bg-slate-50 relative overflow-hidden border-2 border-muted">
            <div className="absolute inset-0 bg-[url('https://upload.wikimedia.org/wikipedia/commons/8/80/World_map_-_low_resolution.svg')] bg-cover bg-center opacity-10 pointer-events-none" />
            
            <div className="absolute top-4 left-4 z-10 bg-white/90 p-2 rounded shadow-sm backdrop-blur-sm border">
                <h4 className="text-xs font-bold flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-red-500"/> Route Visualization
                </h4>
                <div className="text-[10px] text-muted-foreground mt-1">
                    {origin} ➔ {destination}
                </div>
                <div className="flex gap-2 mt-2">
                    <Badge variant="outline" className="text-[10px] h-5 bg-blue-50 text-blue-700 border-blue-200">
                        {normalizedLegs.filter(l => l.mode.includes('ocean')).length} Ocean
                    </Badge>
                    <Badge variant="outline" className="text-[10px] h-5 bg-sky-50 text-sky-700 border-sky-200">
                        {normalizedLegs.filter(l => l.mode.includes('air')).length} Air
                    </Badge>
                    <Badge variant="outline" className="text-[10px] h-5 bg-amber-50 text-amber-700 border-amber-200">
                        {normalizedLegs.filter(l => l.mode.includes('road')).length} Road
                    </Badge>
                </div>
            </div>

            {/* Visualization Layer */}
            <div className="w-full h-full flex items-center justify-center p-12">
                <div className="relative w-full max-w-3xl flex items-center justify-between">
                    {/* Connecting Line */}
                    <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -translate-y-1/2 z-0" />
                    
                    {/* Origin Node */}
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="w-4 h-4 rounded-full bg-white border-4 border-green-500 shadow-sm" />
                        <div className="absolute top-6 text-xs font-bold whitespace-nowrap bg-white/80 px-1 rounded">{origin}</div>
                    </div>

                    {/* Legs Nodes */}
                    {normalizedLegs.map((leg, i) => (
                        <div key={i} className="relative z-10 flex flex-col items-center group" style={{ left: `${((i + 1) / (normalizedLegs.length + 1)) * 100}%`, position: 'absolute' }}>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="w-8 h-8 rounded-full bg-white border-2 border-primary flex items-center justify-center shadow-sm cursor-pointer hover:scale-110 transition-transform">
                                            {leg.mode.includes('ocean') && <Ship className="w-4 h-4 text-blue-600" />}
                                            {leg.mode.includes('air') && <Plane className="w-4 h-4 text-sky-600" />}
                                            {leg.mode.includes('road') && <Truck className="w-4 h-4 text-amber-600" />}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <div className="text-xs">
                                            <p className="font-semibold">{leg.mode.toUpperCase()} Leg</p>
                                            <p>From: {leg.from}</p>
                                            <p>To: {leg.to}</p>
                                            <p>Duration: {leg.transit_time}</p>
                                            {leg.border_crossing && <Badge variant="destructive" className="text-[9px] h-4 mt-1">Customs Check</Badge>}
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            
                            {/* Border Crossing Indicator on the line */}
                            {leg.border_crossing && (
                                <div className="absolute -top-6 bg-red-100 text-red-600 text-[9px] px-1 rounded border border-red-200 font-bold whitespace-nowrap">
                                    BORDER
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Destination Node */}
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="w-4 h-4 rounded-full bg-white border-4 border-red-500 shadow-sm" />
                        <div className="absolute top-6 text-xs font-bold whitespace-nowrap bg-white/80 px-1 rounded">{destination}</div>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground flex items-center gap-1 bg-white/80 px-2 py-1 rounded">
                <Info className="w-3 h-3" />
                Schematic View • Not to scale
            </div>
        </Card>
    );
}
