
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { Client } from 'pg';
import * as crypto from 'crypto';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set in .env');
  process.exit(1);
}

async function testQuoteLoading() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Get charge side IDs
    const buySideRes = await client.query(`SELECT id FROM charge_sides WHERE lower(code) IN ('buy', 'cost') LIMIT 1`);
    const buyId = buySideRes.rows[0].id;
    const sellSideRes = await client.query(`SELECT id FROM charge_sides WHERE lower(code) IN ('sell', 'revenue') LIMIT 1`);
    const sellId = sellSideRes.rows[0].id;

    console.log('Using Buy Side ID:', buyId);
    console.log('Using Sell Side ID:', sellId);

    // 1. Create a dummy quote with options and legs via save_quote_atomic
    // We need to fetch tenant_id first
    const tenantRes = await client.query(`SELECT id FROM tenants LIMIT 1`);
    const tenantId = tenantRes.rows[0].id;

    // Use a known user ID or fetch one
    const userRes = await client.query(`SELECT id FROM auth.users LIMIT 1`);
    const userId = userRes.rows[0].id;

    console.log('Using Tenant:', tenantId);
    console.log('Using User:', userId);

    const generatedOptionId = crypto.randomUUID();
    const generatedLegId = crypto.randomUUID();
    console.log('Testing with Client-Generated IDs:', { generatedOptionId, generatedLegId });

    const payload = {
        quote: {
            quote_number: `TEST-LOAD-${Date.now()}`,
            title: 'Test Loading Quote',
            transport_mode: 'ocean',
            origin: 'Shanghai',
            destination: 'Los Angeles',
            status: 'draft',
            tenant_id: tenantId,
            owner_id: userId,
            created_by: userId
        },
        items: [],
        cargo_configurations: [],
        options: [
            {
                id: generatedOptionId,
                option_name: 'Test Option 1',
                is_selected: true,
                total_amount: 1500,
                currency: 'USD',
                transit_time_days: 25,
                margin_percentage: 15,
                legs: [
                    {
                        id: generatedLegId,
                        transport_mode: 'ocean',
                        leg_type: 'main',
                        origin_location_name: 'Shanghai',
                        destination_location_name: 'Los Angeles',
                        transit_time_days: 20,
                        charges: [
                            {
                                charge_code: 'fb1a45f6-f50a-47be-8fe5-56f084c26ef4', // Freight
                                basis_id: 'a10bafc5-c887-418b-b6fa-d4a8590adf3d', // Per Shipment
                                amount: 1000,
                                currency_id: 'f4739a55-66ab-47da-a66f-450188f01e69', // USD
                                side: 'buy', 
                                unit_price: 1000,
                                quantity: 1
                            },
                            {
                                charge_code: 'fb1a45f6-f50a-47be-8fe5-56f084c26ef4', // Freight
                                basis_id: 'a10bafc5-c887-418b-b6fa-d4a8590adf3d', // Per Shipment
                                amount: 1200,
                                currency_id: 'f4739a55-66ab-47da-a66f-450188f01e69', // USD
                                side: 'sell',
                                unit_price: 1200,
                                quantity: 1
                            }
                        ]
                    }
                ],
                combined_charges: [
                     {
                        charge_code: '39890baa-42e4-4866-aa28-41e9f487112f', // Documentation
                        basis_id: 'a10bafc5-c887-418b-b6fa-d4a8590adf3d', // Per Shipment
                        amount: 50,
                        currency_id: 'f4739a55-66ab-47da-a66f-450188f01e69', // USD
                        side: 'sell',
                        unit_price: 50,
                        quantity: 1
                    }
                ]
            }
        ]
    };

    // Note: useDraftAutoSave sends 'side' as 'buy'/'sell' string.
    // save_quote_atomic must handle this look up.
    
    const saveQuery = `SELECT save_quote_atomic($1::jsonb) as id`;
    const saveRes = await client.query(saveQuery, [JSON.stringify(payload)]);
    
    const quoteId = saveRes.rows[0].id;
    console.log('Saved Quote ID:', quoteId);

    // Get the version ID
    const versionRes = await client.query(`SELECT current_version_id FROM quotes WHERE id = $1`, [quoteId]);
    const versionId = versionRes.rows[0].current_version_id;
    console.log('Version ID:', versionId);

    // 2. Simulate the loading logic we implemented in UnifiedQuoteComposer
    
    // Fetch options
    const optionRes = await client.query(`
        SELECT * FROM quotation_version_options 
        WHERE quotation_version_id = $1 
        ORDER BY created_at DESC
    `, [versionId]);
    
    const optionRows = optionRes.rows;
    console.log(`Fetched ${optionRows.length} options`);

    if (optionRows.length > 0) {
        const optionIds = optionRows.map((o: any) => o.id);

        // Fetch legs
        const legRes = await client.query(`
            SELECT * FROM quotation_version_option_legs 
            WHERE quotation_version_option_id = ANY($1) 
            ORDER BY sort_order
        `, [optionIds]);
        const legRows = legRes.rows;
        console.log(`Fetched ${legRows.length} legs`);

        // Fetch charges
        const chargeRes = await client.query(`
            SELECT * FROM quote_charges 
            WHERE quote_option_id = ANY($1)
        `, [optionIds]);
        const chargeRows = chargeRes.rows;
        console.log(`Fetched ${chargeRows.length} charges`);

        // Helper to group charges into buy/sell pairs (Copied from UnifiedQuoteComposer)
          const groupCharges = (charges: any[]) => {
             const pairs: any[] = [];
             const pendingBuys: any[] = [];
             const pendingSells: any[] = [];
             
             charges.forEach(c => {
                 // Mock the side object since we don't have the join here
                 // In real app, we join with charge_sides table
                 // But here we can check side_id
                 const sideId = c.charge_side_id; 
                 
                 const sideCode = sideId === buyId ? 'buy' : (sideId === sellId ? 'sell' : 'unknown');
                 
                 if (sideCode === 'buy') pendingBuys.push(c);
                 else pendingSells.push(c);
             });
             
             // Match sells to buys
             pendingSells.forEach(sell => {
                 const matchIndex = pendingBuys.findIndex(buy => 
                     buy.leg_id === sell.leg_id &&
                     buy.category_id === sell.category_id &&
                     buy.basis_id === sell.basis_id
                 );
                 
                 if (matchIndex >= 0) {
                     const buy = pendingBuys[matchIndex];
                     pendingBuys.splice(matchIndex, 1);
                     pairs.push({
                         id: buy.id, 
                         leg_id: buy.leg_id,
                         buy: { amount: buy.amount },
                         sell: { amount: sell.amount }
                     });
                 } else {
                     pairs.push({
                         id: sell.id,
                         leg_id: sell.leg_id,
                         sell: { amount: sell.amount }
                     });
                 }
             });
             
             pendingBuys.forEach(buy => {
                 pairs.push({
                     id: buy.id,
                     leg_id: buy.leg_id,
                     buy: { amount: buy.amount }
                 });
             });
             
             return pairs;
          };

        // Reconstruct
        const reconstructed = optionRows.map((opt: any) => {
            const myLegs = legRows
                .filter((l: any) => l.quotation_version_option_id === opt.id)
                .map((l: any) => {
                    const legChargesRaw = chargeRows.filter((c: any) => c.quote_option_id === opt.id && c.leg_id === l.id);
                    const legCharges = groupCharges(legChargesRaw);
                    return {
                        id: l.id,
                        mode: l.transport_mode,
                        charges: legCharges
                    };
                });
            
            const globalChargesRaw = chargeRows.filter((c: any) => c.quote_option_id === opt.id && !c.leg_id);
            const globalCharges = groupCharges(globalChargesRaw);

            return {
                id: opt.id,
                name: opt.option_name,
                legs: myLegs,
                charges: globalCharges,
                marginPercent: opt.margin_percentage
            };
        });

        console.log('Reconstructed Option:', JSON.stringify(reconstructed[0], null, 2));

        // Assertions
        if (reconstructed[0].legs.length !== 1) throw new Error('Legs missing');
        // We expect 1 charge PAIR for the leg (buy + sell of Freight)
        if (reconstructed[0].legs[0].charges.length !== 1) throw new Error(`Leg charges mismatch. Expected 1 pair, got ${reconstructed[0].legs[0].charges.length}`);
        if (reconstructed[0].legs[0].charges[0].buy && reconstructed[0].legs[0].charges[0].sell) {
             console.log('Leg charge correctly grouped as buy/sell pair');
        } else {
             throw new Error('Leg charge not grouped correctly');
        }
        
        if (reconstructed[0].charges.length !== 1) throw new Error('Global charges missing');
        console.log('VERIFICATION SUCCESSFUL: Data persistence and retrieval logic is correct.');
    } else {
        throw new Error('No options found for saved quote');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

testQuoteLoading();
