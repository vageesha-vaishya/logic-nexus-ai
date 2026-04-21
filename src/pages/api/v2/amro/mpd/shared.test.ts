import { describe, expect, it } from 'vitest';
import {
  mapMpdPayloadToTaskTemplateInput,
  mapTaskTemplateRowToMpd,
  validateMpdInput,
} from './shared';

describe('mpd shared mapping', () => {
  it('maps task_templates row to MPD response shape', () => {
    const mapped = mapTaskTemplateRowToMpd({
      id: 'mpd-1',
      tt_sequence: 7,
      code_form_no: 'MPD-007',
      ata_code: '28',
      reference_amp: 'AMP-28',
      description: 'Fuel system inspection',
      category_code: 'INSP',
      estimated_man_hours: 3.5,
      revision_status: 'B',
      interval_hours: 500,
      interval_cycles: 1000,
      interval_months: 6,
      is_mandatory: true,
      assembly_models: '11111111-1111-4111-8111-111111111111',
      task_template_detail_json: [{ task_number: 'A-1' }],
      task_template_scope_json: [{ section: 'wing' }],
      tenant_id: 'tenant-1',
      franchise_id: null,
      created_at: '2026-04-21T00:00:00.000Z',
      updated_at: '2026-04-21T00:00:00.000Z',
    }, 'tt_sequence', 'assembly_models');

    expect(mapped.mpd_sequence).toBe(7);
    expect(mapped.mpd_code).toBe('MPD-007');
    expect(mapped.assembly_model_id).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('maps MPD payload to task_templates patch shape', () => {
    const mapped = mapMpdPayloadToTaskTemplateInput({
      mpd_code: 'MPD-011',
      ata_code: '52',
      description: 'Door inspection',
      assembly_model_id: '22222222-2222-4222-8222-222222222222',
    }, 'assembly_models');

    expect(mapped.code_form_no).toBe('MPD-011');
    expect(mapped.ata_code).toBe('52');
    expect(mapped.description).toBe('Door inspection');
    expect(mapped.assembly_models).toBe('22222222-2222-4222-8222-222222222222');
  });

  it('validates required create fields and numeric constraints', () => {
    const issues = validateMpdInput({
      ata_code: '',
      description: '',
      estimated_man_hours: -1,
    }, 'create');

    expect(issues.some((issue) => issue.field === 'ata_code')).toBe(true);
    expect(issues.some((issue) => issue.field === 'description')).toBe(true);
    expect(issues.some((issue) => issue.field === 'estimated_man_hours')).toBe(true);
  });
});
