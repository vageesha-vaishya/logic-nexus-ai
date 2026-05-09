/**
 * Unit tests for flypal_configured_directives_create_tasks helpers.
 * Run with: deno test --allow-none supabase/functions/flypal_configured_directives_create_tasks/index.test.ts
 */

import {
  assertEquals,
  assertNotEquals,
  assertMatch,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  buildTaskNumber,
  buildTitle,
  buildProcedureReference,
  calcPlannedStartDate,
  resolveAircraftId,
  resolveAtaCodeId,
} from "./index.ts";

// ═══════════════════════════════════════════════════════════════════════════════
// buildTaskNumber
// ═══════════════════════════════════════════════════════════════════════════════

Deno.test("buildTaskNumber: full values", () => {
  assertEquals(buildTaskNumber("VT-ABC", "AMP-AD-001"), "TSK-VT-ABC AMP-AD-001");
});

Deno.test("buildTaskNumber: no directive_no", () => {
  assertEquals(buildTaskNumber("VT-ABC", null), "TSK-VT-ABC");
});

Deno.test("buildTaskNumber: no registration", () => {
  assertEquals(buildTaskNumber(null, "AMP-AD-001"), "TSK-AMP-AD-001");
});

Deno.test("buildTaskNumber: both null", () => {
  assertEquals(buildTaskNumber(null, null), "TSK-UNKNOWN");
});

Deno.test("buildTaskNumber: trims whitespace", () => {
  assertEquals(buildTaskNumber("  VT-ABC  ", "  AD-001  "), "TSK-VT-ABC AD-001");
});

// ═══════════════════════════════════════════════════════════════════════════════
// buildTitle
// ═══════════════════════════════════════════════════════════════════════════════

Deno.test("buildTitle: full values", () => {
  assertEquals(buildTitle("AD-2023-001", "VT-ABC", 1), "AD-2023-001 — VT-ABC");
});

Deno.test("buildTitle: only directive_no", () => {
  assertEquals(buildTitle("AD-2023-001", null, 5), "AD-2023-001");
});

Deno.test("buildTitle: only registration", () => {
  assertEquals(buildTitle(null, "VT-ABC", 5), "VT-ABC");
});

Deno.test("buildTitle: both null falls back to seq", () => {
  assertEquals(buildTitle(null, null, 42), "Directive task (seq 42)");
});

// ═══════════════════════════════════════════════════════════════════════════════
// buildProcedureReference
// ═══════════════════════════════════════════════════════════════════════════════

Deno.test("buildProcedureReference: standard ata code", () => {
  assertEquals(buildProcedureReference("05-10"), "AMA-05-10-00-00");
});

Deno.test("buildProcedureReference: null returns null", () => {
  assertEquals(buildProcedureReference(null), null);
});

Deno.test("buildProcedureReference: empty string returns null", () => {
  assertEquals(buildProcedureReference(""), null);
});

Deno.test("buildProcedureReference: trims whitespace", () => {
  assertEquals(buildProcedureReference("  21-00  "), "AMA-21-00-00-00");
});

// ═══════════════════════════════════════════════════════════════════════════════
// calcPlannedStartDate
// ═══════════════════════════════════════════════════════════════════════════════

Deno.test("calcPlannedStartDate: null effectiveFromDate returns null", () => {
  assertEquals(calcPlannedStartDate(null, 8), null);
});

Deno.test("calcPlannedStartDate: invalid date returns null", () => {
  assertEquals(calcPlannedStartDate("not-a-date", 8), null);
});

Deno.test("calcPlannedStartDate: 8 man_hours = 1 working day + 1 buffer = 2 days back", () => {
  // 8 hours / 8 = 1 working day, + 1 buffer = 2 days back
  const result = calcPlannedStartDate("2024-06-10", 8);
  assertEquals(result, new Date("2024-06-08T00:00:00.000Z").toISOString());
});

Deno.test("calcPlannedStartDate: 0 man_hours = 0 working days + 1 buffer = 1 day back", () => {
  const result = calcPlannedStartDate("2024-06-10", 0);
  assertEquals(result, new Date("2024-06-09T00:00:00.000Z").toISOString());
});

Deno.test("calcPlannedStartDate: null man_hours = 1 day back", () => {
  const result = calcPlannedStartDate("2024-06-10", null);
  assertEquals(result, new Date("2024-06-09T00:00:00.000Z").toISOString());
});

Deno.test("calcPlannedStartDate: 20 man_hours = ceil(2.5)=3 working days + 1 buffer = 4 days back", () => {
  const result = calcPlannedStartDate("2024-06-10", 20);
  assertEquals(result, new Date("2024-06-06T00:00:00.000Z").toISOString());
});

