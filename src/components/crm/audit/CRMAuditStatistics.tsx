// File: src/components/crm/audit/CRMAuditStatistics.tsx

import { Card, CardContent } from '@/components/ui/card';
import { ActivitySquare, Users, Zap } from 'lucide-react';

interface CRMAuditStatisticsProps {
  data: any[];
}

export function CRMAuditStatistics({ data }: CRMAuditStatisticsProps) {
  const uniqueUsers = new Set(data.map((e) => e.user_id)).size;
  const uniqueEntities = new Set(data.map((e) => e.entity_id)).size;
  const actionCounts = data.reduce(
    (acc, e) => {
      acc[e.action] = (acc[e.action] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const topAction = Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Events</p>
              <p className="text-2xl font-bold">{data.length}</p>
            </div>
            <ActivitySquare className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Users</p>
              <p className="text-2xl font-bold">{uniqueUsers}</p>
            </div>
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Most Common</p>
              <p className="text-2xl font-bold capitalize">{topAction?.[0] || '-'}</p>
              <p className="text-xs text-muted-foreground">{topAction?.[1] || 0} events</p>
            </div>
            <Zap className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
