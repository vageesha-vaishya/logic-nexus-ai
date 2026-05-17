/**
 * Markets — Price Alerts page.
 *
 * Route: /dashboard/markets/alerts
 *
 * Shows all user price alerts grouped by status (Active / Triggered / All).
 */

import { useState } from "react";
import { Bell, BellOff, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  SkeletonCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/design-system";

import { usePriceAlerts, useCancelPriceAlert, type PriceAlert, type AlertStatus } from "../hooks/usePriceAlerts";
import { useLTP } from "../hooks/useLTP";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtINR(n: number | null | undefined): string {
  if (n == null) return "—";
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd MMM yyyy, HH:mm");
  } catch {
    return iso;
  }
}

const STATUS_BADGE: Record<AlertStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active:    { label: "Active",    variant: "default" },
  triggered: { label: "Triggered", variant: "outline" },
  cancelled: { label: "Cancelled", variant: "secondary" },
  expired:   { label: "Expired",   variant: "secondary" },
};

// ── LTP lookup for a list of symbols ─────────────────────────────────────────

function useAlertsLtp(alerts: PriceAlert[]) {
  const symbols = [...new Set(alerts.map((a) => a.symbol))];
  return useLTP(symbols);
}

// ── Alert row ─────────────────────────────────────────────────────────────────

function AlertRow({
  alert,
  ltp,
  showCancel,
}: {
  alert: PriceAlert;
  ltp: number | null | undefined;
  showCancel: boolean;
}) {
  const cancel = useCancelPriceAlert();
  const cfg = STATUS_BADGE[alert.status] ?? STATUS_BADGE.cancelled;

  const handleCancel = () => {
    cancel.mutate(alert.id, {
      onSuccess: () => toast.success("Alert cancelled"),
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <TableRow>
      <TableCell className="font-mono font-medium">{alert.symbol}</TableCell>
      <TableCell>
        <Badge variant="outline" className="text-[10px]">{alert.exchange}</Badge>
      </TableCell>
      <TableCell className="capitalize">{alert.condition}</TableCell>
      <TableCell className="text-right font-mono">{fmtINR(alert.trigger_price)}</TableCell>
      <TableCell className="text-right font-mono text-muted-foreground">
        {ltp != null ? fmtINR(ltp) : "—"}
      </TableCell>
      <TableCell>
        <Badge variant={cfg.variant} className="text-[10px]">{cfg.label}</Badge>
      </TableCell>
      {alert.status === "triggered" ? (
        <TableCell className="text-right font-mono text-xs text-muted-foreground">
          {alert.triggered_price != null ? fmtINR(alert.triggered_price) : "—"}
          {alert.triggered_at && (
            <div className="text-[10px]">{fmtDateTime(alert.triggered_at)}</div>
          )}
        </TableCell>
      ) : (
        <TableCell className="text-xs text-muted-foreground">{fmtDateTime(alert.created_at)}</TableCell>
      )}
      <TableCell className="text-right">
        {showCancel && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={handleCancel}
            disabled={cancel.isPending}
          >
            {cancel.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
            <span className="sr-only">Cancel</span>
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

// ── Alerts table ──────────────────────────────────────────────────────────────

function AlertsTable({
  alerts,
  emptyTitle,
  emptyDescription,
}: {
  alerts: PriceAlert[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  const { data: ltpMap } = useAlertsLtp(alerts);

  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <EmptyState
            icon={<BellOff className="h-10 w-10" />}
            title={emptyTitle}
            description={emptyDescription}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead>Exchange</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead className="text-right">Trigger Price</TableHead>
              <TableHead className="text-right">Current LTP</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Info</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts.map((alert) => (
              <AlertRow
                key={alert.id}
                alert={alert}
                ltp={ltpMap?.[alert.symbol]?.ltp}
                showCancel={alert.status === "active"}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PriceAlertsPage() {
  const [tab, setTab] = useState<"active" | "triggered" | "all">("active");
  const { data: alerts = [], isPending, isError, error, refetch } = usePriceAlerts();

  const activeAlerts    = alerts.filter((a) => a.status === "active");
  const triggeredAlerts = alerts.filter((a) => a.status === "triggered");

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Bell className="h-6 w-6" />
              Price Alerts
              {activeAlerts.length > 0 && (
                <Badge variant="default" className="text-xs">
                  {activeAlerts.length} active
                </Badge>
              )}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Alerts fire when LTP crosses your trigger price. Checked every 30 seconds.
            </p>
          </div>
        </header>

        {isPending && (
          <div className="space-y-4">
            <SkeletonCard withHeader lines={3} />
          </div>
        )}

        {isError && (
          <ErrorState
            title="Failed to load alerts"
            message={error?.message ?? "Unknown error"}
            onRetry={() => refetch()}
          />
        )}

        {!isPending && !isError && (
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="active">
                Active
                {activeAlerts.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-[10px]">
                    {activeAlerts.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="triggered">
                Triggered
                {triggeredAlerts.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-[10px]">
                    {triggeredAlerts.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4">
              <AlertsTable
                alerts={activeAlerts}
                emptyTitle="No active alerts"
                emptyDescription="Open a watchlist and click the bell icon on any instrument to set a price alert."
              />
            </TabsContent>

            <TabsContent value="triggered" className="mt-4">
              <AlertsTable
                alerts={triggeredAlerts}
                emptyTitle="No triggered alerts"
                emptyDescription="Alerts that have fired will appear here."
              />
            </TabsContent>

            <TabsContent value="all" className="mt-4">
              <AlertsTable
                alerts={alerts}
                emptyTitle="No alerts yet"
                emptyDescription="Open a watchlist and click the bell icon on any instrument to set a price alert."
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
