import { serveWithLogger } from "../_shared/logger.ts";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getCorsHeaders } from "../_shared/cors.ts";

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

    let { quoteId, versionId, templateId, template } = await req.json();

    if (!quoteId) {
      throw new Error("Missing quoteId");
    }

    await log(`Generating PDF for Quote: ${quoteId}, Version: ${versionId}, Template: ${templateId}`);

    // Fetch Template
    let templateContent = null;
    if (templateId) {
        const { data: tData, error: tError } = await supabaseClient
            .from("quote_templates")
            .select("content")
            .eq("id", templateId)
            .single();
        
        if (tError) {
             await logger.warn(`Error fetching template: ${tError.message}`);
        } else if (tData) {
            templateContent = tData.content;
        }
    }
    
    // Default fallback template
    if (!templateContent) {
         templateContent = {
          layout: "mgl_granular",
          header: { show_logo: true, company_info: true, title: "QUOTATION" },
          sections: [
              { type: "customer_matrix_header", title: "Customer Information" },
              { type: "shipment_matrix_details", title: "Details (with Equipment/QTY)" },
              { type: "rates_matrix", title: "Freight Charges Matrix" },
              { type: "terms", title: "Terms & Conditions" }
          ],
          footer: { text: "Thank you for your business." }
      };
    }

    // Fetch Charge Sides for Filtering
    const { data: sides } = await supabaseClient.from("charge_sides").select("id, code, name");
    const sellSideId = sides?.find((s: any) => s.code === 'sell' || s.name === 'Sell')?.id;
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
        container_types (code, name)
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
          
          if (chargesError) await logger.warn(`Error fetching charges for option ${opt.id}: ${chargesError.message}`);
          opt.charges = charges || [];
          await logger.info(`Option ${opt.id}: ${opt.legs.length} legs, ${opt.charges.length} charges. SellSideId: ${sellSideId}`);
          if (opt.charges.length > 0) {
             await logger.info(`First Charge: LegID=${opt.charges[0].leg_id}, SideID=${opt.charges[0].charge_side_id}, Amount=${opt.charges[0].amount}, Note=${opt.charges[0].note}`);
          } else {
             await logger.warn(`No charges found for option ${opt.id}`);
          }
      }
    }

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Colors
    const primaryColor = rgb(0, 0.53, 0.71); // MGL Blueish
    const lightBlue = rgb(0.85, 0.93, 0.95); // MGL Light Blue for headers
    const black = rgb(0, 0, 0);
    const gray = rgb(0.5, 0.5, 0.5);
    const white = rgb(1, 1, 1);
    const red = rgb(1, 0, 0);

    let y = height - 50;

    // Helper
    const drawText = (text: string, x: number, y: number, size = 10, isBold = false, color = black, targetPage = page) => {
        targetPage.drawText(String(text || ''), { x, y, size, font: isBold ? boldFont : font, color });
    };

    const drawRect = (x: number, y: number, w: number, h: number, color = black, filled = false, targetPage = page) => {
        if (filled) {
            targetPage.drawRectangle({ x, y, width: w, height: h, color: color });
        } else {
            targetPage.drawRectangle({ x, y, width: w, height: h, borderColor: color, borderWidth: 1 });
        }
    };

    const drawLine = (x1: number, y1: number, x2: number, y2: number, color = black, targetPage = page) => {
        targetPage.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color, thickness: 1 });
    };

    // --- RENDERER ---

    // MGL Layout Logic
    const isMGL = templateContent.layout === "mgl_matrix";
    const isMGLGranular = templateContent.layout === "mgl_granular";
    
    await log(`Layout Mode: MGL=${isMGL}, Granular=${isMGLGranular}`);

    if (isMGL || isMGLGranular) {
        // MGL Header
        // Logo Placeholder (Text for now)
        // Center aligned MGL logo text
        drawText("MGL", 270, height - 40, 30, true, primaryColor);
        drawText("MIAMI GLOBAL LINES", 230, height - 60, 16, true, primaryColor);

        // Address Centered
        const addrY = height - 85;
        drawText("140 Ethel Road West; Unit 'S&T', Piscataway, NJ 08854-USA", 160, addrY, 10, true);
        drawText("Phone:+1-732-640-2365,FMC Lic. # 023172NF / IAC #: NE1210010", 160, addrY - 12, 10, true);
        drawText("Professional Attitude at all Altitudes", 220, addrY - 24, 10, true, black);

        y = addrY - 50;

        // Quote Box & Validity
        drawRect(40, y - 20, 180, 20);
        drawText("QUOTE", 45, y - 14, 9, true);
        drawText(quote.quote_number || quoteId.substring(0,8), 120, y - 14, 9);

        drawRect(370, y - 20, 180, 20);
        drawText("Valid Till", 375, y - 14, 9, true);
        const validDate = version?.valid_until ? new Date(version.valid_until) : new Date();
        if (!version?.valid_until) validDate.setDate(validDate.getDate() + 30);
        drawText(validDate.toISOString().split('T')[0], 470, y - 14, 9);
        
        y -= 35;
    } else {
        // Standard Header
        if (templateContent.header?.show_logo) {
            drawText("MGL", 50, y, 24, true, primaryColor);
            drawText("MIAMI GLOBAL LINES", 110, y, 20, true, primaryColor);
            y -= 30;
        }
        
        if (templateContent.header?.company_info) {
             drawText("140 Ethel Road West; Unit 'S&T', Piscataway, NJ 08854-USA", 50, y, 10);
             y -= 15;
             drawText("Phone: +1-732-640-2365 | FMC Lic. # 023172NF | IAC #: NE1210010", 50, y, 10, true);
             y -= 15;
             drawText("Professional Attitude at all Altitudes", 50, y, 10, true, primaryColor);
             y -= 30;
        }
    }

    // Sections
    if (templateContent.sections) {
        for (const section of templateContent.sections) {
            if (y < 100) { page = pdfDoc.addPage(); y = height - 50; }
            
            if (section.type === "customer_matrix_header") {
                 // MGL Specific Customer Header
                 const boxH = 60;
                 drawRect(40, y - boxH, 510, boxH);
                 
                 // Vertical Divider
                 drawLine(295, y, 295, y - boxH);
                 // Horizontal Dividers
                 drawLine(40, y - 20, 550, y - 20);
                 drawLine(40, y - 40, 550, y - 40);

                 // Row 1
                 drawText(`Customer : ${quote.accounts?.name || "MGL INQUIRY PURPOSE"}`, 45, y - 14, 9, true);
                 drawText(`Customer Code : ${quote.accounts?.id?.substring(0,6) || "MGL12992"}`, 300, y - 14, 9, true);

                 // Row 2
                 drawText(`CTC : ${quote.accounts?.billing_city || ""}`, 45, y - 34, 9, true);
                 drawText(`Inquiry No. : ${quote.quote_number || "INQ20297"}`, 300, y - 34, 9, true);

                 // Row 3
                 drawText(`Contact No : ${quote.accounts?.phone || "||"}`, 45, y - 54, 9, true);
                 drawText(`Date: ${new Date().toISOString().split('T')[0]}`, 300, y - 54, 9, true);

                 y -= (boxH + 15);
            }
            else if (section.type === "shipment_matrix_details") {
                 // Detailed Shipment Grid
                 const labels = [
                     "Origin", "Origin Rail Ramp", "Port of Loading", 
                     "Port Of Discharge", "Final Destination", "Commodity", 
                     "Equipment", "Expected QTY"
                 ];
                 
                 const origin = quote.origin?.location_name || "";
                 const pol = quote.origin?.location_name || ""; // Assuming origin is POL for now
                 const pod = quote.destination?.location_name || "";
                 const dest = quote.destination?.location_name || "";
                 
                 // Get commodity description
                 const commodity = quote.items?.[0]?.description || "General Cargo";
                 
                 // Get Equipment String
                 const equipments = [...new Set(quote.items?.map((i: any) => 
                    `${i.container_sizes?.name || i.container_size || ''} ${i.container_types?.code || i.container_type || ''}`.trim()
                 ))].join(', ');

                 const qty = quote.items?.reduce((acc: number, i: any) => acc + (Number(i.quantity) || 0), 0) || 0;

                 const values = [
                     origin, "", pol,
                     pod, dest, commodity,
                     equipments, String(qty)
                 ];

                 const rowH = 18;
                 for (let i = 0; i < labels.length; i++) {
                     drawRect(40, y - rowH, 510, rowH);
                     drawLine(190, y, 190, y - rowH);
                     drawText(labels[i], 45, y - 13, 9, true);
                     drawText(values[i] || "", 195, y - 13, 9);
                     y -= rowH;
                 }
                 
                 y -= 15;
                 
                 // Currency Line
                 drawRect(40, y - 20, 160, 20);
                 drawLine(100, y, 100, y - 20);
                 drawText("Currency", 45, y - 14, 9, true);
                 const currencyCode = options[0]?.currency || "USD";
                 drawText(`${currencyCode}`, 105, y - 14, 9);
                 
                 y -= 30;
                 drawText("Below rates are for per CONTR/UNIT only", 40, y, 9, true);
                 y -= 15;
            }
            if (section.type === "rates_matrix" || section.type === "rates_table") {
                 await log(`Rendering Rates Matrix. Options count: ${options.length}`);
                 // Matrix Logic: Group by Carrier
                 const carriers: Record<string, any[]> = {};
                 options.forEach((opt: any) => {
                     const cName = opt.carriers?.carrier_name || opt.carrier_name || "Standard";
                     if (!carriers[cName]) carriers[cName] = [];
                     carriers[cName].push(opt);
                 });

                 for (const [carrierName, opts] of Object.entries(carriers)) {
                     await log(`Rendering Carrier: ${carrierName}, Options: ${opts.length}`);
                     const carrierOptions = opts as any[];
                     
                     if (y < 150) { page = pdfDoc.addPage(); y = height - 50; }

                     // Carrier Header
                     const transitTime = carrierOptions[0]?.transit_days || "-";
                     const frequency = carrierOptions[0]?.frequency || "1"; // Mock frequency if missing

                     // Cyan Header Box
                     drawRect(40, y - 25, 510, 25, lightBlue, true); // Fill
                     drawRect(40, y - 25, 510, 25); // Border
                     
                     // Vertical dividers for header
                     const colW = 170;
                     drawLine(40 + colW, y, 40 + colW, y - 25);
                     drawLine(40 + colW * 2, y, 40 + colW * 2, y - 25);

                     drawText(`Carrier: ${carrierName}`, 45, y - 17, 11, true);
                     drawText(`Transit Time: ${transitTime}`, 45 + colW + 5, y - 17, 11, true);
                     drawText(`Frequency: ${frequency}`, 45 + colW * 2 + 5, y - 17, 11, true);
                     
                     y -= 25;

                     // Determine Columns (Container Sizes)
                     const sizeMap = new Map();
                     carrierOptions.forEach(opt => {
                         const sName = opt.container_sizes?.name || opt.container_size || "Standard";
                         const tCode = opt.container_types?.code || opt.container_type || "";
                         // Include service type to differentiate options
                         const key = `${sName} ${tCode} ${opt.service_type ? '(' + opt.service_type + ')' : ''}`.trim();
                         if (!sizeMap.has(key)) sizeMap.set(key, []);
                         sizeMap.get(key).push(opt);
                     });
                     
                     const columns = Array.from(sizeMap.keys()).sort((a, b) => {
                        // Sort logic: 20' < 40' < 45', then alphabetical
                        const getVal = (s: string) => {
                            if (s.includes("20")) return 1;
                            if (s.includes("40")) return 2;
                            if (s.includes("45")) return 3;
                            return 9;
                        };
                        const va = getVal(a);
                        const vb = getVal(b);
                        if (va !== vb) return va - vb;
                        return a.localeCompare(b);
                    });
                    const colCount = columns.length;
                     
                     const descW = 90;
                     const remW = 90;
                     const rateAreaW = 510 - descW - remW;
                     const perColW = colCount > 0 ? rateAreaW / colCount : rateAreaW;

                     // Table Header Row
                     const headerH = 30; // Taller for multi-line text
                     drawRect(40, y - headerH, 510, headerH);
                     
                     // Vertical lines
                     let cx = 40 + descW;
                     drawLine(cx, y, cx, y - headerH); // After Desc
                     
                     for (let i = 0; i < colCount; i++) {
                         drawText(columns[i], cx + 2, y - 12, 8, true);
                         cx += perColW;
                         drawLine(cx, y, cx, y - headerH);
                     }
                     
                     drawText("Remarks", cx + 5, y - 18, 9, true);

                     y -= headerH;

                     // --- GRANULAR MODE LOGIC ---
                     if (isMGLGranular) {
                         // Collect all unique legs across ALL options in this carrier group
                         const uniqueLegsMap = new Map<string, any>();
                         
                         carrierOptions.forEach(opt => {
                             opt.legs?.forEach((l: any) => {
                                 const key = `${l.sort_order}-${l.mode}-${l.origin_location_id}`;
                                 if (!uniqueLegsMap.has(key)) {
                                     uniqueLegsMap.set(key, l);
                                 }
                             });
                         });

                         const refLegs = Array.from(uniqueLegsMap.values());
                         await log(`Granular Mode: Unique legs count = ${refLegs.length}`);
                         
                         // Sort by sort_order
                        refLegs.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));

                         // For each leg, we render a sub-header and then charges
                        for (const leg of refLegs) {
                            const legLabel = `${leg.transport_mode || leg.mode || 'Transport'} (${leg.origin?.location_name || 'Origin'} -> ${leg.destination?.location_name || 'Dest'})`;
                            await log(`Processing Leg: ${legLabel} at y=${y}`);
                            
                            // Page break check for Leg Header
                            if (y < 50) { page = pdfDoc.addPage(); y = height - 50; }

                            // Sub-header for Leg
                            drawRect(40, y - 20, 510, 20, rgb(0.95, 0.95, 0.95), true, page); // Very light gray
                            drawRect(40, y - 20, 510, 20, black, false, page); // Border
                            drawText(legLabel, 45, y - 14, 9, true, gray, page);
                            y -= 20;

                            // Check if this leg has ANY charges in ANY option
                            let hasCharges = false;
                            const legChargeNames = new Set<string>();
                            
                            for (const colKey of columns) {
                                const optsForCol = sizeMap.get(colKey);
                                if (optsForCol) {
                                    for (const o of optsForCol) {
                                        // Match leg in this option
                                        // Try by ID first, then by properties
                                        const targetLeg = o.legs?.find((l: any) => l.sort_order === leg.sort_order) || 
                                                          o.legs?.find((l: any) => (l.transport_mode === leg.transport_mode || l.mode === leg.mode) && l.origin_location_id === leg.origin_location_id);
                                        
                                        if (targetLeg) {
                                            const legCharges = o.charges?.filter((c: any) => c.leg_id === targetLeg.id);
                                            if (legCharges && legCharges.length > 0) {
                                                hasCharges = true;
                                                legCharges.forEach((c: any) => {
                                                    const cName = c.note || c.category?.name || "Charge";
                                                    legChargeNames.add(cName);
                                                });
                                            }
                                        }
                                    }
                                }
                            }

                            if (!hasCharges) {
                                await logWarn(`No charges found for leg: ${legLabel}`);
                                continue; // Skip empty legs
                            }

                            for (const cName of legChargeNames) {
                                // Page break check for Charge Row
                                if (y < 50) { page = pdfDoc.addPage(); y = height - 50; }

                                const rowH = 20;
                                drawRect(40, y - rowH, 510, rowH, black, false, page);
                                
                                // Verticals
                                let lcx = 40 + descW;
                                drawLine(lcx, y, lcx, y - rowH, black, page);
                                for (let i = 0; i < colCount; i++) {
                                    lcx += perColW;
                                    drawLine(lcx, y, lcx, y - rowH, black, page);
                                }

                                drawText(cName, 45, y - 14, 9, false, black, page);
                                await log(`  Drawing Charge Row: ${cName} at y=${y}`);

                                lcx = 40 + descW;
                                for (const colKey of columns) {
                                    const optsForCol = sizeMap.get(colKey);
                                    let val = 0;
                                    let found = false;
                                    if (optsForCol) {
                                        for (const o of optsForCol) {
                                            const targetLeg = o.legs?.find((l: any) => l.sort_order === leg.sort_order) || 
                                                      o.legs?.find((l: any) => (l.transport_mode === leg.transport_mode || l.mode === leg.mode) && l.origin_location_id === leg.origin_location_id);
                                            if (targetLeg) {
                                                const chg = o.charges?.find((c: any) => c.leg_id === targetLeg.id && (c.note || c.category?.name || "Charge") === cName);
                                                if (chg) {
                                                    val += Number(chg.amount);
                                                    found = true;
                                                }
                                            }
                                        }
                                    }
                                    if (found) {
                                        drawText(val.toFixed(2), lcx + 5, y - 14, 9, false, black, page);
                                        await log(`    Val: ${val.toFixed(2)} for col ${colKey}`);
                                    } else {
                                        drawText("-", lcx + 5, y - 14, 9, false, black, page);
                                    }
                                    lcx += perColW;
                                }
                                y -= rowH;
                            }
                        }

                         // General Charges (No Leg ID)
                         const generalChargeNames = new Set<string>();
                         columns.forEach(colKey => {
                             const optsForCol = sizeMap.get(colKey);
                             optsForCol?.forEach((o: any) => {
                                 o.charges?.filter((c: any) => !c.leg_id).forEach((c: any) => generalChargeNames.add(c.note || "Base Freight"));
                             });
                         });

                         if (generalChargeNames.size > 0) {
                             drawRect(40, y - 20, 510, 20, rgb(0.95, 0.95, 0.95), true);
                             drawRect(40, y - 20, 510, 20);
                             drawText("General / Other Charges", 45, y - 14, 9, true, gray);
                             y -= 20;

                             for (const cName of generalChargeNames) {
                                 const rowH = 20;
                                 drawRect(40, y - rowH, 510, rowH);
                                 
                                 // Verticals
                                 let lcx = 40 + descW;
                                 drawLine(lcx, y, lcx, y - rowH);
                                 for (let i = 0; i < colCount; i++) {
                                     lcx += perColW;
                                     drawLine(lcx, y, lcx, y - rowH);
                                 }

                                 drawText(cName, 45, y - 14, 9);

                                 lcx = 40 + descW;
                                 for (const colKey of columns) {
                                     const optsForCol = sizeMap.get(colKey);
                                     let val = 0;
                                     let found = false;
                                     if (optsForCol) {
                                         for (const o of optsForCol) {
                                             const chg = o.charges?.find((c: any) => !c.leg_id && (c.note || "Base Freight") === cName);
                                             if (chg) {
                                                 val += Number(chg.amount);
                                                 found = true;
                                             }
                                         }
                                     }
                                     if (found) drawText(val.toFixed(2), lcx + 5, y - 14, 9);
                                     lcx += perColW;
                                 }
                                 y -= rowH;
                             }
                         }

                         // TOTAL ROW
                         const rowH = 20;
                         drawRect(40, y - rowH, 510, rowH, lightBlue, true);
                         drawRect(40, y - rowH, 510, rowH);
                         let lcx = 40 + descW;
                         drawLine(lcx, y, lcx, y - rowH);
                         for (let i = 0; i < colCount; i++) {
                             lcx += perColW;
                             drawLine(lcx, y, lcx, y - rowH);
                         }
                         drawText("Total", 45, y - 14, 9, true);
                        lcx = 40 + descW;
                        for (const colKey of columns) {
                            const optsForCol = sizeMap.get(colKey);
                            let val = 0;
                            if (optsForCol) {
                                for (const o of optsForCol) val += Number(o.total_amount) || 0;
                            }
                            drawText(val.toFixed(2), lcx + 5, y - 14, 9, true);
                            lcx += perColW;
                        }
                        
                        // Remarks (use first option's note)
                        const firstOpt = carrierOptions[0];
                        const remarks = firstOpt?.notes || "All Inclusive";
                        
                        // Split remarks if too long (basic wrapping)
                        if (remarks.length > 25) {
                             drawText(remarks.substring(0, 25) + "...", lcx + 5, y - 14, 8);
                        } else {
                             drawText(remarks, lcx + 5, y - 14, 8);
                        }

                        y -= rowH;

                     } else {
                        // --- STANDARD MGL MATRIX LOGIC (Collapsed) ---
                        // Gather unique Charge Names (notes) across all options
                        const chargeNames = new Set<string>();
                        carrierOptions.forEach(opt => {
                            opt.charges?.forEach((c: any) => chargeNames.add(c.note || "Base Freight"));
                            if (opt.charges?.length === 0 && Number(opt.total_amount) > 0) {
                                chargeNames.add("Total Freight");
                            }
                        });

                        // Render Rows
                        const cNamesArr = Array.from(chargeNames);
                        // Add "Total" row at the end
                        cNamesArr.push("Total");

                        for (const cName of cNamesArr) {
                            const rowH = 20;
                            drawRect(40, y - rowH, 510, rowH, cName === "Total" ? lightBlue : white, cName === "Total");
                            if (cName === "Total") drawRect(40, y - rowH, 510, rowH); // Border for total

                            // Draw Verticals
                            cx = 40 + descW;
                            drawLine(cx, y, cx, y - rowH);
                            for (let i = 0; i < colCount; i++) {
                                cx += perColW;
                                drawLine(cx, y, cx, y - rowH);
                            }

                            // Draw Label
                            drawText(cName, 45, y - 14, 9, cName === "Total");

                            // Draw Values
                            cx = 40 + descW;
                            for (const colKey of columns) {
                                // Find the option corresponding to this column
                                const targetOpts = sizeMap.get(colKey);
                                // Find the charge in this option
                                let val = 0;
                                let found = false;

                                if (targetOpts) {
                                    // Usually one option per size per carrier, but loop just in case
                                    for (const opt of targetOpts) {
                                        if (cName === "Total") {
                                            val += Number(opt.total_amount) || 0;
                                            found = true;
                                        } else {
                                            const chg = opt.charges?.find((c: any) => (c.note || "Base Freight") === cName);
                                            if (chg) {
                                                val += Number(chg.amount);
                                                found = true;
                                            } else if (cName === "Total Freight" && opt.charges?.length === 0) {
                                                val += Number(opt.total_amount);
                                                found = true;
                                            }
                                        }
                                    }
                                }

                                if (found) {
                                    drawText(val.toFixed(2), cx + 5, y - 14, 9, cName === "Total");
                                }
                                cx += perColW;
                            }

                            // Remarks (Placeholder)
                            if (cName === "Total") {
                                drawText("All Inclusive", cx + 5, y - 14, 8);
                            }

                            y -= rowH;
                        }
                     }
                     
                     y -= 15;
                 }
            }
            else if (section.type === "terms" || section.type === "terms_mgl") {
                 if (y < 200) { page = pdfDoc.addPage(); y = height - 50; }

                 drawText(section.title || "TERMS & CONDITIONS:", 40, y, 11, true, black, page);
                 y -= 15;
                 
                 const textBlock = templateContent.terms_text || section.content || "Standard Terms and Conditions apply.";
                 const lines = textBlock.split('\n');
                 
                 for (const line of lines) {
                     if (y < 40) { page = pdfDoc.addPage(); y = height - 50; }
                     
                     let fontSize = 8;
                     let isBold = false;
                     let color = black;

                     if (line.includes("LAP TOP BATTERIES") || line.includes("RATES ARE NOT SUBJECT")) {
                         isBold = true;
                     }
                     if (line.startsWith("Above Rates Are Excluding") || line.startsWith("Trucking rates are subject")) {
                         // Highlight style (simulated with bold + background maybe? just bold for now)
                         isBold = true;
                         // drawRect(40, y-2, 200, 10, cyan, true);
                     }

                     drawText(line, 40, y, fontSize, isBold, color);
                     y -= 10;
                 }
            }
            else if (section.type === "customer_info") {
                // ... (Keep existing standard logic for backward compatibility if needed) ...
                const infoY = y;
                drawRect(40, infoY - 60, 510, 60);
                drawLine(40, infoY - 20, 550, infoY - 20);
                drawLine(40, infoY - 40, 550, infoY - 40);
                drawLine(295, infoY, 295, infoY - 60);
                drawText("Customer : " + (quote.accounts?.name || "N/A"), 45, infoY - 14, 9, true);
                drawText("Customer Code : " + (quote.accounts?.id?.substring(0,6) || "N/A"), 300, infoY - 14, 9, true);
                drawText("Address : " + (quote.accounts?.billing_city || ""), 45, infoY - 34, 9, true);
                drawText("Inquiry No. : " + (quote.quote_number || ""), 300, infoY - 34, 9, true);
                drawText("Contact No : " + (quote.accounts?.phone || ""), 45, infoY - 54, 9, true);
                drawText(`Date: ${new Date().toISOString().split('T')[0]}`, 300, infoY - 54, 9, true);
                y -= 80;
            } 
            else if (section.type === "shipment_info") {
                 // ... (Keep existing standard logic) ...
                 const rowHeight = 20;
                 const col1X = 40;
                 const col2X = 200;
                 const drawRow = (label: string, value: string) => {
                     drawRect(40, y - rowHeight, 510, rowHeight);
                     drawLine(190, y, 190, y - rowHeight);
                     drawText(label, col1X + 5, y - 14, 9, true);
                     drawText(value, col2X + 5, y - 14, 9);
                     y -= rowHeight;
                 };
                 const origin = quote.origin?.location_name || "N/A";
                 const dest = quote.destination?.location_name || "N/A";
                 drawRow('Origin', origin);
                 drawRow('Destination', dest);
                 if (quote.commodity) drawRow('Commodity', quote.commodity);
                 const totalQty = quote.items?.reduce((acc: number, i: any) => acc + (Number(i.quantity) || 0), 0) || 0;
                 const totalWeight = quote.items?.reduce((acc: number, i: any) => acc + (Number(i.weight_kg) || 0), 0) || 0;
                 drawRow('Total Quantity', String(totalQty));
                 if (totalWeight > 0) drawRow('Total Weight', `${totalWeight} kg`);
                 y -= 20;
            }
            else if (section.type === "rates_table") {
                 // ... (Keep existing standard logic) ...
                 drawText(section.title || "Freight Charges", 40, y, 12, true, primaryColor);
                 y -= 20;
                 if (options.length > 0) {
                    for (const opt of options) {
                        if (y < 100) { page = pdfDoc.addPage(); y = height - 50; }
                        drawRect(40, y - 25, 510, 25, primaryColor, true);
                        const carrierName = opt.carriers?.carrier_name || "Standard";
                        drawText(`Carrier: ${carrierName}`, 50, y - 17, 12, true, white);
                        drawText(`Transit: ${opt.transit_days || '-'} Days`, 250, y - 17, 12, true, white);
                        y -= 30;
                        drawRect(40, y - 20, 510, 20);
                        drawText("Description", 45, y - 14, 9, true);
                        drawText("Amount", 400, y - 14, 9, true);
                        y -= 20;
                        let total = 0;
                        if (opt.charges?.length > 0) {
                            for (const chg of opt.charges) {
                                drawRect(40, y - 20, 510, 20);
                                drawText(chg.note || "Charge", 45, y - 14, 9);
                                const amt = Number(chg.amount) || 0;
                                drawText(`$${amt.toFixed(2)}`, 400, y - 14, 9);
                                total += amt;
                                y -= 20;
                            }
                        } else {
                            drawRect(40, y - 20, 510, 20);
                            drawText("Total Freight", 45, y - 14, 9);
                            drawText(`$${(Number(opt.total_amount) || 0).toFixed(2)}`, 400, y - 14, 9);
                            total = Number(opt.total_amount) || 0;
                            y -= 20;
                        }
                        drawRect(40, y - 20, 510, 20, primaryColor, true);
                        drawText("Total", 45, y - 14, 10, true, white);
                        drawText(`$${total.toFixed(2)}`, 400, y - 14, 10, true, white);
                        y -= 30;
                    }
                 } else {
                     drawText("No rates available.", 50, y, 12, false, gray);
                     y -= 20;
                 }
            }
            else if (section.type === "terms") {
                 // ... (Keep existing standard logic) ...
                 drawText(section.title || "Terms & Conditions", 40, y, 12, true, primaryColor);
                 y -= 15;
                 const terms = [
                      'Above Rates Are Excluding of: Destination charges / Cargo Insurance / taxes / duties.',
                      'Rates are on: PER UNIT basis.',
                      'Prepaid basis.',
                      'Valid for 30 days.',
                      'Subject to change without prior notice.'
                 ];
                 for (const term of terms) {
                      drawText(`• ${term}`, 50, y, 8);
                      y -= 12;
                 }
                 y -= 20;
            }
        }
    }

    // Footer
    if (templateContent.footer) {
        drawText(templateContent.footer.text || "", 50, 50, 10, false, gray);
    }

    const pdfBytes = await pdfDoc.save();
    
    const base64Content = btoa(
      new Uint8Array(pdfBytes).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    return new Response(
      JSON.stringify({ 
        content: base64Content,
        traceLogs: traceLogs
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Critical Error in generate-quote-pdf:", error);
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

}, "generate-quote-pdf");