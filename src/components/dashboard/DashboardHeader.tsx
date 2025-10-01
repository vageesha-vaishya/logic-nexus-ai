import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const DashboardHeader = () => {
  return (
    <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between">
      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search shipments, customers, emails..." 
            className="pl-10"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 text-xs"
          >
            3
          </Badge>
        </Button>
      </div>
    </header>
  );
};
