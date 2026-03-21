import { beforeEach, describe, expect, it } from 'vitest';
import { resolveAmroAuditLedgerCutoverState, resolveAmroV2EndpointRolloutState } from './audit-ledger-cutover';

describe('audit ledger cutover resolver', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
  });

  it('enables cutover for all tenants when canary list is empty', () => {
    process.env.AMRO_AUDIT_LEDGER_CUTOVER_ENABLED = 'true';
    delete process.env.AMRO_AUDIT_LEDGER_CANARY_TENANTS;
    delete process.env.AMRO_AUDIT_LEDGER_CANARY_FRANCHISES;
    delete process.env.AMRO_AUDIT_LEDGER_CANARY_CAPABILITIES;

    const state = resolveAmroAuditLedgerCutoverState({
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      capability: 'tasks',
    });

    expect(state.enabled).toBe(true);
    expect(state.canaryEnforced).toBe(false);
    expect(state.tenantInCanary).toBe(true);
    expect(state.franchiseInCanary).toBe(true);
    expect(state.capabilityInCanary).toBe(true);
  });

  it('disables cutover when global flag is off', () => {
    process.env.AMRO_AUDIT_LEDGER_CUTOVER_ENABLED = 'false';
    process.env.AMRO_AUDIT_LEDGER_CANARY_TENANTS = 'tenant-1';

    const state = resolveAmroAuditLedgerCutoverState({
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      capability: 'compliance-gates',
    });

    expect(state.enabled).toBe(false);
    expect(state.canaryEnforced).toBe(false);
    expect(state.tenantInCanary).toBe(false);
    expect(state.franchiseInCanary).toBe(false);
    expect(state.capabilityInCanary).toBe(false);
  });

  it('enforces canary allowlist for tenant eligibility', () => {
    process.env.AMRO_AUDIT_LEDGER_CUTOVER_ENABLED = 'true';
    process.env.AMRO_AUDIT_LEDGER_CANARY_TENANTS = 'tenant-a, tenant-b';

    const denied = resolveAmroAuditLedgerCutoverState({
      tenantId: 'tenant-c',
      franchiseId: 'fr-1',
      capability: 'work-packages',
    });
    const allowed = resolveAmroAuditLedgerCutoverState({
      tenantId: 'tenant-b',
      franchiseId: 'fr-1',
      capability: 'work-packages',
    });

    expect(denied.enabled).toBe(false);
    expect(denied.canaryEnforced).toBe(true);
    expect(denied.tenantInCanary).toBe(false);
    expect(denied.franchiseInCanary).toBe(true);
    expect(denied.capabilityInCanary).toBe(true);
    expect(allowed.enabled).toBe(true);
    expect(allowed.canaryEnforced).toBe(true);
    expect(allowed.tenantInCanary).toBe(true);
    expect(allowed.franchiseInCanary).toBe(true);
    expect(allowed.capabilityInCanary).toBe(true);
  });

  it('enforces canary allowlist for franchise and capability eligibility', () => {
    process.env.AMRO_AUDIT_LEDGER_CUTOVER_ENABLED = 'true';
    process.env.AMRO_AUDIT_LEDGER_CANARY_FRANCHISES = 'fr-allow';
    process.env.AMRO_AUDIT_LEDGER_CANARY_CAPABILITIES = 'tasks';

    const deniedFranchise = resolveAmroAuditLedgerCutoverState({
      tenantId: 'tenant-1',
      franchiseId: 'fr-deny',
      capability: 'tasks',
    });
    const deniedCapability = resolveAmroAuditLedgerCutoverState({
      tenantId: 'tenant-1',
      franchiseId: 'fr-allow',
      capability: 'work-packages',
    });
    const allowed = resolveAmroAuditLedgerCutoverState({
      tenantId: 'tenant-1',
      franchiseId: 'fr-allow',
      capability: 'tasks',
    });

    expect(deniedFranchise.enabled).toBe(false);
    expect(deniedFranchise.canaryEnforced).toBe(true);
    expect(deniedFranchise.tenantInCanary).toBe(true);
    expect(deniedFranchise.franchiseInCanary).toBe(false);
    expect(deniedFranchise.capabilityInCanary).toBe(true);

    expect(deniedCapability.enabled).toBe(false);
    expect(deniedCapability.canaryEnforced).toBe(true);
    expect(deniedCapability.tenantInCanary).toBe(true);
    expect(deniedCapability.franchiseInCanary).toBe(true);
    expect(deniedCapability.capabilityInCanary).toBe(false);

    expect(allowed.enabled).toBe(true);
    expect(allowed.canaryEnforced).toBe(true);
    expect(allowed.tenantInCanary).toBe(true);
    expect(allowed.franchiseInCanary).toBe(true);
    expect(allowed.capabilityInCanary).toBe(true);
  });
});

