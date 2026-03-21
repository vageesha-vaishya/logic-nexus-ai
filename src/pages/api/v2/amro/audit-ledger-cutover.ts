import type { AmroAuditLedgerCapability } from './audit-ledger';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function parseCanaryList(value: string | undefined): Set<string> {
  const normalized = String(value || '').trim();
  if (!normalized) return new Set();
  return new Set(
    normalized
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

type AmroAuditLedgerCutoverInput = {
  tenantId: string;
  franchiseId: string | null;
  capability: AmroAuditLedgerCapability;
};

export type AmroAuditLedgerCutoverState = {
  enabled: boolean;
  canaryEnforced: boolean;
  tenantInCanary: boolean;
  franchiseInCanary: boolean;
  capabilityInCanary: boolean;
  capability: AmroAuditLedgerCapability;
};

type AmroV2EndpointRolloutInput = {
  tenantId: string;
  franchiseId: string | null;
  capability: AmroAuditLedgerCapability;
};

export type AmroV2EndpointRolloutState = {
  enabled: boolean;
  canaryEnforced: boolean;
  tenantInCanary: boolean;
  franchiseInCanary: boolean;
  capabilityInCanary: boolean;
  capability: AmroAuditLedgerCapability;
};

export function resolveAmroAuditLedgerCutoverState(input: AmroAuditLedgerCutoverInput): AmroAuditLedgerCutoverState {
  const cutoverEnabled = parseBoolean(process.env.AMRO_AUDIT_LEDGER_CUTOVER_ENABLED, true);
  if (!cutoverEnabled) {
    return {
      enabled: false,
      canaryEnforced: false,
      tenantInCanary: false,
      franchiseInCanary: false,
      capabilityInCanary: false,
      capability: input.capability,
    };
  }

  const canaryTenants = parseCanaryList(process.env.AMRO_AUDIT_LEDGER_CANARY_TENANTS);
  const canaryFranchises = parseCanaryList(process.env.AMRO_AUDIT_LEDGER_CANARY_FRANCHISES);
  const canaryCapabilities = parseCanaryList(process.env.AMRO_AUDIT_LEDGER_CANARY_CAPABILITIES);
  const canaryEnforced = Boolean(canaryTenants.size || canaryFranchises.size || canaryCapabilities.size);

  if (!canaryEnforced) {
    return {
      enabled: true,
      canaryEnforced: false,
      tenantInCanary: true,
      franchiseInCanary: true,
      capabilityInCanary: true,
      capability: input.capability,
    };
  }

  const tenantInCanary = !canaryTenants.size || canaryTenants.has(input.tenantId);
  const franchiseInCanary = !canaryFranchises.size || (input.franchiseId ? canaryFranchises.has(input.franchiseId) : false);
  const capabilityInCanary = !canaryCapabilities.size || canaryCapabilities.has(input.capability);
  const enabled = tenantInCanary && franchiseInCanary && capabilityInCanary;

  return {
    enabled,
    canaryEnforced,
    tenantInCanary,
    franchiseInCanary,
    capabilityInCanary,
    capability: input.capability,
  };
}

export function resolveAmroV2EndpointRolloutState(input: AmroV2EndpointRolloutInput): AmroV2EndpointRolloutState {
  const rolloutEnabled = parseBoolean(process.env.AMRO_V2_ROLLOUT_ENABLED, true);
  if (!rolloutEnabled) {
    return {
      enabled: false,
      canaryEnforced: false,
      tenantInCanary: false,
      franchiseInCanary: false,
      capabilityInCanary: false,
      capability: input.capability,
    };
  }

  const canaryTenants = parseCanaryList(process.env.AMRO_V2_CANARY_TENANTS);
  const canaryFranchises = parseCanaryList(process.env.AMRO_V2_CANARY_FRANCHISES);
  const canaryCapabilities = parseCanaryList(process.env.AMRO_V2_CANARY_CAPABILITIES);
  const canaryEnforced = Boolean(canaryTenants.size || canaryFranchises.size || canaryCapabilities.size);

  if (!canaryEnforced) {
    return {
      enabled: true,
      canaryEnforced: false,
      tenantInCanary: true,
      franchiseInCanary: true,
      capabilityInCanary: true,
      capability: input.capability,
    };
  }

  const tenantInCanary = !canaryTenants.size || canaryTenants.has(input.tenantId);
  const franchiseInCanary = !canaryFranchises.size || (input.franchiseId ? canaryFranchises.has(input.franchiseId) : false);
  const capabilityInCanary = !canaryCapabilities.size || canaryCapabilities.has(input.capability);
  const enabled = tenantInCanary && franchiseInCanary && capabilityInCanary;

  return {
    enabled,
    canaryEnforced,
    tenantInCanary,
    franchiseInCanary,
    capabilityInCanary,
    capability: input.capability,
  };
}
