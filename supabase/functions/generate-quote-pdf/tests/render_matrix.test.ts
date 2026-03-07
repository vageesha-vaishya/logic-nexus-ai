
import { describe, it, expect } from 'vitest';
import { PdfRenderer } from '../engine/renderer';
import { SafeContext } from '../engine/context';
import { Logger } from '../../_shared/logger';
import './setup';

describe('PdfRenderer - Detailed Matrix Rate Table', () => {
  const mockLogger = new Logger(null);
  
  const mockContext: SafeContext = {
    quote: {
      number: "QUO-MATRIX-001",
      quote_number: "QUO-MATRIX-001",
      date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      expiry: new Date(Date.now() + 86400000).toISOString(),
      expiration_date: new Date(Date.now() + 86400000).toISOString(),
      service_level: "Standard",
      currency: "USD",
      grand_total: 6500,
      origin: { location_name: "Shanghai" },
      destination: { location_name: "Los Angeles" }
    },
    customer: {
      name: "Test Customer",
      company_name: "Test Customer",
      contact: "Jane Doe",
      contact_name: "Jane Doe",
      address: "456 Test Ave",
      full_address: "456 Test Ave",
      phone: "555-0456",
      email: "jane@example.com",
      code: "CUST002",
      inquiry_number: "INQ-888"
    },
    items: [],
    legs: [],
    charges: [],
    options: [
      {
        id: "opt-1",
        carrier: "Maersk",
        transit_time: "18 Days",
        frequency: "Weekly",
        container_size: "40'",
        container_type: "40' HC",
        grand_total: 5500,
        charges: [
          { desc: "Ocean Freight", total: 4000, curr: "USD" },
          { desc: "THC Origin", total: 200, curr: "USD" }
        ],
        legs: [
           { seq: 1, mode: "Ocean", origin: "Shanghai", destination: "Los Angeles", carrier_name: "Maersk", transit_time: "18 Days" }
        ]
      },
      {
        id: "opt-2",
        carrier: "Maersk",
        transit_time: "18 Days",
        frequency: "Weekly",
        container_size: "20'",
        container_type: "20' GP",
        grand_total: 3500,
        charges: [
          { desc: "Ocean Freight", total: 2500, curr: "USD" },
          { desc: "THC Origin", total: 150, curr: "USD" }
        ],
        legs: [
           { seq: 1, mode: "Ocean", origin: "Shanghai", destination: "Los Angeles", carrier_name: "Maersk", transit_time: "18 Days" }
        ]
      },
      {
        id: "opt-3",
        carrier: "MSC",
        transit_time: "22 Days",
        frequency: "Bi-Weekly",
        container_size: "40'",
        container_type: "40' HC",
        grand_total: 5200,
        charges: [
          { desc: "Ocean Freight", total: 3800, curr: "USD" },
          { desc: "THC Origin", total: 200, curr: "USD" }
        ],
        legs: [
           { seq: 1, mode: "Ocean", origin: "Shanghai", destination: "Los Angeles", carrier_name: "MSC", transit_time: "22 Days" }
        ]
      }
    ],
    meta: {
      locale: "en-US",
      generated_at: new Date().toISOString()
    },
    branding: {
      company_name: "Matrix Logistics",
      company_address: "789 Matrix Blvd",
      primary_color: "#0087b5",
      secondary_color: "#dceef2",
      accent_color: "#000000",
      font_family: "Helvetica",
      header_text: "Rate Matrix Quote",
      sub_header_text: "Details",
      footer_text: "Page",
      disclaimer_text: "Terms apply"
    }
  };

  const matrixTemplate = {
    name: "MGL-Matrix-Test",
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
    sections: [
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

  it('should render detailed matrix rate table correctly', async () => {
    // @ts-ignore
    const renderer = new PdfRenderer(matrixTemplate, mockContext, mockLogger);
    const pdfBytes = await renderer.render();
    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(0);
  });
});
