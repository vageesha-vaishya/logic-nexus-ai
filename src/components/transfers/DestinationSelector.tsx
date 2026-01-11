import { useState, useEffect } from 'react';
import { TransferService, TransferType } from '@/lib/transfer-service';
import { useCRM } from '@/hooks/useCRM';
import { ScopedDataAccess } from '@/lib/db/access';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Building2, Users } from 'lucide-react';

interface DestinationSelectorProps {
  transferType: TransferType;
  sourceTenantId: string;
  sourceFranchiseId?: string;
  targetTenantId: string;
  targetFranchiseId: string;
  onTargetTenantChange: (id: string) => void;
  onTargetFranchiseChange: (id: string) => void;
}

export function DestinationSelector({
  transferType,
  sourceTenantId,
  sourceFranchiseId,
  targetTenantId,
  targetFranchiseId,
  onTargetTenantChange,
  onTargetFranchiseChange,
}: DestinationSelectorProps) {
  const { supabase, context } = useCRM();
  const dao = new ScopedDataAccess(supabase, context);
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [franchises, setFranchises] = useState<{ id: string; name: string }[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [loadingFranchises, setLoadingFranchises] = useState(false);

  // Load tenants
  useEffect(() => {
    const load = async () => {
      setLoadingTenants(true);
      try {
        const data = await TransferService.getAvailableTenants(dao);
        setTenants(data);
      } catch (error) {
        console.error('Error loading tenants:', error);
      } finally {
        setLoadingTenants(false);
      }
    };
    load();
  }, []);

  // Load franchises when tenant is selected
  useEffect(() => {
    const loadFranchises = async () => {
      const effectiveTenantId = transferType === 'franchise_to_franchise' 
        ? sourceTenantId 
        : targetTenantId;
      
      if (!effectiveTenantId) {
        setFranchises([]);
        return;
      }

      setLoadingFranchises(true);
      try {
        const data = await TransferService.getFranchisesForTenant(dao, effectiveTenantId);
        // Filter out source franchise for franchise-to-franchise transfers
        if (transferType === 'franchise_to_franchise' && sourceFranchiseId) {
          setFranchises(data.filter((f: any) => f.id !== sourceFranchiseId));
        } else {
          setFranchises(data);
        }
      } catch (error) {
        console.error('Error loading franchises:', error);
      } finally {
        setLoadingFranchises(false);
      }
    };

    loadFranchises();
  }, [targetTenantId, sourceTenantId, sourceFranchiseId, transferType]);

  const showTenantSelector = transferType === 'tenant_to_tenant' || transferType === 'tenant_to_franchise';
  const showFranchiseSelector = transferType === 'tenant_to_franchise' || transferType === 'franchise_to_franchise';

  // Filter tenants based on transfer type
  const availableTenants = transferType === 'tenant_to_tenant'
    ? tenants.filter(t => t.id !== sourceTenantId)
    : tenants;

  return (
    <div className="space-y-4">
      <h4 className="font-medium flex items-center gap-2">
        <Building2 className="h-4 w-4" />
        Transfer Destination
      </h4>

      {showTenantSelector && (
        <div className="space-y-2">
          <Label>Target Tenant</Label>
          <Select value={targetTenantId} onValueChange={onTargetTenantChange} disabled={loadingTenants}>
            <SelectTrigger>
              {loadingTenants ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SelectValue placeholder="Select target tenant..." />
              )}
            </SelectTrigger>
            <SelectContent>
              {availableTenants.map((tenant) => (
                <SelectItem key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {transferType === 'tenant_to_tenant' 
              ? 'Select the organization to receive these records'
              : 'Select the tenant containing the target franchise'}
          </p>
        </div>
      )}

      {showFranchiseSelector && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Target Franchise
          </Label>
          <Select 
            value={targetFranchiseId} 
            onValueChange={onTargetFranchiseChange}
            disabled={loadingFranchises || (!targetTenantId && transferType !== 'franchise_to_franchise')}
          >
            <SelectTrigger>
              {loadingFranchises ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SelectValue placeholder="Select target franchise..." />
              )}
            </SelectTrigger>
            <SelectContent>
              {franchises.map((franchise) => (
                <SelectItem key={franchise.id} value={franchise.id}>
                  {franchise.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {transferType === 'franchise_to_franchise'
              ? 'Select another franchise within the same tenant'
              : 'Select the franchise location to receive these records'}
          </p>
        </div>
      )}

      {transferType === 'franchise_to_franchise' && (
        <div className="p-3 bg-muted rounded-lg text-sm">
          <p className="font-medium">Franchise-to-Franchise Transfer</p>
          <p className="text-muted-foreground mt-1">
            Records will be moved between franchise locations within your organization.
            The tenant ownership will remain unchanged.
          </p>
        </div>
      )}
    </div>
  );
}
