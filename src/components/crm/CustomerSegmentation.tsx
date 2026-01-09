import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, CartesianGrid, XAxis, YAxis, Bar, Tooltip, Legend } from 'recharts';
import { SkeletonCards } from '@/components/ui/skeleton-table';
import { EmptyState, emptyStates } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

export type SegmentCriteria = 'demographic' | 'behavioral' | 'geographic';

export type Segment = {
  id: string;
  name: string;
  size: number;
  color?: string;
  demographic?: { industry?: string; title?: string; company_size?: string };
  behavioral?: { last_activity_days?: number; email_opens?: number; site_visits?: number };
  geographic?: { region?: string; country?: string };
};

type CustomerSegmentationProps = {
  segments: Segment[];
  defaultCriteria?: SegmentCriteria;
  loading?: boolean;
  error?: string | null;
  className?: string;
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#fb7185'];

export function CustomerSegmentation({ segments, defaultCriteria = 'demographic', loading, error, className }: CustomerSegmentationProps) {
  const [criteria, setCriteria] = useState<SegmentCriteria>(defaultCriteria);
  const [tab, setTab] = useState<'distribution' | 'breakdown'>('distribution');

  const pieData = useMemo(() => {
    return segments.map((s, i) => ({
      name: s.name,
      value: s.size,
      fill: s.color || COLORS[i % COLORS.length],
    }));
  }, [segments]);

  const breakdownData = useMemo(() => {
    if (criteria === 'demographic') {
      const byIndustry: Record<string, number> = {};
      segments.forEach(s => {
        const key = (s.demographic?.industry || 'Other');
        byIndustry[key] = (byIndustry[key] || 0) + s.size;
      });
      return Object.entries(byIndustry).map(([industry, total]) => ({ label: industry, total }));
    }
    if (criteria === 'behavioral') {
      return segments.map(s => ({
        label: s.name,
        email_opens: s.behavioral?.email_opens || 0,
        site_visits: s.behavioral?.site_visits || 0,
      }));
    }
    const byRegion: Record<string, number> = {};
    segments.forEach(s => {
      const key = (s.geographic?.region || 'Other');
      byRegion[key] = (byRegion[key] || 0) + s.size;
    });
    return Object.entries(byRegion).map(([region, total]) => ({ label: region, total }));
  }, [segments, criteria]);

  if (loading) {
    return (
      <Card className={cn(className)}>
        <CardHeader>
          <CardTitle>Customer Segmentation</CardTitle>
          <CardDescription>Loading segments</CardDescription>
        </CardHeader>
        <CardContent>
          <SkeletonCards count={4} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn(className)}>
        <CardHeader>
          <CardTitle>Customer Segmentation</CardTitle>
          <CardDescription>Error state</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState {...emptyStates.error(error)} />
        </CardContent>
      </Card>
    );
  }

  if (!segments || segments.length === 0) {
    return (
      <Card className={cn(className)}>
        <CardHeader>
          <CardTitle>Customer Segmentation</CardTitle>
          <CardDescription>Empty state</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState {...emptyStates.noItems('Segment')} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('h-full flex flex-col', className)}>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Customer Segmentation</CardTitle>
            <CardDescription>Distribution and criteria-based breakdown</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={criteria} onValueChange={(v) => setCriteria(v as SegmentCriteria)}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Criteria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="demographic">Demographic</SelectItem>
                <SelectItem value="behavioral">Behavioral</SelectItem>
                <SelectItem value="geographic">Geographic</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'distribution' | 'breakdown')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="distribution">Distribution</TabsTrigger>
            <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {tab === 'distribution' && (
          <div className="grid gap-4 lg:grid-cols-7">
            <div className="col-span-4 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="col-span-3">
              <ScrollArea className="h-[320px] pr-3">
                <div className="space-y-2">
                  {segments.map((s, i) => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: s.color || COLORS[i % COLORS.length] }} />
                        <span className="text-sm font-medium">{s.name}</span>
                      </div>
                      <Badge variant="secondary" className="font-mono">{Intl.NumberFormat(undefined).format(s.size)}</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        {tab === 'breakdown' && (
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              {criteria === 'behavioral' ? (
                <BarChart data={breakdownData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="email_opens" fill="#06b6d4" name="Email Opens" />
                  <Bar dataKey="site_visits" fill="#8b5cf6" name="Site Visits" />
                </BarChart>
              ) : (
                <BarChart data={breakdownData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill="#3b82f6" name="Total" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
