# AMRO Mobile Security Framework
## Android + iOS Access Security Blueprint

- Document ID: `AMRO-SEC-MOB-001`
- Version: `1.0.0`
- Date: `2026-04-16`
- Scope: `AMRO mobile access across Android and iOS, API integration, operations, and assurance`
- Related AMRO docs:
  - `docs/AMRO/AMRO_DOCUMENTATION_INDEX.md`
  - `docs/AMRO/AMRO_QUICK_REFERENCE_GUIDE.md`
  - `docs/AMRO/AMRO_COMPREHENSIVE_DESIGN_SPECIFICATION.md`
  - `docs/AMRO/AMRO_DEPLOYMENT_PROCEDURES.md`

---

## 1) Security Objectives

1. Protect AMRO tenant/franchise data from unauthorized mobile access.
2. Prevent credential/session compromise through strong token lifecycle controls.
3. Reduce MITM/reverse-engineering/data leakage risk using platform-native hardening.
4. Ensure auditable, testable compliance aligned to OWASP Mobile Top 10.

---

## 2) Recommended Security Stack

### 2.1 Authentication and Authorization

- OAuth 2.0: Authorization Code Flow with PKCE (`S256`) for mobile sign-in.
- Token model:
  - Access token: JWT, short-lived (`<= 15 minutes`).
  - Refresh token: rotating one-time token family; revoke family on anomaly.
- Session binding:
  - Device-bound mobile session ID + rotating nonce.
  - Bind session to user, tenant, platform, and device hash.
- MFA/biometric:
  - Biometric gate required for privileged AMRO operations (sign-off, approvals, high-value edits).

### 2.2 Secure Storage Framework Choice

| Capability | iOS Recommendation | Android Recommendation | Notes |
|---|---|---|---|
| Secret storage | Keychain + Secure Enclave | Keystore + StrongBox | No plaintext tokens in app storage |
| OAuth client | AppAuth-iOS | AppAuth-Android | Standardized PKCE + browser-based auth |
| Attestation | App Attest (+ DeviceCheck fallback) | Play Integrity API | Device/app integrity evidence |
| Local DB encryption | SQLCipher / encrypted Realm | SQLCipher / encrypted Room | AES-256 at rest |

### 2.3 Transport and Communication

- TLS: enforce `TLS 1.3` minimum.
- HTTPS only, HSTS enabled.
- Certificate pinning:
  - Public key pinning (SPKI) with dual pin sets (current + next).
  - Fail-closed in production (`strict` mode).

---

## 3) Encryption Standards

### 3.1 Data in Transit

- TLS 1.3 required for AMRO mobile API traffic.
- Disable legacy TLS (<1.3) on mobile gateway path.
- Pin endpoint cert public keys to prevent trust-store hijack MITM.

### 3.2 Data at Rest

- AES-256 for mobile persisted data.
- Key wrapping using Secure Enclave/Keystore-backed keys.
- Encrypted cache retention:
  - default max 30 days;
  - immediate purge on logout, remote wipe, or compromised posture.

---

## 4) AMRO Mobile Security APIs (Implemented)

### 4.1 Policy Endpoint

- Endpoint: `GET /api/v2/amro/security/mobile/policy`
- Purpose: Provide canonical mobile security requirements for clients.
- File: `src/pages/api/v2/amro/security/mobile/policy.ts`

### 4.2 Session Bootstrap + Refresh Nonce Rotation

- Endpoint: `POST /api/v2/amro/security/mobile/bootstrap`
- Actions:
  - `bootstrap`: validate mobile headers, attestation, threat posture; issue session binding.
  - `refresh`: validate binding + nonce; rotate nonce for replay resistance.
- File: `src/pages/api/v2/amro/security/mobile/bootstrap.ts`

### 4.3 Shared Enforcement Library

- File: `src/pages/api/v2/amro/security/mobile/shared.ts`
- Implemented controls:
  - Mobile header validation (`platform`, app version/build, device id).
  - Attestation provider/token validation.
  - TLS minimum enforcement (`1.3`) and pinning mode (`strict`).
  - Threat signal scoring (`emulator`, `rooted/jailbroken`, `debugger`, `overlay`).
  - Session binding issue/validate/revoke/nonce-rotation primitives.

---

## 5) Required Mobile Request Headers

| Header | Required | Example | Purpose |
|---|---|---|---|
| `x-amro-mobile-platform` | Yes | `ios` / `android` | Platform-specific policy |
| `x-amro-device-id` | Yes | device UUID | Device binding input |
| `x-amro-app-version` | Yes | `2.4.1` | Version policy + rollout controls |
| `x-amro-app-build` | Yes | `24101` | Build auditability |
| `x-amro-attestation-provider` | Yes | `app_attest` / `play_integrity` | Attestation channel |
| `x-amro-attestation-token` | Yes | opaque token | Integrity evidence |
| `x-amro-cert-pinning` | Yes | `strict` | Pinning policy compliance |
| `x-tls-version` | Yes | `1.3` | Transport hardening validation |

