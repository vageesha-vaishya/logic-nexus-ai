
-- Migration: Seed MGL Granular Template
-- Description: Adds a new quote template for MGL with granular rate breakdown support.

INSERT INTO public.quote_templates (name, description, layout, config, is_active, is_default)
VALUES (
    'MGL Granular Quote',
    'MGL FCL Quote with granular rate breakdown (Ocean, Trucking, etc.) per leg/mode.',
    'mgl_granular',
    '{
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
    }'::jsonb,
    true,
    false
)
ON CONFLICT (name) DO UPDATE SET 
    config = EXCLUDED.config,
    layout = EXCLUDED.layout;
