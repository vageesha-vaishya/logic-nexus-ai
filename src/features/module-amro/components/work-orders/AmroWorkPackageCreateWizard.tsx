import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AmroRecordWizard, type WizardStepConfig } from '@/features/module-amro/components/data-grid/AmroRecordWizard';
import { useCRM } from '@/hooks/useCRM';
import {
  useCreateWorkPackage,
  type MaintenanceType,
  type WorkPackagePriority,
} from './useWorkPackageState';
import {
  useCreateEmergencyWP,
  type EmergencyType,
  type UrgencyLevel,
} from './useEmergencyWPState';
import { useWorkPackageTemplateOptions } from './useWorkPackageTemplates';
import { useAircraftOptions } from './useAircraftState';
import { buildWorkPackageWizardSteps, getWorkPackageWizardInitialData } from './workPackageWizardConfig';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  preselectedAircraftId?: string;
};

type CreationPath = 'scheduled' | 'non-scheduled' | 'emergency';

export function AmroWorkPackageCreateWizard({
  open,
  onOpenChange,
  onSuccess,
  preselectedAircraftId,
}: Props) {
  const { scopedDb, context } = useCRM();
  const createWPMutation = useCreateWorkPackage();
  const createEmergencyWPMutation = useCreateEmergencyWP();
  const { options: aircraftOptions } = useAircraftOptions(open);
  const { options: templateOptions } = useWorkPackageTemplateOptions(open);
  const [assignmentOptions, setAssignmentOptions] = useState<Array<{ value: string; label: string; searchText: string }>>([]);
  const [assignmentOptionsLoading, setAssignmentOptionsLoading] = useState(false);
  const [assignmentOptionsError, setAssignmentOptionsError] = useState<string | null>(null);

  const loadAssignmentOptions = useCallback(async () => {
    if (!open) return;

    setAssignmentOptionsLoading(true);
    setAssignmentOptionsError(null);

    try {
      let tenantQuery = (scopedDb as any)
        .from('tenants', Boolean(context.isPlatformAdmin))
        .select('id,name,is_active')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (!context.isPlatformAdmin && context.tenantId) {
        tenantQuery = tenantQuery.eq('id', context.tenantId).limit(1);
      }

      const { data: tenantRows, error: tenantError } = await tenantQuery;
      if (tenantError) {
        throw new Error(String(tenantError.message || 'Failed to load tenants'));
      }

      let franchiseQuery = (scopedDb as any)
        .from('franchises', Boolean(context.isPlatformAdmin || context.isTenantAdmin))
        .select('id,name,tenant_id,is_active')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (context.tenantId) {
        franchiseQuery = franchiseQuery.eq('tenant_id', context.tenantId);
      }

      const { data: franchiseRows, error: franchiseError } = await franchiseQuery;
      if (franchiseError) {
        throw new Error(String(franchiseError.message || 'Failed to load franchises'));
      }

      const tenantNameById = new Map<string, string>();
      const normalizedTenantOptions = (Array.isArray(tenantRows) ? tenantRows : [])
        .map((row) => {
          const tenantId = String((row as Record<string, unknown>).id || '').trim();
          const tenantName = String((row as Record<string, unknown>).name || '').trim();
          if (!tenantId || !tenantName) return null;
          tenantNameById.set(tenantId, tenantName);
          return {
            value: `Tenant: ${tenantName}`,
            label: `Tenant: ${tenantName}`,
            searchText: `${tenantName} tenant ${tenantId}`,
          };
        })
        .filter(Boolean) as Array<{ value: string; label: string; searchText: string }>;

      const normalizedFranchiseOptions = (Array.isArray(franchiseRows) ? franchiseRows : [])
        .map((row) => {
          const franchiseId = String((row as Record<string, unknown>).id || '').trim();
          const franchiseName = String((row as Record<string, unknown>).name || '').trim();
          const tenantId = String((row as Record<string, unknown>).tenant_id || '').trim();
          if (!franchiseId || !franchiseName) return null;
          const tenantName = tenantNameById.get(tenantId) || '';
          const label = tenantName
            ? `Franchise: ${franchiseName} (${tenantName})`
            : `Franchise: ${franchiseName}`;
          return {
            value: label,
            label,
            searchText: `${franchiseName} franchise ${tenantName} tenant ${franchiseId}`,
          };
        })
        .filter(Boolean) as Array<{ value: string; label: string; searchText: string }>;

      const combined = [...normalizedTenantOptions, ...normalizedFranchiseOptions]
        .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }));

      setAssignmentOptions(combined);
      setAssignmentOptionsError(null);
    } catch (error) {
      setAssignmentOptions([]);
      setAssignmentOptionsError(String((error as Error).message || 'Failed to load assignment options'));
    } finally {
      setAssignmentOptionsLoading(false);
    }
  }, [context.isPlatformAdmin, context.isTenantAdmin, context.tenantId, open, scopedDb]);

  useEffect(() => {
    if (!open) return;
    void loadAssignmentOptions();
  }, [loadAssignmentOptions, open]);

  const steps = useMemo<WizardStepConfig[]>(
    () => buildWorkPackageWizardSteps({
      aircraftOptions,
      templateOptions,
      assignmentOptions,
      assignmentOptionsLoading,
      assignmentOptionsError,
    }),
    [aircraftOptions, templateOptions, assignmentOptions, assignmentOptionsLoading, assignmentOptionsError],
  );

  if (!open) return null;

  return (
    <AmroRecordWizard
      mode="create"
      steps={steps}
      initialData={getWorkPackageWizardInitialData(preselectedAircraftId)}
      onClose={() => onOpenChange(false)}
      onDraftSave={async () => {
        toast.success('Draft saved for work package wizard');
      }}
      onSubmit={async (formData) => {
        const creationPath = String(formData.creation_path || 'scheduled') as CreationPath;
        if (creationPath === 'emergency') {
          await createEmergencyWPMutation.mutateAsync({
            aircraft_id: String(formData.aircraft_id || ''),
            emergency_type: String(formData.emergency_type || 'aog') as EmergencyType,
            urgency_level: String(formData.urgency_level || 'immediate') as UrgencyLevel,
            reason: String(formData.emergency_reason || ''),
            estimated_ground_time_hours: formData.estimated_ground_time_hours
              ? Number(formData.estimated_ground_time_hours)
              : undefined,
          });
          toast.success('Emergency work package created successfully');
        } else {
          await createWPMutation.mutateAsync({
            aircraft_id: String(formData.aircraft_id || '').trim(),
            title: String(formData.title || '').trim(),
            description: String(formData.description || '').trim() || undefined,
            maintenance_type: String(formData.maintenance_type || 'line') as MaintenanceType,
            priority: Number(formData.priority || 3) as WorkPackagePriority,
            planned_start_date: String(formData.planned_start_date || '').trim() || undefined,
            planned_end_date: String(formData.planned_end_date || '').trim() || undefined,
            assigned_to: String(formData.assigned_to || '').trim() || undefined,
            source: creationPath === 'non-scheduled' ? 'non_scheduled' : 'scheduled',
          });
          toast.success('Work package created successfully');
        }
        onOpenChange(false);
        onSuccess?.();
      }}
      className="max-w-5xl"
    />
  );
}
