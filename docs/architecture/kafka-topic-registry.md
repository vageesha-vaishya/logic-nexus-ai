# Kafka topic registry

The canonical, append-only list of every Kafka topic on the platform and the contract each one fulfils. Pairs with `packages/event-contracts/src/schemas/` (machine-readable JSON Schemas) and `packages/event-contracts/src/payloads.ts` (TypeScript types).

**Status:** Phase 0 — 9 core topics seeded. Business-module topics land as each module's outbox poller goes live (per master §7.4 phases).

---

## Naming convention

Every topic name is:

```
<module>.<entity_type>.<event_type>
```

Per master design doc §5.1:

| Segment | Rules | Examples |
|---|---|---|
| `<module>` | One of the 11 module codes: `core`, `crm`, `sales`, `quotation`, `logistics`, `finance`, `compliance`, `comms`, `amro`, `uim`, `markets` | `sales` |
| `<entity_type>` | Singular, lowercase, snake_case, **no schema prefix** | `lead`, `work_order`, `quote` |
| `<event_type>` | Past-tense verb describing the state change. Snake_case allowed. | `created`, `won`, `parts_required` |

**Examples:**
- `sales.lead.created`
- `quotation.quote.accepted`
- `logistics.shipment.delivered`
- `amro.work_order.parts_required`
- `compliance.screening.failed`

---

## Universal contract (every topic)

Every topic carries messages matching the **EventEnvelope** shape from master §5.1, defined in TypeScript at `@platform/event-contracts` and validated at runtime by `validateEnvelope()`.

### Envelope fields

| Field | Required | Notes |
|---|---|---|
| `id` | ✅ | ULID, globally unique |
| `tenant_id` | ✅ | UUID; the partition key |
| `module` | ✅ | Module code (matches first segment of topic) |
| `entity_type` | ✅ | Singular lowercase, no schema prefix |
| `event_type` | ✅ | Past-tense verb (matches third segment of topic) |
| `entity_id` | ✅ | UUID |
| `occurred_at` | ✅ | ISO 8601 UTC |
| `version` | ✅ | Integer; bumps only on breaking schema change |
| `payload` | ✅ | Topic-specific; see per-topic JSON Schema |
| `metadata.actor_user_id` | ✅ (nullable) | UUID or null for system actions |
| `metadata.actor_kind` | ✅ | `'user'` / `'service'` / `'integration'` / `'system'` |
| `metadata.correlation_id` | ✅ | Root event's ULID — propagates across the whole saga |
| `metadata.causation_id` | nullable | ULID of immediately-upstream event |
| `metadata.tracing.traceparent` | optional in Phase 0 | W3C trace context (mandatory once observability lands per §8.1) |

### Partition key

**Always `tenant_id`.** Guarantees per-tenant ordering and lets us scale by tenant fan-out. Never `entity_id` (loses cross-entity ordering within a tenant).

### Retention

| Topic class | Default retention |
|---|---|
| `core.*` (identity) | 30 days |
| Commercial lifecycle (`sales.*`, `quotation.*`, `logistics.*`, `finance.*`) | 30 days |
| Regulatory (`amro.*`, `compliance.*`) | 90 days |
| Integration (`uim.*`) | 14 days |
| Comms outbound | 7 days |

Compaction is disabled platform-wide — events are immutable; consumers must process at-least-once and dedup via `core.idempotency_keys`.

### DLQ (Dead-Letter Queue) topic naming

Failed-consume messages land on `dlq.<original_topic>`. Example: failures on `sales.lead.created` go to `dlq.sales.lead.created`. Single retention: 30 days.

---

## Versioning

Topic schemas use additive evolution. Bump rules from master §5.1:

| Change | Bumps `version`? |
|---|---|
| Adding an optional field to `payload` | No |
| Adding a new enum value to an enum already in the schema | No |
| Renaming a field | **Yes** |
| Removing a field | **Yes** |
| Changing a field's type | **Yes** |
| Tightening a constraint (e.g., field becomes required) | **Yes** |

When `version` bumps:
1. New JSON Schema lives at `packages/event-contracts/src/schemas/<topic>.v<N>.json` alongside the previous version.
2. Producers emit at the latest version. Consumers handle both old and new for at least one deprecation window (90 days).
3. After the window, the old version is moved to `_archive/` but kept indefinitely for replay/forensics.

