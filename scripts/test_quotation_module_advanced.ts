
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup Environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Error: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/.env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAdvancedTest() {
    console.log("========================================================");
    console.log("   ADVANCED QUOTATION MODULE END-TO-END TEST SCENARIO   ");
    console.log("========================================================");

    try {
        // ----------------------------------------------------------------
        // 1. SETUP CONTEXT (Tenant, User, Account)
        // ----------------------------------------------------------------
        console.log("\n--> Setting up Test Context...");
        
        // --- Test Data Constants ---
        const tenantId = 'bb451198-2877-4345-a578-d404c5720f1a'; // Default Test Tenant
        const franchiseId = '851e5d36-7e57-4b79-9de0-57c311a8fda5'; // Default Test Franchise
        const userId = '52811a3b-5baf-4c5f-854b-7ced632e3a74';     // Vimal (Platform Admin)
        
        console.log(`    Tenant ID: ${tenantId}`);
        console.log(`    Franchise ID: ${franchiseId}`);
        console.log(`    User ID:   ${userId}`);

        // Master Data Fetching
        const { data: modes } = await supabase.from('service_modes').select('*');
        const { data: types } = await supabase.from('service_types').select('*');
        const { data: services } = await supabase.from('services').select('*').limit(100);
        const { data: carriers } = await supabase.from('carriers').select('*');
        const { data: containerTypes } = await supabase.from('container_types').select('*');
        
        // Fetch Ports for routing - Ensure we get valid IDs
        const { data: ports } = await supabase.from('ports_locations').select('id, location_name, location_code')
            .limit(100); // Increased limit to find better ports
        
        let shanghaiPort = ports?.find(p => p.location_name?.includes('Shanghai'))?.id;
        let nyPort = ports?.find(p => p.location_name?.includes('York'))?.id;
        let laxPort = ports?.find(p => p.location_name?.includes('Angeles'))?.id;
        let rotterdamPort = ports?.find(p => p.location_name?.includes('Rotterdam'))?.id;

        // Fallback if specific ports not found
        if (!shanghaiPort && ports && ports.length > 0) shanghaiPort = ports[0].id;
        if (!nyPort && ports && ports.length > 1) nyPort = ports[1].id;
        if (!laxPort) laxPort = nyPort;
        if (!rotterdamPort) rotterdamPort = shanghaiPort;
        
        // Final fallback to ensure no nulls
        if (!shanghaiPort) console.warn("    [WARN] No ports found in database!");
        if (!nyPort) nyPort = shanghaiPort;

        if (!modes || !types || !carriers) throw new Error("Failed to load Master Data");
        console.log(`    Master Data Loaded: ${modes.length} modes, ${types?.length} types, ${carriers?.length} carriers, ${services?.length} services`);

        // Create Test Account (Customer)
        const customerName = `Adv Test Customer ${Date.now()}`;
        const { data: account, error: accError } = await supabase.from('accounts').insert({
            tenant_id: tenantId,
            name: customerName,
            account_type: 'customer',
            status: 'active',
            email: `test.${Date.now()}@example.com`
        }).select().single();

        if (accError) throw new Error(`Account Creation Failed: ${accError.message}`);
        console.log(`    Created Account: ${account.name} (${account.id})`);

        // Create Test Contact
        const { data: contact, error: contactError } = await supabase.from('contacts').insert({
            tenant_id: tenantId,
            account_id: account.id,
            first_name: "John",
            last_name: "Doe",
            email: `john.doe.${Date.now()}@test.com`,
            phone: "+1-555-0199",
            job_title: "Logistics Manager"
        }).select().single();
        if (contactError) console.warn(`    Contact Creation Failed: ${contactError.message}`);
        else console.log(`    Created Contact: ${contact.first_name} ${contact.last_name} (${contact.id})`);

        // Create Test Opportunity
        const { data: opportunity, error: oppError } = await supabase.from('opportunities').insert({
            tenant_id: tenantId,
            account_id: account.id,
            contact_id: contact?.id,
            name: `Opp for ${customerName}`,
            stage: "proposal",
            amount: 50000,
            close_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            owner_id: userId
        }).select().single();
        if (oppError) console.warn(`    Opportunity Creation Failed: ${oppError.message}`);
        else console.log(`    Created Opportunity: ${opportunity.name} (${opportunity.id})`);

        // ----------------------------------------------------------------
        // 2. PREPARE & INSERT QUOTE (With Full Data)
        // ----------------------------------------------------------------
        console.log("\n--> Generating Quote Data (VERSION 3 - FULLY POPULATED)...");

        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + 30);
        
        const pickupDate = new Date();
        pickupDate.setDate(pickupDate.getDate() + 7);
        
        const deliveryDeadline = new Date();
        deliveryDeadline.setDate(deliveryDeadline.getDate() + 21);

        // INTELLIGENT SERVICE SELECTION
        // Find a service that has a valid service_type_id
        let serviceIdToUse: string | undefined;
        let serviceTypeIdToUse: string | undefined;
        
        // Strategy: 
        // 1. Try to find a service that is linked to a valid service type
        // 2. Ideally, find a "Standard" or "General" service
        
        if (services && services.length > 0) {
            // Filter services that have a service_type_id
            const validServices = services.filter(s => s.service_type_id);
            
            if (validServices.length > 0) {
                // Prefer one with 'Ocean' or 'Air' in name if possible
                const preferredService = validServices.find(s => 
                    (s.service_name?.toLowerCase().includes('ocean') || s.service_name?.toLowerCase().includes('sea')) 
                    && types?.find(t => t.id === s.service_type_id)
                ) || validServices[0];
                
                serviceIdToUse = preferredService.id;
                serviceTypeIdToUse = preferredService.service_type_id;
                console.log(`    [INFO] Selected Linked Service: ${preferredService.service_name} (Type ID: ${serviceTypeIdToUse})`);
            } else {
                 // If no service has a type, pick the first service and first type (Risky but fallback)
                 console.warn("    [WARN] No services have linked service_type_id. Using fallback combination.");
                 serviceIdToUse = services[0].id;
                 serviceTypeIdToUse = types[0].id;
            }
        } else {
            console.warn("    [WARN] No Services found! Using Carrier ID as fallback (might fail validation)");
            serviceIdToUse = carriers?.[0]?.id; 
            serviceTypeIdToUse = types[0]?.id;
        }

        // Validate that serviceTypeIdToUse actually exists in types
        const selectedType = types.find(t => t.id === serviceTypeIdToUse);
        if (!selectedType) {
             console.warn(`    [WARN] Selected Service Type ID ${serviceTypeIdToUse} not found in service_types table! Using first available type.`);
             serviceTypeIdToUse = types[0]?.id;
        }

        console.log(`    [INFO] Using Service Type:    ${types.find(t => t.id === serviceTypeIdToUse)?.name || serviceTypeIdToUse}`);
        console.log(`    [INFO] Using Service ID:      ${serviceIdToUse}`);
        console.log(`    [INFO] Using Origin Port:     ${shanghaiPort}`);
        console.log(`    [INFO] Using Dest Port:       ${nyPort}`);

        // ENSURE SERVICE TYPE MAPPING EXISTS (Critical for UI visibility)
        if (serviceTypeIdToUse && serviceIdToUse) {
            const { data: existingMapping } = await supabase
                .from('service_type_mappings')
                .select('*')
                .eq('service_type_id', serviceTypeIdToUse)
                .eq('service_id', serviceIdToUse)
                .or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
            
            if (!existingMapping || existingMapping.length === 0) {
                console.log(`    [INFO] Creating Service Mapping for visibility...`);
                await supabase.from('service_type_mappings').insert({
                    tenant_id: tenantId,
                    service_type_id: serviceTypeIdToUse,
                    service_id: serviceIdToUse,
                    is_active: true,
                    is_default: true,
                    priority: 10
                });
            } else {
                console.log(`    [INFO] Service Mapping already exists.`);
            }
        }


        const quoteData = {
            tenant_id: tenantId,
            franchise_id: franchiseId,
            quote_number: `Q-${Date.now()}`,
            title: "Advanced Multi-Leg Shipment Project",
            description: "Full container load shipment of electronics components. Requires careful handling and temperature monitoring.",
            opportunity_id: opportunity?.id,
            account_id: account.id,
            contact_id: contact?.id,
            owner_id: userId,
            status: 'draft',
            valid_until: validUntil.toISOString(),
            
            // Financials
            subtotal: 5500,
            shipping_amount: 1500,
            total_amount: 7000,
            currency: 'USD',
            
            // Logistics Configuration (CRITICAL FOR UI POPULATION)
            service_type_id: serviceTypeIdToUse,
            service_id: serviceIdToUse,
            carrier_id: carriers?.[0]?.id,
            origin_port_id: shanghaiPort,
            destination_port_id: nyPort,
            pickup_date: pickupDate.toISOString().split('T')[0],
            delivery_deadline: deliveryDeadline.toISOString().split('T')[0],
            vehicle_type: "53' Dry Van", 
            
            // Cargo Summary
            cargo_details: {
                total_weight: 2700,
                total_volume: 35.5,
                package_count: 51
            },
            special_handling: ['Liftgate', 'Hazmat'],
            incoterms: 'DDP',
            created_by: userId
        };

        const { data: quote, error: qError } = await supabase.from('quotes').insert(quoteData).select().single();
        if (qError) throw new Error(`Quote Creation Failed: ${qError.message}`);
        console.log(`    Created Quote: ${quote.quote_number} (${quote.id})`);

        // ----------------------------------------------------------------
        // 3. ADD LINE ITEMS & CARGO CONFIGURATIONS
        // ----------------------------------------------------------------
        console.log("\n--> Adding Quote Items & Cargo Configurations...");
        
        const items = [
            {
                tenant_id: tenantId,
                franchise_id: franchiseId,
                quote_id: quote.id,
                line_number: 1,
                product_name: "Electronics Components - High Value",
                description: "Full pallet of sensitive electronics.",
                quantity: 50,
                unit_price: 80,
                line_total: 4000,
                weight_kg: 500,
                volume_cbm: 2.5,
                attributes: {
                    length: 100, width: 80, height: 60,
                    stackable: true, hazmat: true, hs_code: "8542.31",
                    weight: 500, volume: 2.5
                },
                type: 'goods',
                tax_percent: 5
            },
            {
                tenant_id: tenantId,
                franchise_id: franchiseId,
                quote_id: quote.id,
                line_number: 2,
                product_name: "20' Standard Container",
                description: "General Cargo",
                quantity: 1,
                unit_price: 1500,
                line_total: 1500,
                weight_kg: 2200,
                volume_cbm: 33,
                attributes: {
                    length: 600, width: 244, height: 259,
                    stackable: false, hazmat: false
                },
                type: 'container',
                container_type_id: containerTypes?.[0]?.id,
            }
        ];

        const { data: insertedItems, error: iError } = await supabase.from('quote_items').insert(items).select();
        if (iError) throw new Error(`Item Insertion Failed: ${iError.message}`);
        console.log(`    Added ${insertedItems.length} Line Items`);

        // 6. Creating Cargo Configurations
        console.log("6. Creating Cargo Configurations...");

        // Fetch Container Sizes
        const { data: containerSizes } = await supabase.from('container_sizes').select('*');
        
        const stdDry = containerTypes?.find(t => t.name === 'Standard Dry' || t.code === 'DRY' || t.code === 'GP') || containerTypes?.[0];
        const size20 = containerSizes?.find(s => s.size_code === '20' || s.size_code === '20GP');
        const size40 = containerSizes?.find(s => s.size_code === '40' || s.size_code === '40GP');

        const cargoConfigs = [
            {
                quote_id: quote.id,
                tenant_id: tenantId,
                transport_mode: 'ocean',
                cargo_type: 'FCL',
                quantity: 1,
                container_type_id: stdDry?.id,
                container_size_id: size20?.id,
                container_type: stdDry?.name || 'Standard Dry',
                container_size: size20?.size_code || '20',
                is_hazardous: false,
                remarks: "Standard General Cargo"
            },
            {
                quote_id: quote.id,
                tenant_id: tenantId,
                transport_mode: 'ocean',
                cargo_type: 'FCL',
                quantity: 1,
                container_type_id: stdDry?.id,
                container_size_id: size40?.id,
                container_type: stdDry?.name || 'Standard Dry',
                container_size: size40?.size_code || '40',
                is_hazardous: true,
                hazardous_class: "3",
                un_number: "1263",
                remarks: "Paints (Flammable)"
            }
        ];

        const { error: cargoErr } = await supabase.from('quote_cargo_configurations').insert(cargoConfigs);
        if (cargoErr) {
             console.warn(`    [WARN] Cargo Config Creation Failed: ${cargoErr.message}`);
        } else {
             console.log(`    Inserted ${cargoConfigs.length} Cargo Configurations`);
        }

        // 7. Create Quotation Version (Active)
        console.log("7. Creating Quotation Version...");
        
        const { data: version, error: verErr } = await supabase.from('quotation_versions').insert({
            tenant_id: tenantId,
            quote_id: quote.id,
            version_number: 1,
            is_active: true, 
            valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            change_reason: "Initial Quote Generation"
        }).select().single();

        if (verErr || !version) {
            throw new Error(`Version Creation Failed: ${verErr?.message}`);
        }
        console.log(`    Created Version: ${version.id} (Active)`);

        // Update QUOTE with Current Version ID
        const { error: updateQuoteErr } = await supabase.from('quotes').update({ 
            current_version_id: version.id,
            status: 'sent' 
        }).eq('id', quote.id);
        
        if (updateQuoteErr) {
            console.log(`    (Note: current_version_id update skipped/failed: ${updateQuoteErr.message})`);
        } else {
             console.log(`    Updated Quote with Current Version ID`);
        }

        // 8. Create Quote Options & Legs (Multi-Leg Scenarios)
        console.log("8. Creating Quote Options & Legs...");

        // Option 1: Multi-Modal (Sea-Air)
        const { data: opt1, error: opt1Error } = await supabase.from('quote_options').insert({
            tenant_id: tenantId,
            quote_version_id: version.id,
            service_id: serviceIdToUse,
            provider_id: carriers?.[0]?.id,
            total_amount: 12500,
            currency_id: null, // Optional if null
            service_type_id: serviceTypeIdToUse,
            origin_port_id: shanghaiPort,
            destination_port_id: nyPort,
            transit_time_days: 18
        }).select().single();

        if (opt1Error) {
             console.error(`    [ERROR] Option 1 Creation Failed: ${opt1Error.message}`);
        } else if (opt1) {
            // Find Modes
            const roadMode = modes.find(m => m.code === 'road' || m.name.toLowerCase() === 'road');
            const oceanMode = modes.find(m => m.code === 'ocean' || m.name.toLowerCase() === 'ocean');
            const airMode = modes.find(m => m.code === 'air' || m.name.toLowerCase() === 'air');

            const legs = [
                {
                    quote_option_id: opt1.id,
                    tenant_id: tenantId,
                    leg_order: 1,
                    mode_id: roadMode?.id,
                    provider_id: carriers?.[1]?.id,
                    origin_location: "Factory, Suzhou",
                    destination_location: "Port of Shanghai"
                },
                {
                    quote_option_id: opt1.id,
                    tenant_id: tenantId,
                    leg_order: 2,
                    mode_id: oceanMode?.id,
                    provider_id: carriers?.[0]?.id,
                    origin_location: "Port of Shanghai",
                    destination_location: "Port of Los Angeles"
                },
                {
                    quote_option_id: opt1.id,
                    tenant_id: tenantId,
                    leg_order: 3,
                    mode_id: airMode?.id,
                    provider_id: carriers?.[2]?.id,
                    origin_location: "LAX",
                    destination_location: "JFK Airport"
                }
            ];
            
            const { error: legErr } = await supabase.from('quote_option_legs').insert(legs);
            if (legErr) console.warn(`    [WARN] Legs Insertion Failed: ${legErr.message}`);
            else console.log(`    Created Option 1 with ${legs.length} Legs (Multi-Mode).`);
        }

        // Option 2: Direct Ocean
        const { data: opt2 } = await supabase.from('quote_options').insert({
            tenant_id: tenantId,
            quote_version_id: version.id,
            service_id: serviceIdToUse,
            provider_id: carriers?.[1]?.id,
            total_amount: 8500,
            service_type_id: serviceTypeIdToUse,
            origin_port_id: shanghaiPort,
            destination_port_id: nyPort,
            transit_time_days: 35
        }).select().single();

        if (opt2) {
             const legs = [{
                quote_option_id: opt2.id,
                tenant_id: tenantId,
                leg_order: 1,
                mode_id: modes?.find(m => m.code === 'ocean' || m.name.toLowerCase() === 'ocean')?.id,
                origin_location: "Port of Shanghai",
                destination_location: "Port of New York",
                provider_id: carriers?.[1]?.id
            }];
            await supabase.from('quote_option_legs').insert(legs);
            console.log(`    Created Option 2 with ${legs.length} Legs (Direct Ocean).`);
        }

        console.log("\n============================================================");
        console.log("   SUCCESS: Comprehensive Test Quote Generated");
        console.log("============================================================");

    } catch (err: any) {
        console.error("\n!!! CRITICAL TEST FAILURE !!!");
        console.error(err.message || err);
        process.exit(1);
    }
}

runAdvancedTest();
