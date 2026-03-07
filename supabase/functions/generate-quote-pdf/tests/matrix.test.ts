
import { describe, it, expect } from 'vitest';
import { PdfRenderer } from '../engine/renderer';
import { QuoteTemplate } from '../engine/schema';
import { SafeContext } from '../engine/context';
import { Logger } from '../../_shared/logger';
import './setup';

describe('PdfRenderer - Matrix Rate Table', () => {
  const mockLogger = new Logger(null);

  const mglTemplate: QuoteTemplate = {
    id: 'mgl-test',
    name: 'MGL Main Template',
    config: {
      page_size: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      font_family: 'Roboto',
      default_locale: 'en-US',
      compliance: 'None'
    },
    sections: [
      {
        type: "detailed_matrix_rate_table",
        height: 300,
        page_break_before: false,
        config: {
            show_total: true,
            group_by: ["carrier", "transit_time", "frequency"]
        },
        content: {
            text: "Freight Rates Breakdown"
        }
      }
    ]
  };

  const mockContext: SafeContext = {
    quote: {
      number: "QUO-MGL-TEST",
      quote_number: "QUO-MGL-TEST",
      date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      expiry: new Date(Date.now() + 86400000).toISOString(),
      expiration_date: new Date(Date.now() + 86400000).toISOString(),
      service_level: "Standard",
      currency: "USD",
      grand_total: 0,
      origin: { location_name: "Shanghai" },
      destination: { location_name: "Los Angeles" }
    },
    customer: {
      name: "Test Customer",
      company_name: "Test Customer",
      contact: "John Doe",
      contact_name: "John Doe",
      email: "test@example.com",
      phone: "123-456-7890",
      full_address: "123 Test St",
      address: "123 Test St",
      code: "CUST001",
      inquiry_number: "INQ001"
    },
    items: [],
    legs: [],
    charges: [],
    options: [
      // Carrier: Zim
      {
        id: "zim-20",
        carrier: "Zim",
        transit_time: "1",
        frequency: "1",
        container_size: "Standard - 20'",
        container_type: "Standard - 20'",
        grand_total: 3500,
        legs: [],
        charges: [
          { desc: "Ocean Freight", total: 2000, curr: "USD" },
          { desc: "Trucking", total: 1500, curr: "USD" }
        ]
      },
      {
        id: "zim-40-ot",
        carrier: "Zim",
        transit_time: "1",
        frequency: "1",
        container_size: "Open Top - 40'",
        container_type: "Open Top - 40'",
        grand_total: 3500,
        legs: [],
        charges: [
          { desc: "Ocean Freight", total: 2000, curr: "USD" },
          { desc: "Trucking", total: 1500, curr: "USD" }
        ]
      },
      // Carrier: EVERGREEN LINES (with 0 value charge)
      {
        id: "evergreen-20",
        carrier: "EVERGREEN LINES",
        transit_time: "",
        frequency: "",
        container_size: "Standard - 20'",
        container_type: "Standard - 20'",
        grand_total: 3800,
        legs: [],
        charges: [
          { desc: "EPS", total: 300, curr: "USD" },
          { desc: "Ocean Freight", total: 2000, curr: "USD" },
          { desc: "Trucking", total: 1500, curr: "USD" }
        ]
      },
      {
          id: "evergreen-platform-20",
          carrier: "EVERGREEN LINES",
          transit_time: "",
          frequency: "",
          container_size: "Platform - 20'",
          container_type: "Platform - 20'",
          grand_total: 3500,
          legs: [],
          charges: [
            { desc: "EPS", total: 0, curr: "USD" }, // Zero value test
            { desc: "Ocean Freight", total: 2000, curr: "USD" },
            { desc: "Trucking", total: 1500, curr: "USD" }
          ]
      }
    ],
    meta: {
      locale: "en-US",
      generated_at: new Date().toISOString()
    },
    branding: {
      company_name: "MGL",
      primary_color: "#000000",
      secondary_color: "#ffffff",
      accent_color: "#cccccc",
      company_address: "123 Main St",
      font_family: "Helvetica",
      header_text: "Header",
      sub_header_text: "Sub Header",
      footer_text: "Footer",
      disclaimer_text: "Disclaimer",
      logo_url: "http://example.com/logo.png"
    }
  };

  it('should render Matrix Rate Table successfully with 0 values', async () => {
    const renderer = new PdfRenderer(mglTemplate, mockContext, mockLogger);
    const pdfBytes = await renderer.render();
    
    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(0);
  });
});
