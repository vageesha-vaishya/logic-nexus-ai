import React, { useMemo, useState } from 'react';
import { 
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransportLeg, Charge } from '@/types/quote-breakdown';
import { Truck, Ship, Plane, Train, Box, Info } from "lucide-react";
import { bifurcateCharges } from '@/lib/charge-bifurcation';

interface ChargesAnalysisGraphProps {
    legs: TransportLeg[];
    globalCharges?: Charge[];
    currency: string;
    onSegmentClick?: (type: 'category' | 'mode' | 'leg', value: string) => void;
}

const COLORS = {
    Freight: '#2563eb', // blue-600
    Surcharge: '#f59e0b', // amber-500
    Fee: '#10b981', // emerald-500
    Tax: '#ef4444', // red-500
    Adjustment: '#8b5cf6', // violet-500
    Other: '#94a3b8', // slate-400
    // Modes
    Ocean: '#0ea5e9', // sky-500
    Air: '#8b5cf6', // violet-500
    Road: '#f59e0b', // amber-500
    Rail: '#10b981', // emerald-500
    // Legs
    Origin: '#f59e0b', // amber-500
    Pickup: '#f59e0b',
    Main: '#2563eb', // blue-600
    Transport: '#2563eb',
    Destination: '#10b981', // emerald-500
    Delivery: '#10b981',
};

export function ChargesAnalysisGraph({ legs, globalCharges = [], currency, onSegmentClick }: ChargesAnalysisGraphProps) {
    const [viewMode, setViewMode] = useState<'category' | 'mode' | 'leg'>('category');

    // Aggregate Data for Pie Chart
    const data = useMemo(() => {
        const totals: Record<string, number> = {};
        
        // 1. Prepare raw list
        const rawCharges: Charge[] = [
            ...globalCharges,
            ...legs.flatMap(l => (l.charges || []).map(c => ({ ...c, leg_id: l.id })))
        ];

        // 2. Apply Bifurcation Logic
        const bifurcated = bifurcateCharges(rawCharges, legs);

        // 3. Aggregate
        bifurcated.forEach(c => {
            let key = 'Other';
            if (viewMode === 'category') {
                key = c.charge_categories?.name || c.category || 'Other';
            } else if (viewMode === 'mode') {
                key = c.assignedMode || 'Other';
                // Capitalize
                key = key.charAt(0).toUpperCase() + key.slice(1);
            } else if (viewMode === 'leg') {
                const legType = c.assignedLegType || 'General';
                // Capitalize
                key = legType.charAt(0).toUpperCase() + legType.slice(1);
                // Group synonyms
                if (key === 'Transport') key = 'Main';
            }
            totals[key] = (totals[key] || 0) + c.amount;
        });

        return Object.entries(totals)
            .filter(([_, value]) => value > 0)
            .map(([name, value]) => ({ 
                name, 
                value,
                // Map to color key
                color: (COLORS as any)[name] || (COLORS as any)[Object.keys(COLORS).find(k => name.includes(k)) || 'Other'] || COLORS.Other
            }))
            .sort((a, b) => b.value - a.value);
    }, [legs, globalCharges, viewMode]);

    const handlePieClick = (entry: any) => {
        if (onSegmentClick && entry) {
            onSegmentClick(viewMode, entry.name);
        }
    };

    const totalAmount = data.reduce((sum, item) => sum + item.value, 0);

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const item = payload[0].payload;
            const percent = ((item.value / totalAmount) * 100).toFixed(1);
            return (
                <div className="bg-popover border border-border p-3 rounded-lg shadow-lg">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-semibold text-sm">{item.name}</span>
                    </div>
                    <div className="text-2xl font-bold text-primary">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(item.value)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                        {percent}% of total
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <Card className="w-full h-full flex flex-col shadow-sm border-t-4 border-t-primary/20">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg font-bold">Cost Breakdown Analysis</CardTitle>
                        <CardDescription>Distribution of charges by {viewMode}</CardDescription>
                    </div>
                    <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-auto">
                        <TabsList className="grid w-full grid-cols-3 h-8">
                            <TabsTrigger value="category" className="text-xs px-3">Category</TabsTrigger>
                            <TabsTrigger value="mode" className="text-xs px-3">Mode</TabsTrigger>
                            <TabsTrigger value="leg" className="text-xs px-3">Leg</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-4 flex flex-col">
                <div className="flex-1 min-h-[300px] w-full relative flex flex-col">
                    {data.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 0, right: 0, bottom: 20, left: 0 }}>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="45%"
                                    innerRadius="55%"
                                    outerRadius="80%"
                                    paddingAngle={3}
                                    dataKey="value"
                                    onClick={handlePieClick}
                                    cursor="pointer"
                                    stroke="none"
                                >
                                    {data.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={entry.color} 
                                            className="hover:opacity-80 transition-opacity outline-none focus:outline-none"
                                        />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend 
                                    layout="horizontal" 
                                    verticalAlign="bottom" 
                                    align="center"
                                    wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }}
                                    formatter={(value, entry: any) => (
                                        <span className="text-foreground font-medium ml-1 mr-3 cursor-pointer hover:text-primary transition-colors" onClick={() => handlePieClick({ name: value })}>{value}</span>
                                    )}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground text-sm flex-col gap-2">
                            <div className="p-3 bg-muted rounded-full">
                                <Box className="w-6 h-6 text-muted-foreground/50" />
                            </div>
                            No charge data available
                        </div>
                    )}
                    
                    {/* Center Text (Total) - Adjusted for new layout */}
                    {data.length > 0 && (
                        <div className="absolute top-[45%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Total {viewMode}</div>
                            <div className="text-xl font-bold text-primary">
                                {new Intl.NumberFormat('en-US', { 
                                    style: 'currency', 
                                    currency,
                                    maximumSignificantDigits: 3
                                }).format(totalAmount)}
                            </div>
                        </div>
                    )}
                </div>
                <div className="text-center mt-4 text-xs text-muted-foreground italic flex items-center justify-center gap-1.5">
                    <Info className="w-3 h-3" />
                    Click on a chart segment or legend item to filter the detailed breakdown below
                </div>
            </CardContent>
        </Card>
    );
}
