import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { dashboardAnalyticsService } from '@/services/dashboardAnalytics';
import { FinancialMetric, CarrierVolume, DashboardStats } from '@/types/dashboard';
import { Loader2 } from 'lucide-react';

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [financialData, setFinancialData] = useState<FinancialMetric[]>([]);
  const [volumeData, setVolumeData] = useState<CarrierVolume[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [financials, volume, dashboardStats] = await Promise.all([
          dashboardAnalyticsService.getFinancialMetrics('12m'),
          dashboardAnalyticsService.getCarrierVolume('12m'),
          dashboardAnalyticsService.getDashboardStats()
        ]);
        setFinancialData(financials);
        setVolumeData(volume);
        setStats(dashboardStats);
      } catch (error) {
        console.error('Failed to load reports data', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-100px)]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
            <p className="text-muted-foreground">Monitor financial performance and operational metrics.</p>
        </div>

        <Tabs defaultValue="financials" className="space-y-4">
          <TabsList>
            <TabsTrigger value="financials">Financial Performance</TabsTrigger>
            <TabsTrigger value="operations">Operations</TabsTrigger>
          </TabsList>
          
          <TabsContent value="financials" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(stats?.total_revenue || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">Recognized revenue</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(stats?.total_profit || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">Total profit margin</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Revenue vs Cost</CardTitle>
                <CardDescription>Monthly financial overview for the current fiscal year.</CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={financialData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" className="text-sm font-medium" />
                        <YAxis className="text-sm font-medium" tickFormatter={(value) => `$${value}`} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }} 
                            itemStyle={{ color: 'var(--foreground)' }}
                            formatter={(value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)}
                        />
                        <Legend />
                        <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="cost" name="Cost" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                    </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="operations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Shipment Volume by Carrier</CardTitle>
                <CardDescription>Total containers moved by carrier line.</CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={volumeData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                        <XAxis type="number" className="text-sm font-medium" />
                        <YAxis dataKey="carrier_name" type="category" width={100} className="text-sm font-medium" />
                        <Tooltip 
                            contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }} 
                            itemStyle={{ color: 'var(--foreground)' }}
                        />
                        <Legend />
                        <Bar dataKey="volume" name="Volume (TEU)" fill="hsl(var(--secondary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                    </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
