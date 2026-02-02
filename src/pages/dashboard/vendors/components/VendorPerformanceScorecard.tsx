import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { format } from 'date-fns';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface VendorPerformanceScorecardProps {
  metrics: {
    total_score: number;
    on_time_delivery_score: number;
    quality_score: number;
    cost_score: number;
    responsiveness_score: number;
    snapshot_date: string;
    total_shipments?: number;
    late_shipments?: number;
    total_claims_value?: number;
  } | null;
  history: any[];
  onRefresh: () => void;
}

export function VendorPerformanceScorecard({ metrics, history, onRefresh }: VendorPerformanceScorecardProps) {
  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Scorecard</CardTitle>
          <CardDescription>No performance data available yet.</CardDescription>
        </CardHeader>
        <CardContent>
          <button 
            onClick={onRefresh}
            className="text-sm text-primary hover:underline"
          >
            Calculate Score Now
          </button>
        </CardContent>
      </Card>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Excellent</Badge>;
    if (score >= 70) return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Good</Badge>;
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Needs Improvement</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Top Level Score */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overall Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline space-x-2">
              <span className={`text-4xl font-bold ${getScoreColor(metrics.total_score)}`}>
                {metrics.total_score}
              </span>
              <span className="text-sm text-muted-foreground">/ 100</span>
            </div>
            <div className="mt-2">
              {getScoreBadge(metrics.total_score)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Last updated: {format(new Date(metrics.snapshot_date), 'MMM d, yyyy')}
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Score Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>On-Time Delivery (40%)</span>
                <span className="font-medium">{metrics.on_time_delivery_score}%</span>
              </div>
              <Progress value={metrics.on_time_delivery_score} className="h-2" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Quality Compliance (30%)</span>
                <span className="font-medium">{metrics.quality_score}%</span>
              </div>
              <Progress value={metrics.quality_score} className="h-2" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Cost Competitiveness (20%)</span>
                <span className="font-medium">{metrics.cost_score}%</span>
              </div>
              <Progress value={metrics.cost_score} className="h-2" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Responsiveness (10%)</span>
                <span className="font-medium">{metrics.responsiveness_score}%</span>
              </div>
              <Progress value={metrics.responsiveness_score} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Trend (90 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="snapshot_date" 
                  tickFormatter={(date) => format(new Date(date), 'MMM d')}
                />
                <YAxis domain={[0, 100]} />
                <Tooltip 
                  labelFormatter={(date) => format(new Date(date), 'MMM d, yyyy')}
                />
                <Legend />
                <Line type="monotone" dataKey="total_score" stroke="#2563eb" name="Overall" strokeWidth={2} />
                <Line type="monotone" dataKey="on_time_delivery_score" stroke="#16a34a" name="OTD" strokeWidth={1} strokeDasharray="5 5" />
                <Line type="monotone" dataKey="quality_score" stroke="#dc2626" name="Quality" strokeWidth={1} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
