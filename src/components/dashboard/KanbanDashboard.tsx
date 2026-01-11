import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LayoutGrid, TrendingUp, Package, FileText, Target, CheckSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { FunnelChart, Funnel, LabelList } from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { useCRM } from "@/hooks/useCRM";
import { ScopedDataAccess, DataAccessContext } from "@/lib/db/access";
import { Input } from "@/components/ui/input";

interface KanbanStats {
  leads: { total: number; byStage: Record<string, number>; avgDays?: Record<string, number> };
  opportunities: { total: number; byStage: Record<string, number>; totalValue: number; avgDays?: Record<string, number> };
  quotes: { total: number; byStatus: Record<string, number>; totalValue: number; avgDays?: Record<string, number> };
  shipments: { total: number; byStatus: Record<string, number> };
  activities: { total: number; byStatus: Record<string, number> };
}

export function KanbanDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { context } = useCRM();
  const [stats, setStats] = useState<KanbanStats>({
    leads: { total: 0, byStage: {} },
    opportunities: { total: 0, byStage: {}, totalValue: 0 },
    quotes: { total: 0, byStatus: {}, totalValue: 0 },
    shipments: { total: 0, byStatus: {} },
    activities: { total: 0, byStatus: {} },
  });
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<"30d" | "90d" | "12m" | "all">("all");
  const [ownerFilter, setOwnerFilter] = useState<"all" | "me">("all");
  const [activeTab, setActiveTab] = useState<"leads" | "opportunities" | "quotes">("leads");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [franchiseFilter, setFranchiseFilter] = useState<string>("all");
  const [franchises, setFranchises] = useState<Array<{ id: string; name: string }>>([]);

  const LABEL_TEXT_DARK = "#0f172a";
  const LABEL_TEXT_LIGHT = "#ffffff";
  const LABEL_SHADOW_OPACITY_LIGHT = 0.40;
  const LABEL_SHADOW_OPACITY_DARK = 0.30;

  const fetchKanbanStats = useCallback(async () => {
    try {
      setLoading(true);
      const now = new Date();
      const from = (() => {
        if (timeframe === "30d") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (timeframe === "90d") return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        if (timeframe === "12m") return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        return null;
      })();

      const db = new ScopedDataAccess(supabase as any, context as unknown as DataAccessContext);

      let leadsQuery = (db.from("leads") as any).select("status, owner_id, created_at, franchise_id, tenant_id");
      if (from) leadsQuery = leadsQuery.gte("created_at", from.toISOString());
      if (dateFrom) leadsQuery = leadsQuery.gte("created_at", new Date(dateFrom).toISOString());
      if (dateTo) leadsQuery = leadsQuery.lte("created_at", new Date(dateTo).toISOString());
      if (ownerFilter === "me" && user?.id) leadsQuery = leadsQuery.eq("owner_id", user.id);
      if (context.isPlatformAdmin) {
        if (franchiseFilter !== "all") leadsQuery = leadsQuery.eq("franchise_id", franchiseFilter);
      } else {
        if (context.franchiseId) leadsQuery = leadsQuery.eq("franchise_id", context.franchiseId);
        else if (context.tenantId) leadsQuery = leadsQuery.eq("tenant_id", context.tenantId as string);
      }

      let oppsQuery = (db.from("opportunities") as any).select("stage, amount, owner_id, created_at, account_id, franchise_id, tenant_id");
      if (from) oppsQuery = oppsQuery.gte("created_at", from.toISOString());
      if (dateFrom) oppsQuery = oppsQuery.gte("created_at", new Date(dateFrom).toISOString());
      if (dateTo) oppsQuery = oppsQuery.lte("created_at", new Date(dateTo).toISOString());
      if (ownerFilter === "me" && user?.id) oppsQuery = oppsQuery.eq("owner_id", user.id);
      if (accountFilter !== "all") oppsQuery = oppsQuery.eq("account_id", accountFilter);
      if (context.isPlatformAdmin) {
        if (franchiseFilter !== "all") oppsQuery = oppsQuery.eq("franchise_id", franchiseFilter);
      } else {
        if (context.franchiseId) oppsQuery = oppsQuery.eq("franchise_id", context.franchiseId);
        else if (context.tenantId) oppsQuery = oppsQuery.eq("tenant_id", context.tenantId as string);
      }

      let quotesQuery = (db.from("quotes") as any).select("status, sell_price, created_at, account_id, franchise_id, tenant_id");
      if (from) quotesQuery = quotesQuery.gte("created_at", from.toISOString());
      if (dateFrom) quotesQuery = quotesQuery.gte("created_at", new Date(dateFrom).toISOString());
      if (dateTo) quotesQuery = quotesQuery.lte("created_at", new Date(dateTo).toISOString());
      if (accountFilter !== "all") quotesQuery = quotesQuery.eq("account_id", accountFilter);
      if (context.isPlatformAdmin) {
        if (franchiseFilter !== "all") quotesQuery = quotesQuery.eq("franchise_id", franchiseFilter);
      } else {
        if (context.franchiseId) quotesQuery = quotesQuery.eq("franchise_id", context.franchiseId);
        else if (context.tenantId) quotesQuery = quotesQuery.eq("tenant_id", context.tenantId as string);
      }

      let shipmentsQuery = (db.from("shipments") as any).select("status, tenant_id, franchise_id");
      let activitiesQuery = (db.from("activities") as any).select("status, tenant_id, franchise_id");

      const [leadsData, opportunitiesData, quotesData, shipmentsData, activitiesData] = await Promise.all([
        leadsQuery,
        oppsQuery,
        quotesQuery,
        shipmentsQuery,
        activitiesQuery,
      ]);

      const leadsByStage = (leadsData.data || []).reduce((acc, lead) => {
        acc[lead.status] = (acc[lead.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const oppsByStage = (opportunitiesData.data || []).reduce((acc, opp) => {
        acc[opp.stage] = (acc[opp.stage] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const oppsValue = (opportunitiesData.data || []).reduce((sum, opp) => sum + (Number(opp.amount) || 0), 0);

      const quotesByStatus = (quotesData.data || []).reduce((acc, quote) => {
        acc[quote.status] = (acc[quote.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const quotesValue = (quotesData.data || []).reduce((sum, quote) => sum + (Number(quote.sell_price) || 0), 0);

      const shipmentsByStatus = (shipmentsData.data || []).reduce((acc, shipment) => {
        acc[shipment.status] = (acc[shipment.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const activitiesByStatus = (activitiesData.data || []).reduce((acc, activity) => {
        acc[activity.status] = (acc[activity.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const avgDaysFrom = <T extends { created_at: string }>(items: T[], getKey: (it: T) => string | undefined, getEnteredAt?: (it: T) => string | undefined) => {
        const nowTs = Date.now();
        const grouped: Record<string, { totalDays: number; count: number }> = {};
        (items || []).forEach((it) => {
          const k = getKey(it);
          if (!k) return;
          const startStr = getEnteredAt?.(it) || it.created_at;
          const start = new Date(startStr).getTime();
          const days = Math.max(0, Math.round((nowTs - start) / (1000 * 60 * 60 * 24)));
          const g = grouped[k] || { totalDays: 0, count: 0 };
          g.totalDays += days;
          g.count += 1;
          grouped[k] = g;
        });
        const result: Record<string, number> = {};
        Object.keys(grouped).forEach((k) => {
          const g = grouped[k];
          result[k] = g.count > 0 ? Math.round(g.totalDays / g.count) : 0;
        });
        return result;
      };

      setStats({
        leads: { 
          total: leadsData.data?.length || 0, 
          byStage: leadsByStage,
          avgDays: avgDaysFrom(leadsData.data as Array<{ status: string; created_at: string }>, (it) => it.status)
        },
        opportunities: { 
          total: opportunitiesData.data?.length || 0, 
          byStage: oppsByStage,
          totalValue: oppsValue,
          avgDays: avgDaysFrom(opportunitiesData.data as Array<{ stage: string; created_at: string }>, (it) => it.stage)
        },
        quotes: { 
          total: quotesData.data?.length || 0, 
          byStatus: quotesByStatus,
          totalValue: quotesValue,
          avgDays: avgDaysFrom(quotesData.data as Array<{ status: string; created_at: string }>, (it) => it.status)
        },
        shipments: { 
          total: shipmentsData.data?.length || 0, 
          byStatus: shipmentsByStatus 
        },
        activities: { 
          total: activitiesData.data?.length || 0, 
          byStatus: activitiesByStatus 
        },
      });
    } catch (error) {
      console.error("Error fetching Kanban stats:", error);
    } finally {
      setLoading(false);
    }
  }, [timeframe, ownerFilter, user?.id, dateFrom, dateTo, accountFilter, franchiseFilter, context.franchiseId, context.tenantId, context.isPlatformAdmin, context.adminOverrideEnabled]);

  useEffect(() => {
    fetchKanbanStats();
  }, [fetchKanbanStats]);

  useEffect(() => {
    const loadAccounts = async () => {
      const db = new ScopedDataAccess(supabase as any, context as unknown as DataAccessContext);
      let query = (db.from("accounts") as any).select("id, name").limit(200).order("name");
      const { data } = await query;
      setAccounts(data || []);
    };
    loadAccounts();
  }, [context.franchiseId, context.tenantId, context.isPlatformAdmin, context.adminOverrideEnabled]);

  useEffect(() => {
    const loadFranchises = async () => {
      const db = new ScopedDataAccess(supabase as any, context as unknown as DataAccessContext);
      let query = (db.from("franchises") as any).select("id, name").order("name");
      const { data } = await query;
      setFranchises(data || []);
    };
    loadFranchises();
  }, [context.franchiseId, context.tenantId, context.isPlatformAdmin, context.adminOverrideEnabled]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const leadFunnel = [
    { key: "new", label: "🔍 New Inquiry", color: "#3b82f6", fill: "#3b82f6", value: stats.leads.byStage.new || 0 },
    { key: "contacted", label: "📞 Contact Attempted", color: "#a855f7", fill: "#a855f7", value: stats.leads.byStage.contacted || 0 },
    { key: "negotiation", label: "💬 In Discussion", color: "#06b6d4", fill: "#06b6d4", value: stats.leads.byStage.negotiation || 0 },
    { key: "proposal", label: "📋 Requirements Gathering", color: "#f59e0b", fill: "#f59e0b", value: stats.leads.byStage.proposal || 0 },
    { key: "qualified", label: "🎯 Qualified Lead", color: "#10b981", fill: "#10b981", value: stats.leads.byStage.qualified || 0 },
    { key: "lost", label: "❌ Disqualified", color: "#ef4444", fill: "#ef4444", value: stats.leads.byStage.lost || 0 },
    { key: "won", label: "✅ Converted", color: "#10b981", fill: "#10b981", value: stats.leads.byStage.won || 0 },
  ];

  const oppFunnel = [
    { key: "prospecting", label: "🆕 New Opportunity", color: "#64748b", fill: "#64748b", value: stats.opportunities.byStage.prospecting || 0 },
    { key: "qualification", label: "💰 Quote Requested", color: "#3b82f6", fill: "#3b82f6", value: stats.opportunities.byStage.qualification || 0 },
    { key: "proposal", label: "📄 Quote Submitted", color: "#a855f7", fill: "#a855f7", value: stats.opportunities.byStage.proposal || 0 },
    { key: "negotiation", label: "🤝 Negotiation", color: "#f97316", fill: "#f97316", value: stats.opportunities.byStage.negotiation || 0 },
    { key: "value_proposition", label: "📝 Contract Review", color: "#6366f1", fill: "#6366f1", value: stats.opportunities.byStage.value_proposition || 0 },
    { key: "needs_analysis", label: "📋 Requirements Gathering", color: "#06b6d4", fill: "#06b6d4", value: stats.opportunities.byStage.needs_analysis || 0 },
    { key: "closed_won", label: "✅ Won", color: "#10b981", fill: "#10b981", value: stats.opportunities.byStage.closed_won || 0 },
    { key: "closed_lost", label: "❌ Lost", color: "#ef4444", fill: "#ef4444", value: stats.opportunities.byStage.closed_lost || 0 },
  ];

  const quoteFunnel = [
    { key: "draft", label: "✏️ Draft", color: "#6b7280", fill: "#6b7280", value: stats.quotes.byStatus.draft || 0 },
    { key: "pricing_review", label: "🔍 Pricing Review", color: "#6366f1", fill: "#6366f1", value: stats.quotes.byStatus.pricing_review || 0 },
    { key: "approved", label: "✅ Approved", color: "#10b981", fill: "#10b981", value: stats.quotes.byStatus.approved || 0 },
    { key: "sent", label: "📧 Sent", color: "#3b82f6", fill: "#3b82f6", value: stats.quotes.byStatus.sent || 0 },
    { key: "customer_reviewing", label: "👀 Reviewing", color: "#06b6d4", fill: "#06b6d4", value: stats.quotes.byStatus.customer_reviewing || 0 },
    { key: "revision_requested", label: "🔄 Revision", color: "#f59e0b", fill: "#f59e0b", value: stats.quotes.byStatus.revision_requested || 0 },
    { key: "accepted", label: "✅ Accepted", color: "#10b981", fill: "#10b981", value: stats.quotes.byStatus.accepted || 0 },
    { key: "rejected", label: "❌ Rejected", color: "#ef4444", fill: "#ef4444", value: stats.quotes.byStatus.rejected || 0 },
    { key: "expired", label: "⏰ Expired", color: "#fb923c", fill: "#fb923c", value: stats.quotes.byStatus.expired || 0 },
  ];

  type ChartClickPayload = { payload?: { key?: string } };

  const navigateWithFilters = (path: string, stageKey: string | undefined) => {
    if (!stageKey) return;
    const params = new URLSearchParams();
    params.set("stage", stageKey);
    if (franchiseFilter !== "all") params.set("franchise", franchiseFilter);
    if (accountFilter !== "all") params.set("account", accountFilter);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    navigate(`${path}?${params.toString()}`);
  };

  const computeConversion = (data: { value: number }[]) => {
    const rates: number[] = [];
    for (let i = 1; i < data.length; i++) {
      const prev = data[i - 1].value;
      const curr = data[i].value;
      rates.push(prev > 0 ? Math.round((curr / prev) * 100) : 0);
    }
    return rates;
  };

  type FunnelLabelProps = {
    x: number;
    y: number;
    width: number;
    height: number;
    value: number;
    index: number;
    payload: { label?: string; value?: number; fill?: string; color?: string };
  };

  const renderFunnelLabel = ({ x, y, width, height, value, payload }: FunnelLabelProps) => {
    const label = payload?.label ?? "";
    const text = `${label}: ${value ?? 0}`;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const color = (payload?.fill || payload?.color || "#3b82f6").toString();
    const hex = color.startsWith("#") ? color.slice(1) : color;
    const parse = (h: string) => {
      if (h.length === 3) return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)] as const;
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)] as const;
    };
    const [r, g, b] = parse(hex);
    const toLinear = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    const rgbDark: [number, number, number] = [15, 23, 42];
    const rgbLight: [number, number, number] = [255, 255, 255];
    const lumFor = ([rr, gg, bb]: [number, number, number]) => 0.2126 * toLinear(rr) + 0.7152 * toLinear(gg) + 0.0722 * toLinear(bb);
    const contrast = (L1: number, L2: number) => {
      const a = Math.max(L1, L2);
      const b2 = Math.min(L1, L2);
      return (a + 0.05) / (b2 + 0.05);
    };
    const ratioDark = contrast(luminance, lumFor(rgbDark));
    const ratioLight = contrast(luminance, lumFor(rgbLight));
    const useLight = ratioLight >= ratioDark;
    const textFill = useLight ? LABEL_TEXT_LIGHT : LABEL_TEXT_DARK;
    const shadowFill = useLight ? "#000000" : "#ffffff";
    const shadowOpacity = useLight ? LABEL_SHADOW_OPACITY_LIGHT : LABEL_SHADOW_OPACITY_DARK;
    return (
      <g>
        <text x={cx + 1} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fill={shadowFill} fontSize={12} opacity={shadowOpacity}>
          {text}
        </text>
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill={textFill} fontSize={12}>
          {text}
        </text>
      </g>
    );
  };

  const kanbanModules = [
    {
      title: "Leads Pipeline",
      icon: Target,
      total: stats.leads.total,
      stages: [
        { key: "new", label: "🔍 New Inquiry", count: stats.leads.byStage.new || 0, color: "bg-blue-500/10 text-blue-700" },
        { key: "contacted", label: "📞 Contact Attempted", count: stats.leads.byStage.contacted || 0, color: "bg-purple-500/10 text-purple-700" },
        { key: "negotiation", label: "💬 In Discussion", count: stats.leads.byStage.negotiation || 0, color: "bg-cyan-500/10 text-cyan-700" },
        { key: "proposal", label: "📋 Requirements Gathering", count: stats.leads.byStage.proposal || 0, color: "bg-yellow-500/10 text-yellow-700" },
        { key: "qualified", label: "🎯 Qualified Lead", count: stats.leads.byStage.qualified || 0, color: "bg-green-500/10 text-green-700" },
        { key: "lost", label: "❌ Disqualified", count: stats.leads.byStage.lost || 0, color: "bg-red-500/10 text-red-700" },
        { key: "won", label: "✅ Converted to Opportunity", count: stats.leads.byStage.won || 0, color: "bg-emerald-500/10 text-emerald-700" },
      ],
      path: "/dashboard/leads/pipeline",
      value: null,
    },
    {
      title: "Opportunities Pipeline",
      icon: TrendingUp,
      total: stats.opportunities.total,
      stages: [
        { key: "prospecting", label: "🆕 New Opportunity", count: stats.opportunities.byStage.prospecting || 0, color: "bg-slate-500/10 text-slate-700" },
        { key: "qualification", label: "💰 Quote Requested", count: stats.opportunities.byStage.qualification || 0, color: "bg-blue-500/10 text-blue-700" },
        { key: "proposal", label: "📄 Quote Submitted", count: stats.opportunities.byStage.proposal || 0, color: "bg-purple-500/10 text-purple-700" },
        { key: "negotiation", label: "🤝 Negotiation", count: stats.opportunities.byStage.negotiation || 0, color: "bg-orange-500/10 text-orange-700" },
        { key: "value_proposition", label: "📝 Contract Review", count: stats.opportunities.byStage.value_proposition || 0, color: "bg-indigo-500/10 text-indigo-700" },
        { key: "needs_analysis", label: "📋 Requirements Gathering", count: stats.opportunities.byStage.needs_analysis || 0, color: "bg-cyan-500/10 text-cyan-700" },
        { key: "closed_won", label: "✅ Won", count: stats.opportunities.byStage.closed_won || 0, color: "bg-green-500/10 text-green-700" },
        { key: "closed_lost", label: "❌ Lost", count: stats.opportunities.byStage.closed_lost || 0, color: "bg-red-500/10 text-red-700" },
      ],
      path: "/dashboard/opportunities/pipeline",
      value: formatCurrency(stats.opportunities.totalValue),
    },
    {
      title: "Quotes Pipeline",
      icon: FileText,
      total: stats.quotes.total,
      stages: [
        { key: "draft", label: "✏️ Draft", count: stats.quotes.byStatus.draft || 0, color: "bg-gray-500/10 text-gray-700" },
        { key: "pricing_review", label: "🔍 Pricing Review", count: stats.quotes.byStatus.pricing_review || 0, color: "bg-indigo-500/10 text-indigo-700" },
        { key: "approved", label: "✅ Approved", count: stats.quotes.byStatus.approved || 0, color: "bg-green-500/10 text-green-700" },
        { key: "sent", label: "📧 Sent", count: stats.quotes.byStatus.sent || 0, color: "bg-blue-500/10 text-blue-700" },
        { key: "customer_reviewing", label: "👀 Customer Reviewing", count: stats.quotes.byStatus.customer_reviewing || 0, color: "bg-cyan-500/10 text-cyan-700" },
        { key: "revision_requested", label: "🔄 Revision Requested", count: stats.quotes.byStatus.revision_requested || 0, color: "bg-amber-500/10 text-amber-700" },
        { key: "accepted", label: "✅ Accepted", count: stats.quotes.byStatus.accepted || 0, color: "bg-emerald-500/10 text-emerald-700" },
        { key: "rejected", label: "❌ Rejected", count: stats.quotes.byStatus.rejected || 0, color: "bg-red-500/10 text-red-700" },
        { key: "expired", label: "⏰ Expired", count: stats.quotes.byStatus.expired || 0, color: "bg-orange-500/10 text-orange-700" },
      ],
      path: "/dashboard/quotes/pipeline",
      value: formatCurrency(stats.quotes.totalValue),
    },
    {
      title: "Shipments Pipeline",
      icon: Package,
      total: stats.shipments.total,
      stages: [
        { label: "Confirmed", count: stats.shipments.byStatus.confirmed || 0, color: "bg-blue-500/10 text-blue-700" },
        { label: "In Transit", count: stats.shipments.byStatus.in_transit || 0, color: "bg-purple-500/10 text-purple-700" },
        { label: "Out for Delivery", count: stats.shipments.byStatus.out_for_delivery || 0, color: "bg-yellow-500/10 text-yellow-700" },
        { label: "Delivered", count: stats.shipments.byStatus.delivered || 0, color: "bg-green-500/10 text-green-700" },
      ],
      path: "/dashboard/shipments/pipeline",
      value: null,
    },
    {
      title: "Activities Pipeline",
      icon: CheckSquare,
      total: stats.activities.total,
      stages: [
        { label: "Planned", count: stats.activities.byStatus.planned || 0, color: "bg-blue-500/10 text-blue-700" },
        { label: "In Progress", count: stats.activities.byStatus.in_progress || 0, color: "bg-purple-500/10 text-purple-700" },
        { label: "Completed", count: stats.activities.byStatus.completed || 0, color: "bg-green-500/10 text-green-700" },
        { label: "Cancelled", count: stats.activities.byStatus.cancelled || 0, color: "bg-red-500/10 text-red-700" },
      ],
      path: "/dashboard/activities",
      value: null,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-primary" />
 <CardTitle>Pipelines Overview</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">Real-time</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading pipelines...</div>
        ) : (
          <div className="space-y-6">
            {kanbanModules.map((module) => {
              const Icon = module.icon;
              return (
                <Card key={module.title} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <h3 className="font-semibold">{module.title}</h3>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(module.path)}
                      >
                        <LayoutGrid className="h-4 w-4 mr-2" />
                        View Pipeline
                      </Button>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm text-muted-foreground">
                        Total: <span className="font-semibold text-foreground">{module.total}</span>
                      </div>
                      {module.value && (
                        <div className="text-sm font-semibold text-primary">
                          {module.value}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {module.stages.map((stage) => (
                        <Badge
                          key={stage.label}
                          variant="secondary"
                          className={`${stage.color} transition-all duration-200 cursor-pointer`}
                          onClick={() => navigateWithFilters(module.path, (stage as unknown as { key: string }).key)}
                        >
                          {stage.label}: {stage.count}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Kanban Funnel</h3>
                <div className="flex items-center gap-2">
                  <Select value={timeframe} onValueChange={(v) => setTimeframe(v as typeof timeframe)}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Timeframe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30d">Last 30 days</SelectItem>
                      <SelectItem value="90d">Last 90 days</SelectItem>
                      <SelectItem value="12m">Last 12 months</SelectItem>
                      <SelectItem value="all">All time</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-36" />
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-36" />
                  {(activeTab === "leads" || activeTab === "opportunities") && (
                    <Select value={ownerFilter} onValueChange={(v) => setOwnerFilter(v as typeof ownerFilter)}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Owner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="me">Assigned to me</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {(activeTab === "leads" || activeTab === "opportunities" || activeTab === "quotes") && (
                    <Select value={franchiseFilter} onValueChange={(v) => setFranchiseFilter(v)}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Franchise" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Franchises</SelectItem>
                        {franchises.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {(activeTab === "opportunities" || activeTab === "quotes") && (
                    <Select value={accountFilter} onValueChange={(v) => setAccountFilter(v)}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Account" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Accounts</SelectItem>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                <TabsList>
                  <TabsTrigger value="leads">Leads</TabsTrigger>
                  <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
                  <TabsTrigger value="quotes">Quotes</TabsTrigger>
                </TabsList>

                <TabsContent value="leads" className="pt-3">
                  <div className="grid gap-4 md:grid-cols-2">
                    <ChartContainer config={{}} className="h-64">
                      <FunnelChart>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Funnel data={leadFunnel} dataKey="value" nameKey="label" isAnimationActive onClick={(d: ChartClickPayload) => navigateWithFilters('/dashboard/leads/pipeline', d.payload?.key)}>
                          <LabelList dataKey="value" position="inside" content={renderFunnelLabel} />
                        </Funnel>
                      </FunnelChart>
                    </ChartContainer>
                    <div className="grid grid-cols-2 gap-2">
                      {computeConversion(leadFunnel).map((r, i) => (
                        <div key={i} className="rounded-lg border p-3">
                          <div className="text-xs text-muted-foreground">Stage {i + 1} → {i + 2}</div>
                          <div className="text-lg font-semibold">{r}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="opportunities" className="pt-3">
                  <div className="grid gap-4 md:grid-cols-2">
                    <ChartContainer config={{}} className="h-64">
                      <FunnelChart>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Funnel data={oppFunnel} dataKey="value" nameKey="label" isAnimationActive onClick={(d: ChartClickPayload) => navigateWithFilters('/dashboard/opportunities/pipeline', d.payload?.key)}>
                          <LabelList dataKey="value" position="inside" content={renderFunnelLabel} />
                        </Funnel>
                      </FunnelChart>
                    </ChartContainer>
                    <div className="grid grid-cols-2 gap-2">
                      {computeConversion(oppFunnel).map((r, i) => (
                        <div key={i} className="rounded-lg border p-3">
                          <div className="text-xs text-muted-foreground">Stage {i + 1} → {i + 2}</div>
                          <div className="text-lg font-semibold">{r}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="quotes" className="pt-3">
                  <div className="grid gap-4 md:grid-cols-2">
                    <ChartContainer config={{}} className="h-64">
                      <FunnelChart>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Funnel data={quoteFunnel} dataKey="value" nameKey="label" isAnimationActive onClick={(d: ChartClickPayload) => navigateWithFilters('/dashboard/quotes/pipeline', d.payload?.key)}>
                          <LabelList dataKey="value" position="inside" content={renderFunnelLabel} />
                        </Funnel>
                      </FunnelChart>
                    </ChartContainer>
                    <div className="grid grid-cols-2 gap-2">
                      {computeConversion(quoteFunnel).map((r, i) => (
                        <div key={i} className="rounded-lg border p-3">
                          <div className="text-xs text-muted-foreground">Stage {i + 1} → {i + 2}</div>
                          <div className="text-lg font-semibold">{r}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}