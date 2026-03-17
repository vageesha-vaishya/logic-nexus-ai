import { useEffect, useState, useCallback } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';
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
  const isTenantAdmin = context.isTenantAdmin;
  const canUseAdminOverride = isPlatformAdmin || isTenantAdmin;
  const ownedTenantId = context.ownedTenantId ?? null;
  const isTenantBoundPlatformAdmin = Boolean(ownedTenantId);

  const loadFranchises = useCallback(async (tenantId: string | null) => {
    try {
      let q = scopedDb.from('franchises').select('id, name, tenant_id').order('name');
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
      let tenantQuery = scopedDb.from('tenants').select('id, name').order('name');
      const scopeTenantId = ownedTenantId ?? context.tenantId ?? null;
      if (!isPlatformAdmin || scopeTenantId) {
        tenantQuery = tenantQuery.eq('id', scopeTenantId);
      }
      const { data: tData } = await tenantQuery;
      setTenants(tData || []);

      const effectiveTenantId = tenantIdOverride !== undefined
        ? tenantIdOverride
        : (currentTenantId || scopeTenantId);
      await loadFranchises(effectiveTenantId);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load scope data");
    }
    setLoadingData(false);
  }, [scopedDb, currentTenantId, loadFranchises, ownedTenantId, context.tenantId, isPlatformAdmin]);

  useEffect(() => {
    if (!canUseAdminOverride) {
      console.debug('AdminScopeSwitcher: User is not eligible for admin override. Context:', context);
    }
  }, [canUseAdminOverride, context]);

  useEffect(() => {
    if (adminOverride && canUseAdminOverride) {
      if (open || tenants.length === 0) {
        loadData();
      }
    }
  }, [adminOverride, open, canUseAdminOverride, loadData, tenants.length]);

  useEffect(() => {
    if (adminOverride && open && canUseAdminOverride) {
      loadFranchises(currentTenantId || ownedTenantId || context.tenantId || null);
    }
  }, [currentTenantId, adminOverride, open, canUseAdminOverride, loadFranchises, ownedTenantId, context.tenantId]);

  if (!canUseAdminOverride) {
    return null;
  }

  const handleToggleOverride = async (checked: boolean) => {
    try {
      await setAdminOverride(checked);
      scopedDb.logViewPreference('admin_override', checked ? 'enabled' : 'disabled');
      toast.success(checked ? "Scoped View Enabled" : (isPlatformAdmin ? "Global Admin View Restored" : "Tenant-wide View Restored"));
      if (checked) {
        loadData();
      }
    } catch (error) {
      toast.error("Failed to toggle admin override");
    }
  };

  const handleTenantChange = async (val: string) => {
    if (!isPlatformAdmin) {
      return;
    }
    if (val === 'all' && isTenantBoundPlatformAdmin) {
      toast.error("Tenant scope is locked to your assigned tenant");
      return;
    }
    const newVal = val === 'all' ? null : val;
    try {
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
    const effectiveTenantId = currentTenantId || ownedTenantId || context.tenantId || null;
    try {
      await setScopePreference(effectiveTenantId, newVal, adminOverride);
      scopedDb.logViewPreference('scope_change', `Tenant: ${effectiveTenantId || 'All'}, Franchise: ${newVal || 'All'}`);
      toast.success("Franchise Scope Updated");
    } catch (error) {
      toast.error("Failed to update franchise scope");
    }
  };

  const getScopeLabel = () => {
    if (!adminOverride) return isPlatformAdmin ? "Global Admin" : "Tenant Admin";
    const effectiveTenantId = currentTenantId || ownedTenantId || context.tenantId || null;
    if (!effectiveTenantId && !isTenantBoundPlatformAdmin) return "All Tenants";
    const tenant = tenants.find(t => t.id === effectiveTenantId);
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
                {isPlatformAdmin ? "View as specific tenant/franchise" : "View as all or specific franchise"}
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
                    value={currentTenantId || ownedTenantId || context.tenantId || 'all'} 
                    onValueChange={handleTenantChange}
                    disabled={loadingData || !isPlatformAdmin || isTenantBoundPlatformAdmin}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {isPlatformAdmin && !isTenantBoundPlatformAdmin && (
                      <SelectItem value="all">All Tenants</SelectItem>
                    )}
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
