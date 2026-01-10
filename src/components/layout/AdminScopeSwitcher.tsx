import { useEffect, useState } from 'react';
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

export function AdminScopeSwitcher() {
  const { context, preferences, setAdminOverride, setScopePreference, supabase } = useCRM();
  const [open, setOpen] = useState(false);
  
  const [tenants, setTenants] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // If not platform admin, don't render anything
  useEffect(() => {
    if (!context.isPlatformAdmin) {
      console.debug('AdminScopeSwitcher: User is not platform admin. Roles:', context);
    }
  }, [context.isPlatformAdmin]);

  if (!context.isPlatformAdmin) {
    return null;
  }

  const adminOverride = preferences?.admin_override_enabled ?? false;
  const currentTenantId = preferences?.tenant_id ?? null;
  const currentFranchiseId = preferences?.franchise_id ?? null;

  useEffect(() => {
    if (adminOverride && open) {
      loadData();
    }
  }, [adminOverride, open]);

  const loadData = async () => {
    setLoadingData(true);
    try {
        const { data: tData } = await (supabase as any).from('tenants').select('id, name').order('name');
        setTenants(tData || []);
        
        let q = (supabase as any).from('franchises').select('id, name, tenant_id').order('name');
        if (currentTenantId) {
            q = q.eq('tenant_id', currentTenantId);
        }
        const { data: fData } = await q;
        setFranchises(fData || []);
    } catch (e) {
        console.error(e);
    }
    setLoadingData(false);
  };

  const handleToggleOverride = async (checked: boolean) => {
    await setAdminOverride(checked);
    if (checked) {
        loadData();
    }
  };

  const handleTenantChange = async (val: string) => {
    const newVal = val === 'all' ? null : val;
    // Reset franchise when tenant changes
    await setScopePreference(newVal, null);
    loadData();
  };

  const handleFranchiseChange = async (val: string) => {
    const newVal = val === 'all' ? null : val;
    await setScopePreference(currentTenantId, newVal);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={adminOverride ? "destructive" : "outline"} size="sm" className="gap-2">
          <Shield className="h-4 w-4" />
          {adminOverride ? "Scoped View" : "Global Admin"}
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
