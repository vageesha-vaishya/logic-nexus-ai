import { describe, expect, it } from 'vitest';
import { formatThresholdFrequency } from './frequencyFormatter';

describe('formatThresholdFrequency', () => {
  it('formats all threshold components when all values are present', () => {
    const value = formatThresholdFrequency({
      interval_hours: 660,
      interval_cycles: 500,
      interval_months: 6,
      calendar_unit: 'Mt',
      threshold_landings: 13500,
      threshold_rins: 20,
      threshold_hobbs: 44,
    });

    expect(value).toBe('660 H, 500 C, 6 Mt, 13500 L, 20 RI, 44 HOB');
  });

  it('formats only non-blank values for partial inputs', () => {
    const value = formatThresholdFrequency({
      interval_hours: null,
      interval_cycles: 500,
      interval_months: '',
      calendar_unit: 'Dy',
      threshold_landings: 13500,
      threshold_rins: undefined,
      threshold_hobbs: 0,
    });

    expect(value).toBe('500 C, 13500 L, 0 HOB');
  });

  it('returns empty string when all threshold values are blank', () => {
    const value = formatThresholdFrequency({
      interval_hours: null,
      interval_cycles: undefined,
      interval_months: '',
      calendar_unit: '',
      threshold_landings: null,
      threshold_rins: undefined,
      threshold_hobbs: null,
    });

    expect(value).toBe('');
  });
});
