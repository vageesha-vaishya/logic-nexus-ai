import { createHash } from 'node:crypto';

type RolloutStage = 'canary' | 'progressive' | 'full';
export type PolicyAction = 'read' | 'write' | 'execute' | 'publish' | 'subscribe';

export type PolicyBypassProfile = {
  enabled: boolean;
  reason: string;
  strictAuditLogging: boolean;
  expiresAt: string | null;
  updatedAt: string;
};

export type PolicyRolloutState = {
  stage: RolloutStage;
  canaryPercent: number;
  automaticRollback: boolean;
  lastPromotedAt: string;
};

export type TokenIntrospectionResult = {
  active: boolean;
  tokenHash: string;
  subject: string | null;
  audience: string | null;
  scope: string[];
  tenantId: string | null;
  franchiseId: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  reason: 'active' | 'invalid_format' | 'expired' | 'missing_claims';
};

export type MtlsIdentity = {
  serviceName: string;
  serviceAccount: string;
  spiffeId: string;
  certFingerprint: string;
  tenantId: string | null;
  franchiseId: string | null;
  propagatedAt: string;
};

export type PolicyRule = {
  callerService: string;
  targetService: string;
  action: PolicyAction;
  resource: string;
  requireTenantMatch: boolean;
};

export type PolicyDecisionInput = {
  callerService: string;
  targetService: string;
  action: PolicyAction;
  resource: string;
  token: string;
  tenantId?: string | null;
  franchiseId?: string | null;
  identity?: Partial<MtlsIdentity>;
};

export type PolicyDecision = {
  authorized: boolean;
  reason:
    | 'policy_allowed'
    | 'policy_denied'
    | 'staged_rollout_bypass'
    | 'policy_bypass_profile'
    | 'token_inactive'
    | 'identity_mismatch'
    | 'tenant_context_missing';
  enforcedByCentralPolicy: boolean;
  rolloutStage: RolloutStage;
  canarySelected: boolean;
  strictAuditRequired: boolean;
  decisionToken: string;
  introspection: TokenIntrospectionResult;
  identity: MtlsIdentity;
};

export type PolicyAuditRecord = {
  at: string;
  callerService: string;
  targetService: string;
  authorized: boolean;
  reason: PolicyDecision['reason'];
  strictAuditRequired: boolean;
  rolloutStage: RolloutStage;
  tenantId: string | null;
  franchiseId: string | null;
  decisionToken: string;
};

const defaultPolicyRules: PolicyRule[] = [
  { callerService: 'module-crm', targetService: 'module-quotation', action: 'publish', resource: 'crm.opportunity.converted', requireTenantMatch: true },
  { callerService: 'module-logistics', targetService: 'module-finance', action: 'publish', resource: 'shipment.delivered', requireTenantMatch: true },
  { callerService: 'module-quotation', targetService: 'module-finance', action: 'write', resource: 'invoice.create', requireTenantMatch: true },
  { callerService: 'module-finance', targetService: 'platform-governance-audit', action: 'publish', resource: 'invoice.posted', requireTenantMatch: false },
];

const rulesStore = new Map<string, PolicyRule>();
const auditStore: PolicyAuditRecord[] = [];

const defaultBypassProfile: PolicyBypassProfile = {
  enabled: false,
  reason: '',
  strictAuditLogging: true,
  expiresAt: null,
  updatedAt: new Date().toISOString(),
};

const defaultRolloutState: PolicyRolloutState = {
  stage: 'canary',
  canaryPercent: 10,
  automaticRollback: true,
  lastPromotedAt: new Date().toISOString(),
};

let bypassProfile: PolicyBypassProfile = { ...defaultBypassProfile };
let rolloutState: PolicyRolloutState = { ...defaultRolloutState };

function normalizePercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 100) return 100;
  return Math.floor(value);
}