describe('amro v2 endpoint rollout resolver', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
  });

  it('enables endpoint rollout for all tenants when canary list is empty', () => {
    process.env.AMRO_V2_ROLLOUT_ENABLED = 'true';
    delete process.env.AMRO_V2_CANARY_TENANTS;
    delete process.env.AMRO_V2_CANARY_FRANCHISES;
    delete process.env.AMRO_V2_CANARY_CAPABILITIES;

    const state = resolveAmroV2EndpointRolloutState({
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      capability: 'tasks',
    });

    expect(state.enabled).toBe(true);
    expect(state.canaryEnforced).toBe(false);
    expect(state.tenantInCanary).toBe(true);
    expect(state.franchiseInCanary).toBe(true);
    expect(state.capabilityInCanary).toBe(true);
  });

  it('disables endpoint rollout when global flag is off', () => {
    process.env.AMRO_V2_ROLLOUT_ENABLED = 'false';
    process.env.AMRO_V2_CANARY_TENANTS = 'tenant-1';

    const state = resolveAmroV2EndpointRolloutState({
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
      capability: 'compliance-gates',
    });

    expect(state.enabled).toBe(false);
    expect(state.canaryEnforced).toBe(false);
    expect(state.tenantInCanary).toBe(false);
    expect(state.franchiseInCanary).toBe(false);
    expect(state.capabilityInCanary).toBe(false);
  });

  it('enforces endpoint rollout allowlist for tenant, franchise, and capability', () => {
    process.env.AMRO_V2_ROLLOUT_ENABLED = 'true';
    process.env.AMRO_V2_CANARY_TENANTS = 'tenant-allow';
    process.env.AMRO_V2_CANARY_FRANCHISES = 'fr-allow';
    process.env.AMRO_V2_CANARY_CAPABILITIES = 'work-packages';

    const deniedTenant = resolveAmroV2EndpointRolloutState({
      tenantId: 'tenant-deny',
      franchiseId: 'fr-allow',
      capability: 'work-packages',
    });
    const deniedFranchise = resolveAmroV2EndpointRolloutState({
      tenantId: 'tenant-allow',
      franchiseId: 'fr-deny',
      capability: 'work-packages',
    });
    const deniedCapability = resolveAmroV2EndpointRolloutState({
      tenantId: 'tenant-allow',
      franchiseId: 'fr-allow',
      capability: 'tasks',
    });
    const allowed = resolveAmroV2EndpointRolloutState({
      tenantId: 'tenant-allow',
      franchiseId: 'fr-allow',
      capability: 'work-packages',
    });

    expect(deniedTenant.enabled).toBe(false);
    expect(deniedTenant.canaryEnforced).toBe(true);
    expect(deniedTenant.tenantInCanary).toBe(false);
    expect(deniedTenant.franchiseInCanary).toBe(true);
    expect(deniedTenant.capabilityInCanary).toBe(true);

    expect(deniedFranchise.enabled).toBe(false);
    expect(deniedFranchise.canaryEnforced).toBe(true);
    expect(deniedFranchise.tenantInCanary).toBe(true);
    expect(deniedFranchise.franchiseInCanary).toBe(false);
    expect(deniedFranchise.capabilityInCanary).toBe(true);

    expect(deniedCapability.enabled).toBe(false);
    expect(deniedCapability.canaryEnforced).toBe(true);
    expect(deniedCapability.tenantInCanary).toBe(true);
    expect(deniedCapability.franchiseInCanary).toBe(true);
    expect(deniedCapability.capabilityInCanary).toBe(false);

    expect(allowed.enabled).toBe(true);
    expect(allowed.canaryEnforced).toBe(true);
    expect(allowed.tenantInCanary).toBe(true);
    expect(allowed.franchiseInCanary).toBe(true);
    expect(allowed.capabilityInCanary).toBe(true);
  });
});
