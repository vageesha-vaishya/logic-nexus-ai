import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WidgetProps, CarrierVolume } from '@/types/dashboard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useEffect, useState } from 'react';
import { dashboardAnalyticsService } from '@/services/dashboardAnalytics';
import { Loader2 } from 'lucide-react';

export function VolumeWidget({ config }: WidgetProps) {
  const [data, setData] = useState<CarrierVolume[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const volume = await dashboardAnalyticsService.getCarrierVolume();
        setData(volume);
      } catch (error) {
        console.error('Failed to load volume data', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">{config.title || 'Shipment Volume'}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{config.title || 'Shipment Volume'}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        <div className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                <XAxis type="number" className="text-xs" />
                <YAxis dataKey="carrier_name" type="category" width={100} className="text-xs" />
                <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }} 
                    itemStyle={{ color: 'var(--foreground)' }}
                />
                <Legend />
                <Bar dataKey="volume" name="Shipments" fill="hsl(var(--secondary))" radius={[0, 4, 4, 0]} />
            </BarChart>
            </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
