import { serveWithLogger } from "../_shared/logger.ts"
import { getCorsHeaders } from "../_shared/cors.ts"

serveWithLogger(async (req, logger, admin) => {
  const headers = getCorsHeaders(req)
  if (req.method === "OPTIONS") return new Response("ok", { headers })
  try {
    const payload = await req.json()
    const sinceMinutes = Number(payload?.since_minutes ?? 5)
    const since = new Date(Date.now() - sinceMinutes * 60_000).toISOString()

    const { data: quotes, error } = await admin
      .from("quotes")
      .select("id, quote_number, updated_at")
      .gte("updated_at", since)
      .limit(200)
    if (error) throw error

    let discrepancies = 0
    for (const q of quotes || []) {
      const { data: reconcile, error: rErr } = await admin.functions.invoke("reconcile-quote", {
        body: { quoteId: q.id, source: "scheduler" },
        method: "POST"
      })
      if (rErr) {
        await logger.warn("Reconcile call failed", { quoteId: q.id })
        discrepancies++
        continue
      }
      if (!reconcile?.consistent) {
        discrepancies++
        await admin.from("audit_logs").insert({
          action: "ALERT:ReconcileMismatch",
          resource_type: "quotation",
          details: { quote_id: q.id, metrics: reconcile?.metrics }
        })
      }
    }

    const rate = quotes && quotes.length > 0 ? (discrepancies / quotes.length) : 0
    await logger.info("Scheduled reconcile summary", { checked: quotes?.length || 0, discrepancies, rate })

    return new Response(JSON.stringify({ checked: quotes?.length || 0, discrepancies, rate }), {
      headers: { ...headers, "Content-Type": "application/json" }
    })
  } catch (e: any) {
    await logger.error("scheduled-reconcile failed", { error: e?.message || String(e) })
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" }
    })
  }
}, "scheduled-reconcile")
