import { serveWithLogger } from "../_shared/logger.ts"
import { getCorsHeaders } from "../_shared/cors.ts"
import { requireAuth } from "../_shared/auth.ts"

serveWithLogger(async (req, logger, adminSupabase) => {
  const headers = getCorsHeaders(req)
  if (req.method === "OPTIONS") return new Response("ok", { headers })

  // Auth: require authenticated user or admin
  const { user, error: authError } = await requireAuth(req, logger)
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } })
  }

  try {
    const payload = await req.json().catch(() => ({}))
    const minutes = Number(payload.minutes ?? 60)
    const since = new Date(Date.now() - minutes * 60_000).toISOString()

    const { data: pdfLogs } = await adminSupabase
      .from("audit_logs")
      .select("id, created_at")
      .eq("action", "EVENT:PdfGenerated")
      .gte("created_at", since)
    const { data: emailLogs } = await adminSupabase
      .from("audit_logs")
      .select("id, created_at")
      .eq("action", "EVENT:EmailSent")
      .gte("created_at", since)
    const { data: alerts } = await adminSupabase
      .from("audit_logs")
      .select("id, created_at")
      .eq("action", "ALERT:ReconcileMismatch")
      .gte("created_at", since)

    const pdfCount = pdfLogs?.length || 0
    const emailCount = emailLogs?.length || 0
    const discrepancies = alerts?.length || 0
    const total = Math.max(pdfCount, emailCount)
    const successRate = total > 0 ? emailCount / total : 1
    const discrepancyRate = total > 0 ? discrepancies / total : 0

    logger.info("Metrics computed", { pdfCount, emailCount, discrepancies, successRate, discrepancyRate })
    return new Response(JSON.stringify({
      window_minutes: minutes,
      pdfCount,
      emailCount,
      discrepancies,
      successRate,
      discrepancyRate
    }), { headers: { ...headers, "Content-Type": "application/json" } })
  } catch (e: any) {
    logger.error("metrics-quotation failed", { error: e?.message || String(e) })
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" }
    })
  }
}, "metrics-quotation")
