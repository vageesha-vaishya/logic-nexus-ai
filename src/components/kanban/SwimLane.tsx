import { ReactNode, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SwimLaneProps {
  id: string;
  title: string;
  count: number;
  metrics?: {
    label: string;
    value: string | number;
  }[];
  children: ReactNode;
  defaultCollapsed?: boolean;
}

export function SwimLane({ id, title, count, metrics, children, defaultCollapsed = false }: SwimLaneProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Lane Header */}
      <div className="bg-muted/30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          <div className="font-semibold text-sm">{title}</div>
          <Badge variant="secondary">{count}</Badge>
        </div>
        {metrics && metrics.length > 0 && (
          <div className="flex items-center gap-4">
            {metrics.map((metric, idx) => (
              <div key={idx} className="text-xs">
                <span className="text-muted-foreground">{metric.label}: </span>
                <span className="font-semibold">{metric.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Lane Content */}
      {!collapsed && (
        <div className="p-4">
          {children}
        </div>
      )}
    </div>
  );
}
