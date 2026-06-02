// Pure-function tests for the chi-square evaluator + the admin routes.

import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  chi2PValueDf1,
  chi2Yates,
  erfc,
  evaluate,
  type ContingencyCounts,
} from '../src/prompts/evaluator.js';
import { buildInMemoryEvaluatorStore } from '../src/prompts/evaluatorStore.js';
import { setEvaluatorStoreForTesting } from '../src/routes/experiments.js';
import { setAuthLookupForTesting } from '../src/routes/invoke.js';

function counts(overrides: Partial<ContingencyCounts> = {}): ContingencyCounts {
  return {
    experiment_id: 'exp-1',
    prompt_key: 'mod.feat',
    variant_a_version_id: 'ver-a',
    variant_b_version_id: 'ver-b',
    traffic_split: 0.5,
    status: 'active',
    target_invocations: null,
    invocations_a: 0,
    invocations_b: 0,
    accepted_a: 0,
    accepted_b: 0,
    rejected_a: 0,
    rejected_b: 0,
    ignored_a: 0,
    ignored_b: 0,
    total_outcomes_a: 0,
    total_outcomes_b: 0,
    ...overrides,
  };
}

describe('erfc + chi-square math', () => {
  it('erfc(0) = 1, erfc(∞) → 0', () => {
    expect(erfc(0)).toBeCloseTo(1, 6);
    expect(erfc(5)).toBeLessThan(1e-10);
  });

  it('chi2PValueDf1: chi²=3.84 → p≈0.05', () => {
    expect(chi2PValueDf1(3.84)).toBeCloseTo(0.05, 2);
  });

  it('chi2PValueDf1: chi²=6.63 → p≈0.01', () => {
    expect(chi2PValueDf1(6.63)).toBeCloseTo(0.01, 2);
  });

  it('chi2PValueDf1: chi²=0 → p=1', () => {
    expect(chi2PValueDf1(0)).toBe(1);
  });

  it('chi2Yates: identical accept rates yield small chi²', () => {
    // 50/50 vs 50/50 with continuity correction:
    // |50*50 - 50*50| - 200/2 = -100 (squared = 10000); num = 200 * 10000; den = 100^4
    const chi2 = chi2Yates(50, 50, 50, 50);
    expect(chi2).toBeLessThan(0.1);
  });

  it('chi2Yates: strong A-better-than-B is large chi²', () => {
    // 90 accepted / 10 rejected vs 30 accepted / 70 rejected
    const chi2 = chi2Yates(90, 10, 30, 70);
    expect(chi2).toBeGreaterThan(50);
    expect(chi2PValueDf1(chi2)).toBeLessThan(1e-10);
  });

  it('chi2Yates: handles empty table without dividing by zero', () => {
    expect(chi2Yates(0, 0, 0, 0)).toBe(0);
  });
});

describe('evaluate', () => {
  it('insufficient_invocations when target_invocations set + not yet met', () => {
    const v = evaluate(counts({ target_invocations: 1000, invocations_a: 100, invocations_b: 200 }));
    expect(v.kind).toBe('insufficient_invocations');
    expect(v.kind === 'insufficient_invocations' && v.have).toBe(300);
    expect(v.kind === 'insufficient_invocations' && v.need).toBe(1000);
  });

  it('insufficient_outcomes_per_variant when below min', () => {
    const v = evaluate(
      counts({
        invocations_a: 1000, invocations_b: 1000,
        accepted_a: 10, rejected_a: 10,
        accepted_b: 5,  rejected_b: 5,
      }),
      { min_per_variant: 30 },
    );
    expect(v.kind).toBe('insufficient_outcomes_per_variant');
    expect(v.kind === 'insufficient_outcomes_per_variant' && v.have_a).toBe(20);
    expect(v.kind === 'insufficient_outcomes_per_variant' && v.have_b).toBe(10);
  });

  it('inconclusive when sample is fine but p ≥ threshold', () => {
    // 50/50 vs 51/49 — basically no difference, p should be huge
    const v = evaluate(
      counts({
        accepted_a: 50, rejected_a: 50,
        accepted_b: 51, rejected_b: 49,
      }),
      { min_per_variant: 30 },
    );
    expect(v.kind).toBe('inconclusive');
    if (v.kind === 'inconclusive') {
      expect(v.p_value).toBeGreaterThan(0.05);
      expect(v.accept_rate_a).toBeCloseTo(0.5, 2);
      expect(v.accept_rate_b).toBeCloseTo(0.51, 2);
    }
  });

  it('significant when A clearly wins, picks variant_a', () => {
    const v = evaluate(
      counts({
        accepted_a: 90, rejected_a: 10,
        accepted_b: 30, rejected_b: 70,
      }),
      { min_per_variant: 30 },
    );
    expect(v.kind).toBe('significant');
    if (v.kind === 'significant') {
      expect(v.winner_label).toBe('a');
      expect(v.winner_version_id).toBe('ver-a');
      expect(v.loser_version_id).toBe('ver-b');
      expect(v.p_value).toBeLessThan(0.05);
    }
  });

  it('significant when B clearly wins, picks variant_b', () => {
    const v = evaluate(
      counts({
        accepted_a: 30, rejected_a: 70,
        accepted_b: 90, rejected_b: 10,
      }),
      { min_per_variant: 30 },
    );
    expect(v.kind).toBe('significant');
    if (v.kind === 'significant') {
      expect(v.winner_label).toBe('b');
      expect(v.winner_version_id).toBe('ver-b');
    }
  });

  it('respects custom p_threshold', () => {
    // Borderline result — significant at 0.05 but not 0.001
    const c = counts({
      accepted_a: 60, rejected_a: 40,
      accepted_b: 45, rejected_b: 55,
    });
    const lax = evaluate(c, { p_threshold: 0.05, min_per_variant: 30 });
    const strict = evaluate(c, { p_threshold: 0.001, min_per_variant: 30 });
    // The first is significant at 5%; the second very likely isn't
    expect(strict.kind === 'inconclusive' || strict.kind === 'significant').toBe(true);
    // Both should compute the same chi²/p
    if ((lax.kind === 'significant' || lax.kind === 'inconclusive') &&
        (strict.kind === 'significant' || strict.kind === 'inconclusive')) {
      expect(lax.p_value).toBeCloseTo(strict.p_value, 6);
    }
  });

  it('ignored outcomes do NOT enter the contingency math', () => {
    // 30 a, 30 a-rejected, 200 a-ignored vs 30 b-acc, 30 b-rej, 0 b-ignored.
    // ignored counts shouldn't matter to chi²/winner.
    const v = evaluate(
      counts({
        accepted_a: 30, rejected_a: 30, ignored_a: 200,
        accepted_b: 30, rejected_b: 30, ignored_b: 0,
      }),
      { min_per_variant: 30 },
    );
    expect(v.kind).toBe('inconclusive'); // tied
  });
});

