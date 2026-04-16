import { describe, expect, it } from 'vitest';
import { buildWorkPackageWizardSteps } from './workPackageWizardConfig';

describe('workPackageWizardConfig template model validation', () => {
  const getTemplateValidator = (aircraftOptions: any[], templateOptions: any[]) => {
    const steps = buildWorkPackageWizardSteps({ aircraftOptions, templateOptions });
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

