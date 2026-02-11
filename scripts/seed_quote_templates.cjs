const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const templates = [
    {
        name: 'MGL FCL Quote',
        description: 'Miami Global Lines FCL Quotation with Rate Matrix',
        content: {
            layout: "mgl_matrix",
            header: { 
                show_logo: true, 
                company_info: true, 
                title: "QUOTE",
                logo_url: "https://your-mgl-logo-url.com/logo.png" // Placeholder
            },
            sections: [
                { type: "customer_matrix_header", title: "Customer Info" }, // Custom combined header
                { type: "shipment_matrix_details", title: "Shipment Details" },
                { type: "rates_matrix", title: "Freight Charges" },
                { type: "terms_mgl", title: "TERMS & CONDITIONS" }
            ],
            footer: { text: "Professional Attitude at all Altitudes" },
            terms_text: `Above Rates Are Excluding of:
Destination charges / Cargo Insurance / taxes / duties / Title validation.
Demurrage / Detention / Storage / Overweight surcharges that may be incurred.

Rates are on:
- on PER UNIT basis.
- Prepaid basis.
- VATOS- Valid at time of shipping.
- All surcharges subject to change without any prior notice.
- On shippers stow, load and count basis

Rates are subject to:
- GRI (General Rate Increase) – if applicable .
- Telex Fee (if applicable)

- All Destination local charges on consignee’s account.
- Availability of equipment/space
- Hazardous cargo acceptance/approval.
- FUEL MUST BE DRAINED and BATTERIES SHOULD BE DISCONNECTED .
- Any additional charges at cost against official receipts.

Trucking rates are subject to:
- One hour free load and thereafter USD 100/hr. Drop n pick will be double unless otherwise advised .
- Chassis availability from shipping line ...if chassis need to rent out then there will be extra charges by trucker which will be as per actual.
- Chassis repositioning charges (if trucker has to pull out and return the chassis to different yard .charges will be additional).
- Maximum pay loader per 20’ std = 44000 LBS ( 20000 KGS ) WITH TRI AXLE
- All containers MUST observe standard US road weight limitations = MAX 44,000 LBS
- Chassis rental fee for one day included. All charges thereafter will be charged @ $40 to 80 / DAY depending on location.
- LOADING, LASHING, SECURING of cargo will be the responsibility of shipper.
- STORAGE/DEMURRAGE CHARGES / CUSTOMS VACIS EXAMINATION fee OR if any other cost will be charged as per actual.
- Pre-Pull charges will be applicable for pulling out container on the previous day if loading is schedule for early morning appointment .
- If TWO stop loading is required, you will get only ½ Hour free at each stop means total 1 hrs. for both the stops .
- Foodstuffs, Liquor, Additives, Tobacco, Animal Skin, Veterinary & Agricultural products require approval from HUB and/or Destination Office.
- HS Codes & other docs. may be required for approval & loading.
- Cargo must be palletized.
- Due to ongoing uncertainties in booking and non-availability of containers and storage space at terminals , many a times after issuing empty containers lines are shifting their ERD and dates of receiving containers in the yard . Such situations force us to store containers in private warehouses and involve additional move of containers at an extra cost . While we try our best to avoid such situation ,  under unavoidable situations any extra charges incurred in storage , security and additional trips made by truckers will be payable by you

Above rates subject to the following :
- TRUCKER AVAILABILITY
- CONTAINER AVAILABILITY
- CHASSIS AVAILABILITY
- Booking availability
- Above rates subject to additional charges due to change in EARLIEST RECEIVING which may change on daily basis.
- Due to current market scenario NO GUARANTEE of Loading on Particular date
- Subject to weight approval from shipping line

LAP TOP BATTERIES
- Many Lines consider Laptop Batteries as DG and require a specific declaration even if batteries are fitted in laptops as part of the equipment . Non observance of this may lead to payment of penalties which will be shipper’s responsibility ,kindly note.

RATES ARE NOT SUBJECT TO ANY COMMISSION.
THE SHIPPER'S BOOKING OF CARGO AFTER RECEIVING THE TERMS OF THIS NRA OR NRA AMENDMENT CONSTITUTES ACCEPTANCE OF THE RATES AND TERMS OF THIS NRA OR NRA AMENDMENT`
        }
    },
    {
        name: 'Standard FCL Quote',
        description: 'Standard Full Container Load quotation template',
        content: {
            layout: "standard",
            header: { show_logo: true, company_info: true, title: "FCL QUOTATION" },
            sections: [
                { type: "customer_info", title: "Customer Information" },
                { type: "shipment_info", title: "Shipment Details" },
                { type: "container_details", title: "Container Specifications" },
                { type: "rates_table", title: "Freight Charges" },
                { type: "terms", title: "Terms & Conditions" }
            ],
            footer: { text: "Thank you for your business. Please contact us for any questions." }
        }
    },
    {
        name: 'Standard LCL Quote',
        description: 'Less than Container Load quotation template',
        content: {
            layout: "standard",
            header: { show_logo: true, company_info: true, title: "LCL QUOTATION" },
            sections: [
                { type: "customer_info", title: "Customer Information" },
                { type: "shipment_info", title: "Shipment Details" },
                { type: "cargo_details", title: "Cargo Details" },
                { type: "rates_table", title: "Freight Charges" },
                { type: "terms", title: "Terms & Conditions" }
            ],
            footer: { text: "LCL rates are subject to change based on final weight/volume." }
        }
    },
    {
        name: 'Air Freight Quote',
        description: 'Air Freight quotation template',
        content: {
            layout: "compact",
            header: { show_logo: true, company_info: true, title: "AIR FREIGHT QUOTE" },
            sections: [
                { type: "customer_info", title: "Client" },
                { type: "shipment_info", title: "Routing" },
                { type: "cargo_details", title: "Cargo Specification" },
                { type: "rates_table", title: "Air Freight Rates" },
                { type: "terms", title: "Conditions" }
            ],
            footer: { text: "Air rates are valid for 7 days." }
        }
    },
    {
        name: 'Multimodal Quote',
        description: 'Combined transport quotation template',
        content: {
            layout: "detailed",
            header: { show_logo: true, company_info: true, title: "MULTIMODAL TRANSPORT QUOTATION" },
            sections: [
                { type: "customer_info", title: "Customer Details" },
                { type: "shipment_info", title: "Route Overview" },
                { type: "address_details", title: "Pickup & Delivery" },
                { type: "rates_table", title: "Transport Charges" },
                { type: "terms", title: "Terms & Conditions" }
            ],
            footer: { text: "Multimodal liability applies." }
        }
    },
    {
        name: 'Express Quote',
        description: 'Express/Courier quotation template',
        content: {
            layout: "simple",
            header: { show_logo: true, company_info: true, title: "EXPRESS QUOTE" },
            sections: [
                { type: "customer_info", title: "To" },
                { type: "shipment_info", title: "Shipment" },
                { type: "rates_table", title: "Total Cost" },
                { type: "terms", title: "Terms" }
            ],
            footer: { text: "Express delivery guaranteed." }
        }
    }
];

async function seedTemplates() {
    console.log('Seeding Quote Templates...');
    
    // Check if templates exist
    const { data: existing } = await supabase.from('quote_templates').select('name');
    const existingNames = new Set(existing ? existing.map(t => t.name) : []);

    for (const t of templates) {
        if (existingNames.has(t.name)) {
            console.log(`Template "${t.name}" already exists. Updating...`);
            const { error } = await supabase.from('quote_templates').update(t).eq('name', t.name);
            if (error) console.error(`Error updating ${t.name}:`, error);
        } else {
            console.log(`Creating Template "${t.name}"...`);
            const { error } = await supabase.from('quote_templates').insert(t);
            if (error) console.error(`Error inserting ${t.name}:`, error);
        }
    }
    console.log('Seeding complete.');
}

seedTemplates();
