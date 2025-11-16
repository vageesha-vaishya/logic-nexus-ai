import * as React from "react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Grid3x3, FileText, Users, Building2, Package, TrendingUp, Calendar, Mail, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface AppModule {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  color: string;
}

const modules: AppModule[] = [
  {
    id: "leads",
    name: "Leads",
    description: "Manage and track leads",
    icon: FileText,
    path: "/dashboard/leads/pipeline",
    color: "text-blue-500",
  },
  {
    id: "accounts",
    name: "Accounts",
    description: "Customer accounts",
    icon: Building2,
    path: "/dashboard/accounts/pipeline",
    color: "text-purple-500",
  },
  {
    id: "contacts",
    name: "Contacts",
    description: "Contact management",
    icon: Users,
    path: "/dashboard/contacts/pipeline",
    color: "text-green-500",
  },
  {
    id: "quotes",
    name: "Quotes",
    description: "Sales quotes",
    icon: Package,
    path: "/dashboard/quotes/pipeline",
    color: "text-orange-500",
  },
  {
    id: "opportunities",
    name: "Opportunities",
    description: "Sales pipeline",
    icon: TrendingUp,
    path: "/dashboard/opportunities/pipeline",
    color: "text-emerald-500",
  },
  {
    id: "activities",
    name: "Activities",
    description: "Tasks and events",
    icon: Calendar,
    path: "/dashboard/activities",
    color: "text-pink-500",
  },
  {
    id: "email",
    name: "Email",
    description: "Email management",
    icon: Mail,
    path: "/dashboard/email",
    color: "text-cyan-500",
  },
  {
    id: "settings",
    name: "Settings",
    description: "System settings",
    icon: Settings,
    path: "/dashboard/settings",
    color: "text-gray-500",
  },
];

interface AppLauncherProps {
  trigger?: React.ReactNode;
}

export function AppLauncher({ trigger }: AppLauncherProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleModuleClick = (module: AppModule) => {
    navigate(module.path);
    setOpen(false);
  };

  return (
    <>
      {trigger ? (
        <div onClick={() => setOpen(true)}>{trigger}</div>
      ) : (
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
          <Grid3x3 className="h-5 w-5" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>App Launcher</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
            {modules.map((module) => {
              const Icon = module.icon;
              return (
                <button
                  key={module.id}
                  onClick={() => handleModuleClick(module)}
                  className={cn(
                    "flex flex-col items-center gap-3 p-4 rounded-lg",
                    "hover:bg-accent transition-colors text-center group"
                  )}
                >
                  <div className="p-3 rounded-full bg-muted group-hover:bg-muted/80 transition-colors">
                    <Icon className={cn("h-6 w-6", module.color)} />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{module.name}</p>
                    <p className="text-xs text-muted-foreground">{module.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
