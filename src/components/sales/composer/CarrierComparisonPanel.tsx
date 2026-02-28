import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TransportLeg } from '@/types/quote-breakdown';
import { Ship, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface CarrierComparisonPanelProps {
  leg: TransportLeg;
}

interface CarrierRate {
  id: string;
  carrier: string;
  baseFreight: number;
  baf: number;
  thc: number;
  total: number;
  currency: string;
  transitTime: string;
  validity: string;
}

export function CarrierComparisonPanel({ leg }: CarrierComparisonPanelProps) {
  const [loading, setLoading] = useState(false);
  const [rates, setRates] = useState<CarrierRate[]>([]);
  const [selectedRate, setSelectedRate] = useState<string | null>(null);

  const fetchRates = async () => {
    setLoading(true);
    // Simulate concurrent API calls to carriers
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mock Data
    const mockRates: CarrierRate[] = [
      { id: 'maersk-01', carrier: 'Maersk', baseFreight: 1200, baf: 150, thc: 200, total: 1550, currency: 'USD', transitTime: '24 Days', validity: '2024-04-30' },
      { id: 'one-01', carrier: 'ONE', baseFreight: 1150, baf: 180, thc: 190, total: 1520, currency: 'USD', transitTime: '26 Days', validity: '2024-04-15' },
      { id: 'green-01', carrier: 'GREEN', baseFreight: 1100, baf: 140, thc: 180, total: 1420, currency: 'USD', transitTime: '30 Days', validity: '2024-05-01' },
      { id: 'hapag-01', carrier: 'Hapag-Lloyd', baseFreight: 1250, baf: 160, thc: 210, total: 1620, currency: 'USD', transitTime: '22 Days', validity: '2024-04-20' },
    ];
    
    setRates(mockRates);
    setLoading(false);
  };

  const handleSelectRate = (rate: CarrierRate) => {
    setSelectedRate(rate.id);
    // In a real implementation, this would update the leg's carrier and charges
    // For now, we just visually select it
  };

  return (
    <Card className="border-blue-100 bg-blue-50/30">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold flex items-center gap-2 text-blue-900">
              <Ship className="w-4 h-4" /> Live Carrier Rates
            </h4>
            <p className="text-xs text-blue-700">
              Real-time spot rates for {leg.origin} → {leg.destination}
            </p>
          </div>
          <Button size="sm" onClick={fetchRates} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white h-8">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
            {rates.length > 0 ? 'Refresh Rates' : 'Fetch Rates'}
          </Button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8 text-blue-600">
             <div className="flex flex-col items-center gap-2">
               <Loader2 className="w-6 h-6 animate-spin" />
               <span className="text-xs">Connecting to Maersk, ONE, GREEN, Hapag-Lloyd...</span>
             </div>
          </div>
        )}

        {!loading && rates.length > 0 && (
          <div className="rounded-md border bg-white overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="h-8 text-xs">Carrier</TableHead>
                  <TableHead className="h-8 text-xs text-right">Base Freight</TableHead>
                  <TableHead className="h-8 text-xs text-right">Surcharges</TableHead>
                  <TableHead className="h-8 text-xs text-right">Total</TableHead>
                  <TableHead className="h-8 text-xs text-center">Transit</TableHead>
                  <TableHead className="h-8 text-xs text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((rate) => (
                  <TableRow key={rate.id} className={selectedRate === rate.id ? 'bg-blue-50' : ''}>
                    <TableCell className="font-medium text-xs">
                      {rate.carrier}
                      {rate.carrier === 'GREEN' && <Badge variant="secondary" className="ml-2 text-[9px] bg-green-100 text-green-800">Eco</Badge>}
                    </TableCell>
                    <TableCell className="text-right text-xs">${rate.baseFreight}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">${rate.baf + rate.thc}</TableCell>
                    <TableCell className="text-right font-bold text-xs">${rate.total}</TableCell>
                    <TableCell className="text-center text-xs">{rate.transitTime}</TableCell>
                    <TableCell className="text-center">
                      <Button 
                        size="sm" 
                        variant={selectedRate === rate.id ? "default" : "outline"} 
                        className={`h-6 text-[10px] ${selectedRate === rate.id ? 'bg-blue-600' : ''}`}
                        onClick={() => handleSelectRate(rate)}
                      >
                        {selectedRate === rate.id ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Selected</> : 'Select'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
