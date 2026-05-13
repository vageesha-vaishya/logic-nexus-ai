import { serveWithLogger } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireServiceRoleOrAdmin } from "../_shared/auth.ts";

const DEFAULT_BATCH_SIZE = 500;
const MAX_BATCH_SIZE = 5000;

type JsonRecord = Record<string, unknown>;

function toText(value: unknown): string {
  return String(value ?? "").trim();
}

function parseAssemblyModelId(raw: unknown): string | null {
  if (typeof raw === "string") {
    const normalized = raw.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (Array.isArray(raw) && raw.length > 0) {
    const first = raw[0];
    if (typeof first === "string") {
      const normalized = first.trim();
      return normalized.length > 0 ? normalized : null;
    }
    if (first && typeof first === "object") {
      const id = toText((first as JsonRecord).id ?? (first as JsonRecord).assembly_model_id);
      return id || null;
    }
  }

  if (raw && typeof raw === "object") {
    const id = toText((raw as JsonRecord).id ?? (raw as JsonRecord).assembly_model_id);
    return id || null;
  }

  return null;
}

serveWithLogger(async (req, logger, supabase) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });

  const access = await requireServiceRoleOrAdmin(req, supabase, logger);
  if (!access.authorized) {
    return new Response(JSON.stringify({ error: access.error || "Unauthorized" }), {
      status: access.status,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    const requestUrl = new URL(req.url);
    const templateId = toText(requestUrl.searchParams.get("template_id"));
    const dryRun = String(requestUrl.searchParams.get("dry_run") || "").toLowerCase() === "true";
    const batchSizeInput = Number(requestUrl.searchParams.get("batch_size") || DEFAULT_BATCH_SIZE);
    const batchSize = Number.isFinite(batchSizeInput) && batchSizeInput > 0
      ? Math.min(Math.floor(batchSizeInput), MAX_BATCH_SIZE)
      : DEFAULT_BATCH_SIZE;

    let templateQuery = supabase
      .from("aircraft_template")
      .select("id,tenant_id,franchise_id,assembly_models,model_json")
      .order("id", { ascending: true })
      .limit(batchSize);

    if (templateId) {
      templateQuery = templateQuery.eq("id", templateId);
    }

    const { data: templateRows, error: templateError } = await templateQuery;
    if (templateError) throw templateError;

    const templates = Array.isArray(templateRows) ? (templateRows as JsonRecord[]) : [];
    if (templates.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No aircraft_template rows matched.", total_rows: 0 }), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const assemblyModelIds = Array.from(
      new Set(
        templates
          .map((row) => parseAssemblyModelId(row.assembly_models))
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const modelById = new Map<string, JsonRecord>();
    if (assemblyModelIds.length > 0) {
      const { data: modelRows, error: modelError } = await supabase
        .from("assembly_models")
        .select("id,name,manufacturer_id,aircraft_category_id")
        .in("id", assemblyModelIds);
      if (modelError) throw modelError;
      for (const row of Array.isArray(modelRows) ? (modelRows as JsonRecord[]) : []) {
        const id = toText(row.id);
        if (id) modelById.set(id, row);
      }
    }

    const manufacturerIds = Array.from(
      new Set(
        Array.from(modelById.values())
          .map((row) => toText(row.manufacturer_id))
          .filter(Boolean),
      ),
    );
    const categoryIds = Array.from(
      new Set(
        Array.from(modelById.values())
          .map((row) => toText(row.aircraft_category_id))
          .filter(Boolean),
      ),
    );

    const manufacturerNameById = new Map<string, string>();
    if (manufacturerIds.length > 0) {
      const { data: manufacturerRows, error: manufacturerError } = await supabase
        .from("manufacturers")
        .select("id,name")
        .in("id", manufacturerIds);
      if (manufacturerError) throw manufacturerError;
      for (const row of Array.isArray(manufacturerRows) ? (manufacturerRows as JsonRecord[]) : []) {
        const id = toText(row.id);
        if (id) manufacturerNameById.set(id, toText(row.name));
      }
    }

    const categoryNameById = new Map<string, string>();
    if (categoryIds.length > 0) {
      const { data: categoryRows, error: categoryError } = await supabase
        .from("aircraft_categories")
        .select("id,name")
        .in("id", categoryIds);
      if (categoryError) throw categoryError;
      for (const row of Array.isArray(categoryRows) ? (categoryRows as JsonRecord[]) : []) {
        const id = toText(row.id);
        if (id) categoryNameById.set(id, toText(row.name));
      }
    }

    let updatedRows = 0;
    let skippedRows = 0;
    const failures: Array<{ template_id: string; reason: string }> = [];

    for (const template of templates) {
      const currentTemplateId = toText(template.id);
      const assemblyModelId = parseAssemblyModelId(template.assembly_models);
      if (!currentTemplateId || !assemblyModelId) {
        skippedRows += 1;
        continue;
      }

      const model = modelById.get(assemblyModelId);
      if (!model) {
        failures.push({ template_id: currentTemplateId, reason: `assembly_models ${assemblyModelId} not found in assembly_models table` });
        continue;
      }

      const manufacturerId = toText(model.manufacturer_id);
      const categoryId = toText(model.aircraft_category_id);
      const payloadEntry: JsonRecord = {
        assembly_model_id: assemblyModelId,
        assembly_model_name: toText(model.name),
        manufacturer_id: manufacturerId,
        manufacturer_name: manufacturerNameById.get(manufacturerId) ?? "",
        aircraft_category_name: categoryNameById.get(categoryId) ?? "",
        // backward-compatible aliases
        "Manufacturer Name": manufacturerNameById.get(manufacturerId) ?? "",
        aircraft_categorie_name: categoryNameById.get(categoryId) ?? "",
      };

      const nextModelJson = [payloadEntry];
      const existingModelJson = Array.isArray(template.model_json) ? template.model_json : [];
      if (JSON.stringify(existingModelJson) === JSON.stringify(nextModelJson)) {
        skippedRows += 1;
        continue;
      }

      if (!dryRun) {
        const { error: updateError } = await supabase
          .from("aircraft_template")
          .update({ model_json: nextModelJson })
          .eq("id", currentTemplateId);
        if (updateError) {
          failures.push({ template_id: currentTemplateId, reason: updateError.message });
          continue;
        }
      }

      updatedRows += 1;
    }

    return new Response(
      JSON.stringify({
        success: true,
        template_id: templateId || null,
        dry_run: dryRun,
        total_rows: templates.length,
        updated_rows: updatedRows,
        skipped_rows: skippedRows,
        failed_rows: failures.length,
        failures,
      }),
      {
        headers: { ...headers, "Content-Type": "application/json" },
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await logger.error("Failed to update aircraft_template.model_json", { error: message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
}, "update-aircraft-template-model-json");

