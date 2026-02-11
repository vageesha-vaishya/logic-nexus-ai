
import fs from 'fs';
import { createRequire } from 'module';

import * as pdfParseModule from 'pdf-parse';
import fs from 'fs';

// @ts-ignore
const PDFParse = pdfParseModule.PDFParse || pdfParseModule.default || pdfParseModule;

async function validate() {
    const dataBuffer = fs.readFileSync('test_output.pdf');
    console.log("PDF Buffer size:", dataBuffer.length);
    
    let text = "";
    try {
        // Try calling it as a function
        // @ts-ignore
        const data = await PDFParse(dataBuffer);
        text = data.text;
    } catch (e) {
        console.log("Direct call failed, trying new:", e.message);
        try {
            // @ts-ignore
            const instance = new PDFParse(dataBuffer);
            // Wait if it's a promise or has a method
            text = instance.text || (await instance).text;
        } catch (e2) {
             console.log("New instance failed:", e2.message);
        }
    }

    if (!text) {
        console.error("Could not extract text from PDF");
        process.exit(1);
    }
    
    console.log("Extracted Text Length:", text.length);
    console.log("Extracted Text Preview:", text.substring(0, 200));

    const checks = [
        "MGL",
        "Carrier: Maersk Line",
        "OCEAN (New York -> London)",
        "Ocean Freight",
        "1000.00",
        "1800.00",
        "TRUCK (London -> Warehouse)",
        "Delivery",
        "200.00",
        "300.00",
        "20' GP (Standard)",
        "40' GP (Standard)"
    ];

    const failed = checks.filter(c => !text.includes(c));

    if (failed.length > 0) {
        console.error("FAILED: Missing content:", failed);
        process.exit(1);
    } else {
        console.log("SUCCESS: All content found.");
    }
}

validate().catch(console.error);

    console.log("Extracted Text:\n", text);

    const checks = [
        "MGL",
        "Carrier: Maersk Line",
        "OCEAN (New York -> London)",
        "Ocean Freight",
        "1000.00",
        "1800.00",
        "TRUCK (London -> Warehouse)",
        "Delivery",
        "200.00",
        "300.00",
        "20' GP (Standard)",
        "40' GP (Standard)"
    ];

    const failed = checks.filter(c => !text.includes(c));

    if (failed.length > 0) {
        console.error("FAILED: Missing content:", failed);
        process.exit(1);
    } else {
        console.log("SUCCESS: All content found.");
    }
}

validate().catch(console.error);
