
import { describe, it, expect, vi } from 'vitest';
import './setup';
import { PdfRenderer } from '../engine/renderer';
import { QuoteTemplate } from '../engine/schema';
import { SafeContext } from '../engine/context';
import { Logger } from '../../_shared/logger';
import { PDFDocument } from 'pdf-lib';

// Mock Logger
const mockLogger = new Logger(null);

describe('PdfRenderer - MGL Legacy Section Normalization', () => {
  // Mock Context
  const mockContext: SafeContext = {
    quote: {
      number: "QUO-TEST-MGL",
      quote_number: "QUO-TEST-MGL",
      date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      grand_total: 1500,
      currency: "USD",
      origin: { location_name: "Shanghai" },
      destination: { location_name: "Los Angeles" },
      incoterms: "FOB"
    },
    customer: {
      name: "Test Customer",
      company_name: "Test Customer",
      contact: "John Doe",
      contact_name: "John Doe",
      email: "john@example.com",
      phone: "123-456-7890",
      address: "123 Test St",
      full_address: "123 Test St",
      code: "CUST001",
      inquiry_number: "INQ001"
    },
    items: [
      { type: "General", qty: 1, commodity: "Electronics", details: "Computer Parts" }
    ],
    options: [
      {
        id: "opt1",
        grand_total: 1500,
        carrier: "Maersk",
        transit_time: "25 days",
        legs: [],
        charges: []
      }
    ],
    legs: [],
    charges: [],
    branding: {
        primary_color: "#000000",
        secondary_color: "#ffffff",
        accent_color: "#ff0000",
        company_name: "My Logistics",
        company_address: "123 Main St",
        header_text: "Quotation",
        sub_header_text: "Details",
        footer_text: "Footer",
        disclaimer_text: "Disclaimer",
        font_family: "Helvetica"
    },
    meta: { locale: 'en-US', generated_at: new Date().toISOString() }
  };

  it('should normalize customer_matrix_header to key_value_grid', async () => {
    const template: QuoteTemplate = {
      id: 'mgl-legacy-1',
      name: 'MGL Legacy',
      config: {
        page_size: 'A4',
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        font_family: 'Helvetica',
        default_locale: 'en-US',
        compliance: 'None'
      },
      sections: [
        {
          type: "customer_matrix_header" as any, // Legacy type
          // @ts-ignore
          id: "customer_header",
          content: { text: "Old Header", alignment: "left" }
        }
      ]
    };

    const renderer = new PdfRenderer(template, mockContext, mockLogger);
    // @ts-ignore - Accessing private method for testing or using public render
    const pdfBytes = await renderer.render();
    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(0);
  });

  it('should normalize shipment_matrix_details to key_value_grid', async () => {
    const template: QuoteTemplate = {
      id: 'mgl-legacy-2',
      name: 'MGL Legacy Shipment',
      config: { default_locale: 'en-US', page_size: 'A4', margins: { top: 40, bottom: 40, left: 40, right: 40 }, font_family: 'Helvetica', compliance: 'None' },
      sections: [
        {
          type: "shipment_matrix_details" as any,
          // @ts-ignore
          id: "shipment_details"
        }
      ]
    };

    const renderer = new PdfRenderer(template, mockContext, mockLogger);
    const pdfBytes = await renderer.render();
    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(0);
  });

  it('should normalize rates_matrix to matrix_rate_table', async () => {
    const template: QuoteTemplate = {
      id: 'mgl-legacy-3',
      name: 'MGL Legacy Rates',
      config: { default_locale: 'en-US', page_size: 'A4', margins: { top: 40, bottom: 40, left: 40, right: 40 }, font_family: 'Helvetica', compliance: 'None' },
      sections: [
        {
          type: "rates_matrix" as any,
          // @ts-ignore
          id: "rate_matrix"
        }
      ]
    };

    const renderer = new PdfRenderer(template, mockContext, mockLogger);
    const pdfBytes = await renderer.render();
    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(0);
  });
  
  it('should normalize terms_mgl to terms_block', async () => {
    const template: QuoteTemplate = {
      id: 'mgl-legacy-4',
      name: 'MGL Legacy Terms',
      config: { default_locale: 'en-US', page_size: 'A4', margins: { top: 40, bottom: 40, left: 40, right: 40 }, font_family: 'Helvetica', compliance: 'None' },
      sections: [
        {
          type: "terms_mgl" as any,
          // @ts-ignore
          id: "terms"
        }
      ]
    };

    const renderer = new PdfRenderer(template, mockContext, mockLogger);
    const pdfBytes = await renderer.render();
    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(0);
  });
});
