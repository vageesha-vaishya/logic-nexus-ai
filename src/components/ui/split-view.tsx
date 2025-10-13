import * as React from "react";
import { useState } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SplitViewProps {
  listView: React.ReactNode;
  detailView: React.ReactNode;
  defaultCollapsed?: boolean;
  className?: string;
}

export function SplitView({ listView, detailView, defaultCollapsed = false, className }: SplitViewProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className={cn("flex h-full gap-4", className)}>
      {/* List Panel */}
      <div
        className={cn(
          "transition-all duration-300 overflow-auto",
          collapsed ? "w-12" : "w-[400px]"
        )}
      >
        {collapsed ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(false)}
            className="h-full w-full rounded-none border-r"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <div className="h-full flex flex-col border-r bg-card">
            <div className="flex items-center justify-between p-2 border-b">
              <h2 className="font-semibold text-sm px-2">Items</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(true)}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto">
              {listView}
            </div>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      <div className="flex-1 overflow-auto">
        {detailView}
      </div>
    </div>
  );
}
