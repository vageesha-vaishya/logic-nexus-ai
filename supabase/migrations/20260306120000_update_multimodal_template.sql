-- Update 'Standard Multi-Modal' template to include 'multi_modal_details' section
UPDATE public.quote_templates
SET content = jsonb_set(
    content,
    '{sections}',
    '[
        { "type": "customer_info", "title": "Customer Details" },
        { "type": "shipment_info", "title": "Shipment Details" },
        { "type": "multi_modal_details", "title": "Transport Leg Details" },
        { "type": "rates_table", "title": "Freight Rates", "columns": ["carrier", "transit_time", "frequency", "price"] },
        { "type": "terms", "title": "Terms & Conditions" }
    ]'::jsonb
)
WHERE name = 'Standard Multi-Modal';
