import { serveWithLogger } from "../_shared/logger.ts"
import { getCorsHeaders } from "../_shared/cors.ts"
import { createClient } from "@supabase/supabase-js"

serveWithLogger(async (req, logger) => {
  const headers = getCorsHeaders(req)
  if (req.method === "OPTIONS") return new Response("ok", { headers })
  try {
    const payload = await req.json().catch(() => ({}))
    const minutes = Number(payload.minutes ?? 60)
    const since = new Date(Date.now() - minutes * 60_000).toISOString()

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const admin = createClient(supabaseUrl, serviceKey)

    const { data: pdfLogs } = await admin
      .from("audit_logs")
      .select("id, created_at")
      .eq("action", "EVENT:PdfGenerated")
      .gte("created_at", since)
    const { data: emailLogs } = await admin
      .from("audit_logs")
      .select("id, created_at")
      .eq("action", "EVENT:EmailSent")
      .gte("created_at", since)
    const { data: alerts } = await admin
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

    await logger.info("Metrics computed", { pdfCount, emailCount, discrepancies, successRate, discrepancyRate })
    return new Response(JSON.stringify({
      window_minutes: minutes,
      pdfCount,
      emailCount,
      discrepancies,
      successRate,
      discrepancyRate
    }), { headers: { ...headers, "Content-Type": "application/json" } })
  } catch (e: any) {
    await logger.error("metrics-quotation failed", { error: e?.message || String(e) })
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" }
    })
  }
}, "metrics-quotation")
