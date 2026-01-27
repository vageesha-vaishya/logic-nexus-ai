import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Printer, FileText, Package, Box } from 'lucide-react';

interface DocumentPreviewProps {
  quoteData: any;
  legs: any[];
  combinedCharges?: any[];
}

export function DocumentPreview({ quoteData, legs, combinedCharges = [] }: DocumentPreviewProps) {
  const handlePrint = () => {
    window.print();
  };

  const today = new Date().toLocaleDateString();

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
                        <p className="text-slate-500 mt-1">Reference: {quoteData.reference || 'DRAFT'}</p>
                    </div>
                    <div className="text-right">
                        <div className="font-bold text-xl text-slate-800">SOS Logistics Pro</div>
                        <p className="text-sm text-slate-600">123 Logistics Way</p>
                        <p className="text-sm text-slate-600">Global Trade Center, NY 10001</p>
                        <p className="text-sm text-slate-600">Phone: +1 (555) 123-4567</p>
                    </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-12 mb-8">
                    <div>
                        <h3 className="text-xs font-bold uppercase text-slate-400 mb-2">Prepared For</h3>
                        <div className="text-sm font-medium">
                            <p className="font-bold text-lg">{quoteData.account_id || 'Client Name'}</p>
                            <p className="text-slate-500">{quoteData.contact_id || 'Contact Person'}</p>
                            <p className="text-slate-500 mt-1">{quoteData.destination || 'Client Address'}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h3 className="text-xs font-bold uppercase text-slate-400 mb-2">Date</h3>
                            <p className="text-sm font-medium">{today}</p>
                        </div>
                        <div>
                            <h3 className="text-xs font-bold uppercase text-slate-400 mb-2">Valid Until</h3>
                            <p className="text-sm font-medium">{quoteData.validUntil || '30 Days from Date'}</p>
                        </div>
                        <div>
                            <h3 className="text-xs font-bold uppercase text-slate-400 mb-2">Incoterms</h3>
                            <p className="text-sm font-medium">{quoteData.incoterms || 'Ex Works (EXW)'}</p>
                        </div>
                        <div>
                             <h3 className="text-xs font-bold uppercase text-slate-400 mb-2">Currency</h3>
                             <p className="text-sm font-medium">{quoteData.currencyId ? 'Selected' : 'USD'}</p>
                        </div>
                    </div>
                </div>

                {/* Cargo Details */}
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
                            <span className="font-medium">{quoteData.commodity || 'General Cargo'}</span>
                         </div>
                    </div>
                </div>

                {/* Routing */}
                <div className="mb-8">
                    <h3 className="font-bold text-sm mb-3 text-slate-700">Routing</h3>
                    <div className="space-y-2">
                        {legs.map((leg, i) => (
                             <div key={leg.id} className="flex items-center text-sm border p-3 rounded-md">
                                <span className="font-bold text-slate-400 mr-4 w-6">0{i+1}</span>
                                <span className="font-semibold uppercase w-24 px-2 py-1 bg-slate-100 rounded text-center text-xs mr-4">{leg.mode}</span>
                                <div className="flex-1 flex items-center gap-2">
                                    <span className="font-medium">{leg.origin || leg.origin_location_id || 'Origin'}</span>
                                    <span className="text-slate-400">→</span>
                                    <span className="font-medium">{leg.destination || leg.destination_location_id || 'Destination'}</span>
                                </div>
                                <div className="text-xs text-slate-500">
                                    {leg.carrierName || 'TBD'}
                                </div>
                             </div>
                        ))}
                    </div>
                </div>

                {/* Charges */}
                <div className="mb-8">
                    <h3 className="font-bold text-sm mb-3 text-slate-700">Cost Breakdown</h3>
                    <table className="w-full text-sm border-collapse">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                            <tr>
                                <th className="p-3 text-left font-semibold">Description</th>
                                <th className="p-3 text-right font-semibold">Qty</th>
                                <th className="p-3 text-right font-semibold">Rate</th>
                                <th className="p-3 text-right font-semibold">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {legs.flatMap(l => l.charges).map((c: any, i: number) => (
                                <tr key={i}>
                                    <td className="p-3">
                                        <div className="font-medium">{c.category || 'Charge'}</div>
                                        <div className="text-xs text-slate-500">{c.note || c.name || '-'}</div>
                                    </td>
                                    <td className="p-3 text-right text-slate-600">{c.sell?.quantity || 1}</td>
                                    <td className="p-3 text-right text-slate-600">{c.sell?.rate?.toFixed(2)}</td>
                                    <td className="p-3 text-right font-medium">{((c.sell?.quantity || 1) * (c.sell?.rate || 0)).toFixed(2)}</td>
                                </tr>
                            ))}
                            {combinedCharges.map((c: any, i: number) => (
                                <tr key={`combined-${i}`}>
                                    <td className="p-3">
                                        <div className="font-medium">{c.description || 'Combined Charge'}</div>
                                        <div className="text-xs text-slate-500">{c.category || 'Additional'}</div>
                                    </td>
                                    <td className="p-3 text-right text-slate-600">{c.sell?.quantity || 1}</td>
                                    <td className="p-3 text-right text-slate-600">{c.sell?.rate?.toFixed(2)}</td>
                                    <td className="p-3 text-right font-medium">{((c.sell?.quantity || 1) * (c.sell?.rate || 0)).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="border-t-2 border-slate-800">
                            <tr>
                                <td colSpan={3} className="p-3 text-right font-bold">Total Estimated Cost:</td>
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

                {/* Footer */}
                <div className="text-xs text-slate-400 mt-12 pt-6 border-t text-center">
                    <p className="mb-2">This quotation is subject to our Standard Trading Conditions. Rates are subject to space and equipment availability.</p>
                    <p>Generated on {new Date().toLocaleString()}</p>
                </div>
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
                                    <p>Shipper at {quoteData.origin}</p>
                                    <p className="text-slate-500 text-xs mt-1">Address on file</p>
                                </>
                            ) : 'TBD'}
                        </div>
                    </div>
                    <div className="border-b border-slate-300 p-4 min-h-[120px]">
                        <span className="block font-bold text-xs uppercase text-slate-400 mb-1">Booking No.</span>
                        <p className="font-mono text-lg">{quoteData.reference || 'DRAFT-001'}</p>
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
                                    <p>Consignee at {quoteData.destination}</p>
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
                            {quoteData.reference || 'N/A'}<br/>
                            1/1
                         </div>
                         <div className="p-4 border-r border-slate-300 col-span-2">
                            <p className="font-bold mb-2">{quoteData.commodity || 'General Cargo'}</p>
                            <p className="text-xs text-slate-500">
                                Total Volume: {quoteData.total_volume || '0'} CBM<br/>
                                Transport Mode: {quoteData.mode?.toUpperCase() || 'OCEAN'}
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
