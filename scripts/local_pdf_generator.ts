
import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gzhxgoigflftharcmdqj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6aHhnb2lnZmxmdGhhcmNtZHFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTUxOTY4NywiZXhwIjoyMDg1MDk1Njg3fQ.MImJoQhZUG2lSQ9PpN0z1QwDI1nvA2AsYPOeVfDGMos';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function generatePdfLocal(quoteId: string, versionId?: string, templateId?: string) {
  console.log('--- Generating PDF Locally (Simulating Edge Function) ---');

  if (!quoteId) {
    throw new Error("Missing quoteId");
  }

  // Fetch Template
  let templateContent = null;
  if (templateId) {
      const { data: tData, error: tError } = await supabase
          .from("quote_templates")
          .select("content")
          .eq("id", templateId)
          .single();
      
      if (tError) {
           console.warn(`Error fetching template: ${tError.message}`);
      } else if (tData) {
          templateContent = tData.content;
      }
  }
  
  // Default fallback template
  if (!templateContent) {
       templateContent = {
        layout: "standard",
        header: { show_logo: true, company_info: true, title: "QUOTATION" },
        sections: [
            { type: "customer_info", title: "Customer Information" },
            { type: "shipment_info", title: "Shipment Details" },
            { type: "rates_table", title: "Freight Charges" },
            { type: "terms", title: "Terms & Conditions" }
        ],
        footer: { text: "Thank you for your business." }
    };
  }

  // Fetch Quote Data
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select(`
      *,
      accounts (id, name, billing_street, billing_city, billing_state, billing_postal_code, billing_country, phone),
      origin:ports_locations!origin_port_id(location_name, country_id),
      destination:ports_locations!destination_port_id(location_name, country_id)
    `)
    .eq("id", quoteId)
    .single();

  if (quoteError) throw quoteError;

  // Fetch Quote Items separately
  const { data: items, error: itemsError } = await supabase
    .from("quote_items")
    .select(`
      *,
      container_sizes (code, name),
      container_types (code, name)
    `)
    .eq("quote_id", quoteId);
  
  if (itemsError) throw new Error(`Error fetching items: ${itemsError.message}`);
  quote.items = items || [];

  // Fetch Version Data (if provided)
  let version = null;
  let options = [];
  if (versionId) {
    const { data: vData, error: vError } = await supabase
      .from("quotation_versions")
      .select("*")
      .eq("id", versionId)
      .single();
    
    if (vError) throw vError;
    version = vData;

    const { data: oData, error: oError } = await supabase
      .from("quotation_version_options")
      .select(`
          *,
          carriers(carrier_name),
          container_sizes(name, code),
          container_types(name, code),
          legs:quotation_version_option_legs(
            *,
            origin:ports_locations!origin_location_id(location_name),
            destination:ports_locations!destination_location_id(location_name)
          )
      `)
      .eq("quotation_version_id", versionId);
      
    if (oError) throw oError;
    options = oData || [];

    // Fetch Charges for each option
    for (const opt of options) {
        const { data: charges, error: chargesError } = await supabase
            .from("quote_charges")
            .select("*")
            .eq("quote_option_id", opt.id);
        
        if (chargesError) console.warn(`Error fetching charges for option ${opt.id}: ${chargesError.message}`);
        opt.charges = charges || [];
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
  const white = rgb(1, 1, 1);

  let y = height - 50;

  // Helper
  const drawText = (text: string, x: number, y: number, size = 10, isBold = false, color = black) => {
      page.drawText(String(text || ''), { x, y, size, font: isBold ? boldFont : font, color });
  };

  const drawRect = (x: number, y: number, w: number, h: number, color = black, filled = false) => {
      if (filled) {
          page.drawRectangle({ x, y, width: w, height: h, color: color });
      } else {
          page.drawRectangle({ x, y, width: w, height: h, borderColor: color, borderWidth: 1 });
      }
  };

  const drawLine = (x1: number, y1: number, x2: number, y2: number, color = black) => {
      page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color, thickness: 1 });
  };

  // MGL Layout Logic
  const isMGL = templateContent.layout === "mgl_matrix";
  const isMGLGranular = templateContent.layout === "mgl_granular";

  if (isMGL || isMGLGranular) {
      // MGL Header
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
      page.drawText("SOS Logistics", { x: 50, y, size: 20, font: boldFont, color: rgb(0.05, 0.65, 0.9) });
      y -= 30;
      page.drawText(`Quotation: ${quote.quote_number}`, { x: 50, y, size: 14, font: boldFont });
      y -= 20;
      page.drawText(`Date: ${new Date().toLocaleDateString()}`, { x: 50, y, size: 12, font });
      y -= 30;
  }

  // Sections
  if (templateContent.sections) {
      for (const section of templateContent.sections) {
          if (y < 100) { page = pdfDoc.addPage([595.28, 841.89]); y = height - 50; }
          
          if (section.type === "customer_matrix_header") {
               // MGL Specific Customer Header
               const boxH = 60;
               drawRect(40, y - boxH, 510, boxH);
               
               drawLine(295, y, 295, y - boxH);
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
               const labels = [
                   "Origin", "Origin Rail Ramp", "Port of Loading", 
                   "Port Of Discharge", "Final Destination", "Commodity", 
                   "Equipment", "Expected QTY"
               ];
               
               const origin = quote.origin?.location_name || "";
               const pol = quote.origin?.location_name || ""; 
               const pod = quote.destination?.location_name || "";
               const dest = quote.destination?.location_name || "";
               
               const commodity = quote.items?.[0]?.description || "General Cargo";
               
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
               
               drawRect(40, y - 20, 160, 20);
               drawLine(100, y, 100, y - 20);
               drawText("Currency", 45, y - 14, 9, true);
               drawText("US Dollar($)", 105, y - 14, 9);
               
               y -= 30;
               drawText("Below rates are for per CONTR/UNIT only", 40, y, 9, true);
               y -= 15;
          }
          else if (section.type === "rates_matrix") {
               const carriers: Record<string, any[]> = {};
               options.forEach((opt: any) => {
                   const cName = opt.carriers?.carrier_name || opt.carrier_name || "Standard";
                   if (!carriers[cName]) carriers[cName] = [];
                   carriers[cName].push(opt);
               });

               for (const [carrierName, opts] of Object.entries(carriers)) {
                   const carrierOptions = opts as any[];
                   
                   if (y < 150) { page = pdfDoc.addPage([595.28, 841.89]); y = height - 50; }

                   const transitTime = carrierOptions[0]?.transit_days || "-";
                   const frequency = carrierOptions[0]?.frequency || "1";

                   drawRect(40, y - 25, 510, 25, lightBlue, true); 
                   drawRect(40, y - 25, 510, 25); 
                   
                   const colW = 170;
                   drawLine(40 + colW, y, 40 + colW, y - 25);
                   drawLine(40 + colW * 2, y, 40 + colW * 2, y - 25);

                   drawText(`Carrier: ${carrierName}`, 45, y - 17, 11, true);
                   drawText(`Transit Time: ${transitTime}`, 45 + colW + 5, y - 17, 11, true);
                   drawText(`Frequency: ${frequency}`, 45 + colW * 2 + 5, y - 17, 11, true);
                   
                   y -= 25;

                   const sizeMap = new Map();
                   carrierOptions.forEach(opt => {
                       const sName = opt.container_sizes?.name || opt.container_size || "Standard";
                       const tCode = opt.container_types?.code || opt.container_type || "";
                       const key = `${sName} ${tCode}`.trim();
                       if (!sizeMap.has(key)) sizeMap.set(key, []);
                       sizeMap.get(key).push(opt);
                   });
                   
                   const columns = Array.from(sizeMap.keys());
                   const colCount = columns.length;
                   
                   const descW = 90;
                   const remW = 90;
                   const rateAreaW = 510 - descW - remW;
                   const perColW = colCount > 0 ? rateAreaW / colCount : rateAreaW;

                   // Table Header Row
                   const headerH = 30; 
                   drawRect(40, y - headerH, 510, headerH);
                   
                   // Vertical lines
                   let cx = 40 + descW;
                   drawLine(cx, y, cx, y - headerH); 
                   
                   for (let i = 0; i < colCount; i++) {
                       drawText(columns[i], cx + 2, y - 12, 8, true);
                       cx += perColW;
                       drawLine(cx, y, cx, y - headerH);
                   }
                   
                   drawText("Remarks", cx + 5, y - 18, 9, true);

                   y -= headerH;

                   // --- GRANULAR MODE LOGIC ---
                   if (isMGLGranular) {
                       const refLegs = carrierOptions[0]?.legs || [];

                       for (const leg of refLegs) {
                           const legLabel = `${leg.transport_mode || 'Transport'} (${leg.origin?.location_name || 'Origin'} -> ${leg.destination?.location_name || 'Dest'})`;
                           
                           drawRect(40, y - 20, 510, 20, rgb(0.95, 0.95, 0.95), true);
                           drawRect(40, y - 20, 510, 20);
                           drawText(legLabel, 45, y - 14, 9, true, rgb(0.5, 0.5, 0.5));
                           y -= 20;

                           const legChargeNames = new Set<string>();
                           columns.forEach(colKey => {
                               const optsForCol = sizeMap.get(colKey);
                               optsForCol?.forEach((o: any) => {
                                   const targetLeg = o.legs?.find((l: any) => l.leg_number === leg.leg_number) || 
                                                     o.legs?.find((l: any) => l.transport_mode === leg.transport_mode && l.origin_location_id === leg.origin_location_id);
                                   if (targetLeg) {
                                       o.charges?.filter((c: any) => c.leg_id === targetLeg.id).forEach((c: any) => legChargeNames.add(c.note || "Charge"));
                                   }
                               });
                           });

                           for (const cName of legChargeNames) {
                               const rowH = 20;
                               drawRect(40, y - rowH, 510, rowH);
                               
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
                                           const targetLeg = o.legs?.find((l: any) => l.leg_number === leg.leg_number) || 
                                                             o.legs?.find((l: any) => l.transport_mode === leg.transport_mode);
                                           if (targetLeg) {
                                              const chg = o.charges?.find((c: any) => c.leg_id === targetLeg.id && (c.note || "Charge") === cName);
                                              if (chg) {
                                                  val += Number(chg.amount);
                                                  found = true;
                                              }
                                           }
                                       }
                                   }
                                   if (found) drawText(val.toFixed(2), lcx + 5, y - 14, 9);
                                   lcx += perColW;
                               }
                               y -= rowH;
                           }
                       }

                       // General Charges
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
                           drawText("General / Other Charges", 45, y - 14, 9, true, rgb(0.5, 0.5, 0.5));
                           y -= 20;

                           for (const cName of generalChargeNames) {
                               const rowH = 20;
                               drawRect(40, y - rowH, 510, rowH);
                               
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
                       drawText("All Inclusive", lcx + 5, y - 14, 8);
                       y -= rowH;

                   } else {
                        // Standard MGL Logic
                       const chargeNames = new Set<string>();
                       carrierOptions.forEach(opt => {
                           opt.charges?.forEach((c: any) => chargeNames.add(c.note || "Base Freight"));
                           if (opt.charges?.length === 0 && Number(opt.total_amount) > 0) {
                               chargeNames.add("Total Freight");
                           }
                       });

                       const cNamesArr = Array.from(chargeNames);
                       cNamesArr.push("Total");

                       for (const cName of cNamesArr) {
                           const rowH = 20;
                           drawRect(40, y - rowH, 510, rowH, cName === "Total" ? lightBlue : white, cName === "Total");
                           if (cName === "Total") drawRect(40, y - rowH, 510, rowH);

                           cx = 40 + descW;
                           drawLine(cx, y, cx, y - rowH);
                           for (let i = 0; i < colCount; i++) {
                               cx += perColW;
                               drawLine(cx, y, cx, y - rowH);
                           }

                           drawText(cName, 45, y - 14, 9, cName === "Total");

                           cx = 40 + descW;
                           for (const colKey of columns) {
                               const targetOpts = sizeMap.get(colKey);
                               let val = 0;
                               let found = false;

                               if (targetOpts) {
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

                           if (cName === "Total") {
                               drawText("All Inclusive", cx + 5, y - 14, 8);
                           }

                           y -= rowH;
                       }
                   }
                   
                   y -= 15;
               }
          }
          else if (section.type === "terms_mgl") {
               if (y < 200) { page = pdfDoc.addPage([595.28, 841.89]); y = height - 50; }

               drawText(section.title || "TERMS & CONDITIONS:", 40, y, 11, true);
               y -= 15;
               
               const textBlock = templateContent.terms_text || "";
               const lines = textBlock.split('\n');
               
               for (const line of lines) {
                   if (y < 40) { page = pdfDoc.addPage([595.28, 841.89]); y = height - 50; }
                   
                   let fontSize = 8;
                   let isBold = false;
                   let color = black;

                   if (line.includes("LAP TOP BATTERIES") || line.includes("RATES ARE NOT SUBJECT")) {
                       isBold = true;
                   }
                   if (line.startsWith("Above Rates Are Excluding") || line.startsWith("Trucking rates are subject")) {
                       isBold = true;
                   }

                   drawText(line, 40, y, fontSize, isBold, color);
                   y -= 10;
               }
          }
          else if (section.type === "rates_table") {
              // Fallback for standard layout
              page.drawText("Routing Options:", { x: 50, y, size: 12, font: boldFont });
              y -= 20;
              for (const opt of options) {
                  const carrier = opt.carriers?.carrier_name || "Standard Service";
                  const price = opt.total_amount || 0;
                  page.drawText(`${carrier}: $${price.toFixed(2)}`, { x: 60, y, size: 12, font });
                  y -= 15;
              }
          }
      }
  }

  const pdfBytes = await pdfDoc.save();
  const base64Content = Buffer.from(pdfBytes).toString('base64');

  return { content: base64Content };
}
