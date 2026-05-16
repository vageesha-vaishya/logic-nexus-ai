/**
 * Feature Flags admin page — /dashboard/settings/feature-flags
 * Platform admin only.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Flag, Loader2, RefreshCw, Search, Shield } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle,
  Input, Switch, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/design-system";
import { supabase } from "@/integrations/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FlagRow {
  id:          string;
  key:         string;
  name:        string;
  description: string | null;
  enabled:     boolean;
  rollout_pct: number;
  tags:        string[];
  updated_at:  string;
}

// ── Edge function caller ──────────────────────────────────────────────────────

async function callFlags(action: string, body?: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/feature-flags`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
      },
      body: JSON.stringify({ action, ...body }),
    }
  );
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? "Feature flags error");
  return json.data;
}

// ── Tag badge ─────────────────────────────────────────────────────────────────

const TAG_COLORS: Record<string, string> = {
  markets:  "bg-blue-100 text-blue-700",
  billing:  "bg-violet-100 text-violet-700",
  platform: "bg-amber-100 text-amber-700",
  signals:  "bg-emerald-100 text-emerald-700",
};

function TagBadge({ tag }: { tag: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${TAG_COLORS[tag] ?? "bg-gray-100 text-gray-600"}`}>
      {tag}
    </span>
  );
}

// ── Flag row ──────────────────────────────────────────────────────────────────

function FlagRow({ flag, onToggle, toggling }: {
  flag:     FlagRow;
  onToggle: (key: string, enabled: boolean) => void;
  toggling: boolean;
}) {
  return (
    <div className="flex items-center gap-4 py-3 px-4 border-b last:border-0 hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-medium">{flag.key}</span>
          {flag.rollout_pct < 100 && (
            <Badge variant="outline" className="text-xs h-4 px-1.5">
              {flag.rollout_pct}% rollout
            </Badge>
          )}
          {flag.tags.map(t => <TagBadge key={t} tag={t} />)}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 truncate">
          {flag.name}{flag.description ? ` — ${flag.description}` : ""}
        </div>
      </div>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 shrink-0">
              {toggling && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              <Switch
                checked={flag.enabled}
                onCheckedChange={(v) => onToggle(flag.key, v)}
                disabled={toggling}
                className="data-[state=checked]:bg-emerald-500"
              />
              <span className={`text-xs font-medium w-10 ${flag.enabled ? "text-emerald-600" : "text-muted-foreground"}`}>
                {flag.enabled ? "ON" : "OFF"}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {flag.enabled ? "Click to disable" : "Click to enable"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FeatureFlagsPage() {
  const [search, setSearch]   = useState("");
  const [tagFilter, setTag]   = useState<string | null>(null);
  const [togglingKey, setKey] = useState<string | null>(null);
  const qc = useQueryClient();

  const flagsQ = useQuery({
    queryKey: ["admin", "feature-flags"],
    staleTime: 30_000,
    queryFn: () => callFlags("list") as Promise<{ flags: FlagRow[] }>,
  });

  const toggleMut = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      callFlags("upsert", {
        key,
        name:    flagsQ.data?.flags.find(f => f.key === key)?.name ?? key,
        enabled,
      }),
    onMutate:  ({ key }) => setKey(key),
    onSettled: () => setKey(null),
    onSuccess: (_, { key, enabled }) => {
      toast.success(`${key} → ${enabled ? "enabled" : "disabled"}`);
      qc.invalidateQueries({ queryKey: ["admin", "feature-flags"] });
      qc.invalidateQueries({ queryKey: ["feature-flags"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows  = flagsQ.data?.flags ?? [];
  const allTags = [...new Set(rows.flatMap(f => f.tags))].sort();

  const filtered = rows.filter(f => {
    const q = search.toLowerCase();
    const matchQ = !q || f.key.includes(q) || f.name.toLowerCase().includes(q);
    const matchT = !tagFilter || f.tags.includes(tagFilter);
    return matchQ && matchT;
  });

  // Group by first tag
  const groups: Record<string, FlagRow[]> = {};
  for (const f of filtered) {
    const grp = f.tags[0] ?? "other";
    (groups[grp] ??= []).push(f);
  }

  const enabledCount  = rows.filter(f => f.enabled).length;
  const disabledCount = rows.length - enabledCount;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6 p-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Flag className="h-5 w-5 text-muted-foreground" />
              Feature Flags
            </h1>
            <p className="text-sm text-muted-foreground">
              Control feature availability across tenants and users.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-emerald-600 border-emerald-200">
              {enabledCount} enabled
            </Badge>
            <Badge variant="outline" className="text-muted-foreground">
              {disabledCount} disabled
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => flagsQ.refetch()}>
              <RefreshCw className={`h-3.5 w-3.5 ${flagsQ.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search flags…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <Button
              variant={tagFilter === null ? "default" : "outline"}
              size="sm" className="h-8 text-xs"
              onClick={() => setTag(null)}
            >
              All
            </Button>
            {allTags.map(t => (
              <Button
                key={t}
                variant={tagFilter === t ? "default" : "outline"}
                size="sm" className="h-8 text-xs"
                onClick={() => setTag(t === tagFilter ? null : t)}
              >
                {t}
              </Button>
            ))}
          </div>
        </div>

        {/* Maintenance mode callout */}
        {rows.find(f => f.key === "platform.maintenance_mode")?.enabled && (
          <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            <Shield className="h-4 w-4 shrink-0" />
            <strong>Maintenance mode is ON</strong> — non-admin users see a maintenance banner.
          </div>
        )}

        {flagsQ.isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : flagsQ.isError ? (
          <Card>
            <CardContent className="py-12 text-center text-destructive text-sm">
              {String(flagsQ.error)}
            </CardContent>
          </Card>
        ) : (
          Object.entries(groups).map(([group, flags]) => (
            <Card key={group} className="overflow-hidden">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm font-semibold capitalize flex items-center gap-2">
                  <TagBadge tag={group} />
                  <span>{group} flags</span>
                  <span className="text-xs font-normal text-muted-foreground ml-auto">
                    {flags.filter(f => f.enabled).length}/{flags.length} enabled
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {flags.map(flag => (
                  <FlagRow
                    key={flag.key}
                    flag={flag}
                    onToggle={(key, enabled) => toggleMut.mutate({ key, enabled })}
                    toggling={togglingKey === flag.key}
                  />
                ))}
              </CardContent>
            </Card>
          ))
        )}

        {!flagsQ.isLoading && filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No flags match your filter.
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Changes take effect within 60 seconds (client cache TTL).
          Use tenant overrides for per-customer control.
        </p>
      </div>
    </DashboardLayout>
  );
}
