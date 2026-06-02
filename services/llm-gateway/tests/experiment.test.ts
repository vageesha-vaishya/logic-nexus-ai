// Pure-function tests for the experiment picker + in-memory store.

import { pickVariant, experimentWarning } from '../src/prompts/experimentPicker.js';
import { buildInMemoryExperimentStore } from '../src/prompts/experimentStore.js';
import type { PromptExperiment } from '../src/prompts/experimentTypes.js';

function exp(overrides: Partial<PromptExperiment> = {}): PromptExperiment {
  return {
    id: 'exp-1',
    prompt_key: 'mod.feat',
    variant_a_version_id: 'ver-a',
    variant_b_version_id: 'ver-b',
    traffic_split: 0.5,
    status: 'active',
    started_at: '2026-06-02T00:00:00Z',
    ...overrides,
  };
}

describe('pickVariant', () => {
  it('always returns a deterministic pick for a given (experiment_id, seed)', () => {
    const p1 = pickVariant(exp(), 'seed-X');
    const p2 = pickVariant(exp(), 'seed-X');
    expect(p1).toEqual(p2);
  });

  it('different seeds land in different buckets (high probability)', () => {
    const seeds = Array.from({ length: 30 }, (_, i) => `seed-${i}`);
    const buckets = new Set(seeds.map((s) => pickVariant(exp(), s).bucket));
    // 30 seeds should land in at least a handful of distinct buckets out of 100
    expect(buckets.size).toBeGreaterThan(10);
  });

  it('traffic_split=0.0 always picks variant_a', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const pick = pickVariant(exp({ traffic_split: 0.0 }), seed);
      expect(pick.variant_label).toBe('a');
      expect(pick.variant_version_id).toBe('ver-a');
      expect(pick.threshold).toBe(0);
    }
  });

  it('traffic_split=1.0 always picks variant_b', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const pick = pickVariant(exp({ traffic_split: 1.0 }), seed);
      expect(pick.variant_label).toBe('b');
      expect(pick.variant_version_id).toBe('ver-b');
      expect(pick.threshold).toBe(100);
    }
  });

  it('traffic_split=0.5 yields roughly even distribution over many seeds', () => {
    const seeds = Array.from({ length: 2000 }, (_, i) => `seed-${i}`);
    let bCount = 0;
    for (const seed of seeds) {
      if (pickVariant(exp({ traffic_split: 0.5 }), seed).variant_label === 'b') bCount += 1;
    }
    const fraction = bCount / seeds.length;
    // Should be between 0.45 and 0.55 with high probability at 2000 samples
    expect(fraction).toBeGreaterThan(0.45);
    expect(fraction).toBeLessThan(0.55);
  });

  it('bucket is always in [0, 100)', () => {
    for (let i = 0; i < 1000; i += 1) {
      const pick = pickVariant(exp(), `seed-${i}`);
      expect(pick.bucket).toBeGreaterThanOrEqual(0);
      expect(pick.bucket).toBeLessThan(100);
    }
  });

  it('experimentWarning emits the audit-trail string shape', () => {
    const pick = pickVariant(exp({ traffic_split: 0.7 }), 'fixed-seed-1');
    const w = experimentWarning(pick);
    expect(w).toMatch(/^experiment:exp-1:variant_[ab]:bucket=\d+\/70$/);
  });
});

describe('in-memory experiment store', () => {
  it('returns null when no experiment registered', async () => {
    const store = buildInMemoryExperimentStore();
    expect(await store.getActiveFor('mod.feat')).toBeNull();
  });

  it('returns the active experiment after setExperiment', async () => {
    const store = buildInMemoryExperimentStore();
    store.setExperiment(exp());
    const got = await store.getActiveFor('mod.feat');
    expect(got).toMatchObject({ id: 'exp-1', prompt_key: 'mod.feat', status: 'active' });
  });

  it('paused experiments are NOT returned by getActiveFor', async () => {
    const store = buildInMemoryExperimentStore();
    store.setExperiment(exp({ status: 'paused' }));
    expect(await store.getActiveFor('mod.feat')).toBeNull();
  });
});
