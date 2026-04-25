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
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEFAULT_WORK_PACKAGE_TITLE_FALLBACK: Array<{ title: string; wp_title: string }> = [
  { title: 'Hot section intervention planning', wp_title: 'HOTSEC' },
  { title: 'LLP cycle projection and replacement prep', wp_title: 'LLPAUDIT' },
  { title: 'Oil consumption exceedance corrective action', wp_title: 'OILANALYSIS' },
  { title: 'Starter Work Package', wp_title: 'STARTER' },
  { title: 'Engine borescope inspection package', wp_title: 'BORESCOPE' },
  { title: 'Engine warranty status review', wp_title: 'WARRANTTY' },
  { title: 'A-Check Deccan Fly', wp_title: 'ACHECK' },
  { title: 'pre_docking', wp_title: 'PREDOCKING' },
  { title: 'C-Check Deccan Fly Heavy', wp_title: 'CCHECK' },
  { title: 'WiFi System Upgrade', wp_title: 'WIFI' },
  { title: 'A-Check Inspection', wp_title: 'ACHECK' },
  { title: 'Engine Overhaul - CFM56', wp_title: 'EOVERHAUL' },
  { title: 'slotting', wp_title: 'SLOTTING' },
  { title: 'Verify post-fix path', wp_title: 'VERIFYFIX' },
  { title: 'Annual Airworthiness Review', wp_title: 'ANNUALREV' },
  { title: 'Cabin Refurbishment - Deferred', wp_title: 'CABINREF' },
  { title: 'Pre-Flight Inspection', wp_title: 'PREFLIGHT' },
  { title: 'Landing Gear Inspection', wp_title: 'LANDGEAR' },
  { title: 'Runtime path retry package', wp_title: 'PATHRETRY' },
  { title: 'APU Repair', wp_title: 'APUREPAIR' },
];

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
  const [titleOptions, setTitleOptions] = useState<Array<{ value: string; label: string; wp_title: string; title: string }>>([]);
  const [titleOptionsLoading, setTitleOptionsLoading] = useState(false);
  const [assignmentOptions, setAssignmentOptions] = useState<Array<{ value: string; label: string; searchText: string }>>([]);
  const [assignmentOptionsLoading, setAssignmentOptionsLoading] = useState(false);
  const [assignmentOptionsError, setAssignmentOptionsError] = useState<string | null>(null);

  const getFallbackTitleOptions = useCallback(
    () =>
      DEFAULT_WORK_PACKAGE_TITLE_FALLBACK.map((item) => ({
        value: `fallback:${item.wp_title}`,
        label: `${item.title} (${item.wp_title})`,
        title: item.title,
        wp_title: item.wp_title,
      })),
    [],
  );

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

  const loadTitleOptions = useCallback(async () => {
    if (!open) return;
    setTitleOptionsLoading(true);
    try {
      let query = (scopedDb as any)
        .from('work_packages_title', Boolean(context.isPlatformAdmin))
        .select('id,title,wp_title,tenant_id,franchise_id')
        .order('title', { ascending: true });

      if (context.tenantId) {
        query = query.eq('tenant_id', context.tenantId);
      }

      if (!context.isPlatformAdmin && context.franchiseId) {
        query = query.or(`franchise_id.is.null,franchise_id.eq.${context.franchiseId}`);
      }

      const { data, error } = await query;
      if (error) throw new Error(String(error.message || 'Failed to load title options'));

      const mapped = (Array.isArray(data) ? data : [])
        .map((row) => {
          const id = String((row as Record<string, unknown>).id || '').trim();
          const title = String((row as Record<string, unknown>).title || '').trim();
          const wpTitle = String((row as Record<string, unknown>).wp_title || '').trim();
          if (!id || !title || !wpTitle) return null;
          return {
            value: id,
            label: `${title} (${wpTitle})`,
            title,
            wp_title: wpTitle,
          };
        })
        .filter(Boolean) as Array<{ value: string; label: string; wp_title: string; title: string }>;

      setTitleOptions(mapped.length ? mapped : getFallbackTitleOptions());
    } catch {
      setTitleOptions(getFallbackTitleOptions());
    } finally {
      setTitleOptionsLoading(false);
    }
  }, [context.franchiseId, context.isPlatformAdmin, context.tenantId, getFallbackTitleOptions, open, scopedDb]);

  useEffect(() => {
    if (!open) return;
    void loadAssignmentOptions();
  }, [loadAssignmentOptions, open]);

  useEffect(() => {
    if (!open) return;
    void loadTitleOptions();
  }, [loadTitleOptions, open]);

  const steps = useMemo<WizardStepConfig[]>(
    () => buildWorkPackageWizardSteps({
      aircraftOptions,
      templateOptions,
      assignmentOptions,
      assignmentOptionsLoading,
      assignmentOptionsError,
      titleOptions,
      titleOptionsLoading,
    }),
    [aircraftOptions, templateOptions, assignmentOptions, assignmentOptionsLoading, assignmentOptionsError, titleOptions, titleOptionsLoading],
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
          const selectedTitle = titleOptions.find((option) => option.value === String(formData.work_order_title_id || '').trim());
          const selectedTitleId = String(formData.work_order_title_id || '').trim();
          const workPackageTitleId = UUID_PATTERN.test(selectedTitleId) ? selectedTitleId : undefined;
          await createWPMutation.mutateAsync({
            aircraft_id: String(formData.aircraft_id || '').trim(),
            title: selectedTitle?.title || undefined,
            work_order_title_id: workPackageTitleId,
            description: String(formData.description || '').trim() || undefined,
            maintenance_type: String(formData.maintenance_type || 'line') as MaintenanceType,
            priority: Number(formData.priority || 3) as WorkPackagePriority,
            planned_start_date: String(formData.planned_start_date || '').trim() || undefined,
            planned_end_date: String(formData.planned_end_date || '').trim() || undefined,
            assigned_to: String(formData.assigned_to || '').trim() || undefined,
            work_order_template_id: String(formData.template_version_id || '').trim() || undefined,
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
