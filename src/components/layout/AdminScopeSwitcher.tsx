import { useEffect, useState, useCallback, useMemo } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Button } from '@/components/ui/button';
import { Shield, Check } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ScopedDataAccess, DataAccessContext } from '@/lib/db/access';

export function AdminScopeSwitcher() {
  const { context, preferences, setAdminOverride, setScopePreference, scopedDb } = useCRM();
  const [open, setOpen] = useState(false);
  
  const [tenants, setTenants] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const adminOverride = preferences?.admin_override_enabled ?? false;
  const currentTenantId = preferences?.tenant_id ?? null;
  const currentFranchiseId = preferences?.franchise_id ?? null;
  const isPlatformAdmin = context.isPlatformAdmin;

  // Load franchises when tenant changes or on initial load
  const loadFranchises = useCallback(async (tenantId: string | null) => {
    try {
      let q = scopedDb.from('franchises', true).select('id, name, tenant_id').order('name');
      if (tenantId) {
        q = q.eq('tenant_id', tenantId);
      }
      const { data: fData } = await q;
      setFranchises(fData || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load franchises");
    }
  }, [scopedDb]);

  const loadData = useCallback(async (tenantIdOverride?: string | null) => {
    setLoadingData(true);
    try {
      const { data: tData } = await scopedDb.from('tenants', true).select('id, name').order('name');
      setTenants(tData || []);
      
      // Use override if provided, otherwise use current preference
      const effectiveTenantId = tenantIdOverride !== undefined ? tenantIdOverride : currentTenantId;
      await loadFranchises(effectiveTenantId);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load scope data");
    }
    setLoadingData(false);
  }, [scopedDb, currentTenantId, loadFranchises]);

  // Debug logging (only when component mounts)
  useEffect(() => {
    if (!isPlatformAdmin) {
      console.debug('AdminScopeSwitcher: User is not platform admin. Context:', context);
    }
  }, [isPlatformAdmin, context]);

  // Load data when admin override is enabled and popover opens
  // OR if override is enabled and we need tenant name for button label
  useEffect(() => {
    if (adminOverride && isPlatformAdmin) {
      // We load data if open OR if we don't have tenants list yet (to show label)
      if (open || tenants.length === 0) {
        loadData();
      }
    }
  }, [adminOverride, open, isPlatformAdmin, loadData, tenants.length]);

  // Reload franchises when tenant preference changes
  useEffect(() => {
    if (adminOverride && open && isPlatformAdmin) {
      loadFranchises(currentTenantId);
    }
  }, [currentTenantId, adminOverride, open, isPlatformAdmin, loadFranchises]);

  // If not platform admin, don't render anything
  if (!isPlatformAdmin) {
    return null;
  }

  const handleToggleOverride = async (checked: boolean) => {
    try {
      await setAdminOverride(checked);
      scopedDb.logViewPreference('admin_override', checked ? 'enabled' : 'disabled');
      toast.success(checked ? "Scoped View Enabled" : "Global Admin View Restored");
      if (checked) {
        loadData();
      }
    } catch (error) {
      toast.error("Failed to toggle admin override");
    }
  };

  const handleTenantChange = async (val: string) => {
    const newVal = val === 'all' ? null : val;
    try {
      // Reset franchise when tenant changes and immediately load filtered franchises
      // Explicitly pass adminOverride to prevent state synchronization issues
      await setScopePreference(newVal, null, adminOverride);
      scopedDb.logViewPreference('scope_change', `Tenant: ${newVal || 'All'}, Franchise: All`);
      await loadFranchises(newVal);
      toast.success("Tenant Scope Updated");
    } catch (error) {
      toast.error("Failed to update tenant scope");
    }
  };

  const handleFranchiseChange = async (val: string) => {
    const newVal = val === 'all' ? null : val;
    try {
      // Explicitly pass adminOverride to prevent state synchronization issues
      await setScopePreference(currentTenantId, newVal, adminOverride);
      scopedDb.logViewPreference('scope_change', `Tenant: ${currentTenantId || 'All'}, Franchise: ${newVal || 'All'}`);
      toast.success("Franchise Scope Updated");
    } catch (error) {
      toast.error("Failed to update franchise scope");
    }
  };

  // Resolve scope label
  const getScopeLabel = () => {
    if (!adminOverride) return "Global Admin";
    if (!currentTenantId) return "All Tenants";
    const tenant = tenants.find(t => t.id === currentTenantId);
    return tenant ? tenant.name : "Scoped View";
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={adminOverride ? "destructive" : "outline"} size="sm" className="gap-2 max-w-[200px]">
          <Shield className="h-4 w-4 shrink-0" />
          <span className="truncate">{getScopeLabel()}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="font-medium leading-none">Admin Override</h4>
              <p className="text-sm text-muted-foreground">
                View as specific tenant/franchise
              </p>
            </div>
            <Switch
              checked={adminOverride}
              onCheckedChange={handleToggleOverride}
            />
          </div>
          
          {adminOverride && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label>Tenant</Label>
                <Select 
                    value={currentTenantId || 'all'} 
                    onValueChange={handleTenantChange}
                    disabled={loadingData}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tenants</SelectItem>
                    {tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Franchise</Label>
                <Select 
                    value={currentFranchiseId || 'all'} 
                    onValueChange={handleFranchiseChange}
                    disabled={loadingData}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Franchise" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Franchises</SelectItem>
                    {franchises.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
