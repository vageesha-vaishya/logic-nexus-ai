import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid 
} from 'recharts';
import { Truck, Ship, Plane, AlertTriangle, ShieldCheck, FileText, Globe } from "lucide-react";
import { QuoteLegsVisualizer } from './QuoteLegsVisualizer';

interface QuoteDetailViewProps {
    quote: any; // Ideally typed
    onClose?: () => void;
}

export function QuoteDetailView({ quote }: QuoteDetailViewProps) {
    if (!quote) return null;

    // Prepare Chart Data
    const priceData = [
        { name: 'Base Fare', value: quote.price_breakdown?.base_fare || 0 },
        { name: 'Surcharges', value: Object.values(quote.price_breakdown?.surcharges || {}).reduce((a: any, b: any) => a + b, 0) as number },
        { name: 'Fees', value: Object.values(quote.price_breakdown?.fees || {}).reduce((a: any, b: any) => a + b, 0) as number },
        { name: 'Taxes', value: quote.price_breakdown?.taxes || 0 },
    ].filter(d => d.value > 0);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

    return (
        <div className="space-y-6">
            {/* Header Summary */}
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        {quote.transport_mode === 'Ocean - FCL' && <Ship className="w-5 h-5 text-blue-600"/>}
                        {quote.transport_mode === 'Air' && <Plane className="w-5 h-5 text-sky-600"/>}
                        {quote.transport_mode === 'Road' && <Truck className="w-5 h-5 text-orange-600"/>}
                        {quote.carrier?.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">{quote.tier.toUpperCase()} Option • {quote.transit_time?.details}</p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                        {quote.price_breakdown?.currency} {quote.price_breakdown?.total?.toLocaleString()}
                    </div>
                    <Badge variant={quote.reliability?.score > 8 ? "default" : "secondary"}>
                        Reliability: {quote.reliability?.score}/10
                    </Badge>
                </div>
            </div>

            {/* Visualizer */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Route Visualization</CardTitle>
                </CardHeader>
                <CardContent>
                    <QuoteLegsVisualizer legs={quote.legs || []} />
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Cost Breakdown Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Cost Structure</CardTitle>
                    </CardHeader>
                    <CardContent className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={priceData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {priceData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Regulatory & Compliance */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4"/> Compliance & Regulations
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {quote.regulatory_info?.customs_procedures?.length > 0 && (
                            <div>
                                <h4 className="text-xs font-semibold mb-2 text-muted-foreground">REQUIRED PROCEDURES</h4>
                                <ul className="space-y-1">
                                    {quote.regulatory_info.customs_procedures.map((proc: string, i: number) => (
                                        <li key={i} className="text-xs flex items-center gap-2">
                                            <FileText className="w-3 h-3 text-blue-500"/> {proc}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        
                        <Separator />

                        {quote.regulatory_info?.restrictions?.length > 0 && (
                            <div>
                                <h4 className="text-xs font-semibold mb-2 text-red-500 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3"/> RESTRICTIONS
                                </h4>
                                <ul className="space-y-1">
                                    {quote.regulatory_info.restrictions.map((res: string, i: number) => (
                                        <li key={i} className="text-xs text-red-600 bg-red-50 p-1 rounded">
                                            {res}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                         {/* Environmental */}
                         <div className="pt-2">
                            <div className="flex justify-between items-center bg-green-50 p-2 rounded border border-green-100">
                                <span className="text-xs text-green-700 flex items-center gap-1">
                                    <Globe className="w-3 h-3"/> CO2 Emissions
                                </span>
                                <span className="text-xs font-bold text-green-800">{quote.environmental?.co2_emissions}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Charge Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Detailed Charge Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-sm space-y-2">
                        <div className="flex justify-between py-1 border-b">
                            <span>Base Freight</span>
                            <span className="font-medium">${quote.price_breakdown?.base_fare?.toLocaleString()}</span>
                        </div>
                        
                        {Object.entries(quote.price_breakdown?.surcharges || {}).map(([key, val]: [string, any]) => (
                            <div key={key} className="flex justify-between py-1 border-b border-dashed text-muted-foreground">
                                <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                                <span>${val}</span>
                            </div>
                        ))}

                        {Object.entries(quote.price_breakdown?.fees || {}).map(([key, val]: [string, any]) => (
                            <div key={key} className="flex justify-between py-1 border-b border-dashed text-muted-foreground">
                                <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                                <span>${val}</span>
                            </div>
                        ))}

                        <div className="flex justify-between py-2 font-bold text-lg">
                            <span>Total</span>
                            <span>${quote.price_breakdown?.total?.toLocaleString()}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
