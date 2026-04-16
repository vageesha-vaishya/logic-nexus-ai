import { createHash, randomUUID } from 'node:crypto';
import type { ApiRequest } from '../../../../_utils/types';
import { parseHeaderValue } from '../../../../_utils/http';

export type MobilePlatform = 'ios' | 'android';
export type AttestationProvider = 'app_attest' | 'device_check' | 'play_integrity';
export type BiometricStrength = 'none' | 'device' | 'strong';
export type ThreatDecision = 'allow' | 'step_up' | 'block';

export type MobileSecurityContext = {
  platform: MobilePlatform;
  appVersion: string;
  appBuild: string;
  deviceIdHash: string;
  attestationProvider: AttestationProvider;
  certificatePinningMode: 'strict' | 'report_only';
  tlsVersion: number;
};

export type ThreatAssessment = {
  score: number;
  decision: ThreatDecision;
  flags: string[];
};

export type MobileSessionBinding = {
  bindingId: string;
  userId: string;
  tenantId: string;
  franchiseId: string | null;
  platform: MobilePlatform;
  deviceIdHash: string;
  biometricStrength: BiometricStrength;
  sessionNonce: string;
  refreshTokenFamily: string;
  issuedAt: string;
  expiresAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
};

const bindings = new Map<string, MobileSessionBinding>();
const MOBILE_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function parseBooleanHeader(req: ApiRequest, name: string): boolean {
  const value = parseHeaderValue(req.headers[name]).trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

function parseTlsVersion(req: ApiRequest): number {
  const raw = parseHeaderValue(req.headers['x-tls-version']).trim().toLowerCase();
  if (!raw) return 1.2;
  const normalized = raw.startsWith('tlsv') ? raw.slice(4) : raw.replace('tls', '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 1.2;
}

function parsePlatform(req: ApiRequest): MobilePlatform {
  const platform = parseHeaderValue(req.headers['x-amro-mobile-platform']).trim().toLowerCase();
  if (platform === 'ios' || platform === 'android') return platform;
  throw new Error('Invalid mobile platform header');
}

function parseAttestationProvider(req: ApiRequest): AttestationProvider {
  const provider = parseHeaderValue(req.headers['x-amro-attestation-provider']).trim().toLowerCase();
  if (provider === 'app_attest' || provider === 'device_check' || provider === 'play_integrity') return provider;
  throw new Error('Invalid mobile attestation provider');
}

export function enforceMobileSecurityHeaders(
  req: ApiRequest,
  options: { minimumTlsVersion?: number; requirePinning?: boolean; requireAttestation?: boolean } = {},
): MobileSecurityContext {
  const minimumTlsVersion = options.minimumTlsVersion ?? 1.3;
  const platform = parsePlatform(req);
  const tlsVersion = parseTlsVersion(req);
  if (tlsVersion < minimumTlsVersion) {
    throw new Error(`Mobile TLS policy violation. Minimum TLS ${minimumTlsVersion} is required.`);
  }

  const pinningMode = parseHeaderValue(req.headers['x-amro-cert-pinning']).trim().toLowerCase();
  const certificatePinningMode = pinningMode === 'strict' ? 'strict' : 'report_only';
  if (options.requirePinning !== false && certificatePinningMode !== 'strict') {
    throw new Error('Certificate pinning must be strict for AMRO mobile access');
  }

  const appVersion = parseHeaderValue(req.headers['x-amro-app-version']).trim();
  const appBuild = parseHeaderValue(req.headers['x-amro-app-build']).trim();
  if (!appVersion || !appBuild) {
    throw new Error('Missing mobile app version/build headers');
  }

  const deviceId = parseHeaderValue(req.headers['x-amro-device-id']).trim();
  if (!deviceId) {
    throw new Error('Missing mobile device identifier');
  }

  const attestationProvider = parseAttestationProvider(req);
  const attestationToken = parseHeaderValue(req.headers['x-amro-attestation-token']).trim();
  if (options.requireAttestation !== false && attestationToken.length < 24) {
    throw new Error('Missing or invalid mobile attestation token');
  }

  return {
    platform,
    appVersion,
    appBuild,
    deviceIdHash: hashValue(deviceId),
    attestationProvider,
    certificatePinningMode,
    tlsVersion,
  };
}

export function evaluateMobileThreatSignals(req: ApiRequest): ThreatAssessment {
  const flags: string[] = [];
  let score = 0;
  if (parseBooleanHeader(req, 'x-amro-emulator')) {
    flags.push('emulator');
    score += 35;
  }
  if (parseBooleanHeader(req, 'x-amro-rooted-device')) {
    flags.push('rooted_or_jailbroken');
    score += 45;
  }
  if (parseBooleanHeader(req, 'x-amro-debugger-attached')) {
    flags.push('debugger_attached');
    score += 30;
  }
  if (parseBooleanHeader(req, 'x-amro-screen-overlay')) {
    flags.push('screen_overlay');
    score += 20;
  }
  const decision: ThreatDecision = score >= 70 ? 'block' : score >= 35 ? 'step_up' : 'allow';
  return { score, decision, flags };
}

export function issueMobileSessionBinding(input: {
  userId: string;
  tenantId: string;
  franchiseId?: string | null;
  platform: MobilePlatform;
  rawDeviceId: string;
  biometricStrength: BiometricStrength;
}): MobileSessionBinding {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const binding: MobileSessionBinding = {
    bindingId: randomUUID(),
    userId: input.userId,
    tenantId: input.tenantId,
    franchiseId: input.franchiseId || null,
    platform: input.platform,
    deviceIdHash: hashValue(input.rawDeviceId),
    biometricStrength: input.biometricStrength,
    sessionNonce: randomUUID(),
    refreshTokenFamily: randomUUID(),
    issuedAt: nowIso,
    expiresAt: new Date(now + MOBILE_SESSION_TTL_MS).toISOString(),
    lastSeenAt: nowIso,
    revokedAt: null,
  };
  bindings.set(binding.bindingId, binding);
  return binding;
}

export function validateMobileSessionBinding(input: {
  bindingId: string;
  userId: string;
  rawDeviceId: string;
}): MobileSessionBinding {
  const binding = bindings.get(input.bindingId);
  if (!binding) throw new Error('Unknown mobile session binding');
  if (binding.revokedAt) throw new Error('Mobile session binding revoked');
  if (binding.userId !== input.userId) throw new Error('Mobile session binding user mismatch');
  if (binding.deviceIdHash !== hashValue(input.rawDeviceId)) throw new Error('Mobile session binding device mismatch');
  if (Date.parse(binding.expiresAt) <= Date.now()) throw new Error('Mobile session binding expired');
  binding.lastSeenAt = new Date().toISOString();
  bindings.set(binding.bindingId, binding);
  return binding;
}

export function rotateMobileSessionNonce(input: { bindingId: string; expectedNonce: string }): MobileSessionBinding {
  const binding = bindings.get(input.bindingId);
  if (!binding) throw new Error('Unknown mobile session binding');
  if (binding.sessionNonce !== input.expectedNonce) throw new Error('Invalid session nonce');
  binding.sessionNonce = randomUUID();
  binding.lastSeenAt = new Date().toISOString();
  bindings.set(binding.bindingId, binding);
  return binding;
}

export function revokeMobileSessionBinding(bindingId: string): void {
  const binding = bindings.get(bindingId);
  if (!binding) return;
  binding.revokedAt = new Date().toISOString();
  bindings.set(bindingId, binding);
}

export function getMobileSessionBinding(bindingId: string): MobileSessionBinding | null {
  const binding = bindings.get(bindingId);
  return binding ? { ...binding } : null;
}

export function resetMobileSecurityTestState(): void {
  bindings.clear();
}
