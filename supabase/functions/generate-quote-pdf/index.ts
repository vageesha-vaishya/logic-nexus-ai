import { serveWithLogger } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
// @ts-ignore
import { PdfRenderer } from "./engine/renderer.ts";
// @ts-ignore
import { buildSafeContextWithValidation, mapQuoteItemsToRawItems, ValidationBlockError } from "./engine/context.ts";
// @ts-ignore
import { fetchQuoteItemsWithFallbacks } from "./engine/item-loader.ts";
// @ts-ignore
import { DefaultTemplate } from "./engine/default_template.ts";
// @ts-ignore
import { getTemplate } from "./engine/template-service.ts";
import { requireAuth } from "../_shared/auth.ts";

declare const Deno: any;

serveWithLogger(async (req, logger, adminSupabase) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: getCorsHeaders(req) });
    }

    // 1. Determine Auth Context
    let supabaseClient = adminSupabase;
    let authenticatedUserId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const isServiceRole = authHeader && serviceRoleKey && authHeader.includes(serviceRoleKey);

    // If not service role (e.g. Webhook/Cron), require user auth
    if (!isServiceRole) {
        const { user, error } = await requireAuth(req, logger);
        if (error || !user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { 
                status: 401, 
                headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } 
            });
        }
        authenticatedUserId = user.id;
        // Use admin client for data loading; enforce access explicitly below.
        supabaseClient = adminSupabase;
    }

    const traceLogs: string[] = [];
    const log = async (msg: string) => {
        traceLogs.push(msg);
        await logger.info(msg);
    };
    const logWarn = async (msg: string) => {
        traceLogs.push(`WARN: ${msg}`);
        await logger.warn(msg);
    };

    const body = await req.json();
    const { templateId, template, engine_v2 } = body;
    let { quoteId, versionId, store_result } = body;

    // Handle Database Webhook Payload
    if (body.type === 'INSERT' || body.type === 'UPDATE') {
         // It's likely a database webhook
         if (body.table === 'quotation_versions' && body.record) {
             versionId = body.record.id;
             quoteId = body.record.quote_id;
             store_result = true; // Auto-store if triggered by DB
             await log(`Triggered by DB Webhook: Version=${versionId}, Quote=${quoteId}`);
         } else if (body.table === 'quotes' && body.record) {
             quoteId = body.record.id;
             store_result = true;
             await log(`Triggered by DB Webhook: Quote=${quoteId}`);
         }
    }

    if (!quoteId) {
      throw new Error("Missing quoteId");
    }

    await log(`Generating PDF for Quote: ${quoteId}, Version: ${versionId}, Template: ${templateId}`);

    // Fetch Template (with Caching)
    let templateContent = null;
    if (templateId) {
        templateContent = await getTemplate(supabaseClient, templateId, logger);
    }
    
    // Default fallback template
    if (!templateContent) {
         await log("Using Default Template (fallback)");
         templateContent = DefaultTemplate;
    }

    // Helper: retry query with fallback selector when schema differs across environments
    const safeSelect = async (
      table: string,
      primarySelect: string,
      fallbackSelect: string,
      apply: (q: any) => any,
      context: string,
    ): Promise<{ data: any; error: any }> => {
      let query = supabaseClient.from(table).select(primarySelect);
      query = apply(query);
      const { data, error } = await query;
      if (!error) return { data, error: null };

      const msg = String(error?.message || '');
      if (/does not exist|relationship|column|schema cache/i.test(msg) && fallbackSelect !== primarySelect) {
        await logger.warn(`${context}: primary select failed, using fallback`, { error: msg });
        let fallbackQuery = supabaseClient.from(table).select(fallbackSelect);
        fallbackQuery = apply(fallbackQuery);
        const fallback = await fallbackQuery;
        return { data: fallback.data, error: fallback.error };
      }
      return { data, error };
    };

    // Fetch Charge Sides for Filtering
    const { data: sides, error: sidesError } = await supabaseClient
      .from("charge_sides")
      .select("id, code, name");

    if (sidesError) {
      await logger.error(`Error fetching charge sides: ${sidesError.message}`);
      throw new Error("Failed to resolve charge sides for PDF generation");
    }

    const sellSideId = sides?.find(
      (s: any) => s.code === "sell" || s.name === "Sell"
    )?.id;

    if (!sellSideId) {
      await logger.error(
        "Charge side 'sell' not found in charge_sides table. Aborting PDF generation to avoid exposing buy-side data."
      );
      throw new Error(
        "Unable to resolve sell-side charge configuration. Please contact support."
      );
    }

    await logger.info(`Sell Side ID: ${sellSideId}`);

    // Fetch Quote Data (without embedding items to avoid view relationship issues)
    const { data: quote, error: quoteError } = await supabaseClient
      .from("quotes")
      .select(`
        *,
        accounts (name, billing_street, billing_city, billing_state, billing_postal_code, billing_country, phone),
        origin:ports_locations!origin_port_id(location_name, country_id),
        destination:ports_locations!destination_port_id(location_name, country_id)
      `)
      .eq("id", quoteId)
      .single();

    if (quoteError) throw new Error(`Error fetching quote: ${quoteError.message}`);
    if (!quote) throw new Error("Quote not found");

    // Explicit tenant/franchise access checks for authenticated user context.
    if (authenticatedUserId) {
      const { data: userRoles, error: rolesError } = await adminSupabase
        .from("user_roles")
        .select("role, tenant_id, franchise_id")
        .eq("user_id", authenticatedUserId);

      if (rolesError) {
        await logger.error(`Error resolving user roles: ${rolesError.message}`);
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const roles = Array.isArray(userRoles) ? userRoles : [];
      const hasPlatformScope = roles.some((r: any) =>
        ["platform_admin", "super_admin"].includes(String(r?.role || "").toLowerCase())
      );

      if (!hasPlatformScope) {
        const quoteTenantId = (quote as any)?.tenant_id || null;
        const quoteFranchiseId = (quote as any)?.franchise_id || null;
        const hasTenantAccess = roles.some((r: any) => {
          const roleTenant = r?.tenant_id || null;
          const roleFranchise = r?.franchise_id || null;
          if (!quoteTenantId) return true;
          if (roleTenant !== quoteTenantId) return false;
          if (quoteFranchiseId && roleFranchise && roleFranchise !== quoteFranchiseId) return false;
          return true;
        });

        if (!hasTenantAccess) {
          await logger.warn("PDF access denied by tenant/franchise scope", {
            user_id: authenticatedUserId,
            quote_id: quoteId,
            quote_tenant_id: (quote as any)?.tenant_id || null,
            quote_franchise_id: (quote as any)?.franchise_id || null,
          });
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          });
        }
      }
    }

    // Fetch Quote Items separately with schema/table fallbacks.
    quote.items = await fetchQuoteItemsWithFallbacks(quoteId, safeSelect, logger);
    
    await logger.info(`Fetched ${quote.items.length} quote items. First item sizes: ${JSON.stringify(quote.items[0]?.container_sizes)}`);

    // Fetch Version Data (if provided or default to latest)
    let version = null;
    let options: any[] = [];
    
    if (!versionId) {
        // Try to find the latest active version
        const { data: latestVersion, error: latestError } = await supabaseClient
            .from("quotation_versions")
            .select("*")
            .eq("quote_id", quoteId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
            
        if (latestVersion) {
            versionId = latestVersion.id;
            await logger.info(`No versionId provided, using latest version: ${versionId}`);
        } else {
             await logger.warn(`No versionId provided and no version found for quote ${quoteId}`);
        }
    }

    if (versionId) {
      const { data: vData, error: vError } = await supabaseClient
        .from("quotation_versions")
        .select("*")
        .eq("id", versionId)
        .single();
      
      if (vError) throw new Error(`Error fetching version: ${vError.message}`);
      version = vData;

      // Fetch Options separately
      const { data: oData, error: oError } = await safeSelect(
        "quotation_version_options",
        `
            *,
            carriers(carrier_name),
            container_sizes(name, code),
            container_types(name, code)
        `,
        `*`,
        (q) => q.eq("quotation_version_id", versionId),
        "quotation_version_options fetch",
      );
        
      if (oError) {
           await logger.error(`Error fetching options: ${oError.message}`);
           throw new Error(`Error fetching options: ${oError.message}`);
      }
      
      options = oData || [];
      await logger.info(`Fetched ${options.length} options for version ${versionId}`);


      // Fetch Legs and Charges for each option
      for (const opt of options) {
          // Legs
          const { data: legs, error: legsError } = await safeSelect(
              "quotation_version_option_legs",
              `
                  *,
                  origin:ports_locations!origin_location_id(location_name),
                  destination:ports_locations!destination_location_id(location_name)
              `,
              `*`,
              (q) => q.eq("quotation_version_option_id", opt.id),
              `legs fetch for option ${opt.id}`,
          );
          
          if (legsError) await logger.warn(`Error fetching legs for option ${opt.id}: ${legsError.message}`);
          opt.legs = legs || [];

          // Charges
          const { data: charges, error: chargesError } = await safeSelect(
              "quote_charges",
              "*, category:charge_categories(name)",
              "*",
              (q) => {
                let query = q.eq("quote_option_id", opt.id);
                if (sellSideId) query = query.eq("charge_side_id", sellSideId);
                return query;
              },
              `charges fetch for option ${opt.id}`,
          );
          const finalCharges = charges || [];
          
          if (!chargesError && sellSideId && Array.isArray(finalCharges) && finalCharges.length === 0) {
             await logger.warn(`Sell-side charge filter returned zero charges for option ${opt.id} (sellSideId=${sellSideId})`);
          }
          
          if (chargesError) await logger.warn(`Error fetching charges for option ${opt.id}: ${chargesError.message}`);
          opt.charges = finalCharges;
          await logger.info(`Option ${opt.id}: ${opt.legs.length} legs, ${opt.charges.length} charges. SellSideId: ${sellSideId}`);
          if (opt.charges.length > 0) {
             await logger.info(`First Charge: LegID=${opt.charges[0].leg_id}, SideID=${opt.charges[0].charge_side_id}, Amount=${opt.charges[0].amount}, Note=${opt.charges[0].note}`);
          } else {
             await logger.warn(`No charges found for option ${opt.id}`);
          }
      }
    }

    let branding: any = {};
    let brandingLogoBase64: string | undefined = undefined;

    // 1. Try fetching from quotation_configuration (New System)
    const tenantId = (quote as any).tenant_id;
    if (tenantId) {
       try {
         const { data: configData } = await supabaseClient
            .from('quotation_configuration')
            .select('branding_settings')
            .eq('tenant_id', tenantId)
            .maybeSingle();
            
         if (configData?.branding_settings) {
            branding = configData.branding_settings;
            await logger.info(`Using branding from quotation_configuration for tenant ${tenantId}`);
         }
       } catch (e: any) {
          await logger.warn(`Failed to fetch quotation_configuration: ${e.message}`);
       }
    }

    // 2. Fallback to tenant_branding (Legacy System) if new config is empty/missing key fields
    if (!branding.company_name && !branding.logo_url) {
        try {
          let brandingQuery = supabaseClient.from("tenant_branding").select("*");
          if (tenantId) {
            brandingQuery = brandingQuery.eq("tenant_id", tenantId);
          } else {
            brandingQuery = brandingQuery.eq("company_name", "Miami Global Lines");
          }
          const { data: legacyData, error: legacyError } = await brandingQuery.maybeSingle();
          
          if (!legacyError && legacyData) {
             branding = { ...branding, ...legacyData }; 
             await logger.info(`Using legacy tenant_branding fallback for tenant ${tenantId}`);
          } else if (legacyError) {
             await logger.warn(`Error fetching legacy branding: ${legacyError.message}`);
          }
        } catch (e: any) {
           await logger.warn(`Legacy branding fetch failed: ${e?.message || String(e)}`);
        }
    }

    if (branding.logo_url && typeof branding.logo_url === "string" && branding.logo_url.startsWith("data:image")) {
        brandingLogoBase64 = branding.logo_url;
    }

    await log("Using V2 Rendering Engine");

    const selectedOption =
      options.find((o: any) => Array.isArray(o.charges) && o.charges.length > 0) ||
      (options.length > 0 ? options[0] : null);

    const rawData = {
      branding: {
        logo_url: branding.logo_url,
        logo_base64: brandingLogoBase64,
        primary_color: branding.primary_color,
        secondary_color: branding.secondary_color,
        accent_color: branding.accent_color,
        company_name: branding.company_name || (quote.accounts?.name || 'Nexus Logistics'),
        company_address: branding.company_address,
        font_family: branding.font_family,
        header_text: branding.header_text,
        sub_header_text: branding.sub_header_text,
        footer_text: branding.footer_text,
        disclaimer_text: branding.disclaimer_text,
      },
      quote: {
        quote_number: quote.quote_number,
        created_at: quote.created_at,
        expiration_date: quote.expiration_date,
        status: quote.status,
        total_amount: quote.total_amount,
        currency: quote.currency || "USD",
        service_level: quote.service_level,
        notes: quote.notes,
        terms_conditions: quote.terms_conditions,
      },
      customer: {
        company_name: quote.accounts?.name,
        contact_name: quote.accounts?.name,
        email: "",
        address: [
          quote.accounts?.billing_street,
          quote.accounts?.billing_city,
          quote.accounts?.billing_country,
        ]
          .filter(Boolean)
          .join(", "),
      },
      legs:
        selectedOption?.legs?.map((l: any) => ({
          sequence_id: l.sequence_id || 0,
          mode: l.mode,
          pol: l.origin?.location_name,
          pod: l.destination?.location_name,
          carrier: selectedOption.carriers?.carrier_name,
          transit_time: l.transit_time,
        })) || [],
      charges:
        selectedOption?.charges?.map((c: any) => ({
          description: c.charge_name || c.category?.name || "Charge",
          amount: c.amount,
          currency: c.currency || "USD",
          type: c.charge_type,
          basis: c.basis,
          quantity: c.units,
          leg_id: c.leg_id,
        })) || [],
      items: mapQuoteItemsToRawItems(quote.items),
    };

    let pdfBytes: Uint8Array | null = null;

    if (!store_result && version && (version as any).storage_path) {
      try {
        const storagePath = (version as any).storage_path as string;
        const { data: file, error: downloadError } = await supabaseClient.storage
          .from("quotations")
          .download(storagePath);

        if (!downloadError && file) {
          const arrayBuffer = await file.arrayBuffer();
          pdfBytes = new Uint8Array(arrayBuffer);
          await logger.info(`Using cached PDF from storage path ${storagePath}`);
        } else if (downloadError) {
          await logger.warn(`Failed to download cached PDF from ${storagePath}: ${downloadError.message}`);
        }
      } catch (e: any) {
        await logger.warn(`Cached PDF retrieval failed: ${e?.message || String(e)}`);
      }
    }

    if (!pdfBytes) {
      const { context, warnings } = buildSafeContextWithValidation(rawData, logger);
      if (warnings.length > 0) {
        await logWarn(`PDF pre-render warnings (${warnings.length}): ${warnings.slice(0, 5).join(" | ")}${warnings.length > 5 ? " | ..." : ""}`);
      }
      const renderer = new PdfRenderer(templateContent || DefaultTemplate, context, logger);
      pdfBytes = await renderer.render();
      if (warnings.length > 0) {
        (body as any).__pdf_warnings = warnings;
      }
    }

    const traceId = body?.trace_id;
    const idem = body?.idempotency_key;

    if (store_result) {
      const fileName = `${quoteId}/${versionId || "latest"}_${Date.now()}.pdf`;
      const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from("quotations")
        .upload(fileName, pdfBytes, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) {
        await logger.error(`Upload failed: ${uploadError.message}`);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      const fullPath = uploadData.path;

      if (versionId) {
        await supabaseClient
          .from("quotation_versions")
          .update({ storage_path: fullPath })
          .eq("id", versionId);
      }

      try {
        await supabaseClient.from("audit_logs").insert({
          action: "EVENT:PdfGenerated",
          resource_type: "quotation",
          details: {
            trace_id: traceId || null,
            idempotency_key: idem || null,
            quote_id: quoteId,
            version_id: versionId || null,
          },
        });
      } catch (_e) {
        await logger.warn("Audit log insert failed for PdfGenerated");
      }

      return new Response(
        JSON.stringify({
          success: true,
          path: fullPath,
          message: "PDF generated and stored successfully",
        }),
        {
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        },
      );
    }

    let binary = "";
    const len = pdfBytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(pdfBytes[i]);
    }
    const base64Pdf = btoa(binary);

    try {
      await supabaseClient.from("audit_logs").insert({
        action: "EVENT:PdfGenerated",
        resource_type: "quotation",
        details: {
          trace_id: traceId || null,
          idempotency_key: idem || null,
          quote_id: quoteId,
          version_id: versionId || null,
        },
      });
    } catch (_e) {
      await logger.warn("Audit log insert failed for PdfGenerated");
    }

    return new Response(
      JSON.stringify({
        content: base64Pdf,
        filename: `quote_${quote.quote_number || "draft"}.pdf`,
        contentType: "application/pdf",
        issues: Array.isArray((body as any).__pdf_warnings) ? (body as any).__pdf_warnings : [],
        traceLogs: traceLogs,
      }),
      {
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/json",
          "X-Trace-Logs": JSON.stringify(traceLogs),
        },
      },
    );
  } catch (error: any) {
    logger.error("Critical Error in generate-quote-pdf", { error });

    if (error instanceof ValidationBlockError) {
      return new Response(
        JSON.stringify({ error: error.message, issues: error.issues }),
        {
          status: 400,
          headers: {
            ...getCorsHeaders(req),
            "Content-Type": "application/json",
          },
        },
      );
    }

    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

}, "generate-quote-pdf");
