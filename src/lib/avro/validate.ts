type AvroField = { name: string; type: string | (string | object)[]; default?: any }
type AvroSchema = { type: "record"; name: string; namespace?: string; fields: AvroField[] }

function isString(x: unknown) {
  return typeof x === "string"
}

function matchesType(value: unknown, type: string | (string | object)[]) {
  if (Array.isArray(type)) {
    for (const t of type) {
      if (typeof t === "string" && t === "null" && value == null) return true
      if (typeof t === "string" && t === "string" && isString(value)) return true
    }
    return false
  }
  if (type === "string") return isString(value)
  if (type === "null") return value == null
  return false
}

export function validateAvro(schema: AvroSchema, record: Record<string, unknown>) {
  for (const f of schema.fields) {
    if (!(f.name in record)) {
      if (f.default !== undefined) continue
      return { ok: false, error: `missing field ${f.name}` }
    }
    const v = (record as any)[f.name]
    if (!matchesType(v, f.type)) {
      return { ok: false, error: `type mismatch for ${f.name}` }
    }
  }
  return { ok: true }
}