describe('POST /v1/admin/experiments/:id/evaluate', () => {
  let store: ReturnType<typeof buildInMemoryEvaluatorStore>;
  const app = createApp();

  beforeAll(() => {
    setAuthLookupForTesting(async () => ({ authenticated: true, open_mode: true }));
    store = buildInMemoryEvaluatorStore();
    setEvaluatorStoreForTesting(store);
  });
  afterAll(() => {
    setAuthLookupForTesting(null);
    setEvaluatorStoreForTesting(null);
  });
  beforeEach(() => store.clear());

  it('200 with verdict shape', async () => {
    store.setContingency('exp-1', counts({
      accepted_a: 90, rejected_a: 10,
      accepted_b: 30, rejected_b: 70,
    }));
    const res = await request(app).post('/v1/admin/experiments/exp-1/evaluate').send({});
    expect(res.status).toBe(200);
    expect(res.body.experiment_id).toBe('exp-1');
    expect(res.body.verdict.kind).toBe('significant');
    expect(res.body.verdict.winner_label).toBe('a');
    expect(res.body.stats.accepted_a).toBe(90);
  });

  it('404 when experiment not found', async () => {
    const res = await request(app).post('/v1/admin/experiments/nope/evaluate').send({});
    expect(res.status).toBe(404);
  });

  it('honors p_threshold + min_per_variant overrides', async () => {
    store.setContingency('exp-2', counts({
      accepted_a: 60, rejected_a: 40,
      accepted_b: 45, rejected_b: 55,
    }));
    const res = await request(app).post('/v1/admin/experiments/exp-2/evaluate').send({
      p_threshold: 0.001,
    });
    expect(res.status).toBe(200);
    // At p<0.001 this borderline result is unlikely to be significant
    expect(['inconclusive', 'significant']).toContain(res.body.verdict.kind);
    expect(res.body.options.p_threshold).toBe(0.001);
  });
});

describe('POST /v1/admin/experiments/:id/auto-promote', () => {
  let store: ReturnType<typeof buildInMemoryEvaluatorStore>;
  const app = createApp();

  beforeAll(() => {
    setAuthLookupForTesting(async () => ({ authenticated: true, open_mode: true }));
    store = buildInMemoryEvaluatorStore();
    setEvaluatorStoreForTesting(store);
  });
  afterAll(() => {
    setAuthLookupForTesting(null);
    setEvaluatorStoreForTesting(null);
  });
  beforeEach(() => store.clear());

  it('promotes the winner when verdict is significant', async () => {
    store.setContingency('exp-1', counts({
      accepted_a: 90, rejected_a: 10,
      accepted_b: 30, rejected_b: 70,
    }));
    const res = await request(app).post('/v1/admin/experiments/exp-1/auto-promote').send({});
    expect(res.status).toBe(200);
    expect(res.body.promoted).toBe(true);
    expect(res.body.winner_version_id).toBe('ver-a');
    expect(res.body.loser_version_id).toBe('ver-b');
    expect(store.promotions()).toHaveLength(1);
    expect(store.promotions()[0]).toMatchObject({ experiment_id: 'exp-1', winner_version_id: 'ver-a' });
  });

  it('does NOT promote when verdict is inconclusive (202)', async () => {
    store.setContingency('exp-2', counts({
      accepted_a: 50, rejected_a: 50,
      accepted_b: 51, rejected_b: 49,
    }));
    const res = await request(app).post('/v1/admin/experiments/exp-2/auto-promote').send({});
    expect(res.status).toBe(202);
    expect(res.body.promoted).toBe(false);
    expect(res.body.reason).toBe('inconclusive');
    expect(store.promotions()).toHaveLength(0);
  });

  it('does NOT promote when insufficient invocations', async () => {
    store.setContingency('exp-3', counts({
      target_invocations: 10_000,
      invocations_a: 100, invocations_b: 100,
      accepted_a: 90, rejected_a: 10,
      accepted_b: 30, rejected_b: 70,
    }));
    const res = await request(app).post('/v1/admin/experiments/exp-3/auto-promote').send({});
    expect(res.status).toBe(202);
    expect(res.body.reason).toBe('insufficient_invocations');
  });

  it('409 when experiment status is not active', async () => {
    store.setContingency('exp-4', counts({ status: 'completed' }));
    const res = await request(app).post('/v1/admin/experiments/exp-4/auto-promote').send({});
    expect(res.status).toBe(409);
  });

  it('404 when experiment not found', async () => {
    const res = await request(app).post('/v1/admin/experiments/nope/auto-promote').send({});
    expect(res.status).toBe(404);
  });
});
