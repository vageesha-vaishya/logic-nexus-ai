import { describe, expect, it } from 'vitest';
import { mapApiRecordToMpdRecord, mapMpdInputToApiPayload } from './useMpdState';

describe('useMpdState mapping utilities', () => {
  it('maps API record to normalized MPD model', () => {
    const mapped = mapApiRecordToMpdRecord({
      id: 'mpd-22',
      mpd_sequence: 22,
      mpd_code: 'MPD-022',
      ata_code: '53',
      description: 'Fuselage detailed inspection',
      is_mandatory: true,
      task_template_detail_json: [{ task: 'inspect' }],
      task_template_scope_json: [{ zone: 'fuselage' }],
    });

    expect(mapped.id).toBe('mpd-22');
    expect(mapped.mpd_code).toBe('MPD-022');
    expect(mapped.ata_code).toBe('53');
    expect(mapped.task_template_detail_json.length).toBe(1);
  });

  it('maps MPD form input to API payload', () => {
    const payload = mapMpdInputToApiPayload({
      mpd_code: ' MPD-030 ',
      ata_code: ' 24 ',
      description: ' Electrical power operational check ',
      estimated_man_hours: 3.25,
      is_mandatory: true,
    });

    expect(payload.mpd_code).toBe('MPD-030');
    expect(payload.ata_code).toBe('24');
    expect(payload.description).toBe('Electrical power operational check');
    expect(payload.estimated_man_hours).toBe(3.25);
    expect(payload.is_mandatory).toBe(true);
  });
});
