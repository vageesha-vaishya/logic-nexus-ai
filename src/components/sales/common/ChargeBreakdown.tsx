import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronRight, Truck, Ship, Plane, Info, DollarSign, Download, Printer, FileText, ArrowUpDown, Search, Filter, LayoutList, ListTree, Globe, ArrowRight, AlertTriangle, Pencil, Trash, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportExcel } from "@/lib/import-export";

import { bifurcateCharges } from '@/lib/charge-bifurcation';
import { Charge, TransportLeg } from '@/types/quote-breakdown';

interface ChargeBreakdownProps {
    legs: TransportLeg[];
    globalCharges?: Charge[];
    currency?: string;
    className?: string;
    enableAdvancedFeatures?: boolean;
    activeFilter?: { type: 'category' | 'mode' | 'leg', value: string } | null;
    onClearFilter?: () => void;
    onEditCharge?: (charge: Charge) => void;
    onDeleteCharge?: (chargeId: string) => void;
    onAddCharge?: () => void;
    containerHeight?: string;
}

type SortField = 'category' | 'description' | 'amount' | 'mode' | 'leg' | 'rate_reference';
type SortOrder = 'asc' | 'desc';

export function ChargeBreakdown({ 
    legs, 
    globalCharges = [], 
    currency = 'USD', 
    className, 
    enableAdvancedFeatures = true,
    activeFilter,
    onClearFilter,
    onEditCharge,
    onDeleteCharge,
    onAddCharge,
    containerHeight
}: ChargeBreakdownProps) {
    const [viewMode, setViewMode] = useState<'list' | 'grouped'>('list');
    const [expandedLegs, setExpandedLegs] = useState<Record<string, boolean>>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [sortField, setSortField] = useState<SortField>('amount');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    // Sync expanded state with new legs
    useEffect(() => {
        const newState: Record<string, boolean> = {};
        legs.forEach(leg => newState[leg.id] = true);
        setExpandedLegs(prev => ({ ...newState, ...prev }));
    }, [legs]);

    const toggleLeg = (legId: string) => {
        setExpandedLegs(prev => ({ ...prev, [legId]: !(prev[legId] ?? true) }));
    };

    const toggleAll = (expand: boolean) => {
        const newState: Record<string, boolean> = {};
        legs.forEach(leg => newState[leg.id] = expand);
        setExpandedLegs(newState);
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('desc'); // Default to desc for amounts usually
        }
    };

    const getModeIcon = (mode: string) => {
        const m = (mode || '').toLowerCase();
        if (m.includes('sea') || m.includes('ocean')) return <Ship className="h-4 w-4" />;
        if (m.includes('air')) return <Plane className="h-4 w-4" />;
        if (m.includes('rail') || m.includes('train')) return <Train className="h-4 w-4" />;
        return <Truck className="h-4 w-4" />;
    };

    const formatCurrency = (amount: any, curr: string = currency) => {
        const val = Number(amount);
        if (!Number.isFinite(val)) return '-';
        try {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: curr }).format(val);
        } catch (e) {
            return `${curr} ${val.toFixed(2)}`;
        }
    };

    // Calculate Totals by Currency
    const totalsByCurrency = useMemo(() => {
        const totals: Record<string, number> = {};
        
        const add = (amount: number, curr: string = currency) => {
            totals[curr] = (totals[curr] || 0) + amount;
        };

        legs.forEach(leg => {
            (leg.charges || []).forEach(c => add(c.amount || 0, c.currency));
        });

        globalCharges.forEach(c => add(c.amount || 0, c.currency));

        return totals;
    }, [legs, globalCharges, currency]);

    const calculateLegTotal = (leg: TransportLeg) => {
        const legTotals: Record<string, number> = {};
        (leg.charges || []).forEach(c => {
            const curr = c.currency || currency;
            legTotals[curr] = (legTotals[curr] || 0) + (Number(c.amount) || 0);
        });
        return legTotals;
    };

    // Flatten charges using Bifurcation Logic
    const allCharges = useMemo(() => {
        // 1. Prepare raw list with implicit leg associations
        const rawCharges: Charge[] = [
            ...globalCharges,
            ...legs.flatMap(l => (l.charges || []).map(c => ({ ...c, leg_id: l.id })))
        ];

        // 2. Apply Bifurcation Logic
        const bifurcated = bifurcateCharges(rawCharges, legs);

        // 3. Map to UI Model
        return bifurcated.map(c => {
            const leg = c.assignedLegId ? legs.find(l => l.id === c.assignedLegId) : null;
            
            // Normalize legType for display and filtering
            // The DB constraint only allows 'transport' or 'service'.
            // However, bifurcation logic might return 'pickup', 'delivery', 'main' as roles.
            // We map these roles to display labels but keep the strict legType compliant.
            
            let strictLegType = c.assignedLegType;
            let displayRole = c.assignedLegType;

            // Map legacy/role values to strict schema types
            if (['pickup', 'delivery', 'main', 'origin', 'destination'].includes(c.assignedLegType?.toLowerCase() || '')) {
                displayRole = c.assignedLegType; // Keep role for display
                strictLegType = 'transport'; // Schema requires 'transport'
            } else if (c.assignedLegType === 'service') {
                strictLegType = 'service';
                displayRole = 'Service';
            } else {
                strictLegType = 'transport'; // Default to transport
                displayRole = 'Transport';
            }

            return {
                id: c.id || Math.random().toString(),
                type: c.assignedLegId ? 'Leg' : 'Global',
                mode: c.assignedMode || 'N/A',
                legInfo: leg ? `${leg.origin || 'Origin'} → ${leg.destination || 'Destination'}` : 'Global Charge',
                legType: strictLegType, // Strict schema value
                displayRole: displayRole, // Human-friendly role
                category: c.charge_categories?.name || c.category || (c.name?.toLowerCase().includes('freight') ? 'Freight' : 'General'),
                description: c.name || c.note || '-',
                basis: c.basis || 'Flat',
                rate: c.rate || 0,
                quantity: c.quantity || 1,
                amount: c.amount || 0,
                currency: c.currency || currency,
                rate_reference: c.rate_reference || '-',
                original: c,
                isBifurcated: c.isBifurcated
            };
        });
    }, [legs, globalCharges, currency]);

    // Filter and Sort Logic
    const filteredCharges = useMemo(() => {
        let result = [...allCharges];

        // 1. Apply Search Term
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(item => 
                item.category.toLowerCase().includes(lower) ||
                item.description.toLowerCase().includes(lower) ||
                item.mode.toLowerCase().includes(lower) ||
                item.legInfo.toLowerCase().includes(lower) ||
                item.rate_reference.toLowerCase().includes(lower)
            );
        }

        // 2. Apply Active Filter (from Pie Chart)
        if (activeFilter) {
            const { type, value } = activeFilter;
            result = result.filter(item => {
                if (type === 'category') return item.category === value;
                if (type === 'mode') {
                    if (value === 'Other') return !['Air', 'Ocean', 'Road', 'Rail'].some(m => item.mode.includes(m));
                    return item.mode.includes(value);
                }
                if (type === 'leg') {
                    // Match against displayRole (which captures 'pickup', 'delivery' etc.)
                    // or strictLegType
                    const role = (item.displayRole || '').toLowerCase();
                    const legType = (item.legType || '').toLowerCase();
                    
                    if (value === 'Origin' || value === 'Pickup') return role === 'origin' || role === 'pickup';
                    if (value === 'Destination' || value === 'Delivery') return role === 'destination' || role === 'delivery';
                    if (value === 'Main' || value === 'Transport') return role === 'main' || role === 'transport' || legType === 'transport';
                    
                    // Fallback for direct string match
                    return role.includes(value.toLowerCase().replace(' leg', ''));
                }
                return true;
            });
        }

        // 3. Apply Sorting
        result.sort((a, b) => {
            let valA: any = a[sortField as keyof typeof a];
            let valB: any = b[sortField as keyof typeof b];

            // Special handling for virtual sort fields
            if (sortField === 'leg') {
                 valA = `${a.displayRole || ''} ${a.legInfo}`;
                 valB = `${b.displayRole || ''} ${b.legInfo}`;
            }

            // Handle strings case-insensitively
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [allCharges, searchTerm, activeFilter, sortField, sortOrder]);

    const handleExport = () => {
        const rows = filteredCharges.map(c => ({
            Type: c.type,
            Mode: c.mode,
            'Leg Type': c.legType,
            'Leg Info': c.legInfo,
            Category: c.category,
            Description: c.description,
            Basis: c.basis,
            Rate: c.rate,
            Qty: c.quantity,
            Amount: c.amount,
            Currency: c.currency
        }));

        exportExcel('charge_breakdown.xlsx', ['Type', 'Mode', 'Leg Type', 'Leg Info', 'Category', 'Description', 'Basis', 'Rate', 'Qty', 'Amount', 'Currency'], rows);
    };

    const handlePrint = () => {
        window.print();
    };

    const hasActions = !!(onEditCharge || onDeleteCharge);

    return (
        <div className={cn("space-y-4 print:space-y-2", className)}>
            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center print:hidden bg-muted/20 p-3 rounded-lg border">
                <div className="flex flex-1 items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search charges..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 h-9 text-xs"
                        />
                    </div>
                    
                    {/* View Toggle */}
                    <div className="flex border rounded-md bg-background">
                        <Button 
                            variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                            size="sm" 
                            className="h-9 px-3 rounded-r-none"
                            onClick={() => setViewMode('list')}
                        >
                            <LayoutList className="h-4 w-4 mr-2" /> List
                        </Button>
                        <Separator orientation="vertical" className="h-9" />
                        <Button 
                            variant={viewMode === 'grouped' ? 'secondary' : 'ghost'} 
                            size="sm" 
                            className="h-9 px-3 rounded-l-none"
                            onClick={() => setViewMode('grouped')}
                        >
                            <ListTree className="h-4 w-4 mr-2" /> Grouped
                        </Button>
                    </div>
                </div>

                <div className="flex gap-2 w-full md:w-auto justify-end">
                    {onAddCharge && (
                        <Button size="sm" className="h-9 gap-1" onClick={onAddCharge}>
                            <Plus className="w-4 h-4" /> Add Charge
                        </Button>
                    )}
                    {activeFilter && (
                         <Badge variant="secondary" className="h-9 px-3 flex gap-2 items-center bg-primary/10 text-primary border-primary/20">
                            <Filter className="w-3 h-3" />
                            {activeFilter.type}: {activeFilter.value}
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-4 w-4 ml-1 hover:bg-transparent text-primary/70 hover:text-primary"
                                onClick={onClearFilter}
                            >
                                ×
                            </Button>
                        </Badge>
                    )}

                    {viewMode === 'grouped' && (
                        <>
                            <Button variant="ghost" size="sm" onClick={() => toggleAll(true)}>Expand All</Button>
                            <Button variant="ghost" size="sm" onClick={() => toggleAll(false)}>Collapse All</Button>
                        </>
                    )}
                    
                    {enableAdvancedFeatures ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-9">
                                    <Download className="w-4 h-4 mr-2" /> Export
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleExport}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    Export to Excel
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handlePrint}>
                                    <Printer className="mr-2 h-4 w-4" />
                                    Print / Save PDF
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <Button variant="outline" size="sm" onClick={handleExport}>
                            <Download className="w-4 h-4 mr-1" /> Export
                        </Button>
                    )}
                </div>
            </div>

            {/* List View (Detailed Table) */}
            {viewMode === 'list' && (
                <div 
                    className="border rounded-md overflow-auto bg-card scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 pb-2"
                    style={{ maxHeight: containerHeight }}
                >
                    <Table className="min-w-[800px]">
                        <TableHeader className="bg-muted sticky top-0 z-20 shadow-sm">
                            <TableRow>
                                <TableHead className="w-[180px] cursor-pointer hover:text-primary" onClick={() => handleSort('category')}>
                                    <span className="flex items-center gap-1">Category <ArrowUpDown className="h-3 w-3" /></span>
                                </TableHead>
                                <TableHead className="cursor-pointer hover:text-primary" onClick={() => handleSort('description')}>
                                    <span className="flex items-center gap-1">Description <ArrowUpDown className="h-3 w-3" /></span>
                                </TableHead>
                                <TableHead className="cursor-pointer hover:text-primary" onClick={() => handleSort('rate_reference')}>
                                    <span className="flex items-center gap-1">Rate Ref <ArrowUpDown className="h-3 w-3" /></span>
                                </TableHead>
                                <TableHead className="cursor-pointer hover:text-primary" onClick={() => handleSort('mode')}>
                                    <span className="flex items-center gap-1">Mode <ArrowUpDown className="h-3 w-3" /></span>
                                </TableHead>
                                <TableHead className="cursor-pointer hover:text-primary" onClick={() => handleSort('leg')}>
                                    <span className="flex items-center gap-1">Leg <ArrowUpDown className="h-3 w-3" /></span>
                                </TableHead>
                                <TableHead className="text-right">Basis</TableHead>
                                <TableHead className="text-right">Rate</TableHead>
                                <TableHead className="text-right">Qty</TableHead>
                                <TableHead 
                                    className={cn(
                                        "text-right cursor-pointer hover:text-primary",
                                        hasActions ? "sticky right-[80px] bg-background z-10 shadow-[-1px_0_0_0_rgba(0,0,0,0.1)]" : "sticky right-0 bg-background z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                                    )} 
                                    onClick={() => handleSort('amount')}
                                >
                                    <span className="flex items-center justify-end gap-1">Amount <ArrowUpDown className="h-3 w-3" /></span>
                                </TableHead>
                                {hasActions && <TableHead className="w-[80px] sticky right-0 bg-background z-10"></TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredCharges.length > 0 ? filteredCharges.map((item, idx) => (
                                <TableRow key={item.id + idx} className="hover:bg-muted/30">
                                    <TableCell className="font-medium text-xs">
                                        <div className="flex items-center gap-2">
                                            {item.type === 'Global' && <Globe className="w-3 h-3 text-blue-500" />}
                                            {item.category}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{item.description}</TableCell>
                                    <TableCell className="text-xs font-mono text-muted-foreground">{item.rate_reference}</TableCell>
                                    <TableCell className="text-xs">
                                        {item.mode !== 'N/A' && (
                                            <Badge variant="outline" className="font-normal text-[10px] px-1.5 py-0 h-5">
                                                {item.mode}
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        <div className="flex flex-col">
                                            <span className="font-medium">{item.displayRole ? item.displayRole.toUpperCase() : (item.legType !== 'Global' ? item.legType?.toUpperCase() : '-')}</span>
                                            <span className="text-[10px] text-muted-foreground truncate max-w-[150px]" title={item.legInfo}>
                                                {item.legInfo}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right text-xs">{item.basis}</TableCell>
                                    <TableCell className="text-right text-xs">
                                        {item.rate ? formatCurrency(item.rate, item.currency) : '-'}
                                    </TableCell>
                                    <TableCell className="text-right text-xs">{item.quantity}</TableCell>
                                    <TableCell className={cn(
                                        "text-right text-xs font-bold text-primary",
                                        hasActions ? "sticky right-[80px] bg-background z-10 shadow-[-1px_0_0_0_rgba(0,0,0,0.1)]" : "sticky right-0 bg-background z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                                    )}>
                                        {formatCurrency(item.amount, item.currency)}
                                    </TableCell>
                                    {hasActions && (
                                        <TableCell className="text-right sticky right-0 bg-background z-10">
                                            <div className="flex justify-end gap-1">
                                                {onEditCharge && (
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEditCharge(item.original)}>
                                                        <Pencil className="w-3 h-3" />
                                                    </Button>
                                                )}
                                                {onDeleteCharge && (
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => onDeleteCharge(item.id)}>
                                                        <Trash className="w-3 h-3" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    )}
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={(onEditCharge || onDeleteCharge) ? 10 : 9} className="h-24 text-center text-muted-foreground">
                                        No charges match your filters.
                                    </TableCell>
                                </TableRow>
                            )}
                            {filteredCharges.length > 0 && (
                                <TableRow className="bg-muted/50 hover:bg-muted/50 font-bold border-t-2">
                                    <TableCell colSpan={8} className="text-right text-xs uppercase tracking-wider text-muted-foreground">
                                        Total Amount ({currency})
                                    </TableCell>
                                    <TableCell className={cn(
                                        "text-right text-sm text-primary",
                                        hasActions ? "sticky right-[80px] bg-muted/50 z-10 shadow-[-1px_0_0_0_rgba(0,0,0,0.1)]" : "sticky right-0 bg-muted/50 z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                                    )}>
                                        {formatCurrency(filteredCharges.reduce((sum, c) => sum + (c.amount || 0), 0), currency)}
                                    </TableCell>
                                    {hasActions && <TableCell className="sticky right-0 bg-muted/50 z-10" />}
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Grouped View (Detailed Hierarchical) */}
            {viewMode === 'grouped' && (
                <div 
                    className="space-y-4 overflow-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 pb-2 pr-2"
                    style={{ maxHeight: containerHeight }}
                >
                    {/* Global Charges Section */}
                    {(() => {
                        const globalChargesList = filteredCharges.filter(fc => fc.type === 'Global');
                        if (globalChargesList.length > 0) {
                            const isExpanded = expandedLegs['global'] ?? true;
                            
                            // Calculate subtotal
                            const globalSubtotal: Record<string, number> = {};
                            globalChargesList.forEach(c => {
                                globalSubtotal[c.currency] = (globalSubtotal[c.currency] || 0) + c.amount;
                            });
                            const globalTotalDisplay = Object.entries(globalSubtotal)
                                .map(([curr, amt]) => formatCurrency(amt, curr))
                                .join(' + ');

                            return (
                                <div key="global-charges" className="border rounded-lg overflow-hidden transition-all duration-200 shadow-sm print:break-inside-avoid">
                                    <div 
                                        className={cn(
                                            "flex items-center justify-between p-3 cursor-pointer transition-colors",
                                            isExpanded ? "bg-muted/50 border-b" : "bg-card hover:bg-muted/30"
                                        )}
                                        onClick={() => toggleLeg('global')}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={cn("transition-transform duration-200", isExpanded && "rotate-90")}>
                                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-primary/10 rounded-md text-primary">
                                                    <Globe className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold">Global / General Charges</div>
                                                    <div className="text-xs text-muted-foreground mt-0.5">Applicable to entire shipment</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-muted-foreground mb-0.5">Subtotal</div>
                                            <div className="font-bold text-sm text-primary">
                                                {globalTotalDisplay || formatCurrency(0)}
                                            </div>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="bg-card">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="hover:bg-transparent border-b-muted bg-muted/20">
                                                        <TableHead className="w-[200px] h-9 text-xs font-semibold pl-12">Category</TableHead>
                                                        <TableHead className="h-9 text-xs font-semibold">Description</TableHead>
                                                        <TableHead className="h-9 text-xs font-semibold text-right">Basis</TableHead>
                                                        <TableHead className="h-9 text-xs font-semibold text-right">Rate</TableHead>
                                                        <TableHead className="h-9 text-xs font-semibold text-right">Qty</TableHead>
                                                        <TableHead className="h-9 text-xs font-semibold text-right pr-6">Amount</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {globalChargesList.map((item, cIdx) => (
                                                        <TableRow key={item.id || cIdx} className="hover:bg-muted/30 border-b-muted/50 last:border-0">
                                                            <TableCell className="py-2.5 text-xs font-medium pl-12">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                                                                    {item.category}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="py-2.5 text-xs text-muted-foreground">{item.description}</TableCell>
                                                            <TableCell className="py-2.5 text-xs text-right">{item.basis}</TableCell>
                                                            <TableCell className="py-2.5 text-xs text-right text-muted-foreground">{item.rate ? formatCurrency(item.rate, item.currency) : '-'}</TableCell>
                                                            <TableCell className="py-2.5 text-xs text-right text-muted-foreground">{item.quantity}</TableCell>
                                                            <TableCell className="py-2.5 text-xs font-bold text-right pr-6 text-foreground">{formatCurrency(item.amount, item.currency)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </div>
                            );
                        }
                        return null;
                    })()}

                    {/* Render Legs that have matching charges */}
                    {legs.map((leg, index) => {
                        // Check if leg has any charges in filteredCharges
                        // We match by assignedLegId which is set by the bifurcation logic
                        const legCharges = filteredCharges.filter(fc => 
                            fc.type === 'Leg' && 
                            String(fc.original.assignedLegId) === String(leg.id)
                        );
                        
                        // Also check if leg itself matches filter if we were to show empty legs (optional, but let's stick to showing where charges exist)
                        if (legCharges.length === 0 && activeFilter) return null;

                        const isExpanded = expandedLegs[leg.id] ?? true;
                        
                        // Calculate subtotal based on DISPLAYED charges (filtered)
                        const legSubtotalByCurrency: Record<string, number> = {};
                        legCharges.forEach(c => {
                            legSubtotalByCurrency[c.currency] = (legSubtotalByCurrency[c.currency] || 0) + c.amount;
                        });
                        
                        const legTotalDisplay = Object.entries(legSubtotalByCurrency)
                            .map(([curr, amt]) => formatCurrency(amt, curr))
                            .join(' + ');

                        // Calculate total charges for this leg from source (for comparison/debug)
                        const rawLegTotal = (leg.charges || []).reduce((sum, c) => sum + (c.amount || 0), 0);
                        const hasHiddenCharges = rawLegTotal > 0 && legCharges.length === 0 && !activeFilter;

                        return (
                            <div key={leg.id} className="border rounded-lg overflow-hidden transition-all duration-200 shadow-sm print:break-inside-avoid">
                                <div 
                                    data-testid={`leg-header-${leg.id}`}
                                    className={cn(
                                        "flex items-center justify-between p-3 cursor-pointer transition-colors",
                                        isExpanded ? "bg-muted/50 border-b" : "bg-card hover:bg-muted/30"
                                    )}
                                    onClick={() => toggleLeg(leg.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={cn("transition-transform duration-200", isExpanded && "rotate-90")}>
                                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-primary/10 rounded-md text-primary">
                                                {getModeIcon(leg.mode)}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold flex items-center gap-2">
                                                    {leg.mode}
                                                    <Badge variant="secondary" className="text-[10px] px-2 h-5 font-medium">
                                                        {leg.leg_type?.toUpperCase() || 'LEG'} {leg.sequence || index + 1}
                                                    </Badge>
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                                    <span className="font-medium text-foreground">{leg.origin || 'Origin'}</span> 
                                                    <ArrowRight className="w-3 h-3" /> 
                                                    <span className="font-medium text-foreground">{leg.destination || 'Destination'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="text-right">
                                        <div className="text-xs text-muted-foreground mb-0.5">Subtotal</div>
                                        <div className="font-bold text-sm text-primary">
                                            {legTotalDisplay || formatCurrency(0)}
                                        </div>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="bg-card">
                                        {legCharges.length > 0 ? (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="hover:bg-transparent border-b-muted bg-muted/20">
                                                        <TableHead className="w-[200px] h-9 text-xs font-semibold pl-12">Category</TableHead>
                                                        <TableHead className="h-9 text-xs font-semibold">Description</TableHead>
                                                        <TableHead className="h-9 text-xs font-semibold text-right">Basis</TableHead>
                                                        <TableHead className="h-9 text-xs font-semibold text-right">Rate</TableHead>
                                                        <TableHead className="h-9 text-xs font-semibold text-right">Qty</TableHead>
                                                        <TableHead className="h-9 text-xs font-semibold text-right pr-6">Amount</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {legCharges.map((item, cIdx) => (
                                                        <TableRow key={item.id || cIdx} className="hover:bg-muted/30 border-b-muted/50 last:border-0">
                                                            <TableCell className="py-2.5 text-xs font-medium pl-12">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                                                                    {item.category}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="py-2.5 text-xs text-muted-foreground">
                                                                {item.description}
                                                            </TableCell>
                                                            <TableCell className="py-2.5 text-xs text-right">
                                                                {item.basis}
                                                            </TableCell>
                                                            <TableCell className="py-2.5 text-xs text-right text-muted-foreground">
                                                                {item.rate ? formatCurrency(item.rate, item.currency) : '-'}
                                                            </TableCell>
                                                            <TableCell className="py-2.5 text-xs text-right text-muted-foreground">
                                                                {item.quantity}
                                                            </TableCell>
                                                            <TableCell className="py-2.5 text-xs font-bold text-right pr-6 text-foreground">
                                                                {formatCurrency(item.amount, item.currency)}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                    {/* Optional: Leg Summary Row inside table */}
                                                    <TableRow className="bg-muted/10 font-medium">
                                                        <TableCell colSpan={5} className="text-right text-xs py-2">Total {leg.mode} Charges:</TableCell>
                                                        <TableCell className="text-right text-xs py-2 pr-6 font-bold">{legTotalDisplay}</TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        ) : (
                                            <div className="py-6 text-xs text-muted-foreground italic text-center flex flex-col gap-2 items-center">
                                                {hasHiddenCharges ? (
                                                    <>
                                                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                                        <span className="text-yellow-600">
                                                            Charges exist ({formatCurrency(rawLegTotal)}) but are not linked to this leg view.
                                                        </span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Filter className="w-4 h-4 opacity-50" />
                                                        No charges match the current filter for this leg.
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Unassigned Charges Section (Safety Net) */}
                    {(() => {
                        const assignedLegIds = new Set(legs.map(l => String(l.id)));
                        const unassignedCharges = filteredCharges.filter(fc => 
                            fc.type === 'Leg' && 
                            fc.original.assignedLegId && 
                            !assignedLegIds.has(String(fc.original.assignedLegId))
                        );
                        
                        if (unassignedCharges.length > 0) {
                            const isExpanded = expandedLegs['unassigned'] ?? true;
                            
                            // Calculate subtotal
                            const unassignedSubtotal: Record<string, number> = {};
                            unassignedCharges.forEach(c => {
                                unassignedSubtotal[c.currency] = (unassignedSubtotal[c.currency] || 0) + c.amount;
                            });
                            const unassignedTotalDisplay = Object.entries(unassignedSubtotal)
                                .map(([curr, amt]) => formatCurrency(amt, curr))
                                .join(' + ');

                            return (
                                <div key="unassigned-charges" className="border rounded-lg overflow-hidden transition-all duration-200 shadow-sm print:break-inside-avoid border-yellow-200 bg-yellow-50/30">
                                    <div 
                                        className={cn(
                                            "flex items-center justify-between p-3 cursor-pointer transition-colors",
                                            isExpanded ? "bg-muted/50 border-b" : "bg-card hover:bg-muted/30"
                                        )}
                                        onClick={() => toggleLeg('unassigned')}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={cn("transition-transform duration-200", isExpanded && "rotate-90")}>
                                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-yellow-100 rounded-md text-yellow-700">
                                                    <AlertTriangle className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-yellow-800">Unassigned / Mismatched Charges</div>
                                                    <div className="text-xs text-yellow-600 mt-0.5">Charges with invalid leg assignments</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-muted-foreground mb-0.5">Subtotal</div>
                                            <div className="font-bold text-sm text-primary">
                                                {unassignedTotalDisplay || formatCurrency(0)}
                                            </div>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="bg-card">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="hover:bg-transparent border-b-muted bg-muted/20">
                                                        <TableHead className="w-[200px] h-9 text-xs font-semibold pl-12">Category</TableHead>
                                                        <TableHead className="h-9 text-xs font-semibold">Description</TableHead>
                                                        <TableHead className="h-9 text-xs font-semibold text-right">Basis</TableHead>
                                                        <TableHead className="h-9 text-xs font-semibold text-right">Rate</TableHead>
                                                        <TableHead className="h-9 text-xs font-semibold text-right">Qty</TableHead>
                                                        <TableHead className="h-9 text-xs font-semibold text-right pr-6">Amount</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {unassignedCharges.map((item, cIdx) => (
                                                        <TableRow key={item.id || cIdx} className="hover:bg-muted/30 border-b-muted/50 last:border-0">
                                                            <TableCell className="py-2.5 text-xs font-medium pl-12">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                                                                    {item.category}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="py-2.5 text-xs text-muted-foreground">{item.description}</TableCell>
                                                            <TableCell className="py-2.5 text-xs text-right">{item.basis}</TableCell>
                                                            <TableCell className="py-2.5 text-xs text-right text-muted-foreground">{item.rate ? formatCurrency(item.rate, item.currency) : '-'}</TableCell>
                                                            <TableCell className="py-2.5 text-xs text-right text-muted-foreground">{item.quantity}</TableCell>
                                                            <TableCell className="py-2.5 text-xs font-bold text-right pr-6 text-foreground">{formatCurrency(item.amount, item.currency)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </div>
                            );
                        }
                        return null;
                    })()}
                </div>
            )}

            {/* Grand Total Footer */}
            <div className="bg-primary/5 p-4 flex justify-between items-center border-t border-primary/10 rounded-md print:bg-transparent print:border-t-2 print:border-black">
                <div className="flex flex-col">
                    <span className="font-bold text-lg">Total Estimated Cost</span>
                    {filteredCharges.length !== allCharges.length && (
                        <span className="text-xs text-muted-foreground">(Filtered View)</span>
                    )}
                </div>
                <div className="flex flex-col items-end">
                    {Object.entries(totalsByCurrency).map(([curr, amount]) => (
                        <span key={curr} className="font-bold text-xl text-primary print:text-black">
                            {formatCurrency(amount, curr)}
                        </span>
                    ))}
                    {Object.keys(totalsByCurrency).length === 0 && (
                        <span className="font-bold text-xl text-primary">
                            {formatCurrency(0, currency)}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
