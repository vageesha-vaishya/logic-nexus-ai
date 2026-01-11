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
  const { context, setFranchisePreference, setAdminOverride, setScopePreference, supabase } = useCRM();
  const { toast } = useToast();
  const [tenants, setTenants] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string | undefined>(undefined);
  const [selectedFranchise, setSelectedFranchise] = useState<string | undefined>(undefined);
  const [adminOverrideEnabled, setAdminOverrideEnabled] = useState<boolean>(false);

  // Sync local state with context
  useEffect(() => {
    setSelectedTenant(context.tenantId || undefined);
    setSelectedFranchise(context.franchiseId || undefined);
    setAdminOverrideEnabled(!!context.adminOverrideEnabled);
  }, [context.tenantId, context.franchiseId, context.adminOverrideEnabled]);

  // Load Tenants (Platform Admin only)
  useEffect(() => {
    async function loadTenants() {
      if (!context.isPlatformAdmin) return;
      const { data, error } = await supabase
        .from("tenants")
        .select("id,name")
        .order("name", { ascending: true });
      if (!error && data) setTenants(data);
    }
    loadTenants();
  }, [context.isPlatformAdmin, supabase]);

  // Load Franchises based on selectedTenant (or context if not platform admin)
  useEffect(() => {
    async function loadFranchises() {
      // For platform admin, use selectedTenant. For others, use context.tenantId
      const targetTenantId = context.isPlatformAdmin ? selectedTenant : context.tenantId;
      
      if (!targetTenantId) {
        setFranchises([]);
        return;
      }

      const { data, error } = await supabase
        .from("franchises")
        .select("id,name,code")
        .eq("tenant_id", targetTenantId)
        .order("name", { ascending: true });
      if (!error && data) setFranchises(data);
    }
    loadFranchises();
  }, [selectedTenant, context.tenantId, context.isPlatformAdmin, supabase]);

  const handleTenantChange = async (value: string) => {
    setSelectedTenant(value);
    setSelectedFranchise(undefined); // Reset franchise when tenant changes
    
    // If override is enabled, update preference immediately
    if (adminOverrideEnabled) {
      try {
        await setScopePreference(value, null, true);
        toast({ title: "Tenant updated" });
      } catch (e: any) {
        toast({ title: "Failed to update tenant", description: e?.message || String(e), variant: "destructive" });
      }
    }
  };

  const handleFranchiseChange = async (value: string) => {
    setSelectedFranchise(value);
    try {
      // If platform admin, pass selectedTenant. Else pass null (use current).
      const tenantId = context.isPlatformAdmin ? selectedTenant || null : null;
      await setScopePreference(tenantId, value || null, adminOverrideEnabled);
      toast({ title: "Franchise updated" });
    } catch (e: any) {
      toast({ title: "Failed to update franchise", description: e?.message || String(e), variant: "destructive" });
    }
  };

  const handleAdminOverrideToggle = async (checked: boolean) => {
    setAdminOverrideEnabled(checked);
    try {
      // Ensure we pass the currently selected tenant and franchise
      await setAdminOverride(checked, selectedTenant || null, selectedFranchise || null);
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
          {/* Tenant Selector for Platform Admins */}
          {context.isPlatformAdmin && (
            <Select value={selectedTenant || ""} onValueChange={handleTenantChange}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Select tenant" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={selectedFranchise || ""} onValueChange={handleFranchiseChange} disabled={!selectedTenant && context.isPlatformAdmin}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Select franchise" />
            </SelectTrigger>
            <SelectContent>
              {franchises.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {context.isPlatformAdmin && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Override</span>
              <Switch checked={adminOverrideEnabled} onCheckedChange={handleAdminOverrideToggle} />
            </div>
          )}
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
