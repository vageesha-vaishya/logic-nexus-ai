import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LayoutGrid, TrendingUp, Package, FileText, Target, CheckSquare } from "lucide-react";

interface KanbanStats {
  leads: { total: number; byStage: Record<string, number> };
  opportunities: { total: number; byStage: Record<string, number>; totalValue: number };
  quotes: { total: number; byStatus: Record<string, number>; totalValue: number };
  shipments: { total: number; byStatus: Record<string, number> };
  activities: { total: number; byStatus: Record<string, number> };
}

export function KanbanDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<KanbanStats>({
    leads: { total: 0, byStage: {} },
    opportunities: { total: 0, byStage: {}, totalValue: 0 },
    quotes: { total: 0, byStatus: {}, totalValue: 0 },
    shipments: { total: 0, byStatus: {} },
    activities: { total: 0, byStatus: {} },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchKanbanStats();
  }, []);

  const fetchKanbanStats = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [leadsData, opportunitiesData, quotesData, shipmentsData, activitiesData] = await Promise.all([
        supabase.from("leads").select("status"),
        supabase.from("opportunities").select("stage, amount"),
        supabase.from("quotes").select("status, sell_price"),
        supabase.from("shipments").select("status"),
        supabase.from("activities").select("status"),
      ]);

      // Process leads
      const leadsByStage = (leadsData.data || []).reduce((acc, lead) => {
        acc[lead.status] = (acc[lead.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Process opportunities
      const oppsByStage = (opportunitiesData.data || []).reduce((acc, opp) => {
        acc[opp.stage] = (acc[opp.stage] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const oppsValue = (opportunitiesData.data || []).reduce((sum, opp) => sum + (Number(opp.amount) || 0), 0);

      // Process quotes
      const quotesByStatus = (quotesData.data || []).reduce((acc, quote) => {
        acc[quote.status] = (acc[quote.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const quotesValue = (quotesData.data || []).reduce((sum, quote) => sum + (Number(quote.sell_price) || 0), 0);

      // Process shipments
      const shipmentsByStatus = (shipmentsData.data || []).reduce((acc, shipment) => {
        acc[shipment.status] = (acc[shipment.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Process activities
      const activitiesByStatus = (activitiesData.data || []).reduce((acc, activity) => {
        acc[activity.status] = (acc[activity.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      setStats({
        leads: { 
          total: leadsData.data?.length || 0, 
          byStage: leadsByStage 
        },
        opportunities: { 
          total: opportunitiesData.data?.length || 0, 
          byStage: oppsByStage,
          totalValue: oppsValue
        },
        quotes: { 
          total: quotesData.data?.length || 0, 
          byStatus: quotesByStatus,
          totalValue: quotesValue
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
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const kanbanModules = [
    {
      title: "Leads Pipeline",
      icon: Target,
      total: stats.leads.total,
      stages: [
        { label: "New", count: stats.leads.byStage.new || 0, color: "bg-blue-500/10 text-blue-700" },
        { label: "Contacted", count: stats.leads.byStage.contacted || 0, color: "bg-purple-500/10 text-purple-700" },
        { label: "Qualified", count: stats.leads.byStage.qualified || 0, color: "bg-green-500/10 text-green-700" },
        { label: "Converted", count: stats.leads.byStage.converted || 0, color: "bg-emerald-500/10 text-emerald-700" },
      ],
      path: "/dashboard/leads/pipeline",
      value: null,
    },
    {
      title: "Opportunities Pipeline",
      icon: TrendingUp,
      total: stats.opportunities.total,
      stages: [
        { label: "Prospecting", count: stats.opportunities.byStage.prospecting || 0, color: "bg-slate-500/10 text-slate-700" },
        { label: "Qualification", count: stats.opportunities.byStage.qualification || 0, color: "bg-blue-500/10 text-blue-700" },
        { label: "Proposal", count: stats.opportunities.byStage.proposal || 0, color: "bg-purple-500/10 text-purple-700" },
        { label: "Won", count: stats.opportunities.byStage.closed_won || 0, color: "bg-green-500/10 text-green-700" },
      ],
      path: "/dashboard/opportunities/pipeline",
      value: formatCurrency(stats.opportunities.totalValue),
    },
    {
      title: "Quotes Pipeline",
      icon: FileText,
      total: stats.quotes.total,
      stages: [
        { label: "Draft", count: stats.quotes.byStatus.draft || 0, color: "bg-gray-500/10 text-gray-700" },
        { label: "Sent", count: stats.quotes.byStatus.sent || 0, color: "bg-blue-500/10 text-blue-700" },
        { label: "Accepted", count: stats.quotes.byStatus.accepted || 0, color: "bg-green-500/10 text-green-700" },
        { label: "Rejected", count: stats.quotes.byStatus.rejected || 0, color: "bg-red-500/10 text-red-700" },
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
          <div className="space-y-4">
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
                          className={`${stage.color} transition-all duration-200`}
                        >
                          {stage.label}: {stage.count}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}