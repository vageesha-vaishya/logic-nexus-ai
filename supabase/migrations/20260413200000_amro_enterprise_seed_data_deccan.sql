-- AMRO Enterprise Seed Data for Deccan / Deccan Test Franchise
-- Date: 2026-04-13
-- Purpose: Populate tooling registry and compliance AD/SB tables with seed data

-- ============================================================================
-- NOTE: This migration finds Deccan tenant and Deccan Test Franchise IDs dynamically
-- ============================================================================

-- Insert Tools
INSERT INTO amro_tooling_registry (
    tenant_id,
    tool_code,
    tool_name,
    manufacturer,
    model_number,
    tool_category,
    tool_type,
    calibration_required,
    calibration_interval_days,
    calibration_standard,
    specifications,
    currency,
    purchase_cost,
    regulatory_approvals
)
SELECT 
    t.id AS tenant_id,
    v.tool_code,
    v.tool_name,
    v.manufacturer,
    v.model_number,
    v.tool_category,
    v.tool_type,
    v.calibration_required,
    v.calibration_interval_days,
    v.calibration_standard,
    v.specifications,
    v.currency,
    v.purchase_cost,
    v.regulatory_approvals
FROM tenants t, (VALUES 
    ('TOOL-TW-500', 'Digital Torque Wrench 500', 'Snap-on', 'ECF500', 'hand_tool', 'Torque Wrench', TRUE, 180, 'ISO 6789', '{"measurement_range": "50-500 in-lbs", "accuracy": "±2%"}', 'USD', 850.00, ARRAY['FAA', 'EASA']),
    ('TOOL-TW-1000', 'Digital Torque Wrench 1000', 'Snap-on', 'ECF1000', 'hand_tool', 'Torque Wrench', TRUE, 180, 'ISO 6789', '{"measurement_range": "100-1000 in-lbs", "accuracy": "±1.5%"}', 'USD', 1150.00, ARRAY['FAA', 'EASA']),
    ('TOOL-SK-SET', 'Socket Set Complete', 'Craftsman', 'SK-200', 'hand_tool', 'Socket Set', FALSE, 0, NULL, '{"pieces": 200}', 'USD', 350.00, ARRAY['FAA']),
    ('TOOL-PD-750', 'Pneumatic Drill', 'Chicago Pneumatic', 'CP750', 'power_tool', 'Drill', TRUE, 365, 'ANSI B186.9', '{"power": "0.5 HP", "speed": "1800 RPM"}', 'USD', 650.00, ARRAY['FAA', 'EASA']),
    ('TOOL-AG-400', 'Air Grinder', 'Ingersoll Rand', 'AG-400', 'power_tool', 'Grinder', TRUE, 365, 'ANSI B186.9', '{"power": "0.7 HP", "speed": "20000 RPM"}', 'USD', 480.00, ARRAY['FAA']),
    ('TOOL-MLG-1000', 'Magnetic Level Gauge', 'Fluke', 'MLG-1000', 'test_equipment', 'Level Gauge', TRUE, 365, 'NIST', '{"range": "0-100%", "accuracy": "±0.5%"}', 'USD', 1200.00, ARRAY['FAA', 'EASA']),
    ('TOOL-MT-500', 'Multimeter Digital', 'Fluke', '87V', 'test_equipment', 'Multimeter', TRUE, 365, 'NIST', '{"voltage_range": "0-1000V"}', 'USD', 450.00, ARRAY['FAA', 'EASA']),
    ('TOOL-PT-200', 'Pressure Tester', 'GE Druck', 'PT-200', 'test_equipment', 'Pressure Gauge', TRUE, 180, 'ISO 17025', '{"range": "0-5000 PSI"}', 'USD', 2800.00, ARRAY['FAA', 'EASA']),
    ('TOOL-GS-JACK', 'Aircraft Jack', 'Hydravil', 'HJ-50', 'ground_support', 'Jack', TRUE, 365, 'ASME PALD', '{"capacity": "50 tons"}', 'USD', 15000.00, ARRAY['FAA', 'EASA']),
    ('TOOL-ST-ENG', 'Engine Hoist Ring', 'CFM International', 'ENG-HOIST-001', 'special_tool', 'Engine Hoist', TRUE, 365, 'OEM Spec', '{"capacity": "5000 lbs"}', 'USD', 3500.00, ARRAY['FAA', 'EASA'])
) AS v(tool_code, tool_name, manufacturer, model_number, tool_category, tool_type, calibration_required, calibration_interval_days, calibration_standard, specifications, currency, purchase_cost, regulatory_approvals)
WHERE t.name ILIKE '%deccan%'
ON CONFLICT (tenant_id, tool_code) DO NOTHING;

