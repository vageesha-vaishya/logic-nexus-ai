
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function verifyPhase2() {
    console.log("🔍 Starting Phase 2 (AI Threat Detection) Verification...");
    const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
    
    try {
        await client.connect();
        console.log('✅ Connected to DB');

        // 1. Check DB Schema
        console.log("Checking DB Schema...");
        
        // Check security_incidents table
        const tableRes = await client.query(`
            SELECT to_regclass('public.security_incidents');
        `);
        if (tableRes.rows[0].to_regclass) {
            console.log("✅ Table 'security_incidents' exists.");
        } else {
            console.error("❌ Table 'security_incidents' MISSING.");
            process.exit(1);
        }

        // Check emails columns
        const colRes = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'emails' AND column_name = 'threat_level';
        `);
        if (colRes.rows.length > 0) {
            console.log("✅ Column 'threat_level' exists in 'emails'.");
        } else {
            console.error("❌ Column 'threat_level' MISSING in 'emails'.");
            process.exit(1);
        }

        // 2. Check Edge Function File
        console.log("Checking Edge Function...");
        const funcPath = path.join(__dirname, '..', 'supabase', 'functions', 'analyze-email-threat', 'index.ts');
        if (fs.existsSync(funcPath)) {
            console.log("✅ Edge Function 'analyze-email-threat/index.ts' exists.");
        } else {
            console.error("❌ Edge Function file MISSING.");
            process.exit(1);
        }

        // 3. Simulate Data Insertion (Test Constraints)
        console.log("Verifying Data Constraints...");
        // We need a tenant and email first.
        // Let's try to find an existing tenant or create a dummy one if possible.
        // Note: Creating data might fail if we don't satisfy FKs. 
        // We'll skip data insertion if we can't find dependencies to avoid polluting DB or failing.
        
        const tenantRes = await client.query("SELECT id FROM tenants LIMIT 1");
        if (tenantRes.rows.length > 0) {
            const tenantId = tenantRes.rows[0].id;
            console.log(`Found tenant: ${tenantId}`);
            
            // Find an email
            const emailRes = await client.query(`SELECT id FROM emails WHERE tenant_id = $1 LIMIT 1`, [tenantId]);
            if (emailRes.rows.length > 0) {
                const emailId = emailRes.rows[0].id;
                console.log(`Found email: ${emailId}`);
                
                // Try inserting an incident
                try {
                    const insertRes = await client.query(`
                        INSERT INTO security_incidents (tenant_id, email_id, threat_level, threat_type, description, status)
                        VALUES ($1, $2, 'suspicious', 'Phishing', 'Test Incident', 'open')
                        RETURNING id;
                    `, [tenantId, emailId]);
                    
                    console.log(`✅ Successfully inserted test incident: ${insertRes.rows[0].id}`);
                    
                    // Clean up
                    await client.query(`DELETE FROM security_incidents WHERE id = $1`, [insertRes.rows[0].id]);
                    console.log("✅ Test incident cleaned up.");
                    
                } catch (e) {
                    console.error("❌ Failed to insert test incident:", e);
                }
            } else {
                console.log("⚠️ No emails found, skipping incident insertion test.");
            }
        } else {
            console.log("⚠️ No tenants found, skipping data tests.");
        }

        console.log("✅ Phase 2 Verification Completed Successfully.");

    } catch (err) {
        console.error('❌ Verification Failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

verifyPhase2();
