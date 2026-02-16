
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useCRM } from '@/hooks/useCRM';
import { PortsService } from '@/services/PortsService';
import { Loader2, Upload, FileSpreadsheet, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

interface Rate {
  id: string;
  carrier: { carrier_name: string; carrier_code: string } | null;
  origin: { location_code: string; location_name: string } | null;
  destination: { location_code: string; location_name: string } | null;
  mode: string;
  amount: number;
  currency: string;
  container_type: string | null;
  valid_to: string | null;
}

export function RateSheetsTab() {
  const { supabase, scopedDb } = useCRM();
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('carrier_rates')
        .select(`
          id,
          mode,
          amount,
          currency,
          container_type,
          valid_to,
          carrier:carrier_id(carrier_name, carrier_code),
          origin:origin_port_id(location_code, location_name),
          destination:destination_port_id(location_code, location_name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Transform data to match Rate interface
      const transformedRates: Rate[] = (data || []).map((item: any) => ({
        id: item.id,
        carrier: item.carrier,
        origin: item.origin,
        destination: item.destination,
        mode: item.mode,
        amount: item.amount,
        currency: item.currency,
        container_type: item.container_type,
        valid_to: item.valid_to
      }));

      setRates(transformedRates);
    } catch (error: any) {
      console.error('Error fetching rates:', error);
      toast({
        title: "Error",
        description: "Failed to load rates: " + error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        Carrier: "MSCU",
        Origin: "USNYC",
        Destination: "CNSZX",
        Mode: "ocean",
        Amount: 1500,
        Currency: "USD",
        Container: "40HC",
        ValidFrom: "2024-01-01",
        ValidTo: "2024-12-31"
      },
      {
        Carrier: "MAEU",
        Origin: "LAX",
        Destination: "NRT",
        Mode: "air",
        Amount: 2.50,
        Currency: "USD",
        Container: "kg", // For air, use unit
        ValidFrom: "2024-01-01",
        ValidTo: "2024-06-30"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rate Template");
    XLSX.writeFile(wb, "rate_sheet_template.xlsx");
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet);

      if (jsonData.length === 0) {
        throw new Error("Sheet is empty");
      }

      // Pre-fetch reference data for mapping
      const { data: carriers } = await supabase.from('carriers').select('id, carrier_code, scac, iata');
      const portsService = new PortsService(scopedDb);
      const ports = await portsService.getAllPorts();
      const { data: modesData } = await supabase.from('transport_modes').select('code').eq('is_active', true);

      const carrierMap = new Map();
      carriers?.forEach(c => {
        if (c.carrier_code) carrierMap.set(c.carrier_code.toUpperCase(), c.id);
        if (c.scac) carrierMap.set(c.scac.toUpperCase(), c.id);
        if (c.iata) carrierMap.set(c.iata.toUpperCase(), c.id);
      });

      const portMap = new Map();
      ports?.forEach(p => {
        if (p.location_code) portMap.set(p.location_code.toUpperCase(), p.id);
      });

      const validModes = new Set<string>((modesData || []).map((m: any) => String(m.code).toLowerCase()));
      const isUUID = (v: any) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
      const ratesToInsert = [];
      const errors = [];

      for (const [index, row] of jsonData.entries() as any) {
        const carrierCode = (row.Carrier || '').toString().toUpperCase();
        const originCode = (row.Origin || '').toString().toUpperCase();
        const destCode = (row.Destination || '').toString().toUpperCase();
        const modeVal = (row.Mode || 'ocean').toLowerCase();

        const carrierId = carrierMap.get(carrierCode);
        const originId = portMap.get(originCode);
        const destId = portMap.get(destCode);

        if (!carrierId) errors.push(`Row ${index + 2}: Carrier '${carrierCode}' not found`);
        if (!originId) errors.push(`Row ${index + 2}: Origin '${originCode}' not found`);
        if (!destId) errors.push(`Row ${index + 2}: Destination '${destCode}' not found`);
        if (validModes.size > 0 && !validModes.has(modeVal)) errors.push(`Row ${index + 2}: Mode '${modeVal}' is invalid`);

        if (carrierId && originId && destId && isUUID(carrierId) && isUUID(originId) && isUUID(destId) && (validModes.size === 0 || validModes.has(modeVal))) {
          ratesToInsert.push({
            carrier_id: carrierId,
            origin_port_id: originId,
            destination_port_id: destId,
            mode: modeVal,
            amount: Number(row.Amount) || 0,
            currency: row.Currency || 'USD',
            container_type: row.Container || null,
            valid_from: row.ValidFrom ? new Date(row.ValidFrom).toISOString() : new Date().toISOString(),
            valid_to: row.ValidTo ? new Date(row.ValidTo).toISOString() : null,
            // Basic fields
            service_type: 'standard', // Default
          });
        }
      }

      if (errors.length > 0) {
        console.warn("Upload errors:", errors);
        toast({
          title: "Partial Import Warning",
          description: `${errors.length} rows skipped. First error: ${errors[0]}`,
          variant: "destructive"
        });
      }

      if (ratesToInsert.length > 0) {
        const { error } = await supabase.from('carrier_rates').insert(ratesToInsert);
        if (error) throw error;

        toast({
          title: "Success",
          description: `Imported ${ratesToInsert.length} rates successfully.`
        });
        fetchRates();
      } else {
        toast({
          title: "No Data Imported",
          description: "No valid rows found to import.",
          variant: "destructive"
        });
      }

    } catch (error: any) {
      console.error('Upload failed:', error);
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Carrier Rate Sheets</CardTitle>
          <CardDescription>Manage your negotiated rates and contracts</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Template
          </Button>
          <div className="relative">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept=".xlsx,.xls,.csv"
            />
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Upload Rates
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Carrier</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Origin</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Valid Until</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No rates found. Upload a rate sheet to get started.
                  </TableCell>
                </TableRow>
              ) : (
                rates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell className="font-medium">
                      {rate.carrier?.carrier_name || rate.carrier?.carrier_code || '-'}
                    </TableCell>
                    <TableCell className="capitalize">{rate.mode}</TableCell>
                    <TableCell>{rate.origin?.location_code || '-'}</TableCell>
                    <TableCell>{rate.destination?.location_code || '-'}</TableCell>
                    <TableCell>{rate.container_type || '-'}</TableCell>
                    <TableCell className="text-right">
                      {rate.amount.toLocaleString()} {rate.currency}
                    </TableCell>
                    <TableCell>
                      {rate.valid_to ? format(new Date(rate.valid_to), 'MMM d, yyyy') : 'Indefinite'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
