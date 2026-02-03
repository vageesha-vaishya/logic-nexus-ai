import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    Truck, Ship, Plane, AlertTriangle, ShieldCheck, FileText, Globe, 
    Clock, MapPin, DollarSign, BarChart3, Layers, CheckCircle2, Download, Printer, FileSpreadsheet, Loader2, ArrowRight
} from "lucide-react";
import { QuoteLegsVisualizer } from './QuoteLegsVisualizer';
import { QuoteMapVisualizer } from './QuoteMapVisualizer';
import { ChargeBreakdown } from '../common/ChargeBreakdown';
import { ChargesAnalysisGraph } from '../common/ChargesAnalysisGraph';
import { cn } from "@/lib/utils";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/components/ui/use-toast";

import { Button } from "@/components/ui/button";

interface QuoteDetailViewProps {
    quote: any; // Ideally typed
    onClose?: () => void;
    compact?: boolean;
    defaultAnalysisView?: 'category' | 'mode' | 'leg';
}

export function QuoteDetailView({ quote, compact = false, defaultAnalysisView = 'category' }: QuoteDetailViewProps) {
    const [activeFilter, setActiveFilter] = useState<{ type: 'category' | 'mode' | 'leg', value: string } | null>(null);
    const [isConverting, setIsConverting] = useState(false);
    const { toast } = useToast();

    if (!quote) return null;

    const handleConvertToShipment = async () => {
        try {
            setIsConverting(true);
            const { data: shipmentId, error } = await supabase.rpc('create_shipment_from_quote', {
                p_quote_id: quote.id,
                p_tenant_id: quote.tenant_id
            });

            if (error) throw error;

            toast({
                title: "Success",
                description: "Quote converted to shipment successfully.",
            });
            
            // Redirect to shipment detail
            if (shipmentId) {
                navigate(`/dashboard/shipments/${shipmentId}`);
            }
        } catch (error: any) {
            console.error('Conversion error:', error);
            toast({
                title: "Error",
                description: error.message || "Failed to convert quote to shipment",
                variant: "destructive"
            });
        } finally {
            setIsConverting(false);
        }
    };

    // Extract global charges if they exist directly on the quote but not in legs
    const globalCharges = quote.charges || [];

    const handleSegmentClick = (type: 'category' | 'mode' | 'leg', value: string) => {
        // If clicking the same filter, toggle it off
        if (activeFilter?.type === type && activeFilter?.value === value) {
            setActiveFilter(null);
        } else {
            setActiveFilter({ type, value });
            // Scroll to breakdown
            const element = document.getElementById('charge-breakdown-section');
            if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
            }
        }
    };

    const handleExportCSV = () => {
        if (!quote) return;
        
        const headers = ['Category', 'Description', 'Amount', 'Currency'];
        const rows: (string | number)[][] = [];
        
        // Add legs charges
        quote.legs?.forEach((leg: any, index: number) => {
            leg.charges?.forEach((charge: any) => {
                rows.push([
                    `Leg ${index + 1} - ${leg.type || 'Transport'}`,
                    `"${charge.description}"`,
                    charge.amount,
                    charge.currency
                ]);
            });
        });
        
        // Add global charges
        quote.charges?.forEach((charge: any) => {
             rows.push([
                'Global Charge',
                `"${charge.description}"`,
                charge.amount,
                charge.currency
            ]);
        });

        // Add Total
        if (quote.price_breakdown?.total) {
            rows.push([
                'TOTAL',
                'Total Price',
                quote.price_breakdown.total,
                quote.price_breakdown.currency
            ]);
        }
        
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `quote_details_${quote.id || 'export'}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-2 border-b">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        {quote.transport_mode === 'Ocean - FCL' && <Ship className="w-6 h-6 text-blue-600" aria-hidden="true" />}
                        {quote.transport_mode === 'Air' && <Plane className="w-6 h-6 text-sky-600" aria-hidden="true" />}
                        {quote.transport_mode === 'Road' && <Truck className="w-6 h-6 text-orange-600" aria-hidden="true" />}
                        <h3 className="text-xl font-bold tracking-tight text-foreground">{quote.carrier?.name}</h3>
                        <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold ml-2">
                            {quote.tier}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" /> {quote.transit_time?.details}
                        </span>
                        <span className="flex items-center gap-1">
                            <ShieldCheck className={cn("w-4 h-4", quote.reliability?.score > 8 ? "text-green-600" : "text-amber-600")} />
                            Score: {quote.reliability?.score}/10
                        </span>
                    </div>
                </div>

                <div className="text-left md:text-right space-y-1">
                    <div className="flex items-center md:justify-end gap-2 mb-1">
                        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-muted-foreground hover:text-primary" onClick={() => window.print()}>
                            <Printer className="w-3 h-3" /> Print
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-muted-foreground hover:text-primary" onClick={handleExportCSV}>
                            <FileSpreadsheet className="w-3 h-3" /> Export CSV
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 text-xs gap-1 text-muted-foreground hover:text-primary" 
                            onClick={handleConvertToShipment}
                            disabled={isConverting}
                        >
                            {isConverting ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                            Convert to Shipment
                        </Button>
                    </div>
                    <div className="text-3xl font-bold text-primary tracking-tight">
                        {quote.price_breakdown?.currency} {quote.price_breakdown?.total?.toLocaleString()}
                    </div>
                    {(quote.buyPrice !== undefined || quote.marginAmount !== undefined) && (
                        <div className="flex items-center md:justify-end gap-3 text-xs opacity-90">
                            {quote.marginAmount !== undefined && (
                                <span className="text-green-600 font-medium flex items-center gap-1">
                                    Margin: +{quote.price_breakdown?.currency} {quote.marginAmount.toLocaleString()}
                                    {quote.markupPercent !== undefined && (
                                        <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-green-100 text-green-800 hover:bg-green-100">
                                            {quote.markupPercent}%
                                        </Badge>
                                    )}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Tabs Layout */}
            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4 lg:w-[600px] mb-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="route">Route & Map</TabsTrigger>
                    <TabsTrigger value="costs">Cost Analysis</TabsTrigger>
                    <TabsTrigger value="compliance">Compliance</TabsTrigger>
                </TabsList>

                {/* 1. Overview Tab */}
                <TabsContent value="overview" className="space-y-4 focus-visible:outline-none focus-visible:ring-0">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Quick Stats */}
                        <Card className="md:col-span-3 bg-muted/20 border-none shadow-none">
                            <CardContent className="p-4 flex flex-wrap gap-6 justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 text-blue-700 rounded-full">
                                        <Layers className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground font-medium uppercase">Service Type</p>
                                        <p className="text-sm font-semibold">{quote.service_type || 'Standard'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-100 text-green-700 rounded-full">
                                        <Globe className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground font-medium uppercase">CO2 Emissions</p>
                                        <p className="text-sm font-semibold">{quote.environmental?.co2_emissions || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-100 text-purple-700 rounded-full">
                                        <CheckCircle2 className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground font-medium uppercase">Valid Until</p>
                                        <p className="text-sm font-semibold">{quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : '30 Days'}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Route Preview */}
                        <Card className="md:col-span-3">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-muted-foreground" /> Route Sequence
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <QuoteLegsVisualizer legs={quote.legs || []} />
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* 2. Route Tab */}
                <TabsContent value="route" className="space-y-4 focus-visible:outline-none focus-visible:ring-0">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-primary" />
                                Full Route Visualization
                            </CardTitle>
                            <CardDescription>
                                Detailed breakdown of shipment legs, transit modes, and transfer points.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <QuoteLegsVisualizer legs={quote.legs || []} />
                            
                            <QuoteMapVisualizer 
                                origin={quote.legs?.[0]?.origin || "Origin"} 
                                destination={quote.legs?.[quote.legs?.length - 1]?.destination || "Destination"}
                                legs={quote.legs || []}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 3. Cost Analysis Tab */}
                <TabsContent value="costs" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
                    <div className={cn("grid grid-cols-1 gap-6 items-start", !compact && "lg:grid-cols-3")}>
                        {/* Graph */}
                        <Card className={cn("col-span-1", !compact && "lg:col-span-1")}>
                            <CardHeader>
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4" /> Cost Distribution
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="min-h-[300px]">
                                    <ChargesAnalysisGraph 
                                        legs={quote.legs || []} 
                                        globalCharges={globalCharges} 
                                        currency={quote.price_breakdown?.currency || 'USD'} 
                                        onSegmentClick={handleSegmentClick}
                                        defaultViewMode={defaultAnalysisView}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Detailed Table */}
                        <Card id="charge-breakdown-section" className={cn("col-span-1", !compact && "lg:col-span-2", activeFilter ? "ring-2 ring-primary" : "")}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    Detailed Charges
                                </CardTitle>
                                {activeFilter && (
                                    <Badge variant="secondary" className="text-xs font-normal cursor-pointer hover:bg-secondary/80" onClick={() => setActiveFilter(null)}>
                                        Filtered by {activeFilter.type}: {activeFilter.value} (Clear)
                                    </Badge>
                                )}
                            </CardHeader>
                            <CardContent>
                                <ChargeBreakdown 
                                    legs={quote.legs || []} 
                                    globalCharges={globalCharges}
                                    currency={quote.price_breakdown?.currency || 'USD'}
                                    activeFilter={activeFilter}
                                    onClearFilter={() => setActiveFilter(null)}
                                    className="border-0 shadow-none"
                                    containerHeight="400px"
                                />
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* 4. Compliance Tab */}
                <TabsContent value="compliance" className="space-y-4 focus-visible:outline-none focus-visible:ring-0">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-green-600"/> Compliance & Regulations
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {quote.regulatory_info?.customs_procedures?.length > 0 ? (
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Required Procedures</h4>
                                        <ul className="space-y-2">
                                            {quote.regulatory_info.customs_procedures.map((proc: string, i: number) => (
                                                <li key={i} className="text-sm flex items-start gap-2 bg-blue-50/50 p-2 rounded-md border border-blue-100">
                                                    <FileText className="w-4 h-4 text-blue-500 mt-0.5 shrink-0"/> 
                                                    <span className="text-blue-900">{proc}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : (
                                    <div className="text-sm text-muted-foreground italic">No specific customs procedures listed.</div>
                                )}
                                
                                {quote.regulatory_info?.restrictions?.length > 0 ? (
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold uppercase text-red-500 tracking-wider flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3"/> Restrictions
                                        </h4>
                                        <ul className="space-y-2">
                                            {quote.regulatory_info.restrictions.map((res: string, i: number) => (
                                                <li key={i} className="text-sm text-red-700 bg-red-50 p-2 rounded-md border border-red-100 flex items-start gap-2">
                                                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0"/>
                                                    <span>{res}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : (
                                    <div className="text-sm text-muted-foreground italic flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-green-500" /> No known restrictions.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <div className="text-center pt-6 pb-2">
                <a href="#" className="text-xs text-muted-foreground hover:text-primary hover:underline flex items-center justify-center gap-1 transition-colors">
                    <FileText className="w-3 h-3" />
                    Terms & Conditions apply to this quote
                </a>
            </div>
        </div>
    );
}
