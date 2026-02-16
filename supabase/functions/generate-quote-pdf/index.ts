import { serveWithLogger } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { PdfRenderer } from "./engine/renderer.ts";
import { buildSafeContext, mapQuoteItemsToRawItems } from "./engine/context.ts";
import { DefaultTemplate } from "./engine/default_template.ts";
import { getTemplate } from "./engine/template-service.ts";

console.log("Hello from generate-quote-pdf!");

serveWithLogger(async (req, logger, supabaseClient) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: getCorsHeaders(req) });
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

    // Fetch Quote Items separately
    const { data: items, error: itemsError } = await supabaseClient
      .from("quote_items")
      .select(`
        *,
        container_sizes (code, name),
        container_types (code, name),
        master_commodities (name)
      `)
      .eq("quote_id", quoteId);
    
    if (itemsError) throw new Error(`Error fetching items: ${itemsError.message}`);
    quote.items = items || [];
    
    await logger.info(`Fetched ${quote.items.length} quote items. First item sizes: ${JSON.stringify(quote.items[0]?.container_sizes)}`);

    // Fetch Version Data (if provided or default to latest)
    let version = null;
    let options = [];
    
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
      const { data: oData, error: oError } = await supabaseClient
        .from("quotation_version_options")
        .select(`
            *,
            carriers(carrier_name),
            container_sizes(name, code),
            container_types(name, code)
        `)
        .eq("quotation_version_id", versionId);
        
      if (oError) {
           await logger.error(`Error fetching options: ${oError.message}`);
           throw new Error(`Error fetching options: ${oError.message}`);
      }
      
      options = oData || [];
      await logger.info(`Fetched ${options.length} options for version ${versionId}`);


      // Fetch Legs and Charges for each option
      for (const opt of options) {
          // Legs
          const { data: legs, error: legsError } = await supabaseClient
              .from("quotation_version_option_legs")
              .select(`
                  *,
                  origin:ports_locations!origin_location_id(location_name),
                  destination:ports_locations!destination_location_id(location_name)
              `)
              .eq("quotation_version_option_id", opt.id);
          
          if (legsError) await logger.warn(`Error fetching legs for option ${opt.id}: ${legsError.message}`);
          opt.legs = legs || [];

          // Charges
          let chargesQuery = supabaseClient
              .from("quote_charges")
              .select("*, category:charge_categories(name)")
              .eq("quote_option_id", opt.id);

          if (sellSideId) {
             chargesQuery = chargesQuery.eq("charge_side_id", sellSideId);
          }
          
          const { data: charges, error: chargesError } = await chargesQuery;
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

    let branding: any = null;
    let brandingLogoBase64: string | undefined = undefined;

    try {
      const tenantBrandingId = (quote as any).tenant_id;
      let brandingQuery = supabaseClient.from("tenant_branding").select("*");
      if (tenantBrandingId) {
        brandingQuery = brandingQuery.eq("tenant_id", tenantBrandingId);
      } else {
        brandingQuery = brandingQuery.eq("company_name", "Miami Global Lines");
      }
      const { data: brandingData, error: brandingError } = await brandingQuery.single();
      if (!brandingError && brandingData) {
        branding = brandingData;
        if (branding.logo_url && typeof branding.logo_url === "string" && branding.logo_url.startsWith("data:image")) {
          brandingLogoBase64 = branding.logo_url;
        }
        await logger.info(`Fetched branding for: ${branding.company_name}`);
      } else if (brandingError) {
        await logger.warn(`Error fetching branding: ${brandingError.message}`);
      }
    } catch (e: any) {
      await logger.warn(`Branding fetch failed: ${e?.message || String(e)}`);
    }

    await log("Using V2 Rendering Engine");

    const selectedOption =
      options.find((o: any) => Array.isArray(o.charges) && o.charges.length > 0) ||
      (options.length > 0 ? options[0] : null);
    const brandingObj = branding || {};
    const logoBase64 = brandingLogoBase64;

    const rawData = {
      branding: {
        ...brandingObj,
        logo_base64: logoBase64,
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

    const context = buildSafeContext(rawData);
    const renderer = new PdfRenderer(templateContent || DefaultTemplate, context);
    const pdfBytes = await renderer.render();

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
    console.error("Critical Error in generate-quote-pdf:", error);
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

}, "generate-quote-pdf");
