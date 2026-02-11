
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from 'fs';
import path from 'path';

// Mock Data matching the structure expected by the function
const mockQuote = {
    id: "test-quote-123",
    quote_number: "QUO-TEST-001",
    accounts: {
        name: "Test Customer",
        id: "CUST123",
        billing_city: "New York",
        phone: "123-456-7890"
    },
    origin: { location_name: "New York", country_id: "US" },
    destination: { location_name: "London", country_id: "UK" },
    items: [
        { description: "Electronics", quantity: 10, container_sizes: { name: "20'" }, container_types: { code: "GP" } }
    ]
};

const mockVersion = {
    valid_until: "2024-12-31"
};

const mockOptions = [
    {
        id: "opt-1",
        carrier_name: "Maersk Line",
        transit_days: "12",
        frequency: "Weekly",
        container_sizes: { name: "20'", code: "20GP" },
        container_types: { code: "GP", name: "General Purpose" },
        service_type: "Standard",
        currency: "USD",
        legs: [
            { id: "leg-1", sort_order: 1, transport_mode: "OCEAN", origin: { location_name: "New York" }, destination: { location_name: "London" }, leg_number: 1 }, // Added leg_number to test fallback but logic should use sort_order
            { id: "leg-2", sort_order: 2, transport_mode: "TRUCK", origin: { location_name: "London" }, destination: { location_name: "Warehouse" }, leg_number: 2 }
        ],
        charges: [
            { leg_id: "leg-1", amount: 1000, note: "Ocean Freight", category: { name: "Freight" } },
            { leg_id: "leg-2", amount: 200, note: "Delivery", category: { name: "Trucking" } },
            { leg_id: null, amount: 50, note: "Doc Fee", category: { name: "Documentation" } }
        ],
        total_amount: 1250
    },
    {
        id: "opt-2",
        carrier_name: "Maersk Line",
        transit_days: "12",
        frequency: "Weekly",
        container_sizes: { name: "40'", code: "40GP" },
        container_types: { code: "GP", name: "General Purpose" },
        service_type: "Standard",
        currency: "USD",
        legs: [
            { id: "leg-3", sort_order: 1, transport_mode: "OCEAN", origin: { location_name: "New York" }, destination: { location_name: "London" }, leg_number: 1 },
            { id: "leg-4", sort_order: 2, transport_mode: "TRUCK", origin: { location_name: "London" }, destination: { location_name: "Warehouse" }, leg_number: 2 }
        ],
        charges: [
            { leg_id: "leg-3", amount: 1800, note: "Ocean Freight", category: { name: "Freight" } },
            { leg_id: "leg-4", amount: 300, note: "Delivery", category: { name: "Trucking" } },
            { leg_id: null, amount: 50, note: "Doc Fee", category: { name: "Documentation" } }
        ],
        total_amount: 2150
    }
];

const templateContent = {
    layout: "mgl_granular",
    header: { show_logo: true },
    sections: [
        { type: "customer_matrix_header" },
        { type: "shipment_matrix_details" },
        { type: "rates_matrix" }
    ]
};

