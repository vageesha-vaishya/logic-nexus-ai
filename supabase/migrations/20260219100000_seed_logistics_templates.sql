
-- Migration to seed default Logistics Quotation Templates
-- Templates: FCL, LCL, Air Freight, Multimodal, Express

-- Ensure the table exists (it should, but just in case)
CREATE TABLE IF NOT EXISTS "public"."quote_templates" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    "tenant_id" uuid, -- Can be null for global/default templates
    "name" text NOT NULL,
    "description" text,
    "category" text, -- 'FCL', 'LCL', 'Air', 'Multimodal', 'Express'
    "content" jsonb DEFAULT '{}'::jsonb,
    "is_active" boolean DEFAULT true,
    "version" integer DEFAULT 1,
    "created_by" uuid,
    "updated_by" uuid,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

-- Insert FCL Template
INSERT INTO "public"."quote_templates" ("name", "description", "category", "content", "is_active", "version")
VALUES (
  'Standard FCL Quote',
  'Full Container Load quotation with container specifications and shipping line options.',
  'FCL',
  '{
    "sections": [
      {
        "id": "header",
        "type": "header",
        "title": "Quotation Header",
        "fields": ["customer_info", "quote_ref", "validity", "contact_info"]
      },
      {
        "id": "cargo_details",
        "type": "cargo_grid",
        "title": "Cargo Details",
        "fields": ["origin", "destination", "commodity", "equipment", "expected_qty"]
      },
      {
        "id": "rates",
        "type": "rates_table",
        "title": "Shipping Line Options",
        "columns": ["Carrier", "Transit Time", "Frequency", "Ocean Freight", "Trucking", "Total", "Remarks"],
        "show_breakdown": true
      },
      {
        "id": "terms",
        "type": "terms_text",
        "title": "Terms & Conditions",
        "content": "Standard FCL Terms apply. Subject to equipment availability."
      }
    ],
    "layout": "standard_logistics",
    "theme": {
      "primary_color": "#008080",
      "header_style": "classic"
    }
  }'::jsonb,
  true,
  1
);

-- Insert LCL Template
INSERT INTO "public"."quote_templates" ("name", "description", "category", "content", "is_active", "version")
VALUES (
  'LCL Consolidation Quote',
  'Less than Container Load quotation focusing on weight/volume calculations.',
  'LCL',
  '{
    "sections": [
      {
        "id": "header",
        "type": "header",
        "title": "LCL Quotation"
      },
      {
        "id": "cargo_details",
        "type": "cargo_grid",
        "title": "Shipment Details",
        "fields": ["origin_cfs", "destination_cfs", "weight_kg", "volume_cbm", "chargeable_weight"]
      },
      {
        "id": "rates",
        "type": "rates_table",
        "title": "Consolidation Rates",
        "columns": ["Service Provider", "Transit Time", "Freight Rate (w/m)", "CFS Charges", "Total", "Remarks"]
      },
      {
        "id": "terms",
        "type": "terms_text",
        "title": "Terms & Conditions",
        "content": "Rates are per w/m. Minimum 1 CBM charge applies."
      }
    ]
  }'::jsonb,
  true,
  1
);

-- Insert Air Freight Template
INSERT INTO "public"."quote_templates" ("name", "description", "category", "content", "is_active", "version")
VALUES (
  'Air Freight Priority',
  'Air Cargo quotation with flight schedules and chargeable weight calculations.',
  'Air',
  '{
    "sections": [
      {
        "id": "header",
        "type": "header",
        "title": "Air Freight Quote"
      },
      {
        "id": "flight_details",
        "type": "route_info",
        "title": "Flight Details",
        "fields": ["airline", "flight_no", "departure", "arrival"]
      },
      {
        "id": "rates",
        "type": "rates_table",
        "title": "Air Rates",
        "columns": ["Airline", "Service Level", "Rate/Kg", "FSC", "SSC", "Total", "Transit"]
      },
      {
        "id": "terms",
        "type": "terms_text",
        "title": "Terms & Conditions",
        "content": "Subject to space availability. Rates based on chargeable weight (1:6000)."
      }
    ]
  }'::jsonb,
  true,
  1
);

-- Insert Multimodal Template
INSERT INTO "public"."quote_templates" ("name", "description", "category", "content", "is_active", "version")
VALUES (
  'Multimodal Integrated Quote',
  'Combined transport quotation (e.g., Sea-Air, Rail-Truck) with leg breakdown.',
  'Multimodal',
  '{
    "sections": [
      {
        "id": "header",
        "type": "header",
        "title": "Multimodal Logistics Solution"
      },
      {
        "id": "route_map",
        "type": "route_visual",
        "title": "Routing",
        "fields": ["legs", "modes", "transfer_points"]
      },
      {
        "id": "rates",
        "type": "rates_table",
        "title": "Combined Rates",
        "columns": ["Route Option", "Total Transit", "Leg 1 Cost", "Leg 2 Cost", "Total Cost"]
      },
      {
        "id": "terms",
        "type": "terms_text",
        "title": "Terms & Conditions",
        "content": "Combined Transport Bill of Lading terms apply."
      }
    ]
  }'::jsonb,
  true,
  1
);

-- Insert Express Template
INSERT INTO "public"."quote_templates" ("name", "description", "category", "content", "is_active", "version")
VALUES (
  'Express Courier Quote',
  'Door-to-Door express delivery quotation.',
  'Express',
  '{
    "sections": [
      {
        "id": "header",
        "type": "header",
        "title": "Express Delivery Quote"
      },
      {
        "id": "pickup_delivery",
        "type": "address_block",
        "title": "Pickup & Delivery",
        "fields": ["sender_address", "receiver_address"]
      },
      {
        "id": "rates",
        "type": "rates_table",
        "title": "Courier Options",
        "columns": ["Provider", "Service", "Delivery By", "Total Price"]
      },
      {
        "id": "terms",
        "type": "terms_text",
        "title": "Terms & Conditions",
        "content": "Door-to-door service. Duties and taxes excluded unless specified."
      }
    ]
  }'::jsonb,
  true,
  1
);
