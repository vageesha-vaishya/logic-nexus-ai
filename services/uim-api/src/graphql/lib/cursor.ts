// Phase 7 UIM Step 8.2 — Relay cursor encode/decode.
//
// Cursor format: base64 of { k: <updated_at_iso>, i: <id> }. The
// key field is the column the connection orders by; the id field
// is the tiebreaker. Each cursor encodes its tenant scope
// implicitly (the resolver always filters by tenantId before the
// cursor predicate).
//
// Opaque from client perspective — never document the inner shape.

export type DecodedCursor = {
  k: string;
  i: string;
};

export function encodeCursor(input: DecodedCursor): string {
  return Buffer.from(JSON.stringify(input), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string | null | undefined): DecodedCursor | null {
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const k = typeof parsed.k === 'string' ? parsed.k : null;
    const i = typeof parsed.i === 'string' ? parsed.i : null;
    if (!k || !i) return null;
    return { k, i };
  } catch {
    return null;
  }
}
