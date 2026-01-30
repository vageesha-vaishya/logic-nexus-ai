
import { mapOptionToQuote, calculateQuoteFinancials } from '../src/lib/quote-mapper';

// Mock matchLegForCharge since it's imported in quote-mapper
// But wait, we are importing the real one. That's fine if charge-bifurcation is pure logic.
// However, if it has dependencies we might need to be careful.
// charge-bifurcation seems to be pure logic based on previous reads.

const mockAIResponse = {
    carrier: "Maersk",
    price: 1500,
    currency: "USD",
    transit_time: "25 days",
    service_type: "Port-to-Port",
    mode: "Ocean",
    origin: "Shanghai",
    destination: "Los Angeles",
    legs: [
        {
            mode: "Ocean",
            origin: "Shanghai",
            destination: "Los Angeles",
            carrier: "Maersk",
            transit_time: "25 days",
            charges: [
                { name: "Ocean Freight", amount: 1200, unit: "per_container" },
                { name: "Bunker Adjustment Factor", amount: 150, unit: "per_container" },
                { name: "Terminal Handling Charge", amount: 150, unit: "per_container" }
            ]
        }
    ]
};

console.log("Testing mapOptionToQuote with AI response...");

try {
    const result = mapOptionToQuote(mockAIResponse);
    console.log("Result:", JSON.stringify(result, null, 2));

    // Validations
    if (result.sellPrice !== 1500) {
        console.error(`FAIL: sellPrice mismatch. Expected 1500, got ${result.sellPrice}`);
    } else {
        console.log("PASS: sellPrice matches");
    }

    if (result.legs && result.legs.length > 0) {
        console.log(`PASS: Generated ${result.legs.length} legs`);
        
        const leg = result.legs[0];
        if (leg.charges && leg.charges.length === 3) {
            console.log("PASS: Leg has correct number of charges");
        } else {
            console.error(`FAIL: Leg charge count mismatch. Expected 3, got ${leg.charges?.length}`);
        }
    } else {
        console.error("FAIL: No legs generated");
    }

} catch (e) {
    console.error("Error running test:", e);
}

// Test Financial Calculation
console.log("\nTesting calculateQuoteFinancials...");
const cost = 1000;
const financials = calculateQuoteFinancials(cost, true); // cost-plus
console.log(`Cost: ${cost}, Cost-Plus Result:`, financials);

if (financials.buyPrice === 1000 && financials.marginPercent === 15) {
     console.log("PASS: Financial calculation (cost-plus)");
} else {
     console.error("FAIL: Financial calculation mismatch");
}
