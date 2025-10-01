import { Card } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Ship, DollarSign, Mail, AlertCircle } from "lucide-react";

const stats = [
  {
    title: "Active Shipments",
    value: "247",
    change: "+12.5%",
    trend: "up",
    icon: Ship,
    color: "text-primary"
  },
  {
    title: "Monthly Revenue",
    value: "$1.2M",
    change: "+8.2%",
    trend: "up",
    icon: DollarSign,
    color: "text-success"
  },
  {
    title: "Pending Emails",
    value: "34",
    change: "-15.3%",
    trend: "down",
    icon: Mail,
    color: "text-accent"
  },
  {
    title: "Issues Flagged",
    value: "5",
    change: "+2",
    trend: "up",
    icon: AlertCircle,
    color: "text-warning"
  }
];

export const StatsCards = () => {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <Card key={index} className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
              <h3 className="text-3xl font-bold mb-2">{stat.value}</h3>
              <div className="flex items-center gap-1">
                {stat.trend === "up" ? (
                  <ArrowUpRight className="w-4 h-4 text-success" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-success" />
                )}
                <span className="text-sm font-medium text-success">{stat.change}</span>
                <span className="text-xs text-muted-foreground">vs last month</span>
              </div>
            </div>
            <div className={`w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
