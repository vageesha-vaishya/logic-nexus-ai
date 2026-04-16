import { useMemo } from 'react';
import { Calendar, FileText, Plane, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { AmroRecordWizard, type WizardStepConfig } from '@/features/module-amro/components/data-grid/AmroRecordWizard';
import {
  useCreateWorkPackage,
  type MaintenanceType,
  type WorkPackagePriority,
} from './useWorkPackageState';
import {
  useCreateEmergencyWP,
  type EmergencyType,
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

export function AmroWorkPackageCreateWizard({
  open,
  onOpenChange,
  onSuccess,
  preselectedAircraftId,
}: Props) {
  const createWPMutation = useCreateWorkPackage();
  const createEmergencyWPMutation = useCreateEmergencyWP();
  const { options: aircraftOptions } = useAircraftOptions(open);
  const { options: templateOptions } = useWorkPackageTemplateOptions(open);

  const steps = useMemo<WizardStepConfig[]>(
    () => buildWorkPackageWizardSteps({ aircraftOptions, templateOptions }),
    [aircraftOptions, templateOptions],
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
