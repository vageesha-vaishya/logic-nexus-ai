import { describe, expect, it } from 'vitest';
import { buildWorkPackageWizardSteps } from './workPackageWizardConfig';

describe('workPackageWizardConfig template model validation', () => {
  const getTemplateValidator = (aircraftOptions: any[], templateOptions: any[]) => {
    const steps = buildWorkPackageWizardSteps({
      aircraftOptions,
      templateOptions,
      assignmentOptions: [],
      assignmentOptionsLoading: false,
      assignmentOptionsError: null,
      titleOptions: [{ value: 'ttl-1', label: 'Starter Work Package (STARTER)' }],
      titleOptionsLoading: false,
    });
    const aircraftStep = steps.find((step) => step.id === 'aircraft-path');
    const templateField = aircraftStep?.fields.find((field) => field.id === 'template_version_id');
    if (!templateField?.validate) {
      throw new Error('template_version_id validator was not configured');
    }
    return templateField.validate;
  };

  it('passes when aircraft assembly_models matches template assembly_models_id', () => {
    const validate = getTemplateValidator(
      [{ value: 'ac-1', label: 'AC1', assembly_models: 'uuid-abc' }],
      [{ value: 'tpl-1', label: 'TPL1', assembly_models_id: 'uuid-abc' }],
    );
    const result = validate('tpl-1', { aircraft_id: 'ac-1', creation_path: 'scheduled' });
    expect(result).toBeNull();
  });

  it('returns mismatch error when aircraft and template model ids differ', () => {
    const validate = getTemplateValidator(
      [{ value: 'ac-1', label: 'AC1', assembly_models: 'uuid-abc' }],
      [{ value: 'tpl-1', label: 'TPL1', assembly_models_id: 'uuid-def' }],
    );
    const result = validate('tpl-1', { aircraft_id: 'ac-1', creation_path: 'scheduled' });
    expect(result).toBe('Assembly model not matching');
  });

  it('supports legacy fallback where template uses assembly_models instead of assembly_models_id', () => {
    const validate = getTemplateValidator(
      [{ value: 'ac-1', label: 'AC1', assembly_models: 'uuid-abc' }],
      [{ value: 'tpl-1', label: 'TPL1', assembly_models: 'uuid-abc' }],
    );
    const result = validate('tpl-1', { aircraft_id: 'ac-1', creation_path: 'scheduled' });
    expect(result).toBeNull();
  });
});

describe('workPackageWizardConfig schedule validation', () => {
  const steps = buildWorkPackageWizardSteps({
    aircraftOptions: [{ value: 'ac-001', label: 'VT-ABC' }],
    templateOptions: [{ value: 'tpl-001', label: 'A-Check' }],
    assignmentOptions: [
      { value: 'Tenant: Alpha', label: 'Tenant: Alpha', searchText: 'alpha tenant' },
      { value: 'Franchise: Bravo', label: 'Franchise: Bravo', searchText: 'bravo franchise' },
    ],
    assignmentOptionsLoading: false,
    assignmentOptionsError: null,
    titleOptions: [{ value: 'ttl-1', label: 'Starter Work Package (STARTER)' }],
    titleOptionsLoading: false,
  });

  const scheduleStep = steps.find((step) => step.id === 'schedule');
  if (!scheduleStep) throw new Error('schedule step not found');

  const startField = scheduleStep.fields.find((field) => field.id === 'planned_start_date');
  const endField = scheduleStep.fields.find((field) => field.id === 'planned_end_date');
  const assignedToField = scheduleStep.fields.find((field) => field.id === 'assigned_to');

  if (!startField?.validate || !endField?.validate || !assignedToField?.validate) {
    throw new Error('required field validators are not configured');
  }

  it('requires YYYY-MM-DD format for planned start date', () => {
    expect(startField.validate('2026/04/20', { planned_end_date: '' })).toBe('Use YYYY-MM-DD format');
    expect(startField.validate('2026-04-20', { planned_end_date: '' })).toBeNull();
  });

  it('prevents end date earlier than start date', () => {
    const formData = { planned_start_date: '2026-04-20', planned_end_date: '2026-04-19' };
    expect(endField.validate('2026-04-19', formData)).toBe('End date cannot be earlier than start date');
    expect(startField.validate('2026-04-20', formData)).toBe('Start date cannot be later than end date');
  });

  it('accepts empty end date and validates assigned option values', () => {
    expect(endField.validate('', { planned_start_date: '2026-04-20' })).toBeNull();
    expect(assignedToField.validate('Tenant: Alpha', {})).toBeNull();
    expect(assignedToField.validate('Unknown team', {})).toBe('Select a valid franchise or tenant from the list');
  });
});
