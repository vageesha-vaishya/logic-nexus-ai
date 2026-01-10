import { Card } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Ship, DollarSign, Mail, AlertCircle, LucideIcon } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { useTranslation } from "react-i18next";

export interface StatItem {
  id: string;
  title: string;
  value: string;
  change: string;
  trend: "up" | "down";
  icon: LucideIcon;
  color: string;
  data: { value: number }[];
}

interface StatsCardsProps {
  stats?: StatItem[];
  loading?: boolean;
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
    data: [{ value: 10 }, { value: 15 }, { value: 12 }, { value: 20 }, { value: 18 }, { value: 25 }, { value: 22 }]
  },
  {
    id: "revenue",
    title: "Monthly Revenue",
    value: "$1.2M",
    change: "+8.2%",
    trend: "up",
    icon: DollarSign,
    color: "text-success",
    data: [{ value: 100 }, { value: 120 }, { value: 115 }, { value: 130 }, { value: 140 }, { value: 135 }, { value: 150 }]
  },
  {
    id: "emails",
    title: "Pending Emails",
    value: "34",
    change: "-15.3%",
    trend: "down",
    icon: Mail,
    color: "text-accent",
    data: [{ value: 50 }, { value: 45 }, { value: 40 }, { value: 35 }, { value: 30 }, { value: 32 }, { value: 28 }]
  },
  {
    id: "issues",
    title: "Issues Flagged",
    value: "5",
    change: "+2",
    trend: "up",
    icon: AlertCircle,
    color: "text-warning",
    data: [{ value: 2 }, { value: 3 }, { value: 2 }, { value: 4 }, { value: 3 }, { value: 5 }, { value: 5 }]
  }
];

export const StatsCards = ({ stats = defaultStats, loading = false }: StatsCardsProps) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-6 h-[140px] animate-pulse bg-muted/50" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat) => (
        <Card key={stat.id} className="p-6 overflow-hidden relative">
          <div className="flex justify-between z-10 relative">
            <div>
              <p className="text-sm text-muted-foreground mb-1">{t(stat.title)}</p>
              <h3 className="text-3xl font-bold mb-2">{stat.value}</h3>
              <div className="flex items-center gap-1">
                {stat.trend === "up" ? (
                  <ArrowUpRight className="w-4 h-4 text-success" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-destructive" />
                )}
                <span className={`text-sm font-medium ${stat.trend === "up" ? "text-success" : "text-destructive"}`}>
                  {stat.change}
                </span>
                <span className="text-xs text-muted-foreground">{t("vs last month")}</span>
              </div>
            </div>
            <div className={`w-12 h-12 rounded-lg bg-gradient-to-br from-white/50 to-white/10 shadow-sm flex items-center justify-center ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
          </div>
          
          {/* Background Sparkline */}
          <div className={`absolute bottom-0 left-0 right-0 h-16 opacity-10 pointer-events-none ${stat.color}`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stat.data}>
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="currentColor" 
                  fill="currentColor" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      ))}
    </div>
  );
};

