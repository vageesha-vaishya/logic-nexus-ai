
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTemplate() {
    console.log("Checking for 'mgl_granular' template...");
    const { data: templates, error } = await supabase
        .from('quote_templates')
        .select('*')
        .eq('layout_type', 'mgl_granular');

    if (error) {
        console.error("Error fetching template:", error);
        return;
    }

    if (!templates || templates.length === 0) {
        console.log("No template found with layout_type = 'mgl_granular'.");
    } else {
        console.log(`Found ${templates.length} templates.`);
        templates.forEach(t => {
            console.log(`ID: ${t.id}`);
            console.log(`Content Layout: ${t.content?.layout}`);
            console.log(`Content Sections:`, JSON.stringify(t.content?.sections, null, 2));
        });
    }
}

checkTemplate();