-- Insert AD/SB Directives
INSERT INTO amro_compliance_ad_sb_registry (
    tenant_id,
    directive_number,
    directive_type,
    regulatory_authority,
    oem,
    aircraft_model,
    engine_model,
    component_ata,
    effective_date,
    compliance_deadline,
    title,
    description,
    applicability,
    summary,
    applicable_to_fleet,
    priority,
    safety_impact,
    grounding_requirement,
    fleet_impact
)
SELECT 
    t.id AS tenant_id,
    v.directive_number,
    v.directive_type,
    v.regulatory_authority,
    v.oem,
    v.aircraft_model,
    v.engine_model,
    v.component_ata,
    v.effective_date,
    v.compliance_deadline,
    v.title,
    v.description,
    v.applicability,
    v.summary,
    v.applicable_to_fleet,
    v.priority,
    v.safety_impact,
    v.grounding_requirement,
    v.fleet_impact
FROM tenants t, (VALUES 
    ('AD 2024-12-05', 'AD', 'FAA', 'CFM International', 'A320neo', 'CFM LEAP-1A', '72-00-00', '2024-12-01', '2025-06-01', 'Engine Fuel Pump Inspection', 'Inspect fuel pump for cracking', 'A320neo with CFM LEAP-1A', 'Mandatory inspection', TRUE, 'high', TRUE, FALSE, TRUE),
    ('AD 2024-10-03', 'AD', 'FAA', 'Airbus', 'A320', NULL, '27-00-00', '2024-10-15', '2025-04-15', 'Flight Control Software Update', 'Update flight control software', 'All A320 family', 'Software update for flight safety', TRUE, 'critical', TRUE, FALSE, TRUE),
    ('AD 2024-08-15', 'AD', 'FAA', 'Boeing', 'B737 MAX', NULL, '32-00-00', '2024-08-01', '2025-02-01', 'Landing Gear Inspection', 'Inspect landing gear for stress fractures', 'B737 MAX 8/9', 'Preventive inspection', TRUE, 'high', FALSE, FALSE, TRUE),
    ('EASA AD 2024-0150', 'AD', 'EASA', 'Airbus', 'A350', 'Rolls-Royce Trent XWB', '71-00-00', '2024-09-01', '2025-03-01', 'Engine Oil System Inspection', 'Inspect engine oil system', 'A350-900/1000', 'Prevent engine failure', TRUE, 'high', FALSE, FALSE, TRUE),
    ('EASA AD 2024-0120', 'AD', 'EASA', 'Embraer', 'E190-E2', NULL, '53-00-00', '2024-07-01', '2025-01-01', 'Fuselage Skin Inspection', 'Inspect fuselage for fatigue cracking', 'E190-E2/E195-E2', 'Structural integrity check', TRUE, 'medium', FALSE, FALSE, TRUE),
    ('SB A320-2024-001', 'SB', 'FAA', 'Airbus', 'A320neo', NULL, '21-00-00', '2024-11-01', '2025-05-01', 'Air Conditioning Upgrade', 'Upgrade AC system', 'A320neo family', 'Optional upgrade', TRUE, 'low', FALSE, FALSE, FALSE),
    ('SB B737-2024-002', 'SB', 'FAA', 'Boeing', 'B737 MAX', NULL, '22-00-00', '2024-10-01', '2025-04-01', 'Autopilot Enhancement', 'Install enhanced autopilot software', 'B737 MAX 8/9', 'Optional software update', TRUE, 'low', FALSE, FALSE, FALSE),
    ('SIL 2024-001', 'SIL', 'FAA', 'CFM International', 'A320neo', 'CFM LEAP-1A', '72-00-00', '2024-08-01', '2025-02-01', 'Engine Oil Filter Replacement', 'Replace oil filters at reduced interval', 'A320neo LEAP-1A', 'Enhanced maintenance', TRUE, 'medium', FALSE, FALSE, TRUE)
) AS v(directive_number, directive_type, regulatory_authority, oem, aircraft_model, engine_model, component_ata, effective_date, compliance_deadline, title, description, applicability, summary, applicable_to_fleet, priority, safety_impact, grounding_requirement, fleet_impact)
WHERE t.name ILIKE '%deccan%'
ON CONFLICT (tenant_id, directive_number, regulatory_authority) DO NOTHING;
