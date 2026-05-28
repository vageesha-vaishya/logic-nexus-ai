import { describe, it, expect } from "vitest";
import {
  validateEnvelope,
  validateEvent,
  topicFromEnvelope,
  topicName,
  dlqTopicFor,
  RESERVED_TOPICS,
} from "./index.js";
import type { EventEnvelope } from "./types.js";

const baseEnvelope = <T>(overrides: Partial<EventEnvelope<T>> = {}): unknown => ({
  id: "01HG7K2P9XQM8YN3RZBF4VD6TW",
  tenant_id: "00000000-0000-4000-8000-000000000001",
  module: "core",
  entity_type: "party",
  event_type: "created",
  entity_id: "00000000-0000-4000-8000-000000000002",
  occurred_at: "2026-05-28T10:00:00.000Z",
  version: 1,
  payload: {},
  metadata: {
    actor_user_id: "00000000-0000-4000-8000-000000000003",
    actor_kind: "user",
    correlation_id: "01HG7K2P9XQM8YN3RZBF4VD6TW",
    causation_id: null,
  },
  ...overrides,
});

describe("topicName / topicFromEnvelope / dlqTopicFor", () => {
  it("topicName composes module.entity.event", () => {
    expect(topicName("sales", "opportunity", "won")).toBe("sales.opportunity.won");
  });

  it("topicFromEnvelope round-trips", () => {
    const env = baseEnvelope() as EventEnvelope;
    expect(topicFromEnvelope(env)).toBe("core.party.created");
  });

  it("dlqTopicFor prefixes dlq.", () => {
    expect(dlqTopicFor("sales.lead.created")).toBe("dlq.sales.lead.created");
  });
});

describe("RESERVED_TOPICS", () => {
  it("ships the 9 core events in Phase 0", () => {
    expect(RESERVED_TOPICS.length).toBe(9);
    expect(RESERVED_TOPICS).toContain("core.tenant.created");
    expect(RESERVED_TOPICS).toContain("core.party.merged");
    expect(RESERVED_TOPICS).toContain("core.membership.revoked");
  });
  it("every reserved topic matches module.entity.event shape", () => {
    for (const t of RESERVED_TOPICS) {
      const parts = t.split(".");
      expect(parts.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("validateEnvelope", () => {
  it("accepts a well-formed envelope", () => {
    const result = validateEnvelope(baseEnvelope());
    expect(result.ok).toBe(true);
  });

  it("rejects non-object input", () => {
    expect(validateEnvelope(null).ok).toBe(false);
    expect(validateEnvelope("string").ok).toBe(false);
    expect(validateEnvelope(42).ok).toBe(false);
  });

  it("requires non-empty id", () => {
    const result = validateEnvelope(baseEnvelope({ id: "" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('"id"'))).toBe(true);
    }
  });

  it("requires positive integer version", () => {
    const r1 = validateEnvelope(baseEnvelope({ version: 0 }));
    expect(r1.ok).toBe(false);
    const r2 = validateEnvelope(baseEnvelope({ version: 1.5 }));
    expect(r2.ok).toBe(false);
  });

  it("requires metadata.correlation_id and actor_kind", () => {
    const bad = baseEnvelope() as Record<string, unknown>;
    bad.metadata = { actor_kind: "user" };  // missing correlation_id
    const result = validateEnvelope(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("correlation_id"))).toBe(true);
    }
  });
});

describe("validateEvent — core.party.created", () => {
  it("accepts a valid party.created event", () => {
    const result = validateEvent("core.party.created", baseEnvelope({
      payload: {
        party_type: "organization",
        display_name: "Acme Corp",
        source_kind: "manual_create",
      },
    }));
    expect(result.ok).toBe(true);
  });

  it("rejects when payload missing display_name", () => {
    const result = validateEvent("core.party.created", baseEnvelope({
      payload: { party_type: "organization", source_kind: "manual_create" },
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("display_name"))).toBe(true);
    }
  });

  it("rejects when party_type not in enum", () => {
    const result = validateEvent("core.party.created", baseEnvelope({
      payload: { party_type: "robot", display_name: "X", source_kind: "manual_create" },
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("party_type"))).toBe(true);
    }
  });

  it("rejects when envelope topic does not match expected topic", () => {
    const env = baseEnvelope({
      module: "sales",
      entity_type: "lead",
      event_type: "created",
      payload: { party_type: "organization", display_name: "X", source_kind: "manual_create" },
    });
    const result = validateEvent("core.party.created", env);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("does not match"))).toBe(true);
    }
  });
});

describe("validateEvent — core.tenant.created", () => {
  it("accepts with required fields + valid enum", () => {
    const result = validateEvent("core.tenant.created", baseEnvelope({
      module: "core",
      entity_type: "tenant",
      event_type: "created",
      payload: {
        name: "Acme Logistics Pte Ltd",
        status: "trial",
        created_by_user_id: "00000000-0000-4000-8000-000000000099",
      },
    }));
    expect(result.ok).toBe(true);
  });

  it("rejects on bad status enum", () => {
    const result = validateEvent("core.tenant.created", baseEnvelope({
      module: "core",
      entity_type: "tenant",
      event_type: "created",
      payload: { name: "X", status: "frozen", created_by_user_id: "00000000-0000-4000-8000-000000000099" },
    }));
    expect(result.ok).toBe(false);
  });
});

describe("validateEvent — core.party.merged", () => {
  it("accepts with at least one deprecated id", () => {
    const result = validateEvent("core.party.merged", baseEnvelope({
      entity_type: "party",
      event_type: "merged",
      payload: {
        merged_into_party_id: "00000000-0000-4000-8000-000000000010",
        deprecated_party_ids: ["00000000-0000-4000-8000-000000000011"],
        merge_kind: "manual_human",
        merged_by_user_id: "00000000-0000-4000-8000-000000000099",
      },
    }));
    expect(result.ok).toBe(true);
  });

  it("rejects empty deprecated_party_ids", () => {
    const result = validateEvent("core.party.merged", baseEnvelope({
      entity_type: "party",
      event_type: "merged",
      payload: {
        merged_into_party_id: "00000000-0000-4000-8000-000000000010",
        deprecated_party_ids: [],
        merge_kind: "manual_human",
        merged_by_user_id: "00000000-0000-4000-8000-000000000099",
      },
    }));
    expect(result.ok).toBe(false);
  });
});

describe("validateEvent — core.membership.granted", () => {
  it("accepts with valid module codes", () => {
    const result = validateEvent("core.membership.granted", baseEnvelope({
      entity_type: "membership",
      event_type: "granted",
      payload: {
        user_id: "00000000-0000-4000-8000-000000000099",
        module_codes: ["sales", "quotation"],
        granted_by_user_id: "00000000-0000-4000-8000-000000000001",
      },
    }));
    expect(result.ok).toBe(true);
  });
});
