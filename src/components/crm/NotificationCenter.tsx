import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, AlertCircle, CheckCircle2, Info, MoreVertical } from 'lucide-react';
import { SkeletonCards } from '@/components/ui/skeleton-table';
import { EmptyState, emptyStates } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

export type NotificationType = 'system' | 'activity' | 'alert';

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  description?: string;
  created_at: string;
  read?: boolean;
};

type NotificationCenterProps = {
  notifications: NotificationItem[];
  onMarkRead?: (id: string) => void;
  onDismiss?: (id: string) => void;
  loading?: boolean;
  error?: string | null;
  className?: string;
};

const typeIcon = (type: NotificationType) => {
  if (type === 'alert') return <AlertCircle className="h-4 w-4 text-red-600" />;
  if (type === 'system') return <Info className="h-4 w-4 text-blue-600" />;
  return <Bell className="h-4 w-4 text-amber-600" />;
};

export function NotificationCenter({ notifications, onMarkRead, onDismiss, loading, error, className }: NotificationCenterProps) {
  const [tab, setTab] = useState<'all' | 'unread' | 'system'>('all');

  const filtered = useMemo(() => {
    if (tab === 'unread') return notifications.filter(n => !n.read);
    if (tab === 'system') return notifications.filter(n => n.type === 'system');
    return notifications;
  }, [notifications, tab]);

  if (loading) {
    return (
      <Card className={cn(className)}>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <SkeletonCards count={3} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn(className)}>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState {...emptyStates.error(error)} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('h-full flex flex-col', className)}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Notification Center</CardTitle>
        <Badge variant="secondary" className="uppercase text-[10px]">New</Badge>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'all' | 'unread' | 'system')} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">
              All
              <Badge variant="secondary" className="ml-2">{notifications.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="unread">
              Unread
              <Badge variant="secondary" className="ml-2">{notifications.filter(n => !n.read).length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
          </TabsList>
          <TabsContent value={tab}>
            <ScrollArea className="h-[380px] pr-4">
              <div className="space-y-3">
                {filtered.length === 0 ? (
                  <EmptyState {...emptyStates.noItems('Notification')} />
                ) : (
                  filtered.map((n) => (
                    <div key={n.id} className={cn('p-3 rounded-lg border bg-card flex items-start justify-between gap-3', !n.read && 'border-primary/40')}>
                      <div className="flex items-start gap-3">
                        {typeIcon(n.type)}
                        <div className="space-y-1">
                          <div className="text-sm font-medium">{n.title}</div>
                          {n.description && <div className="text-xs text-muted-foreground">{n.description}</div>}
                          <div className="text-xs text-muted-foreground">{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(n.created_at))}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => onMarkRead?.(n.id)} aria-label="Mark as read">
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Mark read
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Actions">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onDismiss?.(n.id)}>Dismiss</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

