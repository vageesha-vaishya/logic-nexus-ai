const cache = new Map<string, number>()

function subjectForEvent(name: string) {
  return `logic-nexus-quotation-${name}`
}

function getRegistryUrl() {
  return import.meta.env.VITE_SCHEMA_REGISTRY_URL || import.meta.env.VITE_AVRO_REGISTRY_URL || null
}

async function registerSchema(subject: string, schema: object) {
  const url = getRegistryUrl()
  if (!url) return null
  try {
    const res = await fetch(`${url}/subjects/${encodeURIComponent(subject)}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schema: JSON.stringify(schema), schemaType: "AVRO" })
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(text || `Registry ${res.status}`)
    }
    const json = await res.json().catch(() => ({}))
    const id = Number(json.id)
    if (Number.isFinite(id)) return id
    return null
  } catch {
    return null
  }
}

export async function ensureSchemaId(eventName: string, schema: object | null) {
  if (!schema) return null
  const subject = subjectForEvent(eventName)
  if (cache.has(subject)) return cache.get(subject) as number
  const id = await registerSchema(subject, schema)
  if (id != null) cache.set(subject, id)
  return id
}
