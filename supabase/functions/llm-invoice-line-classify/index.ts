// llm-invoice-line-classify — eleventh production callsite for the
// unified LLM Gateway, first finance LLM feature. Master plan §7.4
// Phase 10 Tier-1: given a draft invoice's line items + tenant chart
// of accounts + tax rules, classify each line into a GL account with
// tax treatment. Drives auto-posting to the ledger.
//
// Non-modal: structured JSON only. Output is ADVISORY — the operator
// reviews and commits.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { Logger } from "../_shared/logger.ts";

// @ts-ignore
declare const Deno: any;

const PROMPT_KEY = "finance.invoice.line_classify";

interface InvoiceLine {
  line_id: string;
  charge_code: string;
  description: string;
  amount: number;
  currency: string;
  is_pass_through?: boolean | null;
  vendor_ref?: string | null;
  service_country_origin?: string | null;
  service_country_destination?: string | null;
}

interface ChartAccount {
  code: string;
  name: string;
  type:
    | "revenue"
    | "cost_of_sales"
    | "expense"
    | "pass_through_liability"
    | "tax_payable"
    | "tax_receivable"
    | "other";
  tags?: string[];
}

interface TaxRules {
  jurisdiction: string;
  tax_label: "GST" | "VAT" | "Sales Tax" | "Service Tax" | "None";
  default_rate_pct: number | null;
  reverse_charge_applicable_codes: string[];
  zero_rated_charges: string[];
}

interface ClassifyRequest {
  invoice_id?: string | null;
  invoice_lines: InvoiceLine[];
  chart_of_accounts: ChartAccount[];
  tax_rules: TaxRules;
}

