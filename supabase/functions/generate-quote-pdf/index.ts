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
// @ts-ignore
import { fetchMglOptions } from "./engine/mgl-loader.ts";
import { isServiceRoleAuthorizationHeader, requireAuth } from "../_shared/auth.ts";
import { PDFDocument } from "pdf-lib";
// @ts-ignore
import JSZip from "https://esm.sh/jszip@3.10.1";
// @ts-ignore
import Handlebars from "https://esm.sh/handlebars@4.7.7";

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
    const bypassKey = Deno.env.get("TEST_BYPASS_KEY");
    const requestBypassKey = req.headers.get("x-bypass-key");

    const decodeBase64Url = (input: string) => {
        const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized + "===".slice((normalized.length + 3) % 4);
        return atob(padded);
    };

    const getJwtRole = (headerValue: string | null) => {
        if (!headerValue) return null;
        const token = headerValue.startsWith("Bearer ") ? headerValue.slice(7) : headerValue;
        const parts = token.split(".");
        if (parts.length < 2) return null;
        try {
            const payload = JSON.parse(decodeBase64Url(parts[1]));
            return payload?.role || payload?.app_metadata?.role || null;
        } catch {
            return null;
        }
    };

    const tokenRole = getJwtRole(authHeader);
    const hasServiceRoleClaim = tokenRole && ["service_role", "supabase_admin"].includes(String(tokenRole));
    
    const isServiceRole =
        isServiceRoleAuthorizationHeader(authHeader, serviceRoleKey) ||
        hasServiceRoleClaim ||
        (bypassKey && requestBypassKey && bypassKey === requestBypassKey);

    // If not service role (e.g. Webhook/Cron), require user auth
    if (!isServiceRole) {
        const { user, error } = await requireAuth(req, logger);
        if (error || !user) {
            const correlationId = logger.getCorrelationId();
            const authError = String(error || "Unauthorized");
            if (/missing configuration|SUPABASE_URL|SUPABASE_ANON_KEY|SUPABASE_PUBLISHABLE_KEY/i.test(authError)) {
              await logger.critical("PDF auth configuration invalid", {
                error: authError,
                hasAuthorizationHeader: Boolean(authHeader),
                correlation_id: correlationId,
              });
            } else {
              await logger.warn("PDF auth rejected", {
                error: authError,
                hasAuthorizationHeader: Boolean(authHeader),
                correlation_id: correlationId,
              });
            }
            return new Response(JSON.stringify({ error: "Unauthorized", ...(correlationId ? { correlation_id: correlationId } : {}) }), { 
                status: 401, 
                headers: { ...getCorsHeaders(req), "Content-Type": "application/json", ...(correlationId ? { "x-correlation-id": correlationId } : {}) } 
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
    const { templateId } = body;
    let { quoteId, versionId, store_result } = body;
    const forceRerender = Boolean(body?.force_rerender || body?.skip_cache);

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

    await log(`Generating PDF for Quote: ${quoteId}, Version: ${versionId}, Template: ${templateId || 'Auto-Detect'}`);

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

    const enrichOptionContainers = async (targetOptions: any[]) => {
      if (!Array.isArray(targetOptions) || targetOptions.length === 0) return;

      const unresolvedTypeIds = [
        ...new Set(
          targetOptions
            .filter((option) => option?.container_type_id && !option?.container_types?.code && !option?.container_types?.name)
            .map((option) => option.container_type_id),
        ),
      ];
      const unresolvedSizeIds = [
        ...new Set(
          targetOptions
            .filter((option) => option?.container_size_id && !option?.container_sizes?.code && !option?.container_sizes?.name)
            .map((option) => option.container_size_id),
        ),
      ];

      if (unresolvedTypeIds.length > 0) {
        const { data: typeRows, error: typeError } = await safeSelect(
          "container_types",
          "id, code, name",
          "id, code, name",
          (q) => q.in("id", unresolvedTypeIds),
          "manual option container types join",
        );
        if (!typeError && Array.isArray(typeRows)) {
          const typeMap = new Map(typeRows.map((row: any) => [row.id, row]));
          targetOptions.forEach((option: any) => {
            if (option?.container_type_id && typeMap.has(option.container_type_id)) {
              const match = typeMap.get(option.container_type_id);
              option.container_types = { code: match?.code, name: match?.name };
              option.container_type = option.container_type || match?.code || match?.name;
            }
          });
        }
      }

      if (unresolvedSizeIds.length > 0) {
        const { data: sizeRows, error: sizeError } = await safeSelect(
          "container_sizes",
          "id, code, name",
          "id, code, name",
          (q) => q.in("id", unresolvedSizeIds),
          "manual option container sizes join",
        );
        if (!sizeError && Array.isArray(sizeRows)) {
          const sizeMap = new Map(sizeRows.map((row: any) => [row.id, row]));
          targetOptions.forEach((option: any) => {
            if (option?.container_size_id && sizeMap.has(option.container_size_id)) {
              const match = sizeMap.get(option.container_size_id);
              option.container_sizes = { code: match?.code, name: match?.name };
              option.container_size = option.container_size || match?.code || match?.name;
            }
          });
        }
      }
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
        accounts (name, billing_street, billing_city, billing_state, billing_postal_code, billing_country, phone, email, account_number),
        contacts:contacts!contact_id (first_name, last_name, email, phone),
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
        const { data: latestVersion, error: _latestError } = await supabaseClient
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
      await enrichOptionContainers(options);
      await logger.info(`Fetched ${options.length} options for version ${versionId}`);

      // --- BACKWARD COMPATIBILITY: MGL Rate Options Support ---
      // If standard options are empty, try fetching from new MGL tables
      if (options.length === 0) {
        await logger.info("No standard options found. Checking for MGL Rate Options...");
        const mglOptions = await fetchMglOptions(supabaseClient, versionId, safeSelect, logger);
        if (mglOptions && mglOptions.length > 0) {
             options.push(...mglOptions);
        }
      }

      await logger.info(`Final option count after MGL check: ${options.length}`);
      
      // No need to fetch Legs/Charges again for MGL options as we built them above.
      // But we have a loop below "Fetch Legs and Charges for each option".
      // We should skip that loop for MGL options or make it safe.
      // The loop iterates `options`. Standard options have `opt.id` from DB. MGL options have synthetic IDs.
      // Standard fetch uses `quotation_version_option_legs` table which won't match synthetic IDs.
      // So we must modify the loop below to skip if legs/charges are already populated.

      // Fetch Legs and Charges for each option
      for (const opt of options) {
          // Skip if legs are already populated (e.g. MGL options)
          if (opt.legs && opt.legs.length > 0) continue;

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

    // --- TEMPLATE SELECTION LOGIC ---
    let templateContent = null;
    let selectedTemplateId = templateId; // from body

    // 1. If no body templateId, try quote.template_id
    if (!selectedTemplateId && (quote as any).template_id) {
        selectedTemplateId = (quote as any).template_id;
        await log(`Using Template ID from Quote: ${selectedTemplateId}`);
    }

    // 2. If we have an ID, fetch it
    if (selectedTemplateId) {
        templateContent = await getTemplate(supabaseClient, selectedTemplateId, logger);
    }

    // 3. If still no template, check for Multi-Modal heuristic
    if (!templateContent) {
        // Check if any option has > 1 leg OR distinct modes
        // We look at the legs we fetched
        const isMultiModal = options.some((opt: any) => {
             if (opt.legs && opt.legs.length > 1) return true;
             // Check if distinct transport modes exist across legs
             const modes = new Set(opt.legs.map((l: any) => l.mode || l.transport_mode));
             if (modes.size > 1) return true;
             return false;
        });

        if (isMultiModal) {
            await log("Detected Multi-Modal Quote. Attempting to load 'Standard Multi-Modal' template.");
            // Try to find the template by name
            let query = supabaseClient
                 .from("quote_templates")
                 .select("content, tenant_id, name")
                 .eq("name", "Standard Multi-Modal");
             
            if ((quote as any).tenant_id) {
                 query = query.or(`tenant_id.eq.${(quote as any).tenant_id},tenant_id.is.null`);
            } else {
                 query = query.is("tenant_id", null);
            }

            const { data: templates, error: mmError } = await query;
            
            let mmTemplate = null;
            if (templates && templates.length > 0) {
                 // Sort: tenant-specific first
                 templates.sort((a: any, b: any) => {
                     if (a.tenant_id && !b.tenant_id) return -1;
                     if (!a.tenant_id && b.tenant_id) return 1;
                     return 0;
                 });
                 mmTemplate = templates[0];
            }
            
            if (!mmError && mmTemplate && mmTemplate.content) {
                 templateContent = { ...mmTemplate.content, name: mmTemplate.name };
                 await log("Loaded 'Standard Multi-Modal' template.");
            } else {
                 await logWarn(`'Standard Multi-Modal' template not found or error: ${mmError?.message || 'Unknown'}`);
            }
        }
    }

    // 4. Try loading 'MGL-Main-Template' as the preferred default
    if (!templateContent) {
        await log("Attempting to load 'MGL-Main-Template' as preferred default.");
        let query = supabaseClient
             .from("quote_templates")
             .select("content, tenant_id, name")
             .eq("name", "MGL-Main-Template");
         
        if ((quote as any).tenant_id) {
             query = query.or(`tenant_id.eq.${(quote as any).tenant_id},tenant_id.is.null`);
        } else {
             query = query.is("tenant_id", null);
        }

        const { data: templates, error: defError } = await query;
        
        let defTemplate = null;
        if (templates && templates.length > 0) {
             // Sort: tenant-specific first
             templates.sort((a: any, b: any) => {
                 if (a.tenant_id && !b.tenant_id) return -1;
                 if (!a.tenant_id && b.tenant_id) return 1;
                 return 0;
             });
             defTemplate = templates[0];
        }
        
        if (!defError && defTemplate && defTemplate.content) {
             templateContent = { ...defTemplate.content, name: defTemplate.name };
             await log("Loaded 'MGL-Main-Template'.");
        } else {
             await logWarn(`'MGL-Main-Template' not found or error: ${defError?.message || 'Unknown'}`);
        }
    }

    // 5. Fallback to hardcoded DefaultTemplate
    if (!templateContent) {
         await log("Using Default Template (fallback)");
         templateContent = DefaultTemplate;
    }

    let branding: any = {};
    let brandingLogoBase64: string | undefined = undefined;

    // 1. Try fetching from tenant_profile (New Enhanced System)
    const tenantId = (quote as any).tenant_id;
    if (tenantId) {
        try {
            const { data: profileData, error: profileError } = await supabaseClient
                .from('tenant_profile')
                .select('*')
                .eq('tenant_id', tenantId)
                .maybeSingle();

            if (profileData) {
                 branding = {
                     ...branding,
                     company_name: profileData.legal_name || profileData.company_name,
                     company_address: profileData.registered_address || profileData.address,
                     tax_id: profileData.tax_id,
                     contact_email: profileData.contact_email,
                     contact_phone: profileData.contact_phone,
                     website: profileData.website,
                     logo_url: profileData.logo_url
                 };
                 await logger.info(`Using tenant_profile for tenant ${tenantId}`);
            } else if (profileError) {
                 await logger.warn(`Error fetching tenant_profile: ${profileError.message}`);
            }
        } catch (e: any) {
            await logger.warn(`Failed to fetch tenant_profile: ${e.message}`);
        }
    }

    // 2. Try fetching from quotation_configuration (System V2)
    if (tenantId) {
       try {
         const { data: configData } = await supabaseClient
            .from('quotation_configuration')
            .select('branding_settings')
            .eq('tenant_id', tenantId)
            .maybeSingle();
            
         if (configData?.branding_settings) {
            // Merge, preferring config over profile for specific branding settings
            branding = { ...branding, ...configData.branding_settings };
            await logger.info(`Using branding from quotation_configuration for tenant ${tenantId}`);
         }
       } catch (e: any) {
          await logger.warn(`Failed to fetch quotation_configuration: ${e.message}`);
       }
    }

    // 3. Fallback to tenant_branding (Legacy System) if new config is empty/missing key fields
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

    // Required Field Validation
    let missingFields: string[] = [];
    if (!quote.origin && !quote.origin_port_id) missingFields.push("Origin");
    if (!quote.destination && !quote.destination_port_id) missingFields.push("Destination");
    
    // Warn but do not block for Items/Incoterms/Validity to ensure PDF generation works
    if (!quote.items || quote.items.length === 0) {
        await logger.warn("Validation Warning: Commodity/Items missing. Proceeding with empty items.");
    }
    if (!quote.incoterms) {
        await logger.warn("Validation Warning: Incoterm missing. Proceeding.");
    } 
    if (!quote.expiration_date && !quote.valid_until) {
        await logger.warn("Validation Warning: Validity Date missing. Proceeding.");
    }

    // Check total freight on options if options exist
    if (options.length > 0) {
        const hasValidTotal = options.some((o: any) => {
            const total = Array.isArray(o.charges) 
                ? o.charges.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0)
                : (quote.total_amount || 0);
            return total > 0;
        });
        if (!hasValidTotal) {
             await logger.warn("Validation Warning: Total Freight is zero. Proceeding.");
        }
    }

    // Safety: Ensure we don't block on non-critical fields even if they somehow got into missingFields
    missingFields = missingFields.filter(f => !["Commodity/Items", "Validity Date", "Incoterms"].includes(f));

    if (missingFields.length > 0) {
        // Enforce strictly only for critical location fields
        await logger.warn(`Validation failed: Missing fields: ${missingFields.join(", ")}`);
        
        // Return 400 Bad Request with precise field-level error map
        return new Response(JSON.stringify({ 
            error: "Validation Failed", 
            issues: missingFields,
            message: `Missing required fields: ${missingFields.join(", ")}`
        }), {
            status: 400,
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
        });
    }

    if (branding.logo_url && typeof branding.logo_url === "string") {
        if (branding.logo_url.startsWith("data:image")) {
            brandingLogoBase64 = branding.logo_url;
        } else if (branding.logo_url.startsWith("http")) {
            try {
                const response = await fetch(branding.logo_url);
                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    let binary = '';
                    const bytes = new Uint8Array(arrayBuffer);
                    const len = bytes.byteLength;
                    const CHUNK_SIZE = 0x8000; // 32KB chunks to avoid stack overflow
                    for (let i = 0; i < len; i += CHUNK_SIZE) {
                        binary += String.fromCharCode.apply(
                            null,
                            // @ts-ignore
                            bytes.subarray(i, Math.min(i + CHUNK_SIZE, len))
                        );
                    }
                    const base64 = btoa(binary);
                    // Detect mime type or assume png/jpg based on extension or header
                    const contentType = response.headers.get("content-type") || "image/png";
                    brandingLogoBase64 = `data:${contentType};base64,${base64}`;
                    await logger.info(`Successfully fetched and converted logo from URL: ${branding.logo_url}`);
                } else {
                    await logger.warn(`Failed to fetch logo from URL: ${branding.logo_url} - Status: ${response.status}`);
                }
            } catch (e: any) {
                await logger.warn(`Error fetching logo from URL: ${e.message}`);
            }
        }
    }

    // Hard fallback to prevent pre-render validation failures when branding
    // records are incomplete across environments.
    branding.company_name = String(
      branding.company_name ||
      quote.accounts?.name ||
      (quote as any)?.tenant_name ||
      "Miami Global Lines",
    ).trim() || "Miami Global Lines";
    branding.company_address = String(branding.company_address || "").trim();
    branding.primary_color = branding.primary_color || "#0087b5";
    branding.secondary_color = branding.secondary_color || "#dceef2";
    branding.accent_color = branding.accent_color || "#000000";

    await log("Using V2 Rendering Engine");

    const mode = body.mode || 'single';
    let pdfBytes: Uint8Array | null = null;
    const finalWarnings: string[] = [];

    const createRawData = (option: any) => {
      const quoteItems = Array.isArray(quote.items) ? quote.items : [];
      const cargoDetails = (quote as any)?.cargo_details || {};
      const containerCombos = Array.isArray(cargoDetails?.container_combos) ? cargoDetails.container_combos : [];
      const cargoCommodity =
        cargoDetails?.commodity ||
        cargoDetails?.commodity_details?.description ||
        "General Cargo";
      const syntheticItemsFromCargo = containerCombos.map((combo: any) => ({
        sizeId: combo?.sizeId || combo?.size_id,
        typeId: combo?.typeId || combo?.type_id,
        quantity: combo?.quantity,
        commodity: cargoCommodity,
        total_weight: Number(cargoDetails?.total_weight_kg || 0),
        total_volume: Number(cargoDetails?.total_volume_cbm || 0),
        dimensions: cargoDetails?.dimensions || "N/A",
        is_hazmat: !!cargoDetails?.dangerous_goods,
        is_stackable: !!cargoDetails?.stackable,
      }));
      const mappedQuoteItems = mapQuoteItemsToRawItems(quoteItems);
      const mappedCargoComboItems = mapQuoteItemsToRawItems(syntheticItemsFromCargo);
      const comboDrivenItems = mappedCargoComboItems.length > 0
        ? [
            ...mappedCargoComboItems,
            ...mappedQuoteItems.filter((item: any) => {
              const duplicate = mappedCargoComboItems.some((comboItem: any) =>
                String(comboItem?.container_type || "").trim().toLowerCase() === String(item?.container_type || "").trim().toLowerCase() &&
                String(comboItem?.container_size || "").trim().toLowerCase() === String(item?.container_size || "").trim().toLowerCase() &&
                Number(comboItem?.quantity ?? comboItem?.qty ?? 0) === Number(item?.quantity ?? item?.qty ?? 0),
              );
              return !duplicate;
            }),
          ]
        : mappedQuoteItems;
      const mappedItems = comboDrivenItems;
      const fallbackItem = mappedItems.find((item: any) => item?.container_size || item?.container_type);

      const resolveOptionContainerSize = (opt: any) =>
        opt?.container_sizes?.code ||
        opt?.container_sizes?.name ||
        opt?.container_size?.code ||
        opt?.container_size?.name ||
        opt?.container_size_code ||
        opt?.container_size_name ||
        opt?.container_size ||
        fallbackItem?.container_size ||
        "N/A";

      const resolveOptionContainerType = (opt: any) =>
        opt?.container_types?.code ||
        opt?.container_types?.name ||
        opt?.container_type?.code ||
        opt?.container_type?.name ||
        opt?.container_type_code ||
        opt?.container_type_name ||
        opt?.container_type ||
        fallbackItem?.container_type ||
        "N/A";

      // Calculate option specific total if possible
      const optionTotal = Array.isArray(option?.charges) 
        ? option.charges.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0)
        : (quote.total_amount || 0);

      return {
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
          expiration_date: quote.expiration_date || quote.valid_until,
          status: quote.status,
          total_amount: optionTotal,
          currency: quote.currency || "USD",
          service_level: quote.service_level,
          notes: quote.notes,
          terms_conditions: quote.terms_conditions,
          origin: quote.origin,
          destination: quote.destination,
          incoterms: quote.incoterms,
        },
        customer: {
          company_name: quote.accounts?.name,
          contact_name: quote.contacts ? `${quote.contacts.first_name || ''} ${quote.contacts.last_name || ''}`.trim() : quote.accounts?.name,
          email: quote.contacts?.email || quote.accounts?.email || "",
          phone: quote.contacts?.phone || quote.accounts?.phone || "",
          address: [
            quote.accounts?.billing_street,
            quote.accounts?.billing_city,
            quote.accounts?.billing_country,
          ]
            .filter(Boolean)
            .join(", "),
          code: quote.accounts?.account_number || "",
          inquiry_number: quote.quote_number,
        },
        legs:
          option?.legs?.map((l: any) => ({
            sequence_id: l.sequence_id || 0,
            mode: l.mode || l.transport_mode || "Unknown",
            pol: l.origin?.location_name || "N/A",
            pod: l.destination?.location_name || "N/A",
            carrier: option.carriers?.carrier_name || l.carrier_name || "TBD",
            transit_time: l.transit_time || "",
          })) || [],
        charges:
          option?.charges?.map((c: any) => ({
            description: c.charge_name || c.category?.name || "Charge",
            amount: c.amount,
            currency: c.currency || "USD",
            type: c.charge_type,
            basis: c.basis,
            quantity: c.units,
            leg_id: c.leg_id,
            note: c.note || "",
          })) || [],
        items: mappedItems,
        options: options.map((o: any) => ({
          id: o.id,
          carrier: o.carriers?.carrier_name || 'Multi-Carrier',
          transit_time: o.transit_time_days ? `${o.transit_time_days} Days` : (o.legs?.map((l: any) => l.transit_time).filter(Boolean).join(" + ") || "N/A"),
          frequency: o.frequency || o.service_level || "Weekly", // Fallback to Weekly if missing
          container_size: resolveOptionContainerSize(o),
          container_type: resolveOptionContainerType(o),
          grand_total: Array.isArray(o.charges) 
            ? o.charges.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0)
            : 0,
          legs: o.legs?.map((l: any) => ({
             sequence_id: l.sequence_id || 0,
             mode: l.mode || l.transport_mode,
             pol: l.origin?.location_name,
             pod: l.destination?.location_name,
             carrier: o.carriers?.carrier_name || l.carrier_name,
             transit_time: l.transit_time,
             transport_mode: l.transport_mode || l.mode
          })) || [],
          charges: o.charges?.map((c: any) => ({
            description: c.description || c.charge_name || c.name || c.category?.name || "Charge",
            amount: Number(c.amount) || 0,
            currency: c.currency || "USD",
            note: c.note || ""
          })) || []
        }))
      };
    };

    const compileTemplateWithHandlebars = (template: any, data: any): any => {
        if (!template) return template;
        
        // Helper to compile a single value
        const compileValue = (val: any): any => {
            if (typeof val === 'string') {
                // Check if string contains {{ }}
                if (val.includes('{{')) {
                    try {
                        const compiled = Handlebars.compile(val);
                        return compiled(data);
                    } catch (e) {
                        return val;
                    }
                }
                return val;
            } else if (Array.isArray(val)) {
                return val.map(compileValue);
            } else if (typeof val === 'object' && val !== null) {
                const result: any = {};
                for (const key in val) {
                    result[key] = compileValue(val[key]);
                }
                return result;
            }
            return val;
        };

        // Clone first to avoid mutation
        const clone = JSON.parse(JSON.stringify(template));
        return compileValue(clone);
    };

    const ensureTemplateConfig = (template: any) => {
        const safeTemplate = template && typeof template === "object" ? template : {};
        const baseConfig = (DefaultTemplate as any)?.config || {};
        const templateConfigRaw = (safeTemplate as any)?.config;
        const templateConfig = templateConfigRaw && typeof templateConfigRaw === "object" ? templateConfigRaw : {};
        const sourceSections = Array.isArray((safeTemplate as any)?.sections) ? (safeTemplate as any).sections : [];
        const normalizedSections = sourceSections.flatMap((section: any) => {
            const gridFields = Array.isArray(section?.grid_fields) ? section.grid_fields : [];
            const hasFirstItemRefs = gridFields.some((field: any) => typeof field?.key === "string" && /^items\[0\]\./.test(field.key));
            const hasCargoLabels = gridFields.some((field: any) =>
              /equipment\s*type|quantity|cargo\s*description|weight|volume/i.test(String(field?.label || "")),
            );
            if (section?.type !== "key_value_grid" || !hasFirstItemRefs || !hasCargoLabels) {
              return [section];
            }

            const keptGridFields = gridFields.filter((field: any) => !(typeof field?.key === "string" && /^items\[0\]\./.test(field.key)));
            const normalizedGridSection = {
              ...section,
              grid_fields: keptGridFields,
            };
            const cargoItemsTableSection = {
              type: "dynamic_table",
              page_break_before: false,
              table_config: {
                source: "items",
                columns: [
                  { field: "sequence_number", label: "Seq", width: "10%", align: "center" },
                  { field: "container_type", label: "Type", width: "20%", align: "left" },
                  { field: "container_size", label: "Size", width: "15%", align: "center" },
                  { field: "quantity", label: "Qty", width: "10%", align: "center" },
                  { field: "commodity", label: "Commodity", width: "25%", align: "left" },
                  { field: "weight", label: "Weight (kg)", width: "10%", align: "right" },
                  { field: "volume", label: "Volume (cbm)", width: "10%", align: "right" },
                ],
                show_subtotals: false,
              },
            };
            return keptGridFields.length > 0 ? [normalizedGridSection, cargoItemsTableSection] : [cargoItemsTableSection];
        });
        return {
            ...safeTemplate,
            config: {
                ...baseConfig,
                ...templateConfig,
                margins: {
                    ...(baseConfig?.margins || {}),
                    ...(templateConfig?.margins || {}),
                },
                default_locale: templateConfig?.default_locale || baseConfig?.default_locale || "en-US",
            },
            sections: normalizedSections,
        };
    };

    const renderOptionToBytes = async (option: any) => {
        const rawData = createRawData(option);
        
        // Apply Handlebars compilation
        let effectiveTemplate = templateContent || DefaultTemplate;
        try {
             effectiveTemplate = compileTemplateWithHandlebars(effectiveTemplate, rawData);
        } catch (e: any) {
             await logger.warn(`Handlebars compilation failed: ${e.message}`);
        }
        effectiveTemplate = ensureTemplateConfig(effectiveTemplate);

        const { context, warnings } = buildSafeContextWithValidation(rawData, logger);
        if (warnings.length > 0) {
            finalWarnings.push(...warnings);
            await logWarn(`Warnings for option ${option.id}: ${warnings.join(", ")}`);
        }
        const renderer = new PdfRenderer(effectiveTemplate, context, logger);
        return await renderer.render();
    };

    const hasCargoContainerCombos =
      Array.isArray((quote as any)?.cargo_details?.container_combos) &&
      (quote as any).cargo_details.container_combos.length > 0;
    const skipCacheForCargoCombos = hasCargoContainerCombos;

    // Check for cached PDF first if single mode and not forcing re-render
    if (mode === 'single' && !store_result && !forceRerender && !skipCacheForCargoCombos && version && (version as any).storage_path) {
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
    } else if (skipCacheForCargoCombos) {
      await logger.info("Skipping cached PDF because cargo_details.container_combos must be freshly mapped into items");
    }

    let contentType = "application/pdf";
    let fileExtension = "pdf";

    if (!pdfBytes) {
        if (mode === 'consolidated' && options.length > 0) {
            await logger.info(`Generating Consolidated PDF for ${options.length} options`);
            const mergedPdf = await PDFDocument.create();
            
            // --- NEW: Generate Summary Page ---
            try {
                // 1. Create Summary Context
                // We pass an empty object for 'option' so legs/charges are empty in the main context,
                // but we manually populate the 'options' array for the summary table.
                const summaryRawData: any = createRawData({}); 
                summaryRawData.options = options.map((o: any) => ({
                    id: o.id,
                    grand_total: Array.isArray(o.charges) 
                        ? o.charges.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0)
                        : 0,
                    legs: o.legs,
                    charges: o.charges
                }));
                
                const { context: summaryContext } = buildSafeContextWithValidation(summaryRawData, logger);
                
                // 2. Create Summary Template (Clone & Modify)
                // We want a clean summary page: Header -> Summary Table -> Terms -> Footer
                const summaryTemplate = ensureTemplateConfig(
                    JSON.parse(JSON.stringify(templateContent || DefaultTemplate))
                );
                
                // Remove dynamic tables (items/charges) to avoid clutter
                summaryTemplate.sections = summaryTemplate.sections.filter((s: any) => 
                    s.type !== 'dynamic_table' && s.type !== 'static_block'
                );
                
                // Inject multi_rate_summary after Header
                const headerIdx = summaryTemplate.sections.findIndex((s: any) => s.type === 'header');
                const insertIdx = headerIdx >= 0 ? headerIdx + 1 : 0;
                
                summaryTemplate.sections.splice(insertIdx, 0, {
                    type: "multi_rate_summary",
                    height: 150,
                    page_break_before: false,
                    content: { text: "Quotation Options Summary" }
                });

                // Render Summary
                const summaryRenderer = new PdfRenderer(summaryTemplate, summaryContext, logger);
                const summaryBytes = await summaryRenderer.render();
                const summaryDoc = await PDFDocument.load(summaryBytes);
                const summaryPages = await mergedPdf.copyPages(summaryDoc, summaryDoc.getPageIndices());
                summaryPages.forEach((page: any) => mergedPdf.addPage(page));
                
                await logger.info("Added Summary Page to Consolidated PDF");
            } catch (e: any) {
                await logger.warn(`Failed to generate summary page: ${e.message}`);
            }
            // ----------------------------------

            for (const opt of options) {
                try {
                    const optBytes = await renderOptionToBytes(opt);
                    const optDoc = await PDFDocument.load(optBytes);
                    const copiedPages = await mergedPdf.copyPages(optDoc, optDoc.getPageIndices());
                    copiedPages.forEach((page: any) => mergedPdf.addPage(page));
                } catch (e: any) {
                    await logger.error(`Failed to render option ${opt.id}: ${e.message}`);
                    // Continue with other options? Or fail?
                    // Let's continue but log error
                }
            }
            pdfBytes = await mergedPdf.save();
        } else if (mode === 'individual' && options.length > 0) {
            await logger.info(`Generating Individual PDFs for ${options.length} options (ZIP output)`);
            contentType = "application/zip";
            fileExtension = "zip";
            // @ts-ignore
            const zip = new JSZip();
            
            for (let i = 0; i < options.length; i++) {
                const opt = options[i];
                try {
                    const optBytes = await renderOptionToBytes(opt);
                    const fileName = `Quote-${quote.quote_number || 'draft'}-RateOption-${i + 1}.pdf`;
                    zip.file(fileName, optBytes);
                } catch (e: any) {
                    const errMsg = `Failed to render option ${opt.id}: ${e.message}`;
                    await logger.error(errMsg);
                    finalWarnings.push(errMsg);
                }
            }
            
            // Generate ZIP
            pdfBytes = await zip.generateAsync({ type: "uint8array" });
        } else {
            // Single Mode
            const selectedOption =
                options.find((o: any) => Array.isArray(o.charges) && o.charges.length > 0) ||
                (options.length > 0 ? options[0] : null);
            
            if (selectedOption) {
                pdfBytes = await renderOptionToBytes(selectedOption);
            } else {
                // No options found? Render with empty option to show header/items at least
                await logger.warn("No options found for quote. Rendering generic PDF.");
                pdfBytes = await renderOptionToBytes({});
            }
        }
        
        if (finalWarnings.length > 0) {
            (body as any).__pdf_warnings = [...new Set(finalWarnings)];
        }
    }

    if (!pdfBytes) {
        throw new Error("Failed to generate PDF content");
    }

    const traceId = body?.trace_id;
    const idem = body?.idempotency_key;

    if (store_result) {
      const fileName = `${quoteId}/${versionId || "latest"}_${Date.now()}.${fileExtension}`;
      const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from("quotations")
        .upload(fileName, pdfBytes, {
          contentType: contentType,
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
        filename: `quote_${quote.quote_number || "draft"}.${fileExtension}`,
        contentType: contentType,
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
