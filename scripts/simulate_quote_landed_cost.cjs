
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const envMigrationPath = path.join(__dirname, '../.env.migration');
if (fs.existsSync(envMigrationPath)) {
    dotenv.config({ path: envMigrationPath });
} else {
    dotenv.config();
}

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

async function simulateQuoteLandedCost() {
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected to database.");

        // 1. Mock Quote Data (similar to frontend quoteData)
        const mockQuote = {
            id: "quote-123",
            origin_country: "CN", // China
            destination: "Los Angeles, US", // Needs parsing
            items: [
                {
                    description: "Smartphone (Test)",
                    quantity: 100,
                    unit_price: 500,
                    attributes: {
                        hs_code: "851762" // Modems/Phones
                    }
                },
                {
                    description: "T-Shirt (Test)",
                    quantity: 500,
                    unit_price: 10,
                    attributes: {
                        hs_code: "610910" // Cotton T-Shirts
                    }
                },
                {
                    description: "No HS Code Item",
                    quantity: 50,
                    unit_price: 20,
                    attributes: {}
                }
            ]
        };

        console.log("Mock Quote:", JSON.stringify(mockQuote, null, 2));

        // 2. Simulate Frontend Logic (DocumentPreview.tsx)
        
        // Logic: Parse country code from destination
        // Simple regex to find 2-letter code at end or comma separated
        const parseDestinationCountry = (dest) => {
            if (!dest) return 'US'; // Default
            const match = dest.match(/,\s*([A-Z]{2})\s*$/) || dest.match(/\b([A-Z]{2})\b/);
            return match ? match[1] : 'US';
        };

        const destinationCountry = parseDestinationCountry(mockQuote.destination);
        console.log(`Parsed Destination Country: ${destinationCountry}`);

        // Logic: Map items to RPC format
        const rpcItems = mockQuote.items
            .map(item => ({
                hs_code: item.attributes?.hs_code,
                value: Number(item.unit_price || 0) * Number(item.quantity || 1),
                quantity: Number(item.quantity || 1),
                origin_country: mockQuote.origin_country
            }))
            .filter(i => i.hs_code); // Only items with HS codes

        console.log("RPC Payload Items:", JSON.stringify(rpcItems, null, 2));

        if (rpcItems.length === 0) {
            console.log("No valid items for landed cost calculation.");
            return;
        }

        // 3. Call RPC
        console.log("Calling calculate_landed_cost RPC...");
        
        const query = `
            SELECT * FROM calculate_landed_cost(
                $1::jsonb, 
                $2::text
            )
        `;
        
        const res = await client.query(query, [JSON.stringify(rpcItems), destinationCountry]);
        
        // 4. Display Results
        // pg returns scalar function results as a column named after the function
        const rawResult = res.rows[0].calculate_landed_cost; 
        
        if (!rawResult) {
            console.error("RPC returned null or undefined.");
            console.log("Full Row:", res.rows[0]);
            return;
        }

        const result = rawResult;
        console.log("Full RPC Result:", JSON.stringify(result, null, 2));

        console.log("\n--- Landed Cost Results ---");
        console.log("Total Duty:", result.summary.total_duty);
        console.log("Total Fees (MPF/HMF):", result.summary.total_fees);
        console.log("Grand Total:", result.summary.grand_total_estimated_landed_cost);
        console.log("Currency:", "USD"); // Default for now
        console.log("\nItem Breakdown:");
        
        result.items.forEach((item, idx) => {
            console.log(`\nItem ${idx + 1} (HS: ${item.hs_code}):`);
            // Value is input, not returned per item in this version of RPC? 
            // Actually RPC returns result_items with hs_code, duty_amount, rate_found, rate_details.
            // Original value isn't echoed back in items array but is in input.
            
            console.log(`  Duty Rate: ${item.rate_details ? (item.rate_details.rate_value * 100) + '%' : 'N/A'}`);
            console.log(`  Duty Amount: ${item.duty_amount}`);
            console.log(`  Rate Found: ${item.rate_found}`);
            
            if (!item.rate_found) {
                console.warn("  [WARNING] No duty rate found for this HS code.");
            }
        });

    } catch (err) {
        console.error("Error during simulation:", err);
    } finally {
        await client.end();
    }
}

simulateQuoteLandedCost();
