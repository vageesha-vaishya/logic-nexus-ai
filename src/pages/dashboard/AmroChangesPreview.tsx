import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Clock3, Database, Smartphone, Workflow, ArrowRight } from "lucide-react";

type ChangeItem = {
  id: string;
  title: string;
  area: string;
  status: "completed" | "pending";
  detail: string;
};

const amroChangeItems: ChangeItem[] = [
  {
    id: "m0-1",
    title: "AMRO operational schema",
    area: "Database",
    status: "completed",
    detail: "Multi-tenant schema and RLS policies are available for core AMRO data.",
  },
  {
    id: "m0-2",
    title: "AMRO audit schema",
    area: "Database",
    status: "completed",
    detail: "Append-only audit trail with immutability triggers is implemented.",
  },
  {
    id: "m0-3",
    title: "REST API and middleware",
    area: "Service API",
    status: "completed",
    detail: "Work-order endpoints with auth and tenant scoping are wired.",
  },
  {
    id: "m0-4",
    title: "Kafka event publishing",
    area: "Eventing",
    status: "completed",
    detail: "Fire-and-forget event producer is connected with idempotent metadata.",
  },
  {
    id: "m0-5",
    title: "Distributed tracing",
    area: "Observability",
    status: "completed",
    detail: "OpenTelemetry spans are configured for AMRO execution flow.",
  },
  {
    id: "m0-6",
    title: "Mobile offline framework",
    area: "Mobile",
    status: "pending",
    detail: "Offline cache and local work-order sync are still pending implementation.",
  },
  {
    id: "m0-7",
    title: "Integration tests and CI",
    area: "Quality",
    status: "completed",
    detail: "Vitest + CI workflow is prepared for AMRO module validation.",
  },
];

export default function AmroChangesPreview() {
  const navigate = useNavigate();

  const completion = useMemo(() => {
    const completed = amroChangeItems.filter((item) => item.status === "completed").length;
    const total = amroChangeItems.length;
    return {
      completed,
      total,
      percent: Math.round((completed / total) * 100),
    };
  }, []);

  const statusTone = (status: ChangeItem["status"]) =>
    status === "completed"
      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
      : "bg-amber-100 text-amber-800 hover:bg-amber-100";

  const statusIcon = (status: ChangeItem["status"]) =>
    status === "completed" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Clock3 className="h-4 w-4 text-amber-600" />;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Card className="border border-border/60">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <CardTitle className="text-2xl md:text-3xl">AMRO Changes Preview</CardTitle>
                <p className="text-sm text-muted-foreground">
                  This page gives a clear view of the AMRO rollout state and what is still pending.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-[#714B67] text-white hover:bg-[#714B67]">
                  {completion.completed}/{completion.total} Milestones Done
                </Badge>
                <Badge variant="outline">M0 Progress: {completion.percent}%</Badge>
              </div>
            </div>
            <Progress value={completion.percent} className="h-2" />
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <Database className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Data & Isolation</p>
                <p className="text-sm font-semibold">RLS + Audit Ready</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-violet-100 p-2">
                <Workflow className="h-5 w-5 text-violet-700" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Backend Flow</p>
                <p className="text-sm font-semibold">API + Events Active</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 p-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Verification</p>
                <p className="text-sm font-semibold">Tracing + Tests Ready</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 p-2">
                <Smartphone className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Remaining Gap</p>
                <p className="text-sm font-semibold">Mobile Offline Pending</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Milestone Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {amroChangeItems.map((item) => (
              <div key={item.id} className="rounded-lg border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {statusIcon(item.status)}
                      <p className="font-medium text-sm md:text-base">{item.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{item.area}</Badge>
                    <Badge className={statusTone(item.status)}>
                      {item.status === "completed" ? "Completed" : "Pending"}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Quick Navigation</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => navigate("/dashboard/shipments/pipeline")}>
              Logistics Pipeline <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => navigate("/dashboard/leads/pipeline")}>
              CRM Pipeline <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button onClick={() => navigate("/dashboard/amro/changes")} className="bg-[#714B67] hover:bg-[#5d3d56]">
              Refresh AMRO View
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