---

## Topic registry (current)

### `core.*` — 9 topics, all v1

| Topic | When | Key payload fields | Schema |
|---|---|---|---|
| `core.tenant.created` | New customer organization registered | `name`, `status`, `created_by_user_id`, `residency_region` | `schemas/core.tenant.created.v1.json` |
| `core.user.created` | New user record (may be invited or self-signup) | `email`, `display_name`, `provisioning_kind` | `schemas/core.user.created.v1.json` |
| `core.user.invited` | Invitation sent (precedes `user.created` for invited flows) | `email`, `invited_by_user_id`, `role_id`, `expires_at` | `schemas/core.user.invited.v1.json` |
| `core.party.created` | New party (person or organization) | `party_type`, `display_name`, `legal_name?`, source-of-creation | `schemas/core.party.created.v1.json` |
| `core.party.updated` | Party fields changed | `changes` diff | `schemas/core.party.updated.v1.json` |
| `core.party.merged` | Two or more parties consolidated | `merged_into_party_id`, `deprecated_party_ids`, `merge_kind`, `merged_by_user_id` | `schemas/core.party.merged.v1.json` |
| `core.party.deleted` | Soft-delete initiated (GDPR/DPDP) | `soft_delete_at`, `hard_delete_eligible_at` | `schemas/core.party.deleted.v1.json` |
| `core.membership.granted` | User gains access to one or more modules | `user_id`, `role_id`, `module_codes` | `schemas/core.membership.granted.v1.json` |
| `core.membership.revoked` | User loses access | `user_id`, `role_id`, `module_codes`, `reason?` | `schemas/core.membership.revoked.v1.json` |

### Business-module topics — reserved, schemas TBD

These are **reserved names** so producers don't collide as modules light up their outbox publishers. Schema files land alongside each module's outbox-poller PR.

