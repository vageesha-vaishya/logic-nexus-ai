import { Calendar, FileText, Plane, Shield } from 'lucide-react';
import type { WizardStepConfig } from '@/features/module-amro/components/data-grid/AmroRecordWizard';
import { compareIsoDateStrings, isValidIsoDateString } from '@/features/module-amro/components/data-grid/wizardDateUtils';
import { logger } from "@/lib/logger";

type WizardOption = { value: string; label: string; [key: string]: unknown };

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

export function buildWorkOrderWizardSteps({
  aircraftOptions,
  templateOptions,
  assignmentOptions,
  assignmentOptionsLoading,
  assignmentOptionsError,
  titleOptions,
  titleOptionsLoading,
}: {
  aircraftOptions: WizardOption[];
  templateOptions: WizardOption[];
  assignmentOptions: WizardOption[];
  assignmentOptionsLoading: boolean;
  assignmentOptionsError?: string | null;
  titleOptions: WizardOption[];
  titleOptionsLoading: boolean;
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
          id: 'selected_aircraft_info',
          label: 'Selected Aircraft Info',
          type: 'display',
          colSpan: 2,
          showWhen: (formData) => !!String(formData.aircraft_id || '').trim(),
          displayValue: (formData) => {
            const aircraftId = String(formData.aircraft_id || '').trim();
            const selectedAircraft = aircraftOptions.find((aircraft) => aircraft.value === aircraftId) as Record<string, unknown> | undefined;
            const modelName = String(selectedAircraft?.aircraft_model || selectedAircraft?.model || '').trim() || 'N/A';
            const serialNumber = String(selectedAircraft?.serial_number || selectedAircraft?.msn || '').trim() || 'N/A';
            return `Model Name: ${modelName}\nSerial Number: ${serialNumber}`;
          },
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
            
            const selectedAircraft = aircraftOptions.find((a) => a.value === aircraftId) as Record<string, unknown> | undefined;
            const selectedTemplate = templateOptions.find((t) => t.value === value) as Record<string, unknown> | undefined;

            const aircraftModel = String(
              selectedAircraft?.assembly_models
              || selectedAircraft?.assembly_models_id
              || '',
            ).trim();
            const templateModel = String(
              selectedTemplate?.assembly_models_id
              || selectedTemplate?.assembly_models
              || '',
            ).trim();
            logger.debug('[MODEL_COMPARE] Aircraft payload:', selectedAircraft || null);
            logger.debug('[MODEL_COMPARE] Template payload:', selectedTemplate || null);
            logger.debug(`[MODEL_COMPARE] Aircraft Model: ${aircraftModel}`);
            logger.debug(`[MODEL_COMPARE] Template Model: ${templateModel}`);
            if (!templateModel) {
              logger.warn('[MODEL_COMPARE] template model key missing after mapping', {
                selectedTemplateValue: value,
                availableTemplateKeys: selectedTemplate ? Object.keys(selectedTemplate) : [],
              });
            }
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
        {
          id: 'work_order_title_id',
          label: 'Title',
          type: 'select',
          required: true,
          colSpan: 2,
          options: titleOptions,
          placeholder: titleOptionsLoading ? 'Loading titles...' : 'Select work package title...',
          validate: (value) => {
            const selected = String(value || '').trim();
            if (!selected) return 'Title is required';
            const exists = titleOptions.some((option) => option.value === selected);
            return exists ? null : 'Please select a valid title from the list';
          },
        },
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
          type: 'date',
          required: true,
          placeholder: 'YYYY-MM-DD',
          validate: (value, formData) => {
            const start = String(value || '').trim();
            if (!start) return 'Planned start date is required';
            if (!isValidIsoDateString(start)) return 'Use YYYY-MM-DD format';

            const end = String(formData.planned_end_date || '').trim();
            if (end && isValidIsoDateString(end) && compareIsoDateStrings(start, end) > 0) {
              return 'Start date cannot be later than end date';
            }

            return null;
          },
        },
        {
          id: 'planned_end_date',
          label: 'Planned End Date',
          type: 'date',
          placeholder: 'YYYY-MM-DD',
          validate: (value, formData) => {
            const end = String(value || '').trim();
            if (!end) return null;
            if (!isValidIsoDateString(end)) return 'Use YYYY-MM-DD format';

            const start = String(formData.planned_start_date || '').trim();
            if (start && isValidIsoDateString(start) && compareIsoDateStrings(end, start) < 0) {
              return 'End date cannot be earlier than start date';
            }

            return null;
          },
        },
        {
          id: 'assigned_to',
          label: 'Assigned to',
          type: 'searchable-select',
          placeholder: assignmentOptionsLoading ? 'Loading Franchise/Tenant list...' : 'Search Franchise/Tenant',
          helperText: assignmentOptionsError || 'Search by partial name. Up to 10 matches are shown.',
          maxResults: 10,
          options: assignmentOptions,
          validate: (value) => {
            const selected = String(value || '').trim();
            if (!selected) return null;
            const valid = assignmentOptions.some((option) => option.value === selected);
            return valid ? null : 'Select a valid franchise or tenant from the list';
          },
        },
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

export function getWorkOrderWizardInitialData(preselectedAircraftId?: string): Record<string, unknown> {
  return {
    aircraft_id: preselectedAircraftId || '',
    creation_path: 'scheduled',
    maintenance_type: 'line',
    priority: '3',
    urgency_level: 'immediate',
    emergency_type: 'aog',
    submission_check: false,
    work_order_title_id: '',
  };
}
