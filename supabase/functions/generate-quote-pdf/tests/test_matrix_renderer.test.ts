
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';

// Mock Deno global object for Node environment
if (typeof (globalThis as any).Deno === 'undefined') {
  (globalThis as any).Deno = {
    env: {
      get: (_key: string) => undefined,
    }
  };
}

import { PdfRenderer } from '../engine/renderer';
import { SafeContext } from '../engine/context';
import { Logger } from '../../_shared/logger';
import fs from 'fs';
import path from 'path';

// Mock Logger
const logger = new Logger(null, { context: "test-context" });

// Mock Template with Detailed Matrix
const mockTemplate: any = {
  name: "MGL-Main-Template",
  version: "1.0.0",
  layout_engine: "v2_flex_grid",
  config: {
    page_size: "A4" as const,
    margins: { top: 20, right: 20, bottom: 20, left: 20 },
    default_locale: "en-US",
    font_family: "Helvetica",
    compliance: "None" as const,
    colors: {
      primary: "#0087b5",
      secondary: "#dceef2",
      accent: "#333333",
      text: "#000000"
    }
  },
  sections: [
    {
      id: "header",
      type: "header" as const,
      content: { text: "MGL QUOTE TEST" },
      height: 50
    },
    {
      id: "matrix_section",
      type: "detailed_matrix_rate_table" as const,
      config: {
        title: "Rate Options Matrix",
        group_by: ["carrier", "transit_time", "frequency"],
        show_total: true,
        show_breakdown: true
      },
      content: {
        text: "Freight Rates Breakdown"
      }
    }
  ]
};

