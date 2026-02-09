
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function simulateRegistration() {
    const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
    try {
        await client.connect();
        
        // 1. Get a tenant
        const tenantRes = await client.query('SELECT id, name FROM tenants LIMIT 1');
        if (tenantRes.rows.length === 0) {
            console.error('No tenants found. Please create a tenant first.');
            return;
        }
        const tenant = tenantRes.rows[0];
        console.log(`Using Tenant: ${tenant.name} (${tenant.id})`);

        // 2. Simulate Input
        const domainName = 'test-domain.com';
        
        // 3. Generate Tokens (Simulation of AWS SES)
        const generateToken = () => Math.random().toString(36).substring(2, 15);
        const dkimTokens = [generateToken(), generateToken(), generateToken()];
        
        const providerMetadata = {
            provider: 'aws_ses',
            identity_arn: `arn:aws:ses:us-east-1:123456789012:identity/${domainName}`,
            dkim_tokens: dkimTokens,
            registered_at: new Date().toISOString()
        };

        // 4. Upsert into tenant_domains
        const upsertQuery = `
            INSERT INTO tenant_domains (tenant_id, domain_name, provider_metadata)
            VALUES ($1, $2, $3)
            ON CONFLICT (tenant_id, domain_name) 
            DO UPDATE SET provider_metadata = EXCLUDED.provider_metadata
            RETURNING *;
        `;
        
        const res = await client.query(upsertQuery, [tenant.id, domainName, providerMetadata]);
        const domainRecord = res.rows[0];

        console.log('\n🎉 Domain Registered Successfully (Simulated)!');
        console.log('------------------------------------------------');
        console.log(`Domain: ${domainRecord.domain_name}`);
        console.log(`Tenant: ${tenant.name}`);
        console.log('------------------------------------------------');
        console.log('👉 DNS Configuration Instructions (Add these to your DNS provider):');
        console.log('\n1. SPF Record (TXT):');
        console.log(`   Host: @`);
        console.log(`   Value: "v=spf1 include:amazonses.com ~all"`);
        
        console.log('\n2. DMARC Record (TXT):');
        console.log(`   Host: _dmarc.${domainName}`);
        console.log(`   Value: "v=DMARC1; p=none;"`);

        console.log('\n3. DKIM Records (CNAME):');
        dkimTokens.forEach(token => {
            console.log(`   Host: ${token}._domainkey.${domainName}`);
            console.log(`   Value: ${token}.dkim.amazonses.com`);
        });
        console.log('------------------------------------------------');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

simulateRegistration();
