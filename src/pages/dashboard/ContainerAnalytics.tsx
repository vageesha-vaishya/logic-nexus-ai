
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useCRM } from '@/hooks/useCRM';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Loader2, Package, Scale, Activity, Download, Filter, ChevronRight, Ship } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatContainerSize } from '@/lib/container-utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function ContainerAnalytics() {
  const { scopedDb } = useCRM();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('inventory');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [kpis, setKpis] = useState({ totalContainers: 0, totalTeu: 0, distinctTypes: 0 });
  
  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedSize, setSelectedSize] = useState<string>('all');

  // Vessel Capabilities State
  const [vesselClasses, setVesselClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classCapacities, setClassCapacities] = useState<any[]>([]);

  useEffect(() => {
    const loadVesselClasses = async () => {
      const { data } = await scopedDb.from('vessel_classes').select('*').order('name');
      if (data) {
        setVesselClasses(data);
        if (data.length > 0) setSelectedClassId(data[0].id);
      }
    };
    loadVesselClasses();
  }, [scopedDb]);

  useEffect(() => {
    if (!selectedClassId) return;
    const loadCapacities = async () => {
      const { data } = await scopedDb
        .from('vessel_class_capacities')
        .select('*, container_sizes(name, iso_code)')
        .eq('class_id', selectedClassId);
      if (data) setClassCapacities(data);
    };
    loadCapacities();
  }, [selectedClassId, scopedDb]);

  const capacityData = classCapacities.map(c => ({
    name: formatContainerSize(c.container_sizes?.name || 'Unknown'),
    max_slots: c.max_slots,
    weight_limit: c.weight_limit_per_slot_kg
  }));


  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const { data: result, error } = await scopedDb
          .from('view_container_inventory_summary' as any)
          .select('*');
        
        if (error) throw error;

        setData(result || []);

        // Calculate KPIs
        const totalContainers = result?.reduce((acc, curr) => acc + (curr.total_quantity || 0), 0) || 0;
        const totalTeu = result?.reduce((acc, curr) => acc + (curr.total_teu || 0), 0) || 0;
        const distinctTypes = new Set(result?.map(r => r.category)).size;

        setKpis({ totalContainers, totalTeu, distinctTypes });

      } catch (err) {
        console.error('Failed to load container analytics:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [scopedDb]);

  // Filter Data
  const filteredData = data.filter(item => {
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;
    if (selectedSize !== 'all' && item.size !== selectedSize) return false;
    return true;
  });

  // Transform data for charts
  const typeData = data.reduce((acc: any[], curr) => {
    const existing = acc.find(i => i.name === curr.category);
    if (existing) {
      existing.value += curr.total_quantity;
      existing.teu += curr.total_teu;
    } else {
      acc.push({ name: curr.category, value: curr.total_quantity, teu: curr.total_teu });
    }
    return acc;
  }, []);

  const sizeData = filteredData.reduce((acc: any[], curr) => {
    const name = formatContainerSize(curr.size);
    const existing = acc.find(i => i.name === name);
    if (existing) {
      existing.value += curr.total_quantity;
    } else {
      acc.push({ name: name, value: curr.total_quantity });
    }
    return acc;
  }, []);

  const statusData = filteredData.reduce((acc: any[], curr) => {
    const existing = acc.find(i => i.name === curr.status);
    if (existing) {
      existing.value += curr.total_quantity;
    } else {
      acc.push({ name: curr.status, value: curr.total_quantity });
    }
    return acc;
  }, []);

  const uniqueCategories = Array.from(new Set(data.map(d => d.category).filter(Boolean)));
  const uniqueStatuses = Array.from(new Set(data.map(d => d.status).filter(Boolean)));

  const downloadCSV = () => {
    const headers = ['Category', 'Size', 'ISO Code', 'Status', 'Location', 'Quantity', 'TEU'];
    const rows = filteredData.map(d => [
      d.category,
      formatContainerSize(d.size),
      d.iso_code,
      d.status,
      d.location_name,
      d.total_quantity,
      d.total_teu
    ].map(v => `"${v || ''}"`).join(','));
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'container_inventory_analytics.csv';
    a.click();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Container Analytics</h1>
            <p className="text-muted-foreground">Hierarchical analysis of container inventory and vessel capabilities.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/dashboard/container-tracking')}>
              View Full Tracking
            </Button>
            <Button variant="outline" onClick={downloadCSV}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
                <TabsTrigger value="inventory">Inventory Overview</TabsTrigger>
                <TabsTrigger value="capacities">Vessel Capabilities</TabsTrigger>
            </TabsList>

            <TabsContent value="inventory" className="space-y-4">
                {/* Filters */}
                <div className="flex gap-4 p-4 border rounded-lg bg-card">
                  <div className="flex items-center gap-2">
                     <Filter className="h-4 w-4 text-muted-foreground" />
                     <span className="text-sm font-medium">Filters:</span>
                  </div>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {uniqueCategories.map((c: any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {uniqueStatuses.map((s: any) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  
                  {/* Size Filter (Hidden unless active or selected via drill-down) */}
                  {(selectedSize !== 'all') && (
                     <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1 rounded-md border">
                        <span className="text-sm font-medium">{selectedSize}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-4 w-4" 
                          onClick={() => setSelectedSize('all')}
                        >
                          <span className="sr-only">Clear size filter</span>
                          &times;
                        </Button>
                     </div>
                  )}

                  {(selectedCategory !== 'all' || selectedStatus !== 'all' || selectedSize !== 'all') && (
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedCategory('all'); setSelectedStatus('all'); setSelectedSize('all'); }}>
                      Reset
                    </Button>
                  )}
                </div>

                {/* KPI Cards */}
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Containers</CardTitle>
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{kpis.totalContainers}</div>
                      <p className="text-xs text-muted-foreground">Across all locations</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total TEU</CardTitle>
                      <Scale className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{kpis.totalTeu.toFixed(1)}</div>
                      <p className="text-xs text-muted-foreground">Twenty-foot Equivalent Units</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Active Categories</CardTitle>
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{kpis.distinctTypes}</div>
                      <p className="text-xs text-muted-foreground">Distinct container types</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts Row 1 */}
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Inventory by Category (Drill-down)</CardTitle>
                      <CardDescription>Click a bar to filter by category</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={typeData} onClick={(data) => data?.activeLabel && setSelectedCategory(data.activeLabel)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="value" name="Quantity" fill="#8884d8" cursor="pointer" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Status Distribution</CardTitle>
                      <CardDescription>Current status of filtered containers</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={statusData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {statusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts Row 2: Size Breakdown */}
                {selectedCategory !== 'all' && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Size Breakdown for {selectedCategory}</CardTitle>
                      <CardDescription>Quantity by container size</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                       <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sizeData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" width={150} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="value" name="Quantity" fill="#82ca9d" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Detailed Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Detailed Inventory</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>ISO Code</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">TEU</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredData.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell>{item.category}</TableCell>
                            <TableCell>{formatContainerSize(item.size)}</TableCell>
                            <TableCell><Badge variant="outline">{item.iso_code}</Badge></TableCell>
                            <TableCell>
                              <Badge variant={item.status === 'empty' ? 'secondary' : 'default'}>{item.status}</Badge>
                            </TableCell>
                            <TableCell>{item.location_name}</TableCell>
                            <TableCell className="text-right">{item.total_quantity}</TableCell>
                            <TableCell className="text-right">{item.total_teu?.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="capacities" className="space-y-4">
                <div className="flex gap-4 p-4 border rounded-lg bg-card items-center">
                    <div className="flex items-center gap-2">
                        <Ship className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Vessel Class:</span>
                    </div>
                    <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                        <SelectTrigger className="w-[300px]">
                            <SelectValue placeholder="Select a vessel class" />
                        </SelectTrigger>
                        <SelectContent>
                            {vesselClasses.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Max Slots per Container Size</CardTitle>
                            <CardDescription>Capacity constraints for selected vessel class</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={capacityData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" />
                                    <YAxis dataKey="name" type="category" width={150} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="max_slots" name="Max Slots" fill="#8884d8" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Weight Limit per Slot</CardTitle>
                            <CardDescription>Maximum weight per container slot (kg)</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={capacityData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" />
                                    <YAxis dataKey="name" type="category" width={150} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="weight_limit" name="Weight Limit (kg)" fill="#82ca9d" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Capacity Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Container Size</TableHead>
                                    <TableHead>ISO Code</TableHead>
                                    <TableHead className="text-right">Max Slots</TableHead>
                                    <TableHead className="text-right">Weight Limit (kg)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {classCapacities.map((item, i) => (
                                    <TableRow 
                                        key={i} 
                                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => {
                                            if (item.container_sizes?.name) {
                                                setSelectedSize(formatContainerSize(item.container_sizes.name));
                                                setActiveTab('inventory');
                                            }
                                        }}
                                    >
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {formatContainerSize(item.container_sizes?.name)}
                                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                            </div>
                                        </TableCell>
                                        <TableCell><Badge variant="outline">{item.container_sizes?.iso_code}</Badge></TableCell>
                                        <TableCell className="text-right">{item.max_slots}</TableCell>
                                        <TableCell className="text-right">{item.weight_limit_per_slot_kg?.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                                {classCapacities.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                            No capacity data defined for this vessel class.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