| Module | Topics (planned per per-module subdoc §5) |
|---|---|
| `crm` | `crm.activity.logged`, `crm.activity.completed`, `crm.campaign.launched`, `crm.campaign.completed`, `crm.campaign_member.enrolled`, `crm.campaign_member.converted`, `crm.segment.refreshed`, `crm.account_extension.created`, `crm.account_extension.lifecycle_stage_changed`, `crm.do_not_contact.set` |
| `sales` | `sales.lead.created`, `sales.lead.scored`, `sales.lead.assigned`, `sales.lead.qualified`, `sales.lead.converted`, `sales.lead.disqualified`, `sales.opportunity.created`, `sales.opportunity.stage_changed`, `sales.opportunity.amount_changed`, `sales.opportunity.won`, `sales.opportunity.lost`, `sales.forecast.snapshotted`, `sales.target.set`, `sales.target.adjusted` |
| `quotation` | `quotation.quote.draft`, `quotation.quote.version_created`, `quotation.quote.submitted_for_approval`, `quotation.quote.approved`, `quotation.quote.rejected_internally`, `quotation.quote.sent`, `quotation.quote.viewed`, `quotation.quote.option_selected`, `quotation.quote.accepted`, `quotation.quote.rejected`, `quotation.quote.expired` |
| `logistics` | `logistics.booking.created`, `logistics.booking.confirmed`, `logistics.booking.cancelled`, `logistics.shipment.created`, `logistics.shipment.status_changed`, `logistics.shipment.milestone_recorded`, `logistics.shipment.exception`, `logistics.shipment.eta_updated`, `logistics.shipment.delivered`, `logistics.customs.held`, `logistics.customs.cleared`, `logistics.rate.updated` |
| `finance` | `finance.invoice.drafted`, `finance.invoice.finalized`, `finance.invoice.sent`, `finance.invoice.paid`, `finance.invoice.partially_paid`, `finance.invoice.overdue`, `finance.invoice.voided`, `finance.invoice.written_off`, `finance.payment.received`, `finance.payment.failed`, `finance.payment.refunded`, `finance.credit_note.issued`, `finance.journal.posted`, `finance.dunning.escalated`, `finance.subscription.invoiced`, `finance.subscription.payment_failed`, `finance.subscription.cancelled`, `finance.commission.computed` |
| `compliance` | `compliance.screening.requested`, `compliance.screening.passed`, `compliance.screening.flagged`, `compliance.screening.failed`, `compliance.screening.expired`, `compliance.obligation.due_soon`, `compliance.obligation.overdue`, `compliance.override.applied` |
| `comms` | `comms.email.received`, `comms.email.sent`, `comms.email.delivered`, `comms.email.bounced`, `comms.email.opened`, `comms.email.clicked`, `comms.email.complained`, `comms.message.received`, `comms.notification.delivered`, `comms.notification.failed`, `comms.notification.suppressed`, `comms.thread.created`, `comms.account.health_degraded`, `comms.do_not_contact.added` |
| `amro` | `amro.aircraft.created`, `amro.aircraft.updated`, `amro.aircraft.transferred`, `amro.work_order.created`, `amro.work_order.scheduled`, `amro.work_order.started`, `amro.work_order.completed`, `amro.work_order.cancelled`, `amro.work_order.deferred`, `amro.work_order.parts_required`, `amro.work_order.parts_consumed`, `amro.work_order.tool_reserved`, `amro.work_order.tool_released`, `amro.mpd.applied`, `amro.mpd.revised`, `amro.directive.published`, `amro.directive.complied`, `amro.directive.escalated`, `amro.aog.opened`, `amro.aog.escalated`, `amro.aog.resolved`, `amro.calibration.due_soon`, `amro.calibration.overdue`, `amro.certificate.issued`, `amro.compliance.deadline_approaching`, `amro.predictive_maintenance.recommendation_made` |
| `uim` | `uim.item.created`, `uim.item.updated`, `uim.item.deactivated`, `uim.stock.movement_recorded`, `uim.stock.reservation_made`, `uim.stock.reservation_released`, `uim.stock.reservation_consumed`, `uim.stock.low_inventory`, `uim.stock.snapshot_taken`, `uim.sync.started`, `uim.sync.completed`, `uim.sync.failed`, `uim.sync.conflict_detected`, `uim.webhook.delivered`, `uim.webhook.failed`, `uim.dlq.message_added`, `uim.connector.health_degraded` |
| `markets` | `markets.portfolio.created`, `markets.portfolio.updated`, `markets.order.placed`, `markets.order.filled`, `markets.order.cancelled`, `markets.position.closed`, `markets.alert.fired`, `markets.broker.connected`, `markets.broker.disconnected`, `markets.signal.generated` |

Total: **9 core + ~140 business-module topics reserved.**

---

## Process for adding a new topic

1. **Confirm the name** matches the naming convention. Schema-qualified subject-type (`'sales.lead'`, etc.) is **not** a topic name — topics are unprefixed entity names.
2. **Add to this registry** under the owning module's section.
3. **Add the topic name** to `packages/event-contracts/src/topics.ts` `RESERVED_TOPICS` literal so it gets a type.
4. **Write the JSON Schema** at `packages/event-contracts/src/schemas/<topic>.v1.json` and the TS payload type in `packages/event-contracts/src/payloads.ts`.
5. **Add a smoke test** in `packages/event-contracts/src/validator.test.ts` covering one valid + one invalid case.
6. **CODEOWNERS approval** from `@core-team` (registry change) + the owning module's team.

---

## Operational metadata (Phase 1+)

The following details are documented here for forward-compatibility; they take effect when the actual Kafka cluster is provisioned in Phase 1 of the rollout. Not yet enforced in Phase 0.

| Setting | Default | Notes |
|---|---|---|
| Replication factor | 3 | Per the broker-config standard |
| Min in-sync replicas | 2 | Standard durability |
| `cleanup.policy` | `delete` | No compaction; events are immutable |
| `compression.type` | `zstd` | Best ratio for JSON payloads |
| Max message bytes | 1 MB | Larger payloads should be split or stored in `core.files` and referenced |

---

## See also

- Master design doc: `docs/plans/2026-05-28-platform-modules-redesign.md` §5 cross-module workflows
- Event envelope contract: `packages/event-contracts/src/types.ts`
- Schemas (machine-readable): `packages/event-contracts/src/schemas/`
- Validator: `packages/event-contracts/src/validator.ts`
- TypeScript payload types: `packages/event-contracts/src/payloads.ts`
