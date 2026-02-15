import { serveWithLogger } from "../_shared/logger.ts"
import { getCorsHeaders } from "../_shared/cors.ts"

serveWithLogger(async (req, logger, supabase) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: getCorsHeaders(req) })
    }
    const body = await req.json()
    const quoteId = body.quoteId
    if (!quoteId) {
      return new Response(JSON.stringify({ error: "Missing quoteId" }), { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } })
    }

    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .select("id, quote_number, origin_port_id, destination_port_id, currency, shipping_amount, accounts(name)")
      .eq("id", quoteId)
      .single()
    if (qErr) throw qErr

    const { data: version, error: vErr } = await supabase
      .from("quotation_versions")
      .select("id, version_number")
      .eq("quote_id", quoteId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
    if (vErr) throw vErr

    const { data: options, error: oErr } = await supabase
      .from("quotation_version_options")
      .select("id")
      .eq("quotation_version_id", version.id)
    if (oErr) throw oErr

    let chargesCount = 0
    for (const o of options || []) {
      const { count } = await supabase
        .from("quote_charges")
        .select("*", { count: "exact", head: true })
        .eq("quote_option_id", o.id)
      chargesCount += Number(count || 0)
    }

    const { data: previewResp, error: pErr } = await supabase.functions.invoke("generate-quote-pdf", {
      body: { quoteId, versionId: version.id, engine_v2: true, source: "reconcile", action: "generate-pdf" },
      method: "POST"
    })
    if (pErr) {
      await logger.warn("PDF generation error during reconciliation")
    }
    const previewOk = previewResp && previewResp.content && String(previewResp.content).length > 0

    const consistent = !!quote && !!version && (options || []).length > 0 && chargesCount > 0 && previewOk
    const metrics = {
      quote_id: quote.id,
      version_id: version.id,
      options_count: (options || []).length,
      charges_count: chargesCount,
      preview_ok: previewOk
    }
    await logger.info("Reconcile summary", metrics)

    return new Response(JSON.stringify({ consistent, metrics }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
    })
  } catch (error: any) {
    await logger.error("Reconcile failed", { error: String(error?.message || error) })
    return new Response(JSON.stringify({ error: String(error?.message || error) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
    })
  }
}, "reconcile-quote")
