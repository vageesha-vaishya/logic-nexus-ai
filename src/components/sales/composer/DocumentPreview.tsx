import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Printer, FileText, Package, Box, Calculator } from 'lucide-react';
import { LandedCostService, LandedCostResult } from '@/services/quotation/LandedCostService';
import { supabase } from '@/integrations/supabase/client';
import { usePipelineInterceptor } from '@/components/debug/pipeline/usePipelineInterceptor';

interface DocumentPreviewProps {
  quoteData: any;
  legs: any[];
  combinedCharges?: any[];
  templateId?: string;
}

export function DocumentPreview({ quoteData, legs, combinedCharges = [], templateId }: DocumentPreviewProps) {
  const [landedCost, setLandedCost] = useState<LandedCostResult | null>(null);
  const [template, setTemplate] = useState<any>(null);

  // Pipeline Capture
  usePipelineInterceptor('PDFGen', { 
    quoteData, 
    legs, 
    combinedCharges, 
    templateId,
    landedCost 
  }, { 
    action: 'PreviewRender' 
  }, [quoteData, legs, combinedCharges, templateId, landedCost]);

  useEffect(() => {
    if (templateId) {
      const fetchTemplate = async () => {
        const { data } = await supabase
          .from('quote_templates')
          .select('content')
          .eq('id', templateId)
          .single();
        
        if (data?.content) {
            // Handle both string and object content
            const content = typeof data.content === 'string' 
                ? JSON.parse(data.content) 
                : data.content;
            setTemplate(content);
        }
      };
      fetchTemplate();
    } else {
        setTemplate(null);
    }
  }, [templateId]);

  // Helper to parse country code from destination string
  const getCountryCode = (destination: string): string => {
      if (!destination) return 'US';
      const dest = destination.trim().toUpperCase();
      
      // Exact 2-letter match
      if (dest.length === 2) return dest;
      
      // Ends with ", US" or " US"
      if (dest.endsWith(' US') || dest.endsWith(', US') || dest.endsWith(', USA')) return 'US';
      
      // Contains United States
      if (dest.includes('UNITED STATES')) return 'US';
      
      // Default fallback (can be improved with a lookup table later)
      return 'US'; 
  };

  useEffect(() => {
    const calculateCost = async () => {
        // Map items from quoteData to LandedCostItem format
        // Assuming quoteData.items exists (from QuoteLineItems)
        // If items are not present, we can't calculate
        if (quoteData?.items?.length) {
             const items = quoteData.items.map((item: any) => ({
                 hs_code: item.attributes?.hs_code,
                 value: Number(item.unit_price || 0) * Number(item.quantity || 1), 
                 quantity: Number(item.quantity || 1),
                 weight: Number(item.attributes?.weight || 0),
                 origin_country: quoteData.origin_country // Optional, defaults to NULL/World in DB if needed, or ignored
             })).filter((i: any) => i.hs_code);

             if (items.length > 0) {
                 // Parse country code from destination string or use port_id
                 let dest = 'US';
                 
                 if (quoteData.destination_port_id) {
                    const { data: port } = await supabase
                        .from('ports_locations')
                        .select('countries(code_iso2)')
                        .eq('id', quoteData.destination_port_id)
                        .single();
                    
                    // @ts-ignore - nested relationship query
                    if (port?.countries?.code_iso2) {
                        // @ts-ignore - TS doesn't know about the shape of countries relationship
                        dest = port.countries.code_iso2;
                    }
                } else {
                     dest = getCountryCode(quoteData.destination);
                 }

                 const result = await LandedCostService.calculate(items, dest);
                 setLandedCost(result);
             }
        }
    };
    calculateCost();
  }, [quoteData]);

  const handlePrint = () => {
    window.print();
  };

  const getSafeString = (val: any, fallback: string = '') => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') {
       return val.name || val.code || val.details || val.description || fallback;
    }
    return String(val);
  };

  const today = new Date().toLocaleDateString();

  const currency = quoteData.currency || 'USD';

  const renderSection = (type: string, props?: any) => {
      switch(type) {
          case 'customer_info':
              return (
                <div className="grid grid-cols-2 gap-12 mb-8">
                    <div>
                        <h3 className="text-xs font-bold uppercase text-slate-400 mb-2">Prepared For</h3>
                        <div className="text-sm font-medium">
                            <p className="font-bold text-lg">{quoteData.accounts?.name || getSafeString(quoteData.account_id, 'Client Name')}</p>
                            <p className="text-slate-500">
                                {quoteData.contacts 
                                    ? `${quoteData.contacts.first_name || ''} ${quoteData.contacts.last_name || ''}`.trim() 
                                    : getSafeString(quoteData.contact_id, 'Contact Person')}
                            </p>
                            <p className="text-slate-500 mt-1">{getSafeString(quoteData.destination, 'Client Address')}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h3 className="text-xs font-bold uppercase text-slate-400 mb-2">Date</h3>
                            <p className="text-sm font-medium">{today}</p>
                        </div>
                        <div>
                            <h3 className="text-xs font-bold uppercase text-slate-400 mb-2">Valid Until</h3>
                            <p className="text-sm font-medium">{getSafeString(quoteData.validUntil, '30 Days from Date')}</p>
                        </div>
                        <div>
                            <h3 className="text-xs font-bold uppercase text-slate-400 mb-2">Incoterms</h3>
                            <p className="text-sm font-medium">{getSafeString(quoteData.incoterms, 'Ex Works (EXW)')}</p>
                        </div>
                        <div>
                             <h3 className="text-xs font-bold uppercase text-slate-400 mb-2">Currency</h3>
                             <p className="text-sm font-medium">{quoteData.currencyId ? 'Selected' : 'USD'}</p>
                        </div>
                    </div>
                </div>
              );
          case 'shipment_info':
              return (
                <div className="bg-slate-50 p-4 rounded-lg mb-8 border border-slate-100">
                    <h3 className="font-bold text-sm mb-3 text-slate-700">Cargo Details</h3>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                         <div>
                            <span className="text-slate-500 block text-xs">Total Weight</span>
                            <span className="font-mono font-medium">{quoteData.total_weight || '0'} kg</span>
                         </div>
                         <div>
                            <span className="text-slate-500 block text-xs">Total Volume</span>
                            <span className="font-mono font-medium">{quoteData.total_volume || '0'} cbm</span>
                         </div>
                         <div>
                            <span className="text-slate-500 block text-xs">Description</span>
                            <span className="font-medium">{getSafeString(quoteData.commodity, 'General Cargo')}</span>
                         </div>
                    </div>
                </div>
              );
          case 'container_details':
               // Specialized view for FCL
               return (
                <div className="bg-blue-50 p-4 rounded-lg mb-8 border border-blue-100">
                    <h3 className="font-bold text-sm mb-3 text-blue-800">Container Specification (FCL)</h3>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                         <div>
                            <span className="text-blue-500 block text-xs">Container Type</span>
                            {/* Assuming container info might be in items or a specific field */}
                            <span className="font-mono font-medium text-blue-900">
                                {quoteData.items?.map((i: any) => i.container_type).filter(Boolean).join(', ') || '20GP / 40HC'}
                            </span>
                         </div>
                         <div>
                            <span className="text-blue-500 block text-xs">Quantity</span>
                            <span className="font-mono font-medium text-blue-900">
                                {quoteData.items?.reduce((acc: number, i: any) => acc + (Number(i.quantity) || 0), 0) || 1} Units
                            </span>
                         </div>
                         <div>
                            <span className="text-blue-500 block text-xs">Commodity</span>
                            <span className="font-medium text-blue-900">{getSafeString(quoteData.commodity, 'General Cargo')}</span>
                         </div>
                    </div>
                </div>
               );
          case 'cargo_details':
               // Specialized view for LCL/Air
               const chargeableWeight = Math.max(
                   Number(quoteData.total_weight || 0), 
                   (Number(quoteData.total_volume || 0) * 167) // Air standard, LCL uses 1000 usually but simplfying for now
               );
               return (
                <div className="bg-slate-50 p-4 rounded-lg mb-8 border border-slate-100">
                    <h3 className="font-bold text-sm mb-3 text-slate-700">Detailed Cargo Specification</h3>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                         <div>
                            <span className="text-slate-500 block text-xs">Packages</span>
                            <span className="font-mono font-medium">{quoteData.items?.length || 1} Pkgs</span>
                         </div>
                         <div>
                            <span className="text-slate-500 block text-xs">Gross Weight</span>
                            <span className="font-mono font-medium">{quoteData.total_weight || '0'} kg</span>
                         </div>
                         <div>
                            <span className="text-slate-500 block text-xs">Volume</span>
                            <span className="font-mono font-medium">{quoteData.total_volume || '0'} cbm</span>
                         </div>
                         <div>
                            <span className="text-slate-500 block text-xs">Chg. Weight</span>
                            <span className="font-mono font-medium">{chargeableWeight.toFixed(2)} kg</span>
                         </div>
                    </div>
                </div>
               );
          case 'route_info':
              return (
                <div className="mb-8">
                    <h3 className="font-bold text-sm mb-3 text-slate-700">Routing</h3>
                    <div className="space-y-2">
                        {legs.map((leg, i) => (
                             <div key={leg.id} className="flex items-center text-sm border p-3 rounded-md">
                                <span className="font-bold text-slate-400 mr-4 w-6">0{i+1}</span>
                                <span className="font-semibold uppercase w-24 px-2 py-1 bg-slate-100 rounded text-center text-xs mr-4">{getSafeString(leg.mode)}</span>
                                <div className="flex-1 flex items-center gap-2">
                                    <span className="font-medium">{getSafeString(leg.origin || leg.origin_location_id, 'Origin')}</span>
                                    <span className="text-slate-400">→</span>
                                    <span className="font-medium">{getSafeString(leg.destination || leg.destination_location_id, 'Destination')}</span>
                                </div>
                                <div className="text-xs text-slate-500">
                                    {props?.fields?.includes('flight_no') && leg.flight_number ? `Flight: ${leg.flight_number}` : getSafeString(leg.carrierName, 'TBD')}
                                </div>
                             </div>
                        ))}
                    </div>
                </div>
              );
          case 'address_details':
              return (
                 <div className="mb-8 grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded border">
                    <div>
                        <h3 className="font-bold text-xs uppercase text-slate-400 mb-2">Pickup Address</h3>
                        <p className="text-sm">{getSafeString(legs[0]?.origin, 'Origin Location')}</p>
                    </div>
                    <div>
                        <h3 className="font-bold text-xs uppercase text-slate-400 mb-2">Delivery Address</h3>
                        <p className="text-sm">{getSafeString(legs[legs.length-1]?.destination, 'Destination Location')}</p>
                    </div>
                 </div>
              );
          case 'vehicle_details':
               return (
                <div className="mb-8 p-4 bg-orange-50 border border-orange-100 rounded">
                    <h3 className="font-bold text-sm mb-2 text-orange-800">Vehicle Requirements</h3>
                    <div className="flex gap-8 text-sm">
                        <div>
                            <span className="text-orange-500 text-xs block">Truck Type</span>
                            <span className="font-medium text-orange-900">Standard Tilt</span>
                        </div>
                        <div>
                            <span className="text-orange-500 text-xs block">Load Type</span>
                            <span className="font-medium text-orange-900">FTL (Full Truck Load)</span>
                        </div>
                    </div>
                </div>
               );
          case 'rates_table':
          case 'local_charges_table':
              const showCols = props?.columns || ['carrier', 'transit_time', 'frequency', 'price'];
              return (
                <div className="mb-8">
                    <h3 className="font-bold text-sm mb-3 text-slate-700">{props?.title || 'Cost Breakdown'}</h3>
                    <table className="w-full text-sm border-collapse">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                            <tr>
                                <th className="p-3 text-left font-semibold">Description</th>
                                {showCols.includes('transit_time') && <th className="p-3 text-center font-semibold">Transit</th>}
                                <th className="p-3 text-right font-semibold">Qty</th>
                                <th className="p-3 text-right font-semibold">Rate</th>
                                <th className="p-3 text-right font-semibold">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {legs.flatMap(l => l.charges).map((c: any, i: number) => (
                                <tr key={i}>
                                    <td className="p-3">
                                        <div className="font-medium">{getSafeString(c.category, 'Charge')}</div>
                                        <div className="text-xs text-slate-500">{getSafeString(c.note || c.name, '-')}</div>
                                    </td>
                                    {showCols.includes('transit_time') && <td className="p-3 text-center text-slate-500">{legs.find(l => l.id === c.leg_id)?.transit_time || '-'}</td>}
                                    <td className="p-3 text-right text-slate-600">{c.sell?.quantity || 1}</td>
                                    <td className="p-3 text-right text-slate-600">{c.sell?.rate?.toFixed(2)}</td>
                                    <td className="p-3 text-right font-medium">{((c.sell?.quantity || 1) * (c.sell?.rate || 0)).toFixed(2)}</td>
                                </tr>
                            ))}
                            {/* Only show combined charges in main rates table, not local charges table unless specified */}
                            {type === 'rates_table' && combinedCharges.map((c: any, i: number) => (
                                <tr key={`combined-${i}`}>
                                    <td className="p-3">
                                        <div className="font-medium">{getSafeString(c.description, 'Combined Charge')}</div>
                                        <div className="text-xs text-slate-500">{getSafeString(c.category, 'Additional')}</div>
                                    </td>
                                    {showCols.includes('transit_time') && <td className="p-3 text-center">-</td>}
                                    <td className="p-3 text-right text-slate-600">{c.sell?.quantity || 1}</td>
                                    <td className="p-3 text-right text-slate-600">{c.sell?.rate?.toFixed(2)}</td>
                                    <td className="p-3 text-right font-medium">{((c.sell?.quantity || 1) * (c.sell?.rate || 0)).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="border-t-2 border-slate-800">
                            <tr>
                                <td colSpan={showCols.includes('transit_time') ? 4 : 3} className="p-3 text-right font-bold">Total Estimated Cost:</td>
                                <td className="p-3 text-right font-bold text-lg">
                                    { (
                                        legs.reduce((acc, leg) => acc + leg.charges.reduce((sum: number, ch: any) => sum + ((ch.sell?.quantity||0) * (ch.sell?.rate||0)), 0), 0) +
                                        combinedCharges.reduce((acc, ch) => acc + ((ch.sell?.quantity||0) * (ch.sell?.rate||0)), 0)
                                    ).toFixed(2) }
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
              );
          case 'terms':
              return (
                  <div className="mb-8 border-t pt-6">
                      <h3 className="font-bold text-sm mb-3 text-slate-700">Terms & Conditions</h3>
                      <ul className="list-disc pl-5 text-xs text-slate-500 space-y-1">
                          <li>Rates are subject to space and equipment availability.</li>
                          <li>Transit times are estimated and not guaranteed.</li>
                          <li>All business undertaken subject to standard trading conditions.</li>
                          <li>Insurance not included unless specified.</li>
                      </ul>
                  </div>
              );
          default:
              return null;
      }
  };

    return (
        <Dialog>
            <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Printer className="h-4 w-4" />
          Generate Documents
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[85vh] overflow-y-auto" id="document-preview-modal">
        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            #document-preview-content, #document-preview-content * {
              visibility: visible;
            }
            #document-preview-content {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              padding: 20px;
              background: white;
            }
            .no-print {
              display: none !important;
            }
          }
        `}</style>
        <DialogHeader className="no-print">
          <DialogTitle>Document Preview</DialogTitle>
          <DialogDescription className="sr-only">
            Preview of the generated quotation document including details, legs, and charges.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="quote" className="w-full">
          <TabsList className="grid w-full grid-cols-3 no-print">
            <TabsTrigger value="quote" className="gap-2">
                <FileText className="h-4 w-4"/> Quotation
            </TabsTrigger>
            <TabsTrigger value="bol" className="gap-2">
                <Box className="h-4 w-4"/> Bill of Lading (Draft)
            </TabsTrigger>
            <TabsTrigger value="packing" className="gap-2">
                <Package className="h-4 w-4"/> Packing List (Draft)
            </TabsTrigger>
          </TabsList>

          <div id="document-preview-content">
            <TabsContent value="quote" className="mt-6">
            <div className="border p-8 bg-white text-black shadow-sm print:shadow-none print:border-none min-h-[600px]">
                {/* Header */}
                <div className="flex justify-between items-start border-b pb-6 mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">QUOTATION</h1>
                        <p className="text-slate-500 mt-1">Reference: {getSafeString(quoteData.reference, 'DRAFT')}</p>
                    </div>
                    {(!template || template.header?.show_logo !== false) && (
                        <div className="text-right">
                            <div className="font-bold text-xl text-slate-800">SOS Logistics Pro</div>
                            <p className="text-sm text-slate-600">123 Logistics Way</p>
                            <p className="text-sm text-slate-600">Global Trade Center, NY 10001</p>
                            <p className="text-sm text-slate-600">Phone: +1 (555) 123-4567</p>
                        </div>
                    )}
                </div>

                {/* Dynamic Sections */}
                {template && template.sections ? (
                    template.sections.map((section: any, idx: number) => (
                        <React.Fragment key={idx}>
                            {renderSection(section.type, section)}
                        </React.Fragment>
                    ))
                ) : (
                    <>
                        {renderSection('customer_info')}
                        {renderSection('shipment_info')}
                        {renderSection('route_info')}
                        {renderSection('rates_table')}
                        {renderSection('terms')}
                    </>
                )}

                {/* Landed Cost Estimate - Keep as extra section if not in template? Or always show if calculated? */}
                {landedCost && (
                    <div className="mb-8 border-t-2 border-slate-100 pt-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Calculator className="h-4 w-4 text-slate-500" />
                            <h3 className="font-bold text-sm text-slate-700">Estimated Landed Cost (Duties & Taxes)</h3>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-lg">
                            <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Total Duties</span>
                                    <span className="font-medium">{currency} {landedCost.summary.total_duty.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Merchandise Processing Fee (MPF)</span>
                                    <span className="font-medium">{currency} {landedCost.summary.estimated_mpf.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Harbor Maintenance Fee (HMF)</span>
                                    <span className="font-medium">{currency} {landedCost.summary.estimated_hmf.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between border-t border-slate-200 pt-2 mt-2 col-span-2 font-bold text-slate-800">
                                    <span>Total Estimated Landed Cost</span>
                                    <span>{currency} {landedCost.summary.grand_total_estimated_landed_cost.toFixed(2)}</span>
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-3 italic">
                                * Estimated values based on provided HS codes and value. Final assessment by Customs may vary.
                            </p>
                        </div>
                    </div>
                )}

                {/* Footer */}
                {template?.footer ? (
                     <div className="mt-8 pt-6 border-t text-center text-xs text-slate-400">
                         {template.footer.text}
                     </div>
                ) : (
                    <div className="text-xs text-slate-400 mt-12 pt-6 border-t text-center">
                        <p className="mb-2">This quotation is subject to our Standard Trading Conditions. Rates are subject to space and equipment availability.</p>
                        <p>Generated on {new Date().toLocaleString()}</p>
                    </div>
                )}
            </div>
            </TabsContent>

            <TabsContent value="bol" className="mt-6">
            <div className="border p-8 bg-white min-h-[600px] text-black print:border-none">
                <div className="border-2 border-slate-800 p-1 mb-6">
                    <h2 className="text-2xl font-bold text-center uppercase py-2 bg-slate-100">Bill of Lading (Draft)</h2>
                </div>

                <div className="grid grid-cols-2 gap-0 border border-slate-300">
                    <div className="border-r border-b border-slate-300 p-4 min-h-[120px]">
                        <span className="block font-bold text-xs uppercase text-slate-400 mb-1">Shipper</span>
                        <div className="font-medium text-sm">
                            {quoteData.origin ? (
                                <>
                                    <p>Shipper at {getSafeString(quoteData.origin)}</p>
                                    <p className="text-slate-500 text-xs mt-1">Address on file</p>
                                </>
                            ) : 'TBD'}
                        </div>
                    </div>
                    <div className="border-b border-slate-300 p-4 min-h-[120px]">
                        <span className="block font-bold text-xs uppercase text-slate-400 mb-1">Booking No.</span>
                        <p className="font-mono text-lg">{getSafeString(quoteData.reference, 'DRAFT-001')}</p>
                        <div className="mt-4">
                            <span className="block font-bold text-xs uppercase text-slate-400 mb-1">Export References</span>
                            <p className="text-sm">Ref: {new Date().getFullYear()}-{Math.floor(Math.random()*1000)}</p>
                        </div>
                    </div>

                    <div className="border-r border-b border-slate-300 p-4 min-h-[120px]">
                        <span className="block font-bold text-xs uppercase text-slate-400 mb-1">Consignee</span>
                        <div className="font-medium text-sm">
                            {quoteData.destination ? (
                                <>
                                    <p>Consignee at {getSafeString(quoteData.destination)}</p>
                                    <p className="text-slate-500 text-xs mt-1">Address on file</p>
                                </>
                            ) : 'TBD'}
                        </div>
                    </div>
                    <div className="border-b border-slate-300 p-4 min-h-[120px]">
                        <span className="block font-bold text-xs uppercase text-slate-400 mb-1">Forwarding Agent</span>
                        <p className="font-bold">SOS Logistics Pro</p>
                        <p className="text-xs text-slate-500">Global Trade Center, NY 10001</p>
                    </div>
                </div>

                <div className="mt-6 border border-slate-300">
                    <div className="grid grid-cols-4 bg-slate-100 text-xs font-bold uppercase border-b border-slate-300">
                        <div className="p-2 border-r border-slate-300">Marks & Numbers</div>
                        <div className="p-2 border-r border-slate-300 col-span-2">Description of Packages and Goods</div>
                        <div className="p-2">Gross Weight</div>
                    </div>
                    <div className="grid grid-cols-4 min-h-[200px] text-sm">
                         <div className="p-4 border-r border-slate-300 font-mono">
                            {getSafeString(quoteData.reference, 'N/A')}<br/>
                            1/1
                         </div>
                         <div className="p-4 border-r border-slate-300 col-span-2">
                            <p className="font-bold mb-2">{getSafeString(quoteData.commodity, 'General Cargo')}</p>
                            <p className="text-xs text-slate-500">
                                Total Volume: {quoteData.total_volume || '0'} CBM<br/>
                                Transport Mode: {getSafeString(quoteData.mode).toUpperCase() || 'OCEAN'}
                            </p>
                         </div>
                         <div className="p-4 font-mono text-right">
                            {quoteData.total_weight || '0'} KG
                         </div>
                    </div>
                </div>

                <div className="mt-8 text-xs text-slate-500 text-center">
                    <p>Received by the Carrier from the Shipper in apparent good order and condition unless otherwise indicated.</p>
                    <p className="mt-2 font-bold text-slate-300 text-xl">DRAFT COPY - NOT NEGOTIABLE</p>
                </div>
            </div>
            </TabsContent>

            <TabsContent value="packing" className="mt-6">
             <div className="border p-8 bg-white min-h-[600px] text-black print:border-none">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold">PACKING LIST</h1>
                    <div className="text-right">
                        <p className="text-sm font-bold">Date: {today}</p>
                        <p className="text-sm">Ref: {quoteData.reference || 'DRAFT'}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-8">
                    <div className="border p-4 rounded">
                        <h3 className="text-xs font-bold uppercase text-slate-400 mb-2">From</h3>
                        <p className="font-bold">{quoteData.origin || 'Shipper'}</p>
                    </div>
                    <div className="border p-4 rounded">
                        <h3 className="text-xs font-bold uppercase text-slate-400 mb-2">To</h3>
                        <p className="font-bold">{quoteData.destination || 'Consignee'}</p>
                    </div>
                </div>

                <table className="w-full border-collapse border border-slate-300 text-sm">
                    <thead className="bg-slate-100">
                        <tr>
                            <th className="border p-2 text-left">Item / Description</th>
                            <th className="border p-2 text-right">Qty</th>
                            <th className="border p-2 text-right">Unit Type</th>
                            <th className="border p-2 text-right">Weight (KG)</th>
                            <th className="border p-2 text-right">Volume (CBM)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="border p-3">{quoteData.commodity || 'General Cargo'}</td>
                            <td className="border p-3 text-right">{quoteData.quantity || 1}</td>
                            <td className="border p-3 text-right">{quoteData.containerType || 'Package'}</td>
                            <td className="border p-3 text-right">{quoteData.total_weight || 0}</td>
                            <td className="border p-3 text-right">{quoteData.total_volume || 0}</td>
                        </tr>
                        {/* Empty rows for layout */}
                        {[1,2,3].map(i => (
                            <tr key={i}>
                                <td className="border p-3">&nbsp;</td>
                                <td className="border p-3">&nbsp;</td>
                                <td className="border p-3">&nbsp;</td>
                                <td className="border p-3">&nbsp;</td>
                                <td className="border p-3">&nbsp;</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold">
                        <tr>
                            <td className="border p-3 text-right" colSpan={3}>Totals:</td>
                            <td className="border p-3 text-right">{quoteData.total_weight || 0}</td>
                            <td className="border p-3 text-right">{quoteData.total_volume || 0}</td>
                        </tr>
                    </tfoot>
                </table>

                <div className="mt-12 pt-8 border-t flex justify-between text-sm">
                     <div>
                        <p className="mb-8">Prepared By:</p>
                        <div className="border-b border-black w-48"></div>
                     </div>
                     <div>
                        <p className="mb-8">Received By:</p>
                        <div className="border-b border-black w-48"></div>
                     </div>
                </div>
            </div>
            </TabsContent>
          </div>
        </Tabs>
        
        <div className="flex justify-end gap-4 mt-6 no-print">
             <Button onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print / Save PDF
             </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
