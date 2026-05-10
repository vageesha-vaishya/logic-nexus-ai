/**
 * Unit tests for flypal_configured_directives_create_tasks helpers.
 * Run with: deno test --allow-none supabase/functions/flypal_configured_directives_create_tasks/index.test.ts
 */

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

function assertEquals<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`assertEquals failed: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertNotEquals<T>(actual: T, expected: T): void {
  if (actual === expected) {
    throw new Error(`assertNotEquals failed: both values are ${String(actual)}`);
  }
}

function assertMatch(actual: string, pattern: RegExp): void {
  if (!pattern.test(actual)) {
    throw new Error(`assertMatch failed: "${actual}" does not match ${String(pattern)}`);
  }
}

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
  const taskNumber = buildTaskNumber("32", "AD", "202401", 47);
  assertEquals(taskNumber, "TSK-3200-AD-202401-000047");
});

Deno.test("buildTaskNumber: ignores non-AD type input", () => {
  const taskNumber = buildTaskNumber("28", "SB", "202412", 7);
  assertEquals(taskNumber, "TSK-2800-AD-202412-000007");
});

Deno.test("buildTaskNumber: handles missing ata", () => {
  const taskNumber = buildTaskNumber(null, "SB", "202501", 1);
  assertEquals(taskNumber, "TSK-0000-AD-202501-000001");
});

Deno.test("buildTaskNumber: enforces 6-digit sequence", () => {
  const taskNumber = buildTaskNumber("71", "TR", "202603", 1234);
  assertEquals(taskNumber, "TSK-7100-AD-202603-001234");
});

// ═══════════════════════════════════════════════════════════════════════════════
// buildTitle
// ═══════════════════════════════════════════════════════════════════════════════

Deno.test("buildTitle: full values", () => {
  assertEquals(
    buildTitle("32", "AD-DGCA-2024-32-005", "Main Gear Retraction System Inspection"),
    "[Landing Gear] AD-DGCA-2024-32-005 — Main Gear Retraction System Inspection",
  );
});

Deno.test("buildTitle: falls back when reference missing", () => {
  assertEquals(
    buildTitle("28", null, "Fuel Boost Pump Replacement"),
    "[Fuel System] DIRECTIVE — Fuel Boost Pump Replacement",
  );
});

Deno.test("buildTitle: default chapter name when ATA unknown", () => {
  assertEquals(
    buildTitle("99", "REF-001", "Custom task"),
    "[ATA 9900] REF-001 — Custom task",
  );
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