Optional threat telemetry headers:

- `x-amro-rooted-device`
- `x-amro-emulator`
- `x-amro-debugger-attached`
- `x-amro-screen-overlay`

---

## 6) Session Management and Token Refresh Requirements

1. Access tokens are never persisted unencrypted.
2. Refresh tokens remain in Keychain/Keystore only.
3. On every refresh:
  - validate `binding_id + device + user + nonce`;
  - rotate session nonce;
  - rotate refresh token ID (one-time use).
4. On risk events (`block` posture):
  - revoke binding;
  - revoke refresh token family;
  - force full re-authentication.
5. Idle + absolute expiry:
  - idle timeout configurable (recommended 30 minutes);
  - absolute max 24 hours unless re-auth with biometric.

---

## 7) Threat Model and Defensive Controls

| Threat | Control | Enforcement |
|---|---|---|
| MITM | TLS 1.3 + cert pinning strict mode | Mobile header + gateway enforcement |
| Token replay | Nonce rotation + one-time refresh family | `bootstrap` refresh action |
| Reverse engineering | root/jailbreak checks, debugger detection, obfuscation | client + server risk scoring |
| Data leakage | encrypted store, no sensitive logs, clipboard/screenshot controls | client policy + QA checks |
| API abuse | rate limits + anomaly detection + tenant scope enforcement | existing `_utils/http.ts` + AMRO guards |

---

## 8) OWASP Mobile Top 10 Mapping (2024-aligned)

| OWASP Mobile Risk | AMRO Control |
|---|---|
| Improper Credential Usage | OAuth2 PKCE + secure token storage |
| Inadequate Supply Chain Security | signed CI artifacts + dependency scanning |
| Insecure Authentication/Authorization | RBAC + tenant/franchise scoped enforcement |
| Insufficient Input/Output Validation | API-level schema/guard validation |
| Insecure Communication | TLS 1.3 + pinning |
| Inadequate Privacy Controls | minimized PII cache + encrypted persistence |
| Insufficient Binary Protections | obfuscation + anti-debug/root checks |
| Security Misconfiguration | policy endpoint + environment baselines |
| Insecure Data Storage | AES-256 + hardware-backed key storage |
| Inadequate Cryptography | approved algorithms and key rotation governance |

---

## 9) Testing and Validation Protocol

### 9.1 Automated Security Tests (CI)

- Unit tests:
  - `src/pages/api/v2/amro/security/mobile/shared.test.ts`
  - `src/pages/api/v2/amro/security/mobile/bootstrap.test.ts`
  - `src/pages/api/v2/amro/security/mobile/policy.test.ts`
- Contract checks:
  - validate required headers and error taxonomy.
- SAST/SCA:
  - secrets scanning, dependency vulnerability checks, lint/type gates.

### 9.2 Penetration Testing Requirements

- Quarterly mobile pentest (Android + iOS builds).
- Annual red-team scenario:
  - MITM with invalid cert,
  - runtime tampering,
  - token replay,
  - reverse engineering attempts.
- Mandatory remediation SLA:
  - Critical: 24h
  - High: 72h
  - Medium: 10 business days

---

## 10) Deployment, Monitoring, and Maintenance

### 10.1 Deployment Controls

- Enable security framework behind feature flag:
  - `amro_mobile_security_framework_v1`.
- Rollout plan:
  - Canary tenants -> progressive cohort -> full enforcement.
- Backward compatibility:
  - policy endpoint first;
  - bootstrap enforcement in monitor mode, then strict block mode.

### 10.2 Monitoring and Alerting

- Security telemetry:
  - threat score distribution by tenant/platform/version;
  - nonce mismatch and replay failures;
  - attestation failure rate;
  - pinning mode violations.
- Alert thresholds:
  - attestation failures > 2% (15 min window);
  - replay attempts > 10 per tenant/hour;
  - rooted/jailbroken high-risk sessions > baseline + 3 sigma.

### 10.3 Maintenance Runbook

1. Rotate pin sets before certificate rollover.
2. Review attestation provider policy every release.
3. Revalidate mobile app minimum version monthly.
4. Verify emergency revoke path with tabletop drill each quarter.
5. Keep OWASP controls and evidence matrix current per release.

---

## 11) Implementation Backlog (Next)

1. Persist mobile session bindings in tenant-scoped DB table (replace in-memory store).
2. Integrate attestation verification with Apple/Google attestation verification services.
3. Add SIEM export pipeline for mobile threat events.
4. Add enforced step-up challenge API for `step_up` risk decisions.
5. Introduce mobile security dashboard in AMRO admin console.

