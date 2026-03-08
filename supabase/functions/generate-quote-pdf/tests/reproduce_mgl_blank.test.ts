
import { describe, it, expect } from 'vitest';
import { PdfRenderer } from '../engine/renderer';
import { QuoteTemplate } from '../engine/schema';
import { SafeContext } from '../engine/context';
import { Logger } from '../../_shared/logger';
import './setup'; // Assuming setup exists for fonts etc

describe('PdfRenderer - MGL Blank PDF Reproduction', () => {
  const mockLogger = new Logger(null);

  const mglTemplate: QuoteTemplate = {
    id: 'mgl-repro',
    name: 'MGL Standard Granular',
    config: {
      page_size: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      font_family: 'Helvetica',
      default_locale: 'en-US',
    },
    sections: [
      {
        type: "detailed_matrix_rate_table",
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
      number: "QUO-260303-00002",
      quote_number: "QUO-260303-00002",
      date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      expiry: new Date(Date.now() + 86400000).toISOString(),
      expiration_date: new Date(Date.now() + 86400000).toISOString(),
      service_level: "Standard",
      currency: "USD",
      grand_total: 1200,
      origin: { location_name: "Shanghai" },
      destination: { location_name: "Los Angeles" }
    },
    customer: {
      company_name: "Test Customer",
      contact_name: "John Doe"
    },
    // Standard Options Structure (as seen in debug_data.cjs)
    options: [
        {
            id: "opt-1",
            grand_total: 1200,
            legs: [
                { mode: "Ocean", pol: "Shanghai", pod: "Los Angeles", carrier_name: "Maersk", transit_time: "14 Days" }
            ],
            charges: [
                { description: "Ocean Freight", amount: 1000, currency: "USD", charge_side_id: "sell-id", unit_price: 1000, quantity: 1 },
                { description: "THC", amount: 200, currency: "USD", charge_side_id: "sell-id", unit_price: 200, quantity: 1 }
            ]
            // Missing: container_size, container_type, frequency
        },
        {
            id: "opt-2",
            grand_total: 1300,
            legs: [
                { mode: "Ocean", pol: "Shanghai", pod: "Los Angeles", carrier_name: "CMA CGM", transit_time: "16 Days" }
            ],
            charges: [
                { description: "Ocean Freight", amount: 1100, currency: "USD", charge_side_id: "sell-id", unit_price: 1100, quantity: 1 },
                { description: "THC", amount: 200, currency: "USD", charge_side_id: "sell-id", unit_price: 200, quantity: 1 }
            ]
        }
    ],
    items: [],
    legs: [],
    charges: [],
    meta: {
      locale: "en-US",
      generated_at: new Date().toISOString()
    },
    branding: {
      company_name: "Miami Global Lines",
      primary_color: "#0087b5"
    }
  };

  const templates = [
      { id: 'mgl-std', name: 'MGL Standard Granular' },
      { id: 'mgl-fcl', name: 'MGL FCL Quote' },
      { id: 'mgl-gran', name: 'MGL Granular Quote' }
  ];

  templates.forEach(tmpl => {
      it(`renders detailed matrix rate table for ${tmpl.name}`, async () => {
        const template = { ...mglTemplate, id: tmpl.id, name: tmpl.name };
        const renderer = new PdfRenderer(template, mockContext, mockLogger);
        const pdfBytes = await renderer.render();
        
        expect(pdfBytes).toBeDefined();
        expect(pdfBytes.length).toBeGreaterThan(0);
        
        console.log(`Generated PDF size for ${tmpl.name}: ${pdfBytes.length} bytes`);
      });
  });

  it('renders standard matrix rate table (regression check)', async () => {
      const stdTemplate: QuoteTemplate = {
          ...mglTemplate,
          id: 'std-template',
          name: 'Standard Template',
          sections: [
              {
                  type: "matrix_rate_table", // Non-detailed
                  config: { show_total: true, group_by: ["carrier"] },
                  content: { text: "Standard Rates" }
              }
          ]
      };
      const renderer = new PdfRenderer(stdTemplate, mockContext, mockLogger);
      const pdfBytes = await renderer.render();
      expect(pdfBytes).toBeDefined();
      expect(pdfBytes.length).toBeGreaterThan(0);
      console.log(`Generated PDF size for Standard Template: ${pdfBytes.length} bytes`);
  });
});
