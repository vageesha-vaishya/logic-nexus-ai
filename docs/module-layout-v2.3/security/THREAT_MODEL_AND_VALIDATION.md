# Threat Model and Validation Rules (Phase 3.3/3.4)

## Scope
- Event Stream panel
- CRUD events workflows
- Viewport Validation Checklist state updates

## Threat Model
| Vector | Scenario | Impact | Mitigation |
|---|---|---|---|
| XSS in event payload | malicious HTML/script in event message | UI compromise | strict schema validation + HTML escaping + content sanitization |
| CSRF on CRUD endpoints | cross-origin forged create/update/delete | unauthorized mutation | same-site cookie policy + CSRF token + origin checks |
| Permission escalation | checklist update by non-privileged actor | governance failure | RBAC check on endpoint + scoped policy enforcement |
| Replay attack | stale CRUD/event payload replay | audit inconsistency | idempotency key + timestamp window + nonce |
| Event tampering | payload modified in transit/storage | false operational history | checksum signature + server-side canonical event generation |

## Validation Rules
### Event Stream
- JSON-schema validation:
  - [event-stream.schema.json](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/module-layout-v2.3/schemas/event-stream.schema.json)
- Reject payload if:
  - unknown `event_type`
  - malformed `occurred_at`
  - missing `actor.id` / `actor.role`

### CRUD Input Sanitization (OWASP aligned)
- Canonical input handling:
  - trim and normalize UTF-8 input
  - reject null-byte and control-character injections
  - strict allow-list for enum/status fields
- Output encoding:
  - encode text for HTML context
  - never render unsanitized object blobs directly

### Checklist Integrity
- State model:
  - each checklist update includes `revision`, `updated_at`, and checksum
- Checksum:
  - hash(`critical-field-ids + pass/fail-state + revision`) -> detect tamper drift

## Security Test Matrix
| Test | Tooling | Pass Criteria |
|---|---|---|
| SAST | ESLint security rules + TS checks | no high/critical findings |
| DAST | OWASP ZAP (pipeline target) | no high/critical vulnerabilities |
| Dependencies | `npm audit` + policy gate | no unresolved critical advisories |
| Contract abuse tests | API integration tests | unauthorized or malformed requests rejected |
