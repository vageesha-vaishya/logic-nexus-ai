-- Migration: Seed MGL Granular Template
-- Description: Adds a new quote template for MGL with granular rate breakdown support.
-- NOTE: The quote_templates schema uses a JSONB "content" field. We store the layout and configuration inside content.

WITH payload AS (
  SELECT 
    'MGL Granular Quote'::text AS name,
    'MGL FCL Quote with granular rate breakdown (Ocean, Trucking, etc.) per leg/mode.'::text AS description,
    'FCL'::text AS category,
    '{
      "layout": "mgl_granular",
      "header": {
        "show_logo": true,
        "show_address": true,
        "provider_details": {
          "name": "Miami Global Lines",
          "address": "140 Ethel Road West; Unit ''S&T'', Piscataway, NJ 08854–USA",
          "phone": "+1-732-640-2365",
          "fmc_lic": "023172NF",
          "iac_no": "NE1210010"
        }
      },
      "sections": [
        { "id": "customer_info", "title": "Customer Information", "visible": true },
        { "id": "shipment_details", "title": "Shipment Details", "visible": true },
        { "id": "rate_matrix", "title": "Carrier Rates", "visible": true, "show_breakdown": true },
        { "id": "terms", "title": "Terms & Conditions", "visible": true }
      ],
      "terms": {
        "exclusions": [
          "Destination charges",
          "Cargo Insurance",
          "Taxes / duties",
          "Demurrage / Detention / Storage"
        ],
        "notes": [
          "Rates are on PER UNIT basis",
          "VATOS (Valid at time of shipping)",
          "Trucking: One hour free load, thereafter USD 100/hr",
          "Max weight: 44,000 LBS per standard US road limitations"
        ]
      }
    }'::jsonb AS content
)
-- Insert if not exists
INSERT INTO public.quote_templates (tenant_id, name, description, category, content, is_active, version)
SELECT NULL, p.name, p.description, p.category, p.content, true, 1
FROM payload p
WHERE NOT EXISTS (SELECT 1 FROM public.quote_templates qt WHERE qt.name = p.name);

WITH payload AS (
  SELECT 
    'MGL Granular Quote'::text AS name,
    'MGL FCL Quote with granular rate breakdown (Ocean, Trucking, etc.) per leg/mode.'::text AS description,
    'FCL'::text AS category,
    '{
      "layout": "mgl_granular",
      "header": {
        "show_logo": true,
        "show_address": true,
        "provider_details": {
          "name": "Miami Global Lines",
          "address": "140 Ethel Road West; Unit ''S&T'', Piscataway, NJ 08854–USA",
          "phone": "+1-732-640-2365",
          "fmc_lic": "023172NF",
          "iac_no": "NE1210010"
        }
      },
      "sections": [
        { "id": "customer_info", "title": "Customer Information", "visible": true },
        { "id": "shipment_details", "title": "Shipment Details", "visible": true },
        { "id": "rate_matrix", "title": "Carrier Rates", "visible": true, "show_breakdown": true },
        { "id": "terms", "title": "Terms & Conditions", "visible": true }
      ],
      "terms": {
        "exclusions": [
          "Destination charges",
          "Cargo Insurance",
          "Taxes / duties",
          "Demurrage / Detention / Storage"
        ],
        "notes": [
          "Rates are on PER UNIT basis",
          "VATOS (Valid at time of shipping)",
          "Trucking: One hour free load, thereafter USD 100/hr",
          "Max weight: 44,000 LBS per standard US road limitations"
        ]
      }
    }'::jsonb AS content
)
UPDATE public.quote_templates qt
SET content = p.content, category = p.category, description = p.description
FROM payload p
WHERE qt.name = p.name;
