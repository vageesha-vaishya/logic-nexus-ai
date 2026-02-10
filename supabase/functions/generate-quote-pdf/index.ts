
import { serveWithLogger } from "../_shared/logger.ts";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getCorsHeaders } from "../_shared/cors.ts";

console.log("Hello from generate-quote-pdf!");

serveWithLogger(async (req, logger, supabaseClient) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  const { quoteId, versionId } = await req.json();

  if (!quoteId) {
    throw new Error("Missing quoteId");
  }

  await logger.info(`Generating PDF for Quote: ${quoteId}, Version: ${versionId}`);

  // Fetch Quote Data
  const { data: quote, error: quoteError } = await supabaseClient
    .from("quotes")
    .select(`
      *,
      accounts (name, billing_street, billing_city, billing_state, billing_postal_code, billing_country),
      origin:ports_locations!origin_port_id(location_name, country_id),
      destination:ports_locations!destination_port_id(location_name, country_id)
    `)
    .eq("id", quoteId)
    .single();

  if (quoteError) throw quoteError;

  // Fetch Version Data (if provided)
  let version = null;
  let options = [];
  if (versionId) {
    const { data: vData, error: vError } = await supabaseClient
      .from("quotation_versions")
      .select("*")
      .eq("id", versionId)
      .single();
    
    if (vError) throw vError;
    version = vData;

    const { data: oData, error: oError } = await supabaseClient
      .from("quotation_version_options")
      .select(`
          *,
          carriers(carrier_name),
          legs:quotation_version_option_legs(
            *,
            origin:ports_locations!origin_location_id(location_name),
            destination:ports_locations!destination_location_id(location_name)
          )
      `)
      .eq("quotation_version_id", versionId);
      
    if (oError) throw oError;
    options = oData || [];
  }

  // Create PDF
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const fontSize = 12;
  let y = height - 50;

  // Header
  page.drawText("SOS Logistics", { x: 50, y, size: 20, font: boldFont, color: rgb(0.05, 0.65, 0.9) });
  y -= 30;
  page.drawText(`Quotation: ${quote.quote_number || quoteId.substring(0,8)}`, { x: 50, y, size: 14, font: boldFont });
  y -= 20;
  page.drawText(`Date: ${new Date().toLocaleDateString()}`, { x: 50, y, size: 12, font });
  y -= 30;

  // Customer
  page.drawText("Customer Details:", { x: 50, y, size: 12, font: boldFont });
  y -= 20;
  page.drawText(quote.accounts?.name || "N/A", { x: 50, y, size: 12, font });
  y -= 15;
  if (quote.accounts?.billing_street) {
      page.drawText(quote.accounts.billing_street, { x: 50, y, size: 10, font });
      y -= 15;
  }
  const cityStateZip = [
      quote.accounts?.billing_city,
      quote.accounts?.billing_state,
      quote.accounts?.billing_postal_code
  ].filter(Boolean).join(", ");
  
  if (cityStateZip) {
      page.drawText(cityStateZip, { x: 50, y, size: 10, font });
      y -= 15;
  }
  
  if (quote.accounts?.billing_country) {
      page.drawText(quote.accounts.billing_country, { x: 50, y, size: 10, font });
      y -= 15;
  }

  y -= 20;

  // Route
  page.drawText("Route Information:", { x: 50, y, size: 12, font: boldFont });
  y -= 20;
  const originName = quote.origin?.location_name || quote.origin_port_id || "N/A";
  const destName = quote.destination?.location_name || quote.destination_port_id || "N/A";
  page.drawText(`Origin: ${originName}`, { x: 50, y, size: 12, font });
  y -= 15;
  page.drawText(`Destination: ${destName}`, { x: 50, y, size: 12, font });
  y -= 30;

  // Cargo
  page.drawText("Cargo Details:", { x: 50, y, size: 12, font: boldFont });
  y -= 20;
  const cargoSummary = [];
  if (quote.total_weight) cargoSummary.push(`${quote.total_weight} kg`);
  if (quote.total_volume) cargoSummary.push(`${quote.total_volume} cbm`);
  if (quote.commodity) cargoSummary.push(quote.commodity);
  
  if (cargoSummary.length > 0) {
      page.drawText(cargoSummary.join(" | "), { x: 50, y, size: 12, font });
      y -= 30;
  }

  // Financials
  page.drawText("Financial Summary:", { x: 50, y, size: 12, font: boldFont });
  y -= 20;
  page.drawText(`Total Amount: ${quote.currency || 'USD'} ${quote.shipping_amount?.toFixed(2) || '0.00'}`, { x: 50, y, size: 14, font: boldFont });
  y -= 40;

  // Options (if version exists)
  if (options.length > 0) {
      page.drawText("Routing Options:", { x: 50, y, size: 12, font: boldFont });
      y -= 20;
      
      for (const opt of options) {
          if (y < 100) {
              page = pdfDoc.addPage();
              y = height - 50;
          }
          
          const carrier = opt.carriers?.carrier_name || "Standard Service";
          const price = opt.total_amount || 0;
          const transit = opt.total_transit_days ? `${opt.total_transit_days} days` : "N/A";
          
          page.drawText(`Option: ${carrier}`, { x: 60, y, size: 12, font: boldFont });
          y -= 15;
          page.drawText(`Price: $${price.toFixed(2)} | Transit: ${transit}`, { x: 60, y, size: 12, font });
          y -= 15;

          // Render Legs
          if (opt.legs && opt.legs.length > 0) {
              page.drawText("Itinerary:", { x: 70, y, size: 10, font: boldFont });
              y -= 12;
              
              for (const leg of opt.legs) {
                  if (y < 50) { 
                      page = pdfDoc.addPage(); 
                      y = height - 50; 
                  }
                  
                  const mode = leg.transport_mode || leg.mode || "Transport";
                  const flight = leg.flight_number || leg.voyage_number || "";
                  const from = leg.origin?.location_name || "Origin";
                  const to = leg.destination?.location_name || "Dest";
                  const date = leg.departure_date ? new Date(leg.departure_date).toLocaleDateString() : "";
                  
                  const legText = `${mode}: ${from} -> ${to} ${flight ? `(${flight})` : ""} ${date}`;
                  page.drawText(legText, { x: 70, y, size: 10, font });
                  y -= 12;
              }
          }
          y -= 25;
      }
  }

  // Footer
  page.drawText("Terms & Conditions Apply. Valid for 30 days.", { x: 50, y: 50, size: 10, font, color: rgb(0.5, 0.5, 0.5) });

  const pdfBytes = await pdfDoc.save();
  
  const base64Content = btoa(
    new Uint8Array(pdfBytes).reduce((data, byte) => data + String.fromCharCode(byte), "")
  );

  return new Response(
    JSON.stringify({ content: base64Content }),
    { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
  );

}, "generate-quote-pdf");