function normalizeNullable(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function ruleKey(rule: PolicyRule): string {
  return `${rule.callerService}|${rule.targetService}|${rule.action}|${rule.resource}`;
}

function parseTokenClaims(token: string) {
  const parts = String(token || '').trim().split(':');
  if (parts.length < 8 || parts[0] !== 'svc') return null;
  return {
    subject: parts[1] || null,
    audience: parts[2] || null,
    tenantId: parts[3] || null,
    franchiseId: parts[4] || null,
    issuedAtEpoch: Number(parts[5]),
    expiresAtEpoch: Number(parts[6]),
    scope: String(parts[7] || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

function shouldSelectCanary(callerService: string, targetService: string, tenantId: string | null): boolean {
  if (rolloutState.stage === 'full') return true;
  const bucket = Number.parseInt(hash([callerService, targetService, tenantId || '*'].join('|')).slice(0, 8), 16) % 100;
  return bucket < rolloutState.canaryPercent;
}

function activeBypassProfile(): PolicyBypassProfile {
  if (!bypassProfile.enabled) return { ...bypassProfile };
  if (!bypassProfile.expiresAt) return { ...bypassProfile };
  const expired = Date.parse(bypassProfile.expiresAt) < Date.now();
  if (!expired) return { ...bypassProfile };
  bypassProfile = {
    ...bypassProfile,
    enabled: false,
    updatedAt: new Date().toISOString(),
  };
  return { ...bypassProfile };
}

export function introspectServiceToken(token: string): TokenIntrospectionResult {
  const claims = parseTokenClaims(token);
  const tokenHash = hash(String(token || '').trim());
  if (!claims) {
    return {
      active: false,
      tokenHash,
      subject: null,
      audience: null,
      scope: [],
      tenantId: null,
      franchiseId: null,
      issuedAt: null,
      expiresAt: null,
      reason: 'invalid_format',
    };
  }

  if (!Number.isFinite(claims.issuedAtEpoch) || !Number.isFinite(claims.expiresAtEpoch) || !claims.subject || !claims.audience) {
    return {
      active: false,
      tokenHash,
      subject: claims.subject,
      audience: claims.audience,
      scope: claims.scope,
      tenantId: claims.tenantId,
      franchiseId: claims.franchiseId,
      issuedAt: null,
      expiresAt: null,
      reason: 'missing_claims',
    };
  }

  const issuedAt = new Date(claims.issuedAtEpoch * 1000).toISOString();
  const expiresAt = new Date(claims.expiresAtEpoch * 1000).toISOString();
  if (claims.expiresAtEpoch * 1000 <= Date.now()) {
    return {
      active: false,
      tokenHash,
      subject: claims.subject,
      audience: claims.audience,
      scope: claims.scope,
      tenantId: claims.tenantId,
      franchiseId: claims.franchiseId,
      issuedAt,
      expiresAt,
      reason: 'expired',
    };
  }

  return {
    active: true,
    tokenHash,
    subject: claims.subject,
    audience: claims.audience,
    scope: claims.scope,
    tenantId: claims.tenantId,
    franchiseId: claims.franchiseId,
    issuedAt,
    expiresAt,
    reason: 'active',
  };
}

export function propagateMtlsIdentity(input: {
  serviceName: string;
  serviceAccount?: string | null;
  tenantId?: string | null;
  franchiseId?: string | null;
  certFingerprint?: string | null;
}): MtlsIdentity {
  const serviceName = String(input.serviceName || '').trim();
  if (!serviceName) throw new Error('Missing serviceName for mTLS identity propagation');
  const serviceAccount = normalizeNullable(input.serviceAccount) || `${serviceName}-svc`;
  const tenantId = normalizeNullable(input.tenantId);
  const franchiseId = normalizeNullable(input.franchiseId);
  const certFingerprint = normalizeNullable(input.certFingerprint) || hash(`${serviceName}|${serviceAccount}`).slice(0, 40);
  return {
    serviceName,
    serviceAccount,
    spiffeId: `spiffe://logic-nexus-ai.local/ns/platform/sa/${serviceAccount}`,
    certFingerprint,
    tenantId,
    franchiseId,
    propagatedAt: new Date().toISOString(),
  };
}

export function replaceCentralPolicyRules(rules: PolicyRule[]): PolicyRule[] {
  rulesStore.clear();
  for (const rule of rules) {
    const normalized: PolicyRule = {
      callerService: String(rule.callerService || '').trim(),
      targetService: String(rule.targetService || '').trim(),
      action: rule.action,
      resource: String(rule.resource || '').trim(),
      requireTenantMatch: Boolean(rule.requireTenantMatch),
    };
    rulesStore.set(ruleKey(normalized), normalized);
  }
  return getCentralPolicyRules();
}

export function getCentralPolicyRules(): PolicyRule[] {
  return Array.from(rulesStore.values()).sort((a, b) => ruleKey(a).localeCompare(ruleKey(b)));
}

export function setPolicyBypassProfile(patch: Partial<Omit<PolicyBypassProfile, 'updatedAt'>>): PolicyBypassProfile {
  bypassProfile = {
    enabled: patch.enabled ?? bypassProfile.enabled,
    reason: patch.reason !== undefined ? String(patch.reason || '') : bypassProfile.reason,
    strictAuditLogging: patch.strictAuditLogging ?? bypassProfile.strictAuditLogging,
    expiresAt: patch.expiresAt !== undefined ? normalizeNullable(patch.expiresAt) : bypassProfile.expiresAt,
    updatedAt: new Date().toISOString(),
  };
  return { ...bypassProfile };
}

export function getPolicyBypassProfile(): PolicyBypassProfile {
  return activeBypassProfile();
}

export function setPolicyRolloutState(patch: Partial<PolicyRolloutState>): PolicyRolloutState {
  rolloutState = {
    stage: patch.stage ?? rolloutState.stage,
    canaryPercent: patch.canaryPercent !== undefined ? normalizePercent(patch.canaryPercent) : rolloutState.canaryPercent,
    automaticRollback: patch.automaticRollback ?? rolloutState.automaticRollback,
    lastPromotedAt: new Date().toISOString(),
  };
  if (rolloutState.stage === 'full') rolloutState.canaryPercent = 100;
  if (rolloutState.stage === 'canary' && rolloutState.canaryPercent === 0) rolloutState.canaryPercent = 10;
  return { ...rolloutState };
}

export function getPolicyRolloutState(): PolicyRolloutState {
  return { ...rolloutState };
}

function isAllowedByPolicy(input: PolicyDecisionInput, tenantId: string | null): boolean {
  const matchingRule = rulesStore.get(
    ruleKey({
      callerService: input.callerService,
      targetService: input.targetService,
      action: input.action,
      resource: input.resource,
      requireTenantMatch: false,
    })
  );
  if (!matchingRule) return false;
  if (!matchingRule.requireTenantMatch) return true;
  return Boolean(tenantId);
}

export function evaluateCentralPolicyDecision(input: PolicyDecisionInput): PolicyDecision {
  const introspection = introspectServiceToken(input.token);
  const tokenTenantId = introspection.tenantId;
  const tokenFranchiseId = introspection.franchiseId;
  const requestedTenantId = normalizeNullable(input.tenantId) || tokenTenantId;
  const requestedFranchiseId = normalizeNullable(input.franchiseId) || tokenFranchiseId;
  const identity = propagateMtlsIdentity({
    serviceName: input.identity?.serviceName || input.callerService,
    serviceAccount: input.identity?.serviceAccount || null,
    tenantId: input.identity?.tenantId || requestedTenantId,
    franchiseId: input.identity?.franchiseId || requestedFranchiseId,
    certFingerprint: input.identity?.certFingerprint || null,
  });
  const bypass = activeBypassProfile();
  const canarySelected = shouldSelectCanary(input.callerService, input.targetService, requestedTenantId);
  const centralEnforced = rolloutState.stage === 'full' || canarySelected;
  const strictAuditRequired = bypass.enabled ? bypass.strictAuditLogging : rolloutState.stage !== 'full';

  let authorized = false;
  let reason: PolicyDecision['reason'] = 'policy_denied';
  if (bypass.enabled) {
    authorized = true;
    reason = 'policy_bypass_profile';
  } else if (!introspection.active) {
    authorized = false;
    reason = 'token_inactive';
  } else if (identity.serviceName !== input.callerService) {
    authorized = false;
    reason = 'identity_mismatch';
  } else if (!requestedTenantId) {
    authorized = false;
    reason = 'tenant_context_missing';
  } else if (!centralEnforced) {
    authorized = true;
    reason = 'staged_rollout_bypass';
  } else if (isAllowedByPolicy(input, requestedTenantId)) {
    authorized = true;
    reason = 'policy_allowed';
  } else {
    authorized = false;
    reason = 'policy_denied';
  }

  const decisionToken = hash(
    JSON.stringify({
      callerService: input.callerService,
      targetService: input.targetService,
      action: input.action,
      resource: input.resource,
      authorized,
      reason,
      tokenHash: introspection.tokenHash,
      at: Date.now(),
    })
  );

  const decision: PolicyDecision = {
    authorized,
    reason,
    enforcedByCentralPolicy: centralEnforced || bypass.enabled,
    rolloutStage: rolloutState.stage,
    canarySelected,
    strictAuditRequired,
    decisionToken,
    introspection,
    identity,
  };

  const auditRecord: PolicyAuditRecord = {
    at: new Date().toISOString(),
    callerService: input.callerService,
    targetService: input.targetService,
    authorized,
    reason,
    strictAuditRequired,
    rolloutStage: rolloutState.stage,
    tenantId: requestedTenantId,
    franchiseId: requestedFranchiseId,
    decisionToken,
  };
  auditStore.unshift(auditRecord);
  if (auditStore.length > 500) auditStore.splice(500);
  return decision;
}

export function getPolicyAuditRecords(limit = 100): PolicyAuditRecord[] {
  const safeLimit = Math.max(1, Math.min(500, Number(limit || 100)));
  return auditStore.slice(0, safeLimit).map((item) => ({ ...item }));
}

export function getPolicyCentralizationStatus() {
  const rollout = getPolicyRolloutState();
  return {
    rollout,
    bypassProfile: getPolicyBypassProfile(),
    centralPolicyFullyEnforced: rollout.stage === 'full',
    ruleCount: getCentralPolicyRules().length,
  };
}

export function resetIdentityPolicyCentralizationState(): void {
  rulesStore.clear();
  for (const rule of defaultPolicyRules) {
    rulesStore.set(ruleKey(rule), { ...rule });
  }
  bypassProfile = { ...defaultBypassProfile, updatedAt: new Date().toISOString() };
  rolloutState = { ...defaultRolloutState, lastPromotedAt: new Date().toISOString() };
  auditStore.splice(0);
}

resetIdentityPolicyCentralizationState();
