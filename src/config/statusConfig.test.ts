import { describe, expect, it } from 'vitest';
import { statusConfig, STATUS_TONES } from './statusConfig';

describe('statusConfig', () => {
  it('uses a valid tone for every status and no raw palette classes', () => {
    for (const [key, cfg] of Object.entries(statusConfig)) {
      expect(STATUS_TONES, key).toContain(cfg.tone);
      expect(JSON.stringify(cfg)).not.toMatch(/bg-(red|green|yellow|blue|gray)-\d/);
    }
  });
});
