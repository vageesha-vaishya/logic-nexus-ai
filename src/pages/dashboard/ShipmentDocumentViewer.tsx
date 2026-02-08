import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCRM } from '@/hooks/useCRM';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';

export default function ShipmentDocumentViewer() {
  const { id, type } = useParams();
  const navigate = useNavigate();
  const { scopedDb } = useCRM();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        // Fetch Shipment
        const { data: shipment, error: sErr } = await scopedDb
          .from('shipments')
          .select(`
            *,
            accounts(name)
          `)
          .eq('id', id)
          .single();
        
        if (sErr) throw sErr;

        // Fetch Items
        const { data: items, error: iErr } = await scopedDb
          .from('shipment_items')
          .select('*')
          .eq('shipment_id', id);
        
        if (iErr) throw iErr;

        // Fetch Containers
        const { data: containers, error: cErr } = await scopedDb
          .from('shipment_containers' as any)
          .select('*, container_types(name), container_sizes(name)')
          .eq('shipment_id', id);
        
        if (cErr && cErr.code !== '42P01') throw cErr; // Ignore table missing if so

        setData({
          shipment,
          items: items || [],
          containers: containers || []
        });
      } catch (error) {
        console.error('Error fetching document data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, scopedDb]);

  if (loading) return <div className="p-8 text-center">Generating document...</div>;
  if (!data) return <div className="p-8 text-center">Failed to load data</div>;

  const { shipment, items, containers } = data;

  return (
    <div className="min-h-screen bg-white text-black p-8 print:p-0">
      {/* No-Print Toolbar */}
      <div className="print:hidden flex justify-between items-center mb-8 border-b pb-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <h1 className="text-xl font-bold capitalize">{type?.replace('_', ' ')}</h1>
        </div>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
      </div>

      {/* Document Content */}
      <div className="max-w-[210mm] mx-auto bg-white">
        {type === 'bill_of_lading' && <BillOfLading shipment={shipment} items={items} containers={containers} />}
        {type === 'house_bill_of_lading' && <HouseBillOfLading shipment={shipment} items={items} containers={containers} />}
        {type === 'air_waybill' && <AirWaybill shipment={shipment} items={items} containers={containers} />}
        {type === 'packing_list' && <PackingList shipment={shipment} items={items} containers={containers} />}
      </div>
    </div>
  );
}

function HouseBillOfLading({ shipment, items, containers }: any) {
  return (
    <div className="border border-black text-sm">
       <div className="p-4 text-center border-b border-black">
         <h1 className="text-xl font-bold uppercase">House Bill of Lading</h1>
         <div className="text-xs">LOGIC NEXUS LOGISTICS - NON-NEGOTIABLE UNLESS CONSIGNED 'TO ORDER'</div>
       </div>

      <div className="grid grid-cols-2 border-b border-black">
        <div className="p-2 border-r border-black">
          <div className="font-bold text-xs uppercase text-gray-500">Shipper</div>
          <div className="font-bold">{shipment.accounts?.name}</div>
          <div className="whitespace-pre-wrap">{shipment.origin_address?.address || shipment.origin_address}</div>
        </div>
        <div className="p-2">
          <div className="font-bold text-xs uppercase text-gray-500">HBL Number</div>
          <div className="text-lg font-bold">{shipment.shipment_number}</div>
          <div className="font-bold text-xs uppercase text-gray-500 mt-2">Booking Reference</div>
          <div>{shipment.reference_number}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 border-b border-black">
        <div className="p-2 border-r border-black">
          <div className="font-bold text-xs uppercase text-gray-500">Consignee</div>
          <div>TO ORDER OF CONSIGNEE</div>
        </div>
        <div className="p-2">
          <div className="font-bold text-xs uppercase text-gray-500">Notify Party</div>
          <div>SAME AS CONSIGNEE</div>
        </div>
      </div>

      <div className="grid grid-cols-4 border-b border-black">
        <div className="p-2 border-r border-black">
             <div className="font-bold text-xs uppercase text-gray-500">Vessel / Flight</div>
             <div>{shipment.vessel_name || '-'}</div>
        </div>
        <div className="p-2 border-r border-black">
             <div className="font-bold text-xs uppercase text-gray-500">Voyage No.</div>
             <div>{shipment.voyage_number || '-'}</div>
        </div>
        <div className="p-2 border-r border-black">
             <div className="font-bold text-xs uppercase text-gray-500">Port of Loading</div>
             <div>{shipment.port_of_loading || '-'}</div>
        </div>
        <div className="p-2">
             <div className="font-bold text-xs uppercase text-gray-500">Port of Discharge</div>
             <div>{shipment.port_of_discharge || '-'}</div>
        </div>
      </div>

      <div className="border-b border-black min-h-[400px]">
        <div className="grid grid-cols-12 border-b border-black bg-gray-100 font-bold text-xs p-1">
          <div className="col-span-3">Marks & Numbers</div>
          <div className="col-span-2">No. of Pkgs</div>
          <div className="col-span-5">Description of Packages and Goods</div>
          <div className="col-span-1 text-right">Gross Wt</div>
          <div className="col-span-1 text-right">Measurement</div>
        </div>
        
        {containers.length > 0 ? (
            containers.map((c: any) => (
                <div key={c.id} className="grid grid-cols-12 p-2 text-xs">
                    <div className="col-span-3 font-mono">
                        {c.container_number}<br/>
                        SEAL: {c.seal_number}<br/>
                        {c.container_types?.name || c.container_type}
                    </div>
                    <div className="col-span-2">1 CNT</div>
                    <div className="col-span-5">
                        {items.map((i: any) => i.description).join(', ')}
                    </div>
                    <div className="col-span-1 text-right">{c.gross_weight_kg} kg</div>
                    <div className="col-span-1 text-right">{c.volume_cbm} cbm</div>
                </div>
            ))
        ) : (
            items.map((item: any, idx: number) => (
                <div key={idx} className="grid grid-cols-12 p-2 text-xs">
                    <div className="col-span-3">
                        {idx + 1}
                    </div>
                    <div className="col-span-2">{item.quantity}</div>
                    <div className="col-span-5">{item.description}</div>
                    <div className="col-span-1 text-right">{item.weight_kg} kg</div>
                    <div className="col-span-1 text-right">{item.volume_cbm} cbm</div>
                </div>
            ))
        )}
      </div>

      <div className="p-4 grid grid-cols-2 gap-8 text-xs">
        <div>
            <div className="font-bold mb-2">Freight & Charges</div>
            <div className="border p-2 h-24">FREIGHT PREPAID</div>
        </div>
        <div>
            <div className="font-bold mb-2">Signed for the Carrier</div>
            <div className="border-b border-black mt-8"></div>
            <div className="text-center mt-1">As Agent for the Carrier: LOGIC NEXUS LOGISTICS</div>
            <div className="mt-4">Date: {format(new Date(), 'PPP')}</div>
        </div>
      </div>
    </div>
  );
}

function AirWaybill({ shipment, items, containers }: any) {
  return (
    <div className="border border-black text-sm">
      <div className="flex justify-between p-2 border-b border-black bg-gray-50">
          <div className="font-bold">LOGIC NEXUS AIR CARGO</div>
          <div className="font-bold text-xl">AWB: {shipment.shipment_number}</div>
      </div>

      <div className="grid grid-cols-2 border-b border-black">
        <div className="p-2 border-r border-black h-32">
          <div className="font-bold text-xs uppercase text-gray-500">Shipper's Name and Address</div>
          <div className="font-bold">{shipment.accounts?.name}</div>
          <div className="whitespace-pre-wrap">{shipment.origin_address?.address || shipment.origin_address}</div>
        </div>
        <div className="p-2 h-32">
          <div className="font-bold text-xs uppercase text-gray-500">Consignee's Name and Address</div>
          <div>TO ORDER OF CONSIGNEE</div>
        </div>
      </div>

      <div className="grid grid-cols-2 border-b border-black">
        <div className="p-2 border-r border-black h-24">
          <div className="font-bold text-xs uppercase text-gray-500">Issuing Carrier's Agent Name and City</div>
          <div className="font-bold">LOGIC NEXUS LOGISTICS</div>
          <div>New York, NY, USA</div>
        </div>
        <div className="p-2 h-24">
            <div className="font-bold text-xs uppercase text-gray-500">Accounting Information</div>
            <div>FREIGHT PREPAID</div>
        </div>
      </div>

      <div className="grid grid-cols-4 border-b border-black">
        <div className="p-2 border-r border-black">
             <div className="font-bold text-xs uppercase text-gray-500">Airport of Departure</div>
             <div>{shipment.port_of_loading || 'NYC'}</div>
        </div>
        <div className="p-2 border-r border-black">
             <div className="font-bold text-xs uppercase text-gray-500">To</div>
             <div>{shipment.port_of_discharge?.substring(0, 3).toUpperCase() || 'DEST'}</div>
        </div>
        <div className="p-2 border-r border-black">
             <div className="font-bold text-xs uppercase text-gray-500">By First Carrier</div>
             <div>{shipment.vessel_name || 'AIR'}</div>
        </div>
        <div className="p-2">
             <div className="font-bold text-xs uppercase text-gray-500">Currency</div>
             <div>USD</div>
        </div>
      </div>

      <div className="border-b border-black min-h-[300px]">
        <div className="grid grid-cols-12 border-b border-black bg-gray-100 font-bold text-xs p-1">
          <div className="col-span-2">Pieces / RCP</div>
          <div className="col-span-2">Gross Weight</div>
          <div className="col-span-1">Kg/Lb</div>
          <div className="col-span-2">Chargeable Weight</div>
          <div className="col-span-5">Nature and Quantity of Goods</div>
        </div>
        
        {items.map((item: any, idx: number) => (
            <div key={idx} className="grid grid-cols-12 p-2 text-xs">
                <div className="col-span-2">{item.quantity}</div>
                <div className="col-span-2">{item.weight_kg}</div>
                <div className="col-span-1">K</div>
                <div className="col-span-2">{item.weight_kg}</div>
                <div className="col-span-5">
                    <div className="font-bold uppercase">{item.description}</div>
                    <div className="text-gray-500 mt-1">Dims: {item.dimensions || 'N/A'}</div>
                </div>
            </div>
        ))}
        {/* If containers exist (unlikely for AWB but possible for ULDs), list them */}
        {containers.length > 0 && containers.map((c: any) => (
            <div key={c.id} className="grid grid-cols-12 p-2 text-xs">
                <div className="col-span-2">1 ULD</div>
                <div className="col-span-2">{c.gross_weight_kg}</div>
                <div className="col-span-1">K</div>
                <div className="col-span-2">{c.gross_weight_kg}</div>
                <div className="col-span-5">
                    ULD: {c.container_number} ({c.container_types?.name || 'Type'})
                </div>
            </div>
        ))}
      </div>

      <div className="p-4">
        <div className="text-xs text-justify mb-8">
            It is agreed that the goods described herein are accepted in apparent good order and condition (except as noted) for carriage SUBJECT TO THE CONDITIONS OF CONTRACT ON THE REVERSE HEREOF. ALL GOODS MAY BE CARRIED BY ANY OTHER MEANS INCLUDING ROAD OR ANY OTHER CARRIER UNLESS SPECIFIC CONTRARY INSTRUCTIONS ARE GIVEN HEREON BY THE SHIPPER, AND SHIPPER AGREES THAT THE SHIPMENT MAY BE CARRIED VIA INTERMEDIATE STOPPING PLACES WHICH THE CARRIER DEEMS APPROPRIATE. THE SHIPPER'S ATTENTION IS DRAWN TO THE NOTICE CONCERNING CARRIER'S LIMITATION OF LIABILITY.
        </div>
        
        <div className="flex justify-between items-end">
            <div className="text-center w-1/3">
                <div className="border-b border-black mb-1 h-8"></div>
                <div className="text-xs">Signature of Shipper or his Agent</div>
            </div>
            <div className="text-center w-1/3">
                <div className="mb-2">{format(new Date(), 'PPP')}</div>
                <div className="border-b border-black mb-1 h-8"></div>
                <div className="text-xs">Executed on (Date) / Signature of Issuing Carrier</div>
            </div>
        </div>
      </div>
    </div>
  );
}



function BillOfLading({ shipment, items, containers }: any) {
  return (
    <div className="border border-black text-sm">
      <div className="grid grid-cols-2 border-b border-black">
        <div className="p-2 border-r border-black">
          <div className="font-bold text-xs uppercase text-gray-500">Shipper / Exporter</div>
          <div className="font-bold">{shipment.accounts?.name}</div>
          <div className="whitespace-pre-wrap">{shipment.origin_address?.address || shipment.origin_address}</div>
        </div>
        <div className="p-2">
          <div className="font-bold text-xs uppercase text-gray-500">Booking No.</div>
          <div>{shipment.shipment_number}</div>
          <div className="font-bold text-xs uppercase text-gray-500 mt-2">Export References</div>
          <div>{shipment.reference_number}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 border-b border-black">
        <div className="p-2 border-r border-black">
          <div className="font-bold text-xs uppercase text-gray-500">Consignee</div>
          <div>TO ORDER OF CONSIGNEE</div>
          {/* Add consignee logic if available */}
        </div>
        <div className="p-2">
          <div className="font-bold text-xs uppercase text-gray-500">Forwarding Agent</div>
          <div>LOGIC NEXUS LOGISTICS</div>
        </div>
      </div>

      <div className="grid grid-cols-2 border-b border-black">
        <div className="p-2 border-r border-black">
          <div className="font-bold text-xs uppercase text-gray-500">Notify Party</div>
          <div>SAME AS CONSIGNEE</div>
        </div>
        <div className="grid grid-cols-2">
            <div className="p-2 border-r border-black">
                <div className="font-bold text-xs uppercase text-gray-500">Point of Origin</div>
                <div>{shipment.origin_address?.city || 'Origin'}</div>
            </div>
            <div className="p-2">
                <div className="font-bold text-xs uppercase text-gray-500">Country of Origin</div>
                <div>{shipment.origin_address?.country || 'Country'}</div>
            </div>
        </div>
      </div>
      
      <div className="grid grid-cols-4 border-b border-black">
        <div className="p-2 border-r border-black">
             <div className="font-bold text-xs uppercase text-gray-500">Vessel</div>
             <div>{shipment.vessel_name || '-'}</div>
        </div>
        <div className="p-2 border-r border-black">
             <div className="font-bold text-xs uppercase text-gray-500">Voyage No.</div>
             <div>{shipment.voyage_number || '-'}</div>
        </div>
        <div className="p-2 border-r border-black">
             <div className="font-bold text-xs uppercase text-gray-500">Port of Loading</div>
             <div>{shipment.port_of_loading || '-'}</div>
        </div>
        <div className="p-2">
             <div className="font-bold text-xs uppercase text-gray-500">Port of Discharge</div>
             <div>{shipment.port_of_discharge || '-'}</div>
        </div>
      </div>

      <div className="border-b border-black min-h-[300px]">
        <div className="grid grid-cols-12 border-b border-black bg-gray-100 font-bold text-xs p-1">
          <div className="col-span-3">Marks & Numbers</div>
          <div className="col-span-2">No. of Pkgs</div>
          <div className="col-span-5">Description of Packages and Goods</div>
          <div className="col-span-1 text-right">Gross Wt</div>
          <div className="col-span-1 text-right">Measurement</div>
        </div>
        
        {containers.length > 0 ? (
            containers.map((c: any) => (
                <div key={c.id} className="grid grid-cols-12 p-2 text-xs">
                    <div className="col-span-3 font-mono">
                        {c.container_number}<br/>
                        SEAL: {c.seal_number}<br/>
                        {c.container_types?.name || c.container_type} {c.container_sizes?.name ? `(${
                            (c.container_types?.name || c.container_type) 
                            ? (c.container_sizes.name.match(/(\d+)/)?.[0] || c.container_sizes.name)
                            : c.container_sizes.name
                        })` : ''}
                    </div>
                    <div className="col-span-2">1 CNT</div>
                    <div className="col-span-5">
                        SHIPPER'S LOAD, STOW, AND COUNT<br/>
                        {items.map((i: any) => i.description).join(', ')}
                    </div>
                    <div className="col-span-1 text-right">{c.gross_weight_kg} kg</div>
                    <div className="col-span-1 text-right">{c.volume_cbm} cbm</div>
                </div>
            ))
        ) : (
            items.map((item: any, idx: number) => (
                <div key={idx} className="grid grid-cols-12 p-2 text-xs">
                    <div className="col-span-3">
                        {idx + 1}
                    </div>
                    <div className="col-span-2">{item.quantity}</div>
                    <div className="col-span-5">{item.description}</div>
                    <div className="col-span-1 text-right">{item.weight_kg} kg</div>
                    <div className="col-span-1 text-right">{item.volume_cbm} cbm</div>
                </div>
            ))
        )}
      </div>

      <div className="p-4 text-xs text-center uppercase font-bold">
        Bill of Lading - Negotiable
      </div>
    </div>
  );
}

function PackingList({ shipment, items, containers }: any) {
    return (
        <div className="p-8 font-serif">
            <h1 className="text-3xl font-bold text-center mb-8 uppercase">Packing List</h1>
            
            <div className="flex justify-between mb-8">
                <div>
                    <h3 className="font-bold">Shipper:</h3>
                    <div>{shipment.accounts?.name}</div>
                    <div className="whitespace-pre-wrap">{shipment.origin_address?.address || shipment.origin_address}</div>
                </div>
                <div className="text-right">
                    <div className="mb-2"><span className="font-bold">Date:</span> {format(new Date(), 'PPP')}</div>
                    <div className="mb-2"><span className="font-bold">Invoice No:</span> {shipment.shipment_number}</div>
                    <div><span className="font-bold">Reference:</span> {shipment.reference_number}</div>
                </div>
            </div>

            <table className="w-full border-collapse border border-black mb-8">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border border-black p-2 text-left">Item / Container</th>
                        <th className="border border-black p-2 text-left">Description</th>
                        <th className="border border-black p-2 text-right">Quantity</th>
                        <th className="border border-black p-2 text-right">Net Wt (kg)</th>
                        <th className="border border-black p-2 text-right">Gross Wt (kg)</th>
                    </tr>
                </thead>
                <tbody>
                    {containers.length > 0 ? (
                        containers.map((c: any) => (
                            <tr key={c.id}>
                                <td className="border border-black p-2 font-mono">{c.container_number}</td>
                                <td className="border border-black p-2">
                                    {c.container_types?.name || c.container_type} {c.container_sizes?.name ? `(${
                                        (c.container_types?.name || c.container_type)
                                        ? (c.container_sizes.name.match(/(\d+)/)?.[0] || c.container_sizes.name)
                                        : c.container_sizes.name
                                    })` : ''} - Seal: {c.seal_number}<br/>
                                    <span className="text-xs">{c.remarks}</span>
                                </td>
                                <td className="border border-black p-2 text-right">1</td>
                                <td className="border border-black p-2 text-right">{c.net_weight_kg || '-'}</td>
                                <td className="border border-black p-2 text-right">{c.gross_weight_kg || '-'}</td>
                            </tr>
                        ))
                    ) : (
                        items.map((item: any, idx: number) => (
                            <tr key={idx}>
                                <td className="border border-black p-2">{item.item_number || idx + 1}</td>
                                <td className="border border-black p-2">{item.description}</td>
                                <td className="border border-black p-2 text-right">{item.quantity}</td>
                                <td className="border border-black p-2 text-right">-</td>
                                <td className="border border-black p-2 text-right">{item.weight_kg}</td>
                            </tr>
                        ))
                    )}
                </tbody>
                <tfoot>
                    <tr className="font-bold bg-gray-50">
                        <td className="border border-black p-2" colSpan={2}>Totals</td>
                        <td className="border border-black p-2 text-right">
                            {containers.length > 0 ? containers.length : items.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0)}
                        </td>
                        <td className="border border-black p-2 text-right">
                            {containers.length > 0 ? containers.reduce((sum: number, c: any) => sum + (c.net_weight_kg || 0), 0) : '-'}
                        </td>
                        <td className="border border-black p-2 text-right">
                            {containers.length > 0 
                                ? containers.reduce((sum: number, c: any) => sum + (c.gross_weight_kg || 0), 0) 
                                : items.reduce((sum: number, i: any) => sum + (i.weight_kg || 0), 0)}
                        </td>
                    </tr>
                </tfoot>
            </table>

            <div className="mt-16 pt-8 border-t border-black flex justify-between">
                <div>Authorized Signature</div>
                <div>Date</div>
            </div>
        </div>
    );
}
