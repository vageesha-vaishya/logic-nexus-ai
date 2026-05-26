/**
 * RoutingRulesSheet — per-connection m:n broker → portfolio routing.
 *
 * Edits markets.broker_portfolio_links rows + the connection's default
 * portfolio_id. See docs/plans/2026-05-26-broker-portfolio-routing-design.md
 * for the contract:
 *   • Default destination = broker_connections.portfolio_id (catch-all).
 *   • Override rules = broker_portfolio_links with sync_filter.segments[].
 *   • Worker walks links first, falls back to default.
 *
 * The sheet auto-triggers a sync after any save so the new routing takes
 * effect immediately.
 */
import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2, ArrowRight, Info } from "lucide-react";
import { toast } from "sonner";

import {
  Badge,
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/design-system";
import { SheetDescription } from "@/components/ui/sheet";

import {
  BrokerConnection,
  SupportedBroker,
  useBrokerConnections,
  useTriggerBrokerSync,
} from "../hooks/useBrokerConnections";
import {
  RoutingSegment,
  useBrokerPortfolioLinks,
  useCreateBrokerPortfolioLink,
  useDeleteBrokerPortfolioLink,
  useSetDefaultPortfolio,
} from "../hooks/useBrokerPortfolioLinks";
import { useCreatePortfolio, usePortfolios } from "../hooks/usePortfolios";

const NEW_PORTFOLIO = "__new__";

const SEGMENT_LABELS: Record<RoutingSegment, string> = {
  equity:    "Equity",
  fno:       "F&O",
  currency:  "Currency",
  commodity: "Commodity",
  mf:        "Mutual Funds",
};

interface RoutingRulesSheetProps {
  connection: BrokerConnection | null;
  broker:     SupportedBroker | null;
  open:       boolean;
  onClose:    () => void;
}

export function RoutingRulesSheet({
  connection, broker, open, onClose,
}: RoutingRulesSheetProps) {
  const portfoliosQuery = usePortfolios();
  const linksQuery      = useBrokerPortfolioLinks(connection?.id);
  const createPortfolio = useCreatePortfolio();
  const createLink      = useCreateBrokerPortfolioLink();
  const deleteLink      = useDeleteBrokerPortfolioLink();
  const setDefault      = useSetDefaultPortfolio();
  const triggerSync     = useTriggerBrokerSync();
  const connectionsQuery = useBrokerConnections();

  // Track "Add rule" form state.
  const [showAddForm, setShowAddForm]         = useState(false);
  const [selectedSegments, setSelectedSegs]   = useState<RoutingSegment[]>([]);
  const [destChoice, setDestChoice]           = useState<string>(NEW_PORTFOLIO);
  const [newPortfolioName, setNewPortfolio]   = useState<string>("");

  const portfolios = portfoliosQuery.data ?? [];
  const links      = linksQuery.data ?? [];

  // Mirror the most up-to-date default from the connections list (the
  // prop's `connection` snapshot may be stale after a setDefault call).
  const liveConnection = useMemo(
    () => (connectionsQuery.data ?? []).find(c => c.id === connection?.id) ?? connection,
    [connectionsQuery.data, connection],
  );

  if (!connection || !broker || !liveConnection) return null;

  const portfolioName = (pid: string | null | undefined) =>
    portfolios.find(p => p.id === pid)?.name ?? "—";

  // Segments already claimed by another active rule. The Add form blocks
  // any chip that overlaps.
  const claimedSegments = new Set<RoutingSegment>(
    links.flatMap(l => (l.sync_filter?.segments ?? []) as RoutingSegment[]),
  );

  // The broker's `supports` array uses the same labels we route on.
  const availableSegments = (broker.supports as RoutingSegment[]).filter(
    s => Object.prototype.hasOwnProperty.call(SEGMENT_LABELS, s),
  );

  function resetAddForm() {
    setShowAddForm(false);
    setSelectedSegs([]);
    setDestChoice(NEW_PORTFOLIO);
    setNewPortfolio("");
  }

  async function handleSetDefault(newPid: string) {
    if (!liveConnection) return;
    if (newPid === liveConnection.portfolio_id) return;
    try {
      await setDefault.mutateAsync({
        broker_connection_id: liveConnection.id,
        portfolio_id:         newPid,
      });
      triggerSync.mutate(liveConnection.id);
      toast.success("Default portfolio updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update default");
    }
  }

  async function handleSaveRule() {
    if (!liveConnection || selectedSegments.length === 0) return;

    // Resolve destination portfolio: existing or freshly created.
    let portfolio_id = destChoice;
    if (destChoice === NEW_PORTFOLIO) {
      const defaultName = `${broker.name} — ${selectedSegments.join("/")}`;
      const name = newPortfolioName.trim() || defaultName;
      try {
        const created = await createPortfolio.mutateAsync({
          name,
          description:   `Auto-created routing target for ${broker.name}`,
          mode:          "paper",
          base_currency: "INR",
          holder_type:   "self_directed",
        });
        portfolio_id = created.id;
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to create portfolio");
        return;
      }
    }

    try {
      await createLink.mutateAsync({
        broker_connection_id: liveConnection.id,
        portfolio_id,
        segments:             selectedSegments,
      });
      triggerSync.mutate(liveConnection.id);
      toast.success("Routing rule added");
      resetAddForm();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to add rule");
    }
  }

  async function handleDeleteRule(linkId: string) {
    if (!liveConnection) return;
    try {
      await deleteLink.mutateAsync({
        id: linkId,
        broker_connection_id: liveConnection.id,
      });
      triggerSync.mutate(liveConnection.id);
      toast.success("Rule removed");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to remove rule");
    }
  }

  const conflictSegments = selectedSegments.filter(s => claimedSegments.has(s));
  const canSaveRule =
    selectedSegments.length > 0 &&
    conflictSegments.length === 0 &&
    (destChoice !== NEW_PORTFOLIO || newPortfolioName.trim().length > 0 || true /* default name used */) &&
    !createLink.isPending &&
    !createPortfolio.isPending;

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) { resetAddForm(); onClose(); } }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Routing rules — {liveConnection.display_name}</SheetTitle>
          <SheetDescription>
            Send specific segments of this broker's holdings to different portfolios.
            Anything not matched lands in the default below.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* ── Default destination ────────────────────────────────────── */}
          <div className="space-y-2">
            <Label htmlFor="default-portfolio">Default destination</Label>
            <Select
              value={liveConnection.portfolio_id ?? undefined}
              onValueChange={handleSetDefault}
            >
              <SelectTrigger id="default-portfolio">
                <SelectValue placeholder="Pick a portfolio" />
              </SelectTrigger>
              <SelectContent>
                {portfolios.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Holdings that don't match a specific rule go here.
            </p>
          </div>

          {/* ── Override rules list ────────────────────────────────────── */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label>Override rules</Label>
              {!showAddForm && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Add rule
                </Button>
              )}
            </div>

            {linksQuery.isPending && (
              <p className="text-xs text-muted-foreground">Loading…</p>
            )}

            {linksQuery.isSuccess && links.length === 0 && !showAddForm && (
              <p className="text-xs text-muted-foreground italic">
                No overrides. All holdings from this broker land in the default portfolio above.
              </p>
            )}

            {links.map(l => {
              const segs = (l.sync_filter?.segments ?? []) as RoutingSegment[];
              return (
                <div
                  key={l.id}
                  className="flex items-center gap-2 rounded border bg-card px-2 py-1.5 text-xs"
                >
                  <div className="flex flex-wrap gap-1">
                    {segs.map(s => (
                      <Badge key={s} variant="secondary" className="text-[10px]">
                        {SEGMENT_LABELS[s] ?? s}
                      </Badge>
                    ))}
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate flex-1">
                    {portfolioName(l.portfolio_id)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleDeleteRule(l.id)}
                    title="Remove rule"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}

            {/* ── Add rule inline form ─────────────────────────────────── */}
            {showAddForm && (
              <div className="rounded border bg-muted/30 p-3 space-y-3 mt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Segments</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {availableSegments.map(seg => {
                      const chosen   = selectedSegments.includes(seg);
                      const conflict = claimedSegments.has(seg);
                      return (
                        <button
                          key={seg}
                          type="button"
                          onClick={() => {
                            if (conflict) return;
                            setSelectedSegs(p =>
                              p.includes(seg) ? p.filter(x => x !== seg) : [...p, seg]
                            );
                          }}
                          disabled={conflict}
                          className={`px-2 py-0.5 rounded border text-[11px] font-medium transition-colors ${
                            conflict
                              ? "opacity-40 cursor-not-allowed bg-muted line-through"
                              : chosen
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-card hover:bg-accent"
                          }`}
                          title={conflict ? "Already routed via another rule" : ""}
                        >
                          {SEGMENT_LABELS[seg] ?? seg}
                        </button>
                      );
                    })}
                  </div>
                  {claimedSegments.size > 0 && (
                    <p className="text-[10px] text-muted-foreground flex items-start gap-1">
                      <Info className="h-3 w-3 mt-0.5 shrink-0" />
                      Segments already routed via another rule are disabled.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Destination portfolio</Label>
                  <Select value={destChoice} onValueChange={setDestChoice}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Choose a portfolio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NEW_PORTFOLIO}>Create new portfolio…</SelectItem>
                      {portfolios
                        .filter(p => p.id !== liveConnection.portfolio_id)
                        .map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {destChoice === NEW_PORTFOLIO && (
                    <input
                      type="text"
                      value={newPortfolioName}
                      onChange={e => setNewPortfolio(e.target.value)}
                      placeholder={`${broker.name} — ${selectedSegments.join("/") || "rule"}`}
                      className="w-full h-8 text-xs rounded border border-input bg-background px-2"
                      autoComplete="off"
                    />
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={resetAddForm}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={handleSaveRule}
                    disabled={!canSaveRule}
                  >
                    {createLink.isPending || createPortfolio.isPending ? (
                      <><Loader2 className="h-3 w-3 animate-spin mr-1" />Saving…</>
                    ) : "Save rule"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => { resetAddForm(); onClose(); }}>
              Done
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
