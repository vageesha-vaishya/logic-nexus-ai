
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

export async function generatePdfLocal(quoteId: string, versionId?: string) {
  console.log('--- Generating PDF Locally (Simulating Edge Function) ---');

  if (!quoteId) {
    throw new Error("Missing quoteId");
  }

  // Fetch Quote Data
  const { data: quote, error: quoteError } = await supabase
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
  page.drawText(`Quotation: ${quote.quote_number}`, { x: 50, y, size: 14, font: boldFont });
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
  page.drawText(`Total Amount: ${quote.currency || 'USD'} ${quote.total_amount?.toFixed(2) || '0.00'}`, { x: 50, y, size: 14, font: boldFont });
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
          const transit = opt.transit_time ? `${opt.transit_time} days` : "N/A";
          
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
                  
                  const mode = leg.mode || "Transport";
                  const flight = leg.flight_number || leg.voyage_number || "";
                  const from = leg.origin?.location_name || "Origin";
                  const to = leg.destination?.location_name || "Dest";
                  const depDate = leg.departure_date ? new Date(leg.departure_date).toLocaleDateString() : "";
                  const arrDate = leg.arrival_date ? new Date(leg.arrival_date).toLocaleDateString() : "";
                  
                  const legText = `${mode}: ${from} -> ${to} ${flight ? `(${flight})` : ""} ${depDate}${arrDate ? ` - ${arrDate}` : ""}`;
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
  const base64Content = Buffer.from(pdfBytes).toString('base64');

  return { content: base64Content };
}
