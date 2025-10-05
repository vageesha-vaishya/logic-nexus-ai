import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

interface UsageRecord {
  feature_key: string;
  usage_count: number;
  limit_count: number | null;
  period_start: string;
  period_end: string;
}

interface UsageMetricsProps {
  tenantId: string;
}

export function UsageMetrics({ tenantId }: UsageMetricsProps) {
  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { supabase } = useCRM();

  useEffect(() => {
    fetchUsage();
  }, [tenantId]);

  const fetchUsage = async () => {
    try {
      const { data, error } = await supabase
        .from('usage_records')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('period_end', new Date().toISOString())
        .order('feature_key');

      if (error) throw error;
      setUsageRecords(data || []);
    } catch (error: any) {
      toast.error('Failed to load usage data');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUsagePercentage = (usage: number, limit: number | null) => {
    if (!limit) return 0;
    return Math.min((usage / limit) * 100, 100);
  };

  const getUsageStatus = (usage: number, limit: number | null) => {
    if (!limit) return 'unlimited';
    const percentage = (usage / limit) * 100;
    if (percentage >= 90) return 'critical';
    if (percentage >= 75) return 'warning';
    return 'normal';
  };

  const formatFeatureName = (key: string) => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Loading usage data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage Metrics</CardTitle>
        <CardDescription>Current billing period usage</CardDescription>
      </CardHeader>
      <CardContent>
        {usageRecords.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No usage data available for this period
          </p>
        ) : (
          <div className="space-y-6">
            {usageRecords.map((record) => {
              const status = getUsageStatus(record.usage_count, record.limit_count);
              const percentage = getUsagePercentage(record.usage_count, record.limit_count);

              return (
                <div key={record.feature_key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {formatFeatureName(record.feature_key)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {record.usage_count} / {record.limit_count || '∞'}
                        {record.limit_count ? ' used' : ' (unlimited)'}
                      </p>
                    </div>
                    {status === 'critical' && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Limit Reached
                      </Badge>
                    )}
                    {status === 'warning' && (
                      <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-500">
                        <AlertCircle className="h-3 w-3" />
                        Near Limit
                      </Badge>
                    )}
                  </div>
                  {record.limit_count && (
                    <Progress 
                      value={percentage} 
                      className={
                        status === 'critical' 
                          ? '[&>div]:bg-red-500' 
                          : status === 'warning' 
                          ? '[&>div]:bg-yellow-500' 
                          : ''
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}