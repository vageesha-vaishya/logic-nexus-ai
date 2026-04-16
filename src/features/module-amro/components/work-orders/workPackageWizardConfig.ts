import { Calendar, FileText, Plane, Shield } from 'lucide-react';
import type { WizardStepConfig } from '@/features/module-amro/components/data-grid/AmroRecordWizard';

type WizardOption = { value: string; label: string };

const MAINTENANCE_TYPE_OPTIONS: WizardOption[] = [
  { value: 'line', label: 'Line' },
  { value: 'base', label: 'Base' },
  { value: 'component', label: 'Component' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'overhaul', label: 'Overhaul' },
  { value: 'repair', label: 'Repair' },
  { value: 'upgrade', label: 'Upgrade' },
  { value: 'modification', label: 'Modification' },
];

export function buildWorkPackageWizardSteps({
  aircraftOptions,
  templateOptions,
}: {
  aircraftOptions: WizardOption[];
  templateOptions: WizardOption[];
}): WizardStepConfig[] {
  return [
    {
      id: 'aircraft-path',
      title: 'Aircraft & Path',
      description: 'Select aircraft and workflow type',
      icon: Plane,
      fields: [
        {
          id: 'aircraft_id',
          label: 'Aircraft',
          type: 'select',
          required: true,
          options: aircraftOptions,
          placeholder: aircraftOptions.length ? 'Select aircraft...' : 'No aircraft available',
        },
        {
          id: 'creation_path',
          label: 'Creation Path',
          type: 'radio',
          required: true,
          options: [
            { value: 'scheduled', label: 'Scheduled Maintenance' },
            { value: 'non-scheduled', label: 'Non-Scheduled' },
            { value: 'emergency', label: 'Emergency / AOG' },
          ],
        },
        {
          id: 'template_version_id',
          label: 'Template',
          type: 'select',
          required: true,
          options: templateOptions,
          showWhen: (formData) => formData.creation_path === 'scheduled',
          placeholder: templateOptions.length ? 'Select template...' : 'No templates available',
          validate: (value, formData) => {
            if (!value) return 'Template is required';
            const aircraftId = formData.aircraft_id;
            if (!aircraftId) return null;
            
            const selectedAircraft = aircraftOptions.find((a: any) => a.value === aircraftId) as any;
            const selectedTemplate = templateOptions.find((t: any) => t.value === value) as any;
            
            const aircraftModel = String(selectedAircraft?.assembly_models || '').trim();
            const templateModel = String(selectedTemplate?.assembly_models || '').trim();
            console.log(`[MODEL_COMPARE] Aircraft Model: ${aircraftModel}`);
            console.log(`[MODEL_COMPARE] Template Model: ${templateModel}`);
            if (aircraftModel !== templateModel) {
              return 'Assembly model not matching';
            }
            
            return null;
          }
        },
        {
          id: 'defect_description',
          label: 'Defect Description',
          type: 'textarea',
          required: true,
          colSpan: 2,
          showWhen: (formData) => formData.creation_path === 'non-scheduled',
          placeholder: 'Describe the issue found...',
        },
        {
          id: 'emergency_type',
          label: 'Emergency Type',
          type: 'select',
          required: true,
          showWhen: (formData) => formData.creation_path === 'emergency',
          options: [
            { value: 'aog', label: 'AOG (Aircraft on Ground)' },
            { value: 'unscheduled_removal', label: 'Unscheduled Removal' },
            { value: 'flight_delay_risk', label: 'Flight Delay Risk' },
            { value: 'safety_issue', label: 'Safety Issue' },
            { value: 'technical_fault', label: 'Technical Fault' },
          ],
        },
        {
          id: 'urgency_level',
          label: 'Urgency Level',
          type: 'select',
          showWhen: (formData) => formData.creation_path === 'emergency',
          options: [
            { value: 'immediate', label: 'Immediate' },
            { value: 'urgent', label: 'Urgent' },
            { value: 'priority', label: 'Priority' },
            { value: 'routine', label: 'Routine' },
          ],
        },
        {
          id: 'emergency_reason',
          label: 'Reason',
          type: 'textarea',
          required: true,
          colSpan: 2,
          showWhen: (formData) => formData.creation_path === 'emergency',
          placeholder: 'Describe emergency context...',
        },
      ],
    },
    {
      id: 'details',
      title: 'Details',
      description: 'Core work package details',
      icon: FileText,
      fields: [
        { id: 'title', label: 'Title', type: 'text', required: true, colSpan: 2, placeholder: 'Enter work package title' },
        { id: 'description', label: 'Description', type: 'textarea', colSpan: 2, placeholder: 'Describe scope and objectives' },
        {
          id: 'maintenance_type',
          label: 'Maintenance Type',
          type: 'select',
          required: true,
          options: MAINTENANCE_TYPE_OPTIONS,
          placeholder: 'Select maintenance type...',
          validate: (value) => {
            const next = String(value || '').trim().toLowerCase();
            if (!next) return 'Maintenance type is required';
            const valid = MAINTENANCE_TYPE_OPTIONS.some((option) => option.value === next);
            return valid ? null : 'Please select a valid maintenance type from the list';
          },
        },
        {
          id: 'priority',
          label: 'Priority',
          type: 'select',
          required: true,
          options: [
            { value: '1', label: 'P1 - Critical' },
            { value: '2', label: 'P2 - High' },
            { value: '3', label: 'P3 - Medium' },
            { value: '4', label: 'P4 - Low' },
            { value: '5', label: 'P5 - Routine' },
          ],
        },
      ],
    },
    {
      id: 'schedule',
      title: 'Scheduling',
      description: 'Timeline and assignment',
      icon: Calendar,
      fields: [
        {
          id: 'planned_start_date',
          label: 'Planned Start Date',
          type: 'text',
          required: true,
          placeholder: 'YYYY-MM-DD',
          validate: (value) => (String(value || '').trim() ? null : 'Planned start date is required'),
        },
        { id: 'planned_end_date', label: 'Planned End Date', type: 'text', placeholder: 'YYYY-MM-DD' },
        { id: 'assigned_to', label: 'Assigned To', type: 'text', placeholder: 'Technician or team' },
        {
          id: 'estimated_ground_time_hours',
          label: 'Estimated Ground Time (hours)',
          type: 'number',
          showWhen: (formData) => formData.creation_path === 'emergency',
        },
        { id: 'notes', label: 'Notes', type: 'textarea', colSpan: 2, placeholder: 'Optional notes' },
      ],
    },
    {
      id: 'review',
      title: 'Review',
      description: 'Validate and submit',
      icon: Shield,
      fields: [
        {
          id: 'submission_check',
          label: 'I confirm all details are correct',
          type: 'checkbox',
          required: true,
          validate: (value) => (value ? null : 'Please confirm before submitting'),
        },
      ],
    },
  ];
}

export function getWorkPackageWizardInitialData(preselectedAircraftId?: string): Record<string, unknown> {
  return {
    aircraft_id: preselectedAircraftId || '',
    creation_path: 'scheduled',
    maintenance_type: 'line',
    priority: '3',
    urgency_level: 'immediate',
    emergency_type: 'aog',
    submission_check: false,
  };
}
