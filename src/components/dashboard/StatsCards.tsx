import { Card } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Ship, DollarSign, Activity, AlertCircle, LucideIcon } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export interface StatItem {
  id: string;
  title: string;
  value: string;
  change: string;
  trend: "up" | "down";
  icon: LucideIcon;
  color: string;
  data: { value: number }[];
  onClick?: () => void;
  description?: string; // For tooltip or extra detail
}

interface StatsCardsProps {
  stats?: StatItem[];
  loading?: boolean;
  className?: string;
}

const defaultStats: StatItem[] = [
  {
    id: "shipments",
    title: "Active Shipments",
    value: "247",
    change: "+12.5%",
    trend: "up",
    icon: Ship,
    color: "text-primary",
    data: [{ value: 10 }, { value: 15 }, { value: 12 }, { value: 20 }, { value: 18 }, { value: 25 }, { value: 22 }],
    description: "Total active shipments across all modes"
  },
  {
    id: "revenue",
    title: "Monthly Revenue",
    value: "$1.2M",
    change: "+8.2%",
    trend: "up",
    icon: DollarSign,
    color: "text-success",
    data: [{ value: 100 }, { value: 120 }, { value: 115 }, { value: 130 }, { value: 140 }, { value: 135 }, { value: 150 }],
    description: "Recognized revenue for the current month"
  },
  {
    id: "velocity",
    title: "Pipeline Velocity",
    value: "14 days",
    change: "-2 days",
    trend: "up", // "up" trend here means improvement (lower days)
    icon: Activity,
    color: "text-accent",
    data: [{ value: 20 }, { value: 18 }, { value: 16 }, { value: 15 }, { value: 14 }, { value: 14 }, { value: 14 }],
    description: "Average time from lead to closed deal"
  },
  {
    id: "issues",
    title: "Issues Flagged",
    value: "5",
    change: "+2",
    trend: "down", // "down" trend means getting worse (more issues)
    icon: AlertCircle,
    color: "text-warning",
    data: [{ value: 2 }, { value: 3 }, { value: 2 }, { value: 4 }, { value: 3 }, { value: 5 }, { value: 5 }],
    description: "Open support tickets or shipment exceptions"
  }
];

/**
 * StatsCards Component
 * 
 * Displays a grid of KPI cards with sparkline visualizations.
 * Implements the design patterns from the Dashboard Widget Guide.
 * 
 * @param stats - Array of StatItem objects containing metric data
 * @param loading - Boolean to show skeleton loading state
 * @param className - Optional CSS class for the grid container
 */
export const StatsCards = ({ stats = defaultStats, loading = false, className }: StatsCardsProps) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6", className)}>
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-6 h-[140px] animate-pulse bg-muted/50" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6", className)}>
      {stats.map((stat) => (
        <Card 
          key={stat.id} 
          className={cn(
            "p-6 overflow-hidden relative transition-all hover:shadow-md",
            stat.onClick ? "cursor-pointer active:scale-[0.98]" : ""
          )}
          onClick={stat.onClick}
          title={stat.description ? t(stat.description) : undefined}
        >
          <div className="flex justify-between z-10 relative">
            <div>
              <p className="text-sm text-muted-foreground mb-1 font-medium">{t(stat.title)}</p>
              <h3 className="text-3xl font-bold mb-2 tracking-tight">{stat.value}</h3>
              <div className="flex items-center gap-1">
                {stat.trend === "up" ? (
                  <ArrowUpRight className="w-4 h-4 text-success" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-destructive" />
                )}
                <span className={cn(
                  "text-sm font-medium",
                  stat.trend === "up" ? "text-success" : "text-destructive"
                )}>
                  {stat.change}
                </span>
                <span className="text-xs text-muted-foreground ml-1">{t("vs last month")}</span>
              </div>
            </div>
            <div className={cn(
              "w-12 h-12 rounded-lg bg-gradient-to-br from-white/50 to-white/10 shadow-sm flex items-center justify-center backdrop-blur-sm",
              stat.color
            )}>
              <stat.icon className="w-6 h-6" />
            </div>
          </div>
          
          {/* Background Sparkline */}
          <div className={cn("absolute bottom-0 left-0 right-0 h-16 opacity-10 pointer-events-none", stat.color)}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stat.data}>
                <defs>
                  <linearGradient id={`gradient-${stat.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity={0.5}/>
                    <stop offset="100%" stopColor="currentColor" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Tooltip cursor={false} content={<></>} />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="currentColor" 
                  strokeWidth={2}
                  fill={`url(#gradient-${stat.id})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      ))}
    </div>
  );
};

