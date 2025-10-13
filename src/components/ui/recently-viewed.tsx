import * as React from "react";
import { useEffect, useState } from "react";
import { Clock, FileText, Users, Building2, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface RecentItem {
  id: string;
  title: string;
  type: "lead" | "account" | "contact" | "quote" | "opportunity";
  path: string;
  timestamp: number;
}

const MAX_RECENT_ITEMS = 10;
const STORAGE_KEY = "recently-viewed-items";

export function RecentlyViewed({ className }: { className?: string }) {
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Load from localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setRecentItems(JSON.parse(stored));
      } catch (error) {
        console.error("Failed to parse recent items:", error);
      }
    }
  }, []);

  const getIcon = (type: RecentItem["type"]) => {
    switch (type) {
      case "lead": return FileText;
      case "account": return Building2;
      case "contact": return Users;
      case "quote": return Package;
      case "opportunity": return FileText;
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (recentItems.length === 0) {
    return null;
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Recently Viewed
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-1">
            {recentItems.map((item) => {
              const Icon = getIcon(item.type);
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm",
                    "hover:bg-accent transition-colors text-left"
                  )}
                >
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{item.type}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatTime(item.timestamp)}
                  </span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Hook to track viewed items
export function useRecentlyViewed() {
  const addRecentItem = (item: Omit<RecentItem, "timestamp">) => {
    const stored = localStorage.getItem(STORAGE_KEY);
    let items: RecentItem[] = [];
    
    if (stored) {
      try {
        items = JSON.parse(stored);
      } catch (error) {
        console.error("Failed to parse recent items:", error);
      }
    }

    // Remove if already exists
    items = items.filter((i) => i.id !== item.id);

    // Add to front with timestamp
    items.unshift({ ...item, timestamp: Date.now() });

    // Keep only MAX_RECENT_ITEMS
    items = items.slice(0, MAX_RECENT_ITEMS);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  };

  return { addRecentItem };
}
