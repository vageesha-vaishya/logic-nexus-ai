// AogAlertsListPage — live queue + history of AOG alerts. Per
// docs/plans/2026-06-04-aog-alert-surface-design.md slice S4.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Siren, Plus, Loader2, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useAogAlerts,
  type AogPriority,
  type AogStatus,
} from '../hooks/useAogAlerts';
import { AogDeclareDialog } from '../components/aog/AogDeclareDialog';

const STATUS_VARIANT: Record<AogStatus, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  declared: 'destructive',
  triaged: 'destructive',
  assigned: 'default',
  in_progress: 'default',
  resolved: 'secondary',
  cancelled: 'outline',
};

const PRIORITY_VARIANT: Record<AogPriority, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  P1_AOG_CRITICAL: 'destructive',
  P2_AOG_URGENT: 'destructive',
  P3_AOG_PLANNED: 'default',
  P4_DEFER_MEL: 'secondary',
};

const STATUS_LABEL: Record<AogStatus, string> = {
  declared: 'Declared',
  triaged: 'Triaged',
  assigned: 'Assigned',
  in_progress: 'In progress',
  resolved: 'Resolved',
  cancelled: 'Cancelled',
};

export default function AogAlertsListPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<'active' | AogStatus | 'all'>('active');
  const [airportFilter, setAirportFilter] = useState('');
  const [declareOpen, setDeclareOpen] = useState(false);

  const alertsQuery = useAogAlerts({
    status: statusFilter === 'all' ? null : statusFilter,
    airport_iata: airportFilter ? airportFilter.toUpperCase() : null,
  });

  const alerts = alertsQuery.data?.records ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-4 p-4 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Siren className="h-6 w-6 text-rose-600" />
              AOG Alerts
            </h1>
            <p className="text-sm text-muted-foreground">
              Aircraft on Ground triage queue. Declare → triage → assign → resolve.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void alertsQuery.refetch()}
              disabled={alertsQuery.isFetching}
            >
              {alertsQuery.isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            <Button onClick={() => setDeclareOpen(true)} variant="destructive">
              <Plus className="mr-2 h-4 w-4" />
              Declare AOG
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Queue</CardTitle>
            <CardDescription>
              {alerts.length} alert{alerts.length === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active (not closed)</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="declared">Declared</SelectItem>
                    <SelectItem value="triaged">Triaged</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="in_progress">In progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input
                placeholder="Airport IATA (e.g. DEL)"
                value={airportFilter}
                onChange={(e) => setAirportFilter(e.target.value)}
                className="w-44"
              />
            </div>

            {alertsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading alerts…
              </div>
            ) : alerts.length === 0 ? (
              <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">
                No AOG alerts match the current filters.
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">Alert #</TableHead>
                      <TableHead>Aircraft</TableHead>
                      <TableHead>Airport</TableHead>
                      <TableHead>Defect</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Reported</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts.map((a) => (
                      <TableRow
                        key={a.id}
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => navigate(`/dashboard/amro/aog/${a.id}`)}
                      >
                        <TableCell className="font-mono text-xs">
                          <Link
                            to={`/dashboard/amro/aog/${a.id}`}
                            className="text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {a.alert_number}
                          </Link>
                        </TableCell>
                        <TableCell>{a.aircraft_registration || '—'}</TableCell>
                        <TableCell className="font-mono">{a.airport_iata}</TableCell>
                        <TableCell className="max-w-md truncate">{a.defect_summary}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[a.status]}>
                            {STATUS_LABEL[a.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {a.priority ? (
                            <Badge variant={PRIORITY_VARIANT[a.priority]} className="text-xs">
                              {a.priority.replace('_', ' ')}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(a.reported_at), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <AogDeclareDialog open={declareOpen} onOpenChange={setDeclareOpen} />
      </div>
    </DashboardLayout>
  );
}
