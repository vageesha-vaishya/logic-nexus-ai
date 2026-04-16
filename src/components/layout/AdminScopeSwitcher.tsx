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
  // A Platform Admin should never be "bound" to a tenant in terms of visibility override.
  // We only restrict visibility if they are NOT a Platform Admin.
  const isTenantBoundPlatformAdmin = Boolean(ownedTenantId) && !isPlatformAdmin;

  const loadFranchises = useCallback(async (tenantId: string | null) => {
    try {
      let q = (scopedDb as any).client.from('franchises').select('id, name, tenant_id').eq('is_active', true).order('name');
      if (tenantId) {
        q = q.eq('tenant_id', tenantId);
      }
      const { data: fData, error: fError } = await q;
      if (fError) throw fError;
      setFranchises(fData || []);
    } catch (e) {
      console.error('[AdminScopeSwitcher] Failed to load franchises:', e);
      toast.error("Failed to load franchises");
    }
  }, [scopedDb]);

  const loadData = useCallback(async (tenantIdOverride?: string | null) => {
    setLoadingData(true);
    try {
      let tenantQuery = (scopedDb as any).client.from('tenants').select('id, name').eq('is_active', true).order('name');
      const scopeTenantId = ownedTenantId ?? context.tenantId ?? null;
      if (!isPlatformAdmin || (isPlatformAdmin && isTenantBoundPlatformAdmin)) {
        tenantQuery = tenantQuery.eq('id', scopeTenantId);
      }
      const { data: tData, error: tError } = await tenantQuery;
      if (tError) throw tError;
      setTenants(tData || []);

      const effectiveTenantId = tenantIdOverride !== undefined
        ? tenantIdOverride
        : (currentTenantId || scopeTenantId);
      await loadFranchises(effectiveTenantId);
    } catch (e) {
      console.error('[AdminScopeSwitcher] Failed to load scope data:', e);
      toast.error("Failed to load scope data");
    }
    setLoadingData(false);
  }, [scopedDb, currentTenantId, loadFranchises, ownedTenantId, context.tenantId, isPlatformAdmin, isTenantBoundPlatformAdmin]);

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
      // Log the action for auditability
      console.info(`[AdminScopeSwitcher] Admin override ${checked ? 'enabled' : 'disabled'}`);
      
      toast.success(checked ? "Scoped View Enabled" : (isPlatformAdmin ? "Global Admin View Restored" : "Tenant-wide View Restored"));
      if (checked) {
        loadData();
      }
    } catch (error: any) {
      console.error('[AdminScopeSwitcher] Failed to toggle admin override:', error);
      toast.error(`Failed to toggle admin override: ${error?.message || 'Unknown error'}`);
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
      // Log the action for auditability
      console.info(`[AdminScopeSwitcher] Tenant scope changed to: ${newVal || 'All'}`);
      
      // Update local franchises list immediately
      await loadFranchises(newVal);
      toast.success("Tenant Scope Updated");
    } catch (error: any) {
      console.error('[AdminScopeSwitcher] Failed to update tenant scope:', error);
      toast.error(`Failed to update tenant scope: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleFranchiseChange = async (val: string) => {
    const newVal = val === 'all' ? null : val;
    const effectiveTenantId = currentTenantId || ownedTenantId || context.tenantId || null;
    try {
      await setScopePreference(effectiveTenantId, newVal, adminOverride);
      console.info(`[AdminScopeSwitcher] Franchise scope changed to: ${newVal || 'All'} for tenant: ${effectiveTenantId || 'All'}`);
      toast.success("Franchise Scope Updated");
    } catch (error: any) {
      console.error('[AdminScopeSwitcher] Failed to update franchise scope:', error);
      toast.error(`Failed to update franchise scope: ${error?.message || 'Unknown error'}`);
    }
  };

  const getScopeLabel = () => {
    if (!adminOverride) return isPlatformAdmin ? "Global Admin" : "Tenant Admin";
    
    // In override mode, prioritize the explicitly selected tenant preference.
    const effectiveTenantId = currentTenantId;
    if (!effectiveTenantId) return "All Tenants";
    
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
                    value={currentTenantId || 'all'} 
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
