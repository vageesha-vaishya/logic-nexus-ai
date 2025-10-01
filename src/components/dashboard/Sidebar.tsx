import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Users, 
  Ship, 
  Mail, 
  FileText, 
  DollarSign, 
  BarChart3,
  Settings,
  Building2
} from "lucide-react";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: Users, label: "CRM", active: false },
  { icon: Ship, label: "Operations", active: false },
  { icon: Mail, label: "Email Hub", active: false },
  { icon: FileText, label: "Contracts", active: false },
  { icon: DollarSign, label: "Financials", active: false },
  { icon: BarChart3, label: "Analytics", active: false },
  { icon: Settings, label: "Settings", active: false },
];

export const Sidebar = () => {
  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Building2 className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <div className="font-bold text-sidebar-foreground">SOSLogicPro</div>
            <div className="text-xs text-muted-foreground">Enterprise</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item, index) => (
          <Button
            key={index}
            variant={item.active ? "default" : "ghost"}
            className={cn(
              "w-full justify-start gap-3",
              item.active && "bg-sidebar-primary text-sidebar-primary-foreground"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </Button>
        ))}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-sidebar-accent">
          <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-sm font-semibold text-primary-foreground">
            JD
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-sidebar-foreground truncate">John Doe</div>
            <div className="text-xs text-muted-foreground truncate">Admin</div>
          </div>
        </div>
      </div>
    </aside>
  );
};
