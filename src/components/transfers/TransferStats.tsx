import { Card, CardContent } from '@/components/ui/card';
import { ArrowRightLeft, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface TransferStatsProps {
  stats: {
    total: number;
    pending: number;
    completed: number;
    rejected: number;
    failed: number;
  };
}

export function TransferStats({ stats }: TransferStatsProps) {
  const statItems = [
    { 
      label: 'Total Transfers', 
      value: stats.total, 
      icon: ArrowRightLeft, 
      color: 'text-foreground',
      bg: 'bg-muted'
    },
    { 
      label: 'Pending Approval', 
      value: stats.pending, 
      icon: Clock, 
      color: 'text-yellow-600',
      bg: 'bg-yellow-50 dark:bg-yellow-950/20'
    },
    { 
      label: 'Completed', 
      value: stats.completed, 
      icon: CheckCircle, 
      color: 'text-green-600',
      bg: 'bg-green-50 dark:bg-green-950/20'
    },
    { 
      label: 'Rejected', 
      value: stats.rejected, 
      icon: XCircle, 
      color: 'text-red-600',
      bg: 'bg-red-50 dark:bg-red-950/20'
    },
    { 
      label: 'Failed', 
      value: stats.failed, 
      icon: AlertTriangle, 
      color: 'text-orange-600',
      bg: 'bg-orange-50 dark:bg-orange-950/20'
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-5">
      {statItems.map((item) => (
        <Card key={item.label} className={item.bg}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <item.icon className={`h-5 w-5 ${item.color}`} />
              <div>
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
