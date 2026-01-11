import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCRM } from '@/hooks/useCRM';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface Shipment {
  id: string;
  shipment_number: string;
  status: string;
  origin_city: string;
  destination_city: string;
}

export function ShipmentsWidget() {
  const { context, scopedDb } = useCRM();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchShipments = async () => {
      if (!context?.userId) return;
      
      try {
        const { data, error } = await scopedDb
          .from('shipments')
          .select('id, shipment_number, status, origin_city, destination_city')
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        setShipments(data as Shipment[]);
      } catch (error) {
        console.error('Failed to load shipments widget:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchShipments();
  }, [context?.userId]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Recent Shipments</CardTitle>
        <Package className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : shipments.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            No recent shipments
          </div>
        ) : (
          <div className="space-y-4">
            {shipments.map((shipment) => (
              <div key={shipment.id} className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">{shipment.shipment_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {shipment.origin_city} → {shipment.destination_city}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] h-4 px-1">
                  {shipment.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <div className="p-4 pt-0 mt-auto border-t">
        <Button variant="ghost" className="w-full text-xs" asChild>
          <Link to="/dashboard/shipments">
            View All Shipments <ArrowRight className="ml-2 h-3 w-3" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
