import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useCRM } from "@/hooks/useCRM";

export const DashboardHeader = () => {
  const { context, setFranchisePreference, setAdminOverride, supabase } = useCRM();
  const { toast } = useToast();
  const [franchises, setFranchises] = useState<any[]>([]);
  const [selectedFranchise, setSelectedFranchise] = useState<string | undefined>(undefined);
  const [adminOverrideEnabled, setAdminOverrideEnabled] = useState<boolean>(false);

  useEffect(() => {
    setSelectedFranchise(context.franchiseId || undefined);
    setAdminOverrideEnabled(!!context.adminOverrideEnabled);
  }, [context.franchiseId, context.adminOverrideEnabled]);

  useEffect(() => {
    async function loadFranchises() {
      if (!context.tenantId) return;
      const { data, error } = await supabase
        .from("franchises")
        .select("id,name,code")
        .eq("tenant_id", context.tenantId)
        .order("name", { ascending: true });
      if (!error && data) setFranchises(data);
    }
    loadFranchises();
  }, [context.tenantId, supabase]);

  const handleFranchiseChange = async (value: string) => {
    setSelectedFranchise(value);
    try {
      await setFranchisePreference(value || null, adminOverrideEnabled);
      toast({ title: "Franchise updated" });
    } catch (e: any) {
      toast({ title: "Failed to update franchise", description: e?.message || String(e), variant: "destructive" });
    }
  };

  const handleAdminOverrideToggle = async (checked: boolean) => {
    setAdminOverrideEnabled(checked);
    try {
      await setAdminOverride(checked, selectedFranchise || null);
      toast({ title: checked ? "Admin override enabled" : "Admin override disabled" });
    } catch (e: any) {
      toast({ title: "Failed to set admin override", description: e?.message || String(e), variant: "destructive" });
    }
  };

  return (
    <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between">
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search shipments, customers, emails..." 
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Select value={selectedFranchise || ""} onValueChange={handleFranchiseChange}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Select franchise" />
            </SelectTrigger>
            <SelectContent>
              {franchises.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Admin Override</span>
            <Switch checked={adminOverrideEnabled} onCheckedChange={handleAdminOverrideToggle} />
          </div>
        </div>
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
