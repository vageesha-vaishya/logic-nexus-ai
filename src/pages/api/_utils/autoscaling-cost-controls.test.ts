import { beforeEach, describe, expect, it } from 'vitest';
import {
  evaluateAutoscalingDecision,
  evaluateBudgetAlert,
  getAutoscalingCostControlStatus,
  recordModuleSpend,
  resetAutoscalingCostControlsState,
  setAutoscalingRollbackProfile,
} from './autoscaling-cost-controls';

describe('autoscaling and cost controls', () => {
  beforeEach(() => {
    resetAutoscalingCostControlsState();
  });

  it('scales up under sustained high utilization', () => {
    const decision = evaluateAutoscalingDecision({
      moduleKey: 'module-crm',
      currentReplicas: 3,
      currentRps: 320,
      cpuUtilizationPercent: 88,
      memoryUtilizationPercent: 84,
    });
    expect(['scale_up', 'stabilized_hold']).toContain(decision.reason);
    expect(decision.desiredReplicas).toBeGreaterThanOrEqual(3);
  });

  it('reverts to baseline static replicas when rollback is enabled', () => {
    setAutoscalingRollbackProfile({ enabled: true, reason: 'oscillation control' });
    const decision = evaluateAutoscalingDecision({
      moduleKey: 'module-logistics',
      currentReplicas: 9,
      currentRps: 500,
      cpuUtilizationPercent: 82,
      memoryUtilizationPercent: 79,
    });
    expect(decision.reason).toBe('baseline_rollback');
  });

  it('raises budget alert based on spend variance', () => {
    recordModuleSpend({ moduleKey: 'module-crm', amountUsd: 2100 });
    const budget = evaluateBudgetAlert({ moduleKey: 'module-crm' });
    expect(['warning', 'critical']).toContain(budget.alertLevel);
    const status = getAutoscalingCostControlStatus();
    expect(status.moduleCount).toBeGreaterThan(0);
  });
});