async function generatePDF() {
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Colors
    const primaryColor = rgb(0, 0.53, 0.71);
    const lightBlue = rgb(0.85, 0.93, 0.95);
    const black = rgb(0, 0, 0);
    const gray = rgb(0.5, 0.5, 0.5);

    let y = height - 50;

    const drawText = (text: string, x: number, y: number, size = 10, isBold = false, color = black) => {
        page.drawText(String(text || ''), { x, y, size, font: isBold ? boldFont : font, color });
    };

    const drawRect = (x: number, y: number, w: number, h: number, color = black, filled = false) => {
        if (filled) {
            page.drawRectangle({ x, y, width: w, height: h, color: color });
        } else {
            page.drawRectangle({ x, y, width: w, height: h, borderColor: color, borderWidth: 1 });
        }
    };

    const drawLine = (x1: number, y1: number, x2: number, y2: number, color = black) => {
        page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color, thickness: 1 });
    };

    // --- RENDERER LOGIC (Copied & Adapted) ---

    // MGL Header
    drawText("MGL", 270, height - 40, 30, true, primaryColor);
    drawText("MIAMI GLOBAL LINES", 230, height - 60, 16, true, primaryColor);
    
    // ... skipping address details for brevity ...
    y = height - 135;

    // Sections
    for (const section of templateContent.sections) {
        if (y < 100) { page = pdfDoc.addPage(); y = height - 50; }

        if (section.type === "rates_matrix") {
            // Matrix Logic
            const carriers: Record<string, any[]> = {};
            mockOptions.forEach((opt: any) => {
                const cName = opt.carrier_name || "Standard";
                if (!carriers[cName]) carriers[cName] = [];
                carriers[cName].push(opt);
            });

            for (const [carrierName, opts] of Object.entries(carriers)) {
                const carrierOptions = opts as any[];
                
                // Carrier Header
                drawRect(40, y - 25, 510, 25, lightBlue, true);
                drawRect(40, y - 25, 510, 25);
                drawText(`Carrier: ${carrierName}`, 45, y - 17, 11, true);
                y -= 25;

                // Columns
                const sizeMap = new Map();
                carrierOptions.forEach(opt => {
                    const sName = opt.container_sizes?.name || "Standard";
                    const tCode = opt.container_types?.code || "";
                    const key = `${sName} ${tCode} ${opt.service_type ? '(' + opt.service_type + ')' : ''}`.trim();
                    if (!sizeMap.has(key)) sizeMap.set(key, []);
                    sizeMap.get(key).push(opt);
                });
                
                const columns = Array.from(sizeMap.keys());
                const colCount = columns.length;
                const descW = 90;
                const remW = 90;
                const rateAreaW = 510 - descW - remW;
                const perColW = colCount > 0 ? rateAreaW / colCount : rateAreaW;

                // Header Row
                const headerH = 30;
                drawRect(40, y - headerH, 510, headerH);
                let cx = 40 + descW;
                drawLine(cx, y, cx, y - headerH);
                for (let i = 0; i < colCount; i++) {
                    drawText(columns[i], cx + 2, y - 12, 8, true);
                    cx += perColW;
                    drawLine(cx, y, cx, y - headerH);
                }
                drawText("Remarks", cx + 5, y - 18, 9, true);
                y -= headerH;

                // Granular Logic
                const refLegs = carrierOptions[0]?.legs || [];
                // Sort by sort_order
                refLegs.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));

                for (const leg of refLegs) {
                    const legLabel = `${leg.transport_mode || leg.mode || 'Transport'} (${leg.origin?.location_name || 'Origin'} -> ${leg.destination?.location_name || 'Dest'})`;
                    
                    // Sub-header
                    drawRect(40, y - 20, 510, 20, rgb(0.95, 0.95, 0.95), true);
                    drawRect(40, y - 20, 510, 20);
                    drawText(legLabel, 45, y - 14, 9, true, gray);
                    y -= 20;

                    const legChargeNames = new Set<string>();
                    columns.forEach(colKey => {
                        const optsForCol = sizeMap.get(colKey);
                        optsForCol?.forEach((o: any) => {
                            // Match by sort_order
                            const targetLeg = o.legs?.find((l: any) => l.sort_order === leg.sort_order) || 
                                              o.legs?.find((l: any) => (l.transport_mode === leg.transport_mode || l.mode === leg.mode) && l.origin_location_id === leg.origin_location_id);
                            
                            if (targetLeg) {
                                o.charges?.filter((c: any) => c.leg_id === targetLeg.id).forEach((c: any) => legChargeNames.add(c.note || c.category?.name || "Charge"));
                            }
                        });
                    });

                    for (const cName of legChargeNames) {
                        const rowH = 20;
                        drawRect(40, y - rowH, 510, rowH);
                        let lcx = 40 + descW;
                        drawLine(lcx, y, lcx, y - rowH);
                        for (let i = 0; i < colCount; i++) {
                            lcx += perColW;
                            drawLine(lcx, y, lcx, y - rowH);
                        }

                        drawText(cName, 45, y - 14, 9);

                        lcx = 40 + descW;
                        for (const colKey of columns) {
                            const optsForCol = sizeMap.get(colKey);
                            let val = 0;
                            let found = false;
                            if (optsForCol) {
                                for (const o of optsForCol) {
                                    // Match by sort_order
                                    const targetLeg = o.legs?.find((l: any) => l.sort_order === leg.sort_order) || 
                                                      o.legs?.find((l: any) => (l.transport_mode === leg.transport_mode || l.mode === leg.mode) && l.origin_location_id === leg.origin_location_id);
                                    if (targetLeg) {
                                       const chg = o.charges?.find((c: any) => c.leg_id === targetLeg.id && (c.note || c.category?.name || "Charge") === cName);
                                       if (chg) {
                                           val += Number(chg.amount);
                                           found = true;
                                       }
                                    }
                                }
                            }
                            if (found) drawText(val.toFixed(2), lcx + 5, y - 14, 9);
                            lcx += perColW;
                        }
                        y -= rowH;
                    }
                }
            }
        }
    }

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync('test_output.pdf', pdfBytes);
    console.log("PDF generated at test_output.pdf");
}

generatePDF().catch(console.error);
