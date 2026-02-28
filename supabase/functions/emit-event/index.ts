import { serveWithLogger } from "../_shared/logger.ts"
import { getCorsHeaders } from "../_shared/cors.ts"

type EventPayload = {
  trace_id?: string
  idempotency_key?: string
  quote_id?: string
  version_id?: string
  option_id?: string
  email_id?: string
  meta?: Record<string, unknown>
}

function validateEvent(name: string, payload: EventPayload) {
  const allowed = new Set(["QuoteCreated", "OptionAdded", "PdfGenerated", "EmailSent"])
  if (!allowed.has(name)) return { valid: false, error: "Unknown event name" }
  if (typeof payload !== "object") return { valid: false, error: "Invalid payload" }
  return { valid: true }
}

serveWithLogger(async (req, logger, admin) => {
  const headers = getCorsHeaders(req)
  if (req.method === "OPTIONS") return new Response("ok", { headers })

  try {
    const body = await req.json()
    const name = body.eventName as string
    const payload = (body.payload || {}) as EventPayload

    const { valid, error } = validateEvent(name, payload)
    if (!valid) {
      return new Response(JSON.stringify({ error }), { status: 400, headers: { ...headers, "Content-Type": "application/json" } })
    }

    const details = {
      event: name,
      trace_id: payload.trace_id || null,
      idempotency_key: payload.idempotency_key || null,
      quote_id: payload.quote_id || null,
      version_id: payload.version_id || null,
      option_id: payload.option_id || null,
      email_id: payload.email_id || null,
      meta: payload.meta || {}
    }

    const { error: insertError } = await admin
      .from("audit_logs")
      .insert({
        action: `EVENT:${name}`,
        resource_type: "quotation",
        details
      })

    if (insertError) {
      await logger.error("Failed to write audit log", { error: insertError.message })
      return new Response(JSON.stringify({ error: "Audit write failed" }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } })
    }

    await logger.info(`Event emitted: ${name}`, details)
    return new Response(JSON.stringify({ ok: true }), { headers: { ...headers, "Content-Type": "application/json" } })
  } catch (e: any) {
    await logger.error("Emit event failed", { error: e?.message || String(e) })
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } })
  }
}, "emit-event")
