
// @vitest-environment node
import { describe, it, expect, beforeAll, vi } from 'vitest';

// Mock Deno global before imports
if (typeof (globalThis as any).Deno === 'undefined') {
  (globalThis as any).Deno = {
    env: {
      get: (key: string) => process.env[key],
      toObject: () => process.env,
    },
  };
}

import { createClient } from '@supabase/supabase-js';
import { PdfRenderer } from '../engine/renderer';
import { SafeContext } from '../engine/context';
import { Logger } from '../../_shared/logger';
import fs from 'fs';
import path from 'path';

// Helper to load .env manually if not loaded
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      });
    }
  } catch (e) {
    console.error("Failed to load .env", e);
  }
}

describe('MGL Live Integration', () => {
  let supabase: any;
  let logger: Logger;

  beforeAll(() => {
    loadEnv();
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      console.warn("Skipping live integration test: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return;
    }

    supabase = createClient(url, key);
    logger = new Logger(null);
  });

  const mglTemplates = [
    'MGL Standard Granular',
    'MGL FCL Quote',
    'MGL Granular Quote'
  ];

  // Mock Context for QUO-260303-00002
  const mockContext: SafeContext = {
    quote: {
      number: "QUO-260303-00002",
      quote_number: "QUO-260303-00002",
      date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      expiry: new Date(Date.now() + 86400000 * 30).toISOString(),
      expiration_date: new Date(Date.now() + 86400000 * 30).toISOString(),
      service_level: "Standard",
      currency: "USD",
      grand_total: 12500.00,
      origin: { location_name: "Miami, FL" },
      destination: { location_name: "London, UK" }
    },
    customer: {
      name: "Test Client",
      company_name: "Test Client Corp",
      contact: "John Smith",
      contact_name: "John Smith",
      address: "123 Test Ave",
      full_address: "123 Test Ave, Miami, FL",
      phone: "305-555-0123",
      email: "test@example.com",
      code: "CUST-001",
      inquiry_number: "INQ-2026-001"
    },
    items: [
      { type: "40' HC", qty: 2, commodity: "General Cargo", details: "Furniture" }
    ],
    legs: [
      { seq: 1, mode: "Truck", origin: "Miami Warehouse", destination: "Port of Miami", carrier_name: "Local Trucking" },
      { seq: 2, mode: "Ocean", origin: "Port of Miami", destination: "Port of London", carrier_name: "Maersk" },
      { seq: 3, mode: "Truck", origin: "Port of London", destination: "London Warehouse", carrier_name: "UK Haulage" }
    ],
    charges: [
      { desc: "Ocean Freight", total: 10000, curr: "USD", qty: 2, unit_price: 5000 },
      { desc: "THC Origin", total: 500, curr: "USD", qty: 2, unit_price: 250 },
      { desc: "THC Dest", total: 500, curr: "GBP", qty: 2, unit_price: 250 }
    ],
    options: [], // Can be populated if needed for multi-option templates
    meta: {
      locale: "en-US",
      generated_at: new Date().toISOString()
    },
    branding: {
      company_name: "Miami Global Lines",
      company_address: "100 Port Blvd, Miami, FL",
      primary_color: "#003366",
      secondary_color: "#CCCCCC",
      accent_color: "#FF0000",
      font_family: "Helvetica",
      header_text: "Freight Quotation",
      sub_header_text: "Thank you for your business",
      footer_text: "Page",
      disclaimer_text: "Standard trading conditions apply."
    }
  };

  mglTemplates.forEach(templateName => {
    it(`should render ${templateName} successfully using live template data`, async () => {
      if (!supabase) {
        console.warn("Skipping test due to missing credentials");
        return;
      }

      // 1. Fetch template
      const { data: templateData, error } = await supabase
        .from('quote_templates')
        .select('*')
        .or(`name.eq."${templateName}",template_name.eq."${templateName}"`)
        .limit(1)
        .single();

      if (error) {
        console.warn(`Template ${templateName} not found in DB: ${error.message}`);
        // Skip if not found (might be local dev env without data)
        return;
      }

      expect(templateData).toBeDefined();

      // 2. Prepare content
      let content = templateData.content;
      if (typeof content === 'string') {
        try {
          content = JSON.parse(content);
        } catch (e) {
          content = {};
        }
      }
      
      const fullTemplate = {
        ...content,
        id: templateData.id,
        name: templateData.template_name || templateData.name,
        tenant_id: templateData.tenant_id
      };

      // 3. Render
      console.log(`Template: ${templateName}`);
      if (templateName === 'MGL Granular Quote') {
         console.log('MGL Granular Quote Content:', JSON.stringify(fullTemplate, null, 2));
      }
      if (fullTemplate.sections) {
        console.log('Section Types:', fullTemplate.sections.map((s: any) => s.type));
      }
      
      const renderer = new PdfRenderer(fullTemplate, mockContext, logger);
      const pdfBytes = await renderer.render();

      // 4. Verify
      expect(pdfBytes).toBeDefined();
      expect(pdfBytes.length).toBeGreaterThan(0);
      console.log(`Successfully rendered ${templateName}, size: ${pdfBytes.length} bytes`);
    });
  });
});