function bad(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({
      error: { code: status === 401 ? "UNAUTHORIZED" : "INVALID_REQUEST", message },
    }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

const VALID_ACCOUNT_TYPES = new Set([
  "revenue", "cost_of_sales", "expense", "pass_through_liability",
  "tax_payable", "tax_receivable", "other",
]);

const VALID_TAX_LABELS = new Set(["GST", "VAT", "Sales Tax", "Service Tax", "None"]);

function parseInputs(raw: unknown): ClassifyRequest | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "body must be a JSON object" };
  const r = raw as Record<string, unknown>;

  if (!Array.isArray(r.invoice_lines) || r.invoice_lines.length === 0) {
    return { error: "invoice_lines required (non-empty array)" };
  }
  if (r.invoice_lines.length > 80) {
    return { error: "invoice_lines too large (max 80 per invocation)" };
  }
  for (const [i, raw_line] of (r.invoice_lines as unknown[]).entries()) {
    const line = raw_line as InvoiceLine;
    if (typeof line?.line_id !== "string" || !line.line_id) {
      return { error: `invoice_lines[${i}].line_id required (string)` };
    }
    if (typeof line.charge_code !== "string") {
      return { error: `invoice_lines[${i}].charge_code required` };
    }
    if (typeof line.amount !== "number" || !Number.isFinite(line.amount)) {
      return { error: `invoice_lines[${i}].amount required (number)` };
    }
    if (!/^[A-Z]{3}$/.test(line.currency || "")) {
      return { error: `invoice_lines[${i}].currency required (ISO-4217)` };
    }
  }

  if (!Array.isArray(r.chart_of_accounts) || r.chart_of_accounts.length === 0) {
    return { error: "chart_of_accounts required (non-empty array)" };
  }
  for (const [i, raw_acc] of (r.chart_of_accounts as unknown[]).entries()) {
    const acc = raw_acc as ChartAccount;
    if (typeof acc?.code !== "string" || !acc.code) {
      return { error: `chart_of_accounts[${i}].code required` };
    }
    if (typeof acc.name !== "string") {
      return { error: `chart_of_accounts[${i}].name required` };
    }
    if (!VALID_ACCOUNT_TYPES.has(acc.type)) {
      return { error: `chart_of_accounts[${i}].type invalid` };
    }
  }

  const t = r.tax_rules as TaxRules;
  if (!t || typeof t !== "object") return { error: "tax_rules object required" };
  if (typeof t.jurisdiction !== "string" || !/^[A-Z]{2}$/.test(t.jurisdiction)) {
    return { error: "tax_rules.jurisdiction required (ISO-3166-1 alpha-2)" };
  }
  if (!VALID_TAX_LABELS.has(t.tax_label)) {
    return { error: "tax_rules.tax_label invalid" };
  }
  if (!Array.isArray(t.reverse_charge_applicable_codes)) {
    return { error: "tax_rules.reverse_charge_applicable_codes array required (may be empty)" };
  }
  if (!Array.isArray(t.zero_rated_charges)) {
    return { error: "tax_rules.zero_rated_charges array required (may be empty)" };
  }

  return {
    invoice_id: (r.invoice_id as string) ?? null,
    invoice_lines: r.invoice_lines as InvoiceLine[],
    chart_of_accounts: r.chart_of_accounts as ChartAccount[],
    tax_rules: t,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return bad("POST only", 405);

  const logger = new Logger("llm-invoice-line-classify");

  const { user, error: authErr, supabaseClient } = await requireAuth(req, logger);
  if (authErr || !user) return bad(authErr ?? "auth failed", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("invalid JSON body");
  }
  const parsed = parseInputs(body);
  if ("error" in parsed) return bad(parsed.error);

  const { data: profile, error: profileErr } = await supabaseClient
    .from("user_roles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (profileErr || !profile?.tenant_id) {
    logger.error("tenant lookup failed", { user_id: user.id, err: profileErr?.message });
    return bad("tenant context not found", 403);
  }

  const gatewayUrl = Deno.env.get("LLM_GATEWAY_URL");
  if (!gatewayUrl) return bad("gateway not configured", 503);
  const serviceToken = Deno.env.get("LLM_GATEWAY_SERVICE_TOKEN");
  const platformId = Deno.env.get("LLM_GATEWAY_PLATFORM_ID") ?? "logic-nexus-ai";

  const subjectId = parsed.invoice_id || `invoice-classify-${crypto.randomUUID()}`;

  const startedAt = Date.now();
  const gatewayRes = await fetch(`${gatewayUrl.replace(/\/$/, "")}/v1/invoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(serviceToken ? { Authorization: `Bearer ${serviceToken}` } : {}),
      "X-Platform-Id": platformId,
      "X-Correlation-Id": req.headers.get("x-correlation-id") ?? crypto.randomUUID(),
    },
    body: JSON.stringify({
      tenant_id: profile.tenant_id,
      module: "finance",
      feature: "invoice.line_classify",
      prompt_key: PROMPT_KEY,
      variables: {
        invoice_lines: parsed.invoice_lines,
        chart_of_accounts: parsed.chart_of_accounts,
        tax_rules: parsed.tax_rules,
      },
      subject: { type: "invoice_draft", id: subjectId },
      required_capabilities: ["json_mode"],
    }),
  });

  const gatewayBody = await gatewayRes.json().catch(() => ({}));
  if (!gatewayRes.ok) {
    logger.error("gateway non-2xx", {
      status: gatewayRes.status,
      code: (gatewayBody as { error?: { code?: string } })?.error?.code,
      invoice_id: parsed.invoice_id,
      line_count: parsed.invoice_lines.length,
    });
    return new Response(JSON.stringify(gatewayBody), {
      status: gatewayRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result = gatewayBody as {
    invocation_id: string;
    output: unknown;
    cost_usd: number;
    latency_ms: number;
    warnings?: string[];
  };
  logger.info("invoice line classify completed", {
    user_id: user.id,
    tenant_id: profile.tenant_id,
    invoice_id: parsed.invoice_id,
    line_count: parsed.invoice_lines.length,
    chart_size: parsed.chart_of_accounts.length,
    jurisdiction: parsed.tax_rules.jurisdiction,
    invocation_id: result.invocation_id,
    cost_usd: result.cost_usd,
    latency_ms: result.latency_ms,
    wall_ms: Date.now() - startedAt,
  });

  return new Response(
    JSON.stringify({
      invocation_id: result.invocation_id,
      output: result.output,
      cost_usd: result.cost_usd,
      latency_ms: result.latency_ms,
      warnings: result.warnings,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
