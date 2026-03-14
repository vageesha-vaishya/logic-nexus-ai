import { tokens } from './tokens/index';
import { crmDesignSystemRolloutPlan, getRolloutPhaseNames } from './rolloutPlan';
import { getCRMDesignSystemComponentCount } from './componentCatalog';
import * as Components from './components';
import * as DesignSystem from './index';
import * as FederationEntry from './federation-entry';

describe('design system exports', () => {
  it('exports tokens and rollout plan', () => {
    expect(tokens.color.primary.value).toBeDefined();
    expect(crmDesignSystemRolloutPlan.length).toBeGreaterThan(0);
    expect(getRolloutPhaseNames()).toContain('Pilot Contacts');
  });

  it('exports component modules through entry points', () => {
    expect(Components.CRMButton).toBeDefined();
    expect(DesignSystem.CRMButton).toBeDefined();
    expect(FederationEntry.CRMButton).toBeDefined();
    expect(getCRMDesignSystemComponentCount()).toBeGreaterThanOrEqual(30);
  });
});
