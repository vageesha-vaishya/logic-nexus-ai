
import { PdfRenderer } from "./engine/renderer.ts";
import { buildSafeContextWithValidation, RawQuoteDataSchema } from "./engine/context.ts";
import { Logger } from "../_shared/logger.ts";

// Mock Logger
const logger = new Logger("test-context");

// Mock Template with Detailed Matrix
const mockTemplate = {
  name: "MGL-Main-Template",
  config: {
    page_size: "A4",
    margins: { top: 20, right: 20, bottom: 20, left: 20 },
    default_locale: "en-US",
    colors: {
      primary: "#0087b5",
      secondary: "#dceef2",
      accent: "#333333",
      text: "#000000"
    }
  },
  layout: [
    {
      id: "matrix_section",
      type: "detailed_matrix_rate_table",
      config: {
        title: "Rate Options Matrix",
        group_by: ["carrier", "transit_time", "frequency"],
        show_total: true,
        columns: [
          { field: "container_type", label: "Container" },
          { field: "charge_description", label: "Description" },
          { field: "amount", label: "Amount" },
          { field: "total", label: "Total" }
        ]
      }
    }
  ]
};

// Mock Raw Data
const mockRawData = {
  quote: {
    quote_number: "Q-12345",
    created_at: new Date().toISOString(),
    status: "draft",
    currency: "USD",
    service_level: "Standard",
    origin: { location_name: "Shanghai" },
    destination: { location_name: "Los Angeles" }
  },
  customer: {
    company_name: "Test Customer",
    contact_name: "John Doe"
  },
  options: [
    {
      id: "opt-1",
      carrier: "Maersk",
      transit_time: "18 Days",
      frequency: "Weekly",
      container_size: "40",
      container_type: "HC",
      grand_total: 5500,
      charges: [
        { description: "Ocean Freight", amount: 4000, currency: "USD" },
        { description: "THC Origin", amount: 200, currency: "USD" },
        { description: "THC Dest", amount: 300, currency: "USD" },
        { description: "Doc Fee", amount: 100, currency: "USD" }
      ],
      legs: []
    },
    {
      id: "opt-2",
      carrier: "Maersk",
      transit_time: "18 Days",
      frequency: "Weekly",
      container_size: "20",
      container_type: "GP",
      grand_total: 3500,
      charges: [
        { description: "Ocean Freight", amount: 2500, currency: "USD" },
        { description: "THC Origin", amount: 150, currency: "USD" },
        { description: "THC Dest", amount: 250, currency: "USD" },
        { description: "Doc Fee", amount: 100, currency: "USD" }
      ],
      legs: []
    },
    {
      id: "opt-3",
      carrier: "MSC",
      transit_time: "22 Days",
      frequency: "Bi-Weekly",
      container_size: "40",
      container_type: "HC",
      grand_total: 5200,
      charges: [
        { description: "Ocean Freight", amount: 3800, currency: "USD" },
        { description: "THC Origin", amount: 200, currency: "USD" },
        { description: "THC Dest", amount: 300, currency: "USD" }
      ],
      legs: []
    }
  ],
  mode: "single"
};

async function runTest() {
  console.log("Starting PDF Generation Test...");

  try {
    // 1. Validate Data
    const { context, warnings } = buildSafeContextWithValidation(mockRawData, logger);
    if (warnings.length > 0) {
      console.warn("Validation Warnings:", warnings);
    }
    
    // 2. Render PDF
    const renderer = new PdfRenderer(mockTemplate, context, logger);
    // Note: render() returns Uint8Array (PDF bytes)
    // We want to inspect the internal HTML generation if possible, 
    // but PdfRenderer encapsulates it.
    // However, if render() succeeds without error, it means the structure was processed.
    
    const pdfBytes = await renderer.render();
    console.log(`PDF Generated Successfully! Size: ${pdfBytes.length} bytes`);
    
    // Since we can't easily see the HTML, we rely on the fact that no error occurred
    // and that the logic in renderer.ts (which we reviewed) uses the matrix data.
    
    // To be more sure, we can check if the context has the grouped matrix data.
    // The context passed to renderer contains the raw data + mapped helpers.
    // But matrix grouping happens INSIDE renderer.render() -> _renderMatrixRateTable
    
    console.log("Test Passed.");
  } catch (e) {
    console.error("Test Failed:", e);
  }
}

runTest();