// Mock Context mimicking the migration seed data structure as SafeContext
const mockContext: SafeContext = {
  meta: {
    generated_at: new Date().toISOString(),
    locale: "en-US"
  },
  branding: {
    primary_color: "#0087b5",
    secondary_color: "#dceef2",
    accent_color: "#333333",
    company_name: "MGL Matrix Test Customer",
    company_address: "123 Test St",
    font_family: "Helvetica",
    header_text: "",
    sub_header_text: "",
    footer_text: "",
    disclaimer_text: ""
  },
  legs: [],
  items: [],
  charges: [],
  quote: {
    number: "QUO-MGL-MATRIX-TEST",
    quote_number: "QUO-MGL-MATRIX-TEST",
    date: new Date().toISOString(),
    created_at: new Date().toISOString(),
    currency: "USD",
    service_level: "Standard",
    grand_total: 0,
    origin: { location_name: "Shanghai" },
    destination: { location_name: "Los Angeles" }
  },
  customer: {
    name: "MGL Matrix Test Customer",
    company_name: "MGL Matrix Test Customer",
    contact: "Test User",
    contact_name: "Test User",
    email: "test@example.com",
    phone: "123-456-7890",
    address: "123 Test St",
    full_address: "123 Test St, Shanghai",
    code: "CUST-001",
    inquiry_number: "INQ-001"
  },
  options: [
    // MSC - 20SD
    {
      id: "opt-1",
      carrier: "MSC",
      transit_time: "25 Days",
      frequency: "Weekly",
      container_size: "20SD",
      grand_total: 1650,
      charges: [
        { desc: "Freight", total: 1500, curr: "USD" },
        { desc: "THC/O", total: 150, curr: "USD", note: "THC/O" }
      ],
      legs: [{ seq: 1, carrier: "MSC", carrier_name: "MSC", mode: "Ocean", origin: "Shanghai", destination: "Los Angeles", pol: "Shanghai", pod: "Los Angeles" }]
    },
    // MSC - 40SD
    {
      id: "opt-2",
      carrier: "MSC",
      transit_time: "25 Days",
      frequency: "Weekly",
      container_size: "40SD",
      grand_total: 2950,
      charges: [
        { desc: "Freight", total: 2800, curr: "USD" },
        { desc: "THC/O", total: 150, curr: "USD", note: "THC/O" }
      ],
      legs: [{ seq: 1, carrier: "MSC", carrier_name: "MSC", mode: "Ocean", origin: "Shanghai", destination: "Los Angeles", pol: "Shanghai", pod: "Los Angeles" }]
    },
    // MSC - 40HQ
    {
      id: "opt-3",
      carrier: "MSC",
      transit_time: "25 Days",
      frequency: "Weekly",
      container_size: "40HQ",
      grand_total: 3050,
      charges: [
        { desc: "Freight", total: 2900, curr: "USD" },
        { desc: "THC/O", total: 150, curr: "USD", note: "THC/O" }
      ],
      legs: [{ seq: 1, carrier: "MSC", carrier_name: "MSC", mode: "Ocean", origin: "Shanghai", destination: "Los Angeles", pol: "Shanghai", pod: "Los Angeles" }]
    },
    
    // Maersk - 20SD (Includes Remarks)
    {
      id: "opt-4",
      carrier: "Maersk",
      transit_time: "22 Days",
      frequency: "Weekly",
      container_size: "20SD",
      grand_total: 1700,
      remarks: "Rates subject to space availability.",
      charges: [
        { desc: "Freight", total: 1550, curr: "USD", note: "Includes BAF" },
        { desc: "Doc Fee", total: 50, curr: "USD", note: "Doc Fee" },
        { desc: "THC/O", total: 100, curr: "USD", note: "THC/O" }
      ],
      legs: [{ seq: 1, carrier: "Maersk", carrier_name: "Maersk", mode: "Ocean", origin: "Shanghai", destination: "Los Angeles", pol: "Shanghai", pod: "Los Angeles" }]
    },
    // Maersk - 40SD
    {
      id: "opt-5",
      carrier: "Maersk",
      transit_time: "22 Days",
      frequency: "Weekly",
      container_size: "40SD",
      grand_total: 3100,
      remarks: "Rates subject to space availability.",
      charges: [
        { desc: "Freight", total: 2950, curr: "USD", note: "Includes BAF" },
        { desc: "Doc Fee", total: 50, curr: "USD", note: "Doc Fee" },
        { desc: "THC/O", total: 100, curr: "USD", note: "THC/O" }
      ],
      legs: [{ seq: 1, carrier: "Maersk", carrier_name: "Maersk", mode: "Ocean", origin: "Shanghai", destination: "Los Angeles", pol: "Shanghai", pod: "Los Angeles" }]
    },

    // CMA CGM - 40HQ Only
    {
      id: "opt-6",
      carrier: "CMA CGM",
      transit_time: "28 Days",
      frequency: "Bi-Weekly",
      container_size: "40HQ",
      grand_total: 3200,
      charges: [
        { desc: "Freight", total: 3000, curr: "USD", note: "Subject to GRI" },
        { desc: "THC/O", total: 200, curr: "USD", note: "THC/O" }
      ],
      legs: [{ seq: 1, carrier: "CMA CGM", carrier_name: "CMA CGM", mode: "Ocean", origin: "Shanghai", destination: "Los Angeles", pol: "Shanghai", pod: "Los Angeles" }]
    },

    // Hapag-Lloyd - All 3
    {
      id: "opt-7",
      carrier: "Hapag-Lloyd",
      transit_time: "24 Days",
      frequency: "Weekly",
      container_size: "20SD",
      grand_total: 1600,
      charges: [
        { desc: "Freight", total: 1600, curr: "USD" }
      ],
      legs: [{ seq: 1, carrier: "Hapag-Lloyd", carrier_name: "Hapag-Lloyd", mode: "Ocean", origin: "Shanghai", destination: "Los Angeles", pol: "Shanghai", pod: "Los Angeles" }]
    },
    {
      id: "opt-8",
      carrier: "Hapag-Lloyd",
      transit_time: "24 Days",
      frequency: "Weekly",
      container_size: "40SD",
      grand_total: 2900,
      charges: [
        { desc: "Freight", total: 2900, curr: "USD" }
      ],
      legs: [{ seq: 1, carrier: "Hapag-Lloyd", carrier_name: "Hapag-Lloyd", mode: "Ocean", origin: "Shanghai", destination: "Los Angeles", pol: "Shanghai", pod: "Los Angeles" }]
    },
    {
      id: "opt-9",
      carrier: "Hapag-Lloyd",
      transit_time: "24 Days",
      frequency: "Weekly",
      container_size: "40HQ",
      grand_total: 3000,
      charges: [
        { desc: "Freight", total: 3000, curr: "USD" }
      ],
      legs: [{ seq: 1, carrier: "Hapag-Lloyd", carrier_name: "Hapag-Lloyd", mode: "Ocean", origin: "Shanghai", destination: "Los Angeles", pol: "Shanghai", pod: "Los Angeles" }]
    }
  ],
  mode: "single"
};

describe('Detailed Matrix Rate Table Renderer', () => {
  it('should render detailed matrix rate table and save to PDF', async () => {
    // 1. Render PDF
    const renderer = new PdfRenderer(mockTemplate, mockContext, logger);
    const pdfBytes = await renderer.render();
    
    // 2. Verify Output
    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(0);
    console.log(`PDF Generated Successfully! Size: ${pdfBytes.length} bytes`);
    
    // 3. Write to file
    const outputPath = path.resolve(__dirname, 'test_matrix_output.pdf');
    try {
        fs.writeFileSync(outputPath, pdfBytes);
        console.log(`Saved to ${outputPath}`);
    } catch (err) {
        console.error("Failed to write file:", err);
        throw err;
    }
  });
});
