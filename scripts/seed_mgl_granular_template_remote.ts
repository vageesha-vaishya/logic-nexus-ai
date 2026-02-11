
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gzhxgoigflftharcmdqj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6aHhnb2lnZmxmdGhhcmNtZHFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTUxOTY4NywiZXhwIjoyMDg1MDk1Njg3fQ.MImJoQhZUG2lSQ9PpN0z1QwDI1nvA2AsYPOeVfDGMos';

if (!SUPABASE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function seedTemplate() {
    console.log('Seeding MGL Granular Quote template...');

    const config = {
        layout: 'mgl_granular',
        header: {
            show_logo: true,
            show_address: true,
            provider_details: {
                name: "Miami Global Lines",
                address: "140 Ethel Road West; Unit 'S&T', Piscataway, NJ 08854–USA",
                phone: "+1-732-640-2365",
                fmc_lic: "023172NF",
                iac_no: "NE1210010"
            }
        },
        sections: [
            { id: "customer_info", type: "customer_matrix_header", title: "Customer Information", visible: true },
            { id: "shipment_details", type: "shipment_matrix_details", title: "Shipment Details", visible: true },
            { id: "rate_matrix", type: "rates_matrix", title: "Carrier Rates", visible: true, show_breakdown: true },
            { id: "terms", type: "terms", title: "Terms & Conditions", visible: true }
        ],
        terms: {
            exclusions: [
                "Destination charges",
                "Cargo Insurance",
                "Taxes / duties",
                "Demurrage / Detention / Storage"
            ],
            notes: [
                "Rates are on PER UNIT basis",
                "VATOS (Valid at time of shipping)",
                "Trucking: One hour free load, thereafter USD 100/hr",
                "Max weight: 44,000 LBS per standard US road limitations"
            ]
        }
    };

    // Check if template exists
    const { data: existing } = await supabase
        .from('quote_templates')
        .select('id')
        .eq('name', 'MGL Granular Quote')
        .single();

    let result;
    if (existing) {
        console.log('Template exists. Updating...');
        result = await supabase
            .from('quote_templates')
            .update({
                description: 'MGL FCL Quote with granular rate breakdown (Ocean, Trucking, etc.) per leg/mode.',
                content: config
            })
            .eq('id', existing.id)
            .select();
    } else {
        console.log('Template does not exist. Inserting...');
        result = await supabase
            .from('quote_templates')
            .insert({
                name: 'MGL Granular Quote',
                description: 'MGL FCL Quote with granular rate breakdown (Ocean, Trucking, etc.) per leg/mode.',
                content: config
            })
            .select();
    }

    const { data, error } = result;

    if (error) {
        console.error('Error seeding template:', error);
        process.exit(1);
    }

    console.log('Template seeded successfully:', data);
}

seedTemplate();
