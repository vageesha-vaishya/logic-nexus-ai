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
      <DialogContent className="max-w-4xl h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Document Preview</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="quote" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
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
                            <p>{quoteData.account_id || 'Client Name'}</p>
                            <p className="text-slate-500">{quoteData.contact_id || 'Contact Person'}</p>
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
                            <p className="text-sm font-medium">{quoteData.incoterms || '-'}</p>
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
                            <span className="font-medium">{quoteData.commodity || '-'}</span>
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
                                    <span>{leg.origin_location_id || 'Origin'}</span>
                                    <span className="text-slate-400">→</span>
                                    <span>{leg.destination_location_id || 'Destination'}</span>
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
                                    <td className="p-3">{c.note || 'Charge'}</td>
                                    <td className="p-3 text-right text-slate-600">{c.sell?.quantity || 1}</td>
                                    <td className="p-3 text-right text-slate-600">{c.sell?.rate?.toFixed(2)}</td>
                                    <td className="p-3 text-right font-medium">{((c.sell?.quantity || 1) * (c.sell?.rate || 0)).toFixed(2)}</td>
                                </tr>
                            ))}
                            {combinedCharges.map((c: any, i: number) => (
                                <tr key={`combined-${i}`}>
                                    <td className="p-3">{c.description || 'Combined Charge'}</td>
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
                    <p>This quotation is subject to our Standard Trading Conditions. Rates are subject to space and equipment availability.</p>
                </div>
            </div>
          </TabsContent>

          <TabsContent value="bol" className="mt-6">
            <div className="border p-8 bg-white min-h-[600px] flex flex-col items-center justify-center text-center">
                <div className="p-6 bg-slate-50 rounded-full mb-4">
                    <Box className="h-12 w-12 text-slate-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Bill of Lading Preview</h3>
                <p className="text-slate-500 max-w-md mb-6">
                    This is a draft preview of the Bill of Lading based on quotation details. 
                    Official BL numbers are assigned upon booking confirmation.
                </p>
                <div className="w-full max-w-2xl border border-dashed p-8 rounded-lg text-left">
                    <div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
                        <div>
                            <span className="block font-bold text-xs uppercase text-slate-400">Shipper</span>
                            <div className="h-4 bg-slate-100 w-3/4 rounded mt-1"></div>
                            <div className="h-4 bg-slate-100 w-1/2 rounded mt-1"></div>
                        </div>
                        <div>
                             <span className="block font-bold text-xs uppercase text-slate-400">Consignee</span>
                             <div className="h-4 bg-slate-100 w-3/4 rounded mt-1"></div>
                             <div className="h-4 bg-slate-100 w-1/2 rounded mt-1"></div>
                        </div>
                        <div className="col-span-2 mt-4">
                            <span className="block font-bold text-xs uppercase text-slate-400">Description of Goods</span>
                            <p className="font-mono mt-1">{quoteData.commodity}</p>
                            <p className="font-mono text-xs">Weight: {quoteData.total_weight} kg | Vol: {quoteData.total_volume} cbm</p>
                        </div>
                    </div>
                </div>
            </div>
          </TabsContent>

          <TabsContent value="packing" className="mt-6">
             <div className="border p-8 bg-white min-h-[600px] flex flex-col items-center justify-center text-center">
                <div className="p-6 bg-slate-50 rounded-full mb-4">
                    <Package className="h-12 w-12 text-slate-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Packing List Preview</h3>
                <p className="text-slate-500 max-w-md">
                    Packing list generation requires detailed package dimensions and itemized inventory which are typically provided during the booking stage.
                </p>
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="flex justify-end gap-4 mt-6">
             <Button onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print / Save PDF
             </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