Deno.test("calcPlannedStartDate: 40 man_hours = 5 working days + 1 buffer = 6 days back", () => {
  const result = calcPlannedStartDate("2024-06-10", 40);
  assertEquals(result, new Date("2024-06-04T00:00:00.000Z").toISOString());
});

// ═══════════════════════════════════════════════════════════════════════════════
// resolveAircraftId — mock supabase client
// ═══════════════════════════════════════════════════════════════════════════════

function makeMockSupabase(returnData: unknown, returnError: unknown = null) {
  const chain = {
    data: returnData,
    error: returnError,
    select: () => chain,
    eq: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({ data: returnData, error: returnError }),
  };
  return { from: () => chain };
}

Deno.test("resolveAircraftId: returns id when aircraft found", async () => {
  const mock = makeMockSupabase({ id: "aircraft-uuid-123" });
  const result = await resolveAircraftId(
    mock, "tenant-1", "franchise-1", "VT-ABC", "SN-001",
  );
  assertEquals(result, "aircraft-uuid-123");
});

Deno.test("resolveAircraftId: returns null when no aircraft found", async () => {
  const mock = makeMockSupabase(null);
  const result = await resolveAircraftId(
    mock, "tenant-1", "franchise-1", "VT-XYZ", "SN-999",
  );
  assertEquals(result, null);
});

Deno.test("resolveAircraftId: returns null when both registration and serial_number are null", async () => {
  const mock = makeMockSupabase({ id: "aircraft-uuid-123" });
  const result = await resolveAircraftId(mock, "tenant-1", null, null, null);
  assertEquals(result, null);
});

Deno.test("resolveAircraftId: works with null franchise_id", async () => {
  const mock = makeMockSupabase({ id: "aircraft-uuid-456" });
  const result = await resolveAircraftId(
    mock, "tenant-1", null, "VT-ABC", "SN-001",
  );
  assertEquals(result, "aircraft-uuid-456");
});

Deno.test("resolveAircraftId: throws on DB error", async () => {
  const mock = makeMockSupabase(null, { message: "connection refused" });
  let threw = false;
  try {
    await resolveAircraftId(mock, "tenant-1", null, "VT-ABC", "SN-001");
  } catch (e) {
    threw = true;
    assertMatch((e as Error).message, /aircraft lookup failed/);
  }
  assertEquals(threw, true);
});

// ═══════════════════════════════════════════════════════════════════════════════
// resolveAtaCodeId — mock supabase client
// ═══════════════════════════════════════════════════════════════════════════════

Deno.test("resolveAtaCodeId: returns id when ata_code found", async () => {
  const mock = makeMockSupabase({ id: "ata-uuid-789" });
  const result = await resolveAtaCodeId(mock, "tenant-1", "05-10");
  assertEquals(result, "ata-uuid-789");
});

Deno.test("resolveAtaCodeId: returns null when ata_code not found", async () => {
  const mock = makeMockSupabase(null);
  const result = await resolveAtaCodeId(mock, "tenant-1", "99-99");
  assertEquals(result, null);
});

Deno.test("resolveAtaCodeId: returns null when ata_code is null", async () => {
  const mock = makeMockSupabase({ id: "ata-uuid-789" });
  const result = await resolveAtaCodeId(mock, "tenant-1", null);
  assertEquals(result, null);
});

Deno.test("resolveAtaCodeId: returns null when ata_code is empty string", async () => {
  const mock = makeMockSupabase({ id: "ata-uuid-789" });
  const result = await resolveAtaCodeId(mock, "tenant-1", "  ");
  // empty after trim → returns null without querying
  assertEquals(result, null);
});

Deno.test("resolveAtaCodeId: throws on DB error", async () => {
  const mock = makeMockSupabase(null, { message: "timeout" });
  let threw = false;
  try {
    await resolveAtaCodeId(mock, "tenant-1", "05-10");
  } catch (e) {
    threw = true;
    assertMatch((e as Error).message, /ata_codes lookup failed/);
  }
  assertEquals(threw, true);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Combined lookup scenario
// ═══════════════════════════════════════════════════════════════════════════════

Deno.test("resolveAircraftId + resolveAtaCodeId: both resolve correctly", async () => {
  const aircraftMock = makeMockSupabase({ id: "ac-id-001" });
  const ataMock = makeMockSupabase({ id: "ata-id-001" });

  const aircraftId = await resolveAircraftId(
    aircraftMock, "t-1", "f-1", "VT-DEF", "SN-100",
  );
  const ataCodeId = await resolveAtaCodeId(ataMock, "t-1", "21-00");

  assertNotEquals(aircraftId, null);
  assertNotEquals(ataCodeId, null);
  assertEquals(aircraftId, "ac-id-001");
  assertEquals(ataCodeId, "ata-id-001");
});
