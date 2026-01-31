
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Load environment variables
dotenv.config({ path: path.join(projectRoot, '.env') });

// Load .env.migration for DB credentials if needed
const envMigrationPath = path.join(projectRoot, '.env.migration');
let dbUrl = process.env.DATABASE_URL;

if (fs.existsSync(envMigrationPath)) {
  const content = fs.readFileSync(envMigrationPath, 'utf-8');
  content.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) {
      const key = m[1];
      let val = m[2];
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (key === 'SUPABASE_DB_URL' && !dbUrl) dbUrl = val;
    }
  });
}

if (!dbUrl) {
  console.error('❌ No DATABASE_URL or SUPABASE_DB_URL found.');
  process.exit(1);
}

const { Client } = pg;
const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

// Configuration
const DOCS_DIR = join(projectRoot, 'docs');
const MIGRATIONS_DIR = join(projectRoot, 'supabase/migrations');
const NON_LOGISTICS_DOC = join(DOCS_DIR, 'NON_LOGISTICS_DOMAINS.md');
const ARCHITECTURE_DOC = join(DOCS_DIR, 'SERVICE_ARCHITECTURE.md');

// Markdown Templates
const DOMAIN_TEMPLATE = (domain, deps) => `
## ${domain.name}
![Status](https://img.shields.io/badge/Status-${domain.status}-blue) ![Owner](https://img.shields.io/badge/Owner-${encodeURIComponent(domain.owner || 'Unassigned')}-green)

**Business Capability**: ${domain.description || 'No description provided.'}

### Exposed APIs
- [OpenAPI Spec](${domain.swagger_endpoint || '#'})
- [Repository](${domain.repository_url || '#'})

### Dependencies
| Type | Domain | Description |
| :--- | :--- | :--- |
${deps && deps.length > 0 ? deps.map(d => `| ${d.type} | ${d.name} | ${d.description || '-'} |`).join('\n') : '| - | - | - |'}

### Architecture
[View Mermaid Diagram](#)
`;

const CHANGE_LOG_HEADER = `
## Change Log
| Version | Date | Author | Jira Ticket | Change Type | Domain Affected | Commit Hash |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
`;

async function main() {
  try {
    await client.connect();
    console.log('🔌 Connected to database.');

    // --- PHASE 1: EXTRACT ---
    console.log('📥 Phase 1: Extracting authoritative data...');
    const domainsRes = await client.query(`
      SELECT * FROM platform_domains ORDER BY name
    `);
    const domains = domainsRes.rows;

    // Check if domain_relationships table exists before querying
    let relationships = [];
    const relCheck = await client.query("SELECT to_regclass('domain_relationships')");
    if (relCheck.rows[0].to_regclass) {
        const relationshipsRes = await client.query(`
        SELECT 
            dr.relationship_type, 
            dr.description,
            pd_source.key as source_key,
            pd_target.key as target_key,
            pd_target.name as target_name
        FROM domain_relationships dr
        JOIN platform_domains pd_source ON dr.source_domain_id = pd_source.id
        JOIN platform_domains pd_target ON dr.target_domain_id = pd_target.id
        `);
        relationships = relationshipsRes.rows;
    }

    // Attach dependencies to domains
    domains.forEach(d => {
      d.dependencies = relationships
        .filter(r => r.source_key === d.key)
        .map(r => ({ type: r.relationship_type, name: r.target_name, description: r.description }));
    });

    console.log(`✅ Extracted ${domains.length} domains.`);

    // --- PHASE 2 & 3: ANALYZE & GAP ANALYSIS ---
    console.log('🔍 Phase 2 & 3: Analyzing documentation gaps...');
    
    // We categorize domains: 'logistics' goes to SERVICE_ARCHITECTURE.md, others to NON_LOGISTICS_DOMAINS.md
    const logisticsDomains = domains.filter(d => d.key === 'logistics');
    const nonLogisticsDomains = domains.filter(d => d.key !== 'logistics');

    // --- PHASE 4: REWRITE ---
    console.log('📝 Phase 4: Rewriting documentation...');

    await updateDocFile(ARCHITECTURE_DOC, logisticsDomains, 'Service Architecture');
    await updateDocFile(NON_LOGISTICS_DOC, nonLogisticsDomains, 'Non-Logistics Domains');

    // --- PHASE 5: CHANGE LOG ---
    // (Handled inside updateDocFile)

    // --- PHASE 6: GENERATE SQL ---
    console.log('💾 Phase 6: Generating SQL migrations...');
    await generateSqlMigrations(domains);

    // --- VALIDATION ---
    console.log('✅ Validation complete. Documentation is synchronized.');

  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

async function updateDocFile(filePath, domains, title) {
  let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : `# ${title}\n\n`;
  
  // Basic front-matter check (naive)
  if (!content.startsWith('---')) {
    const frontMatter = `---
generated_at: ${new Date().toISOString()}
source: platform_domains
---
`;
    content = frontMatter + content;
  }

  // Split by Change Log to preserve it
  const parts = content.split('## Change Log');
  let body = parts[0];
  let changeLog = parts[1] || '';

  // Remove existing "Domain Reference" if present to rebuild it cleanly
  const referenceHeader = '## Domain Reference';
  if (body.includes(referenceHeader)) {
    body = body.split(referenceHeader)[0];
  }
  
  // Append new Domain Reference section
  body += `\n${referenceHeader}\n`;
  
  domains.forEach(d => {
      body += DOMAIN_TEMPLATE(d, d.dependencies);
  });

  // Reconstruct Change Log
  if (!changeLog.trim()) {
    changeLog = `\n| 1.0.0 | ${new Date().toISOString().split('T')[0]} | Auto-Sync | - | MODIFY | All | - |`;
  } else {
      const today = new Date().toISOString().split('T')[0];
      if (!changeLog.includes(today)) {
          const newEntry = `| 1.0.x | ${today} | Auto-Sync | - | UPDATE | ${domains.map(d=>d.name).join(', ')} | - |`;
          changeLog += `\n${newEntry}`;
      }
  }

  const fullContent = `${body.trim()}\n\n${CHANGE_LOG_HEADER.trim()}\n${changeLog.trim()}`;
  
  fs.writeFileSync(filePath, fullContent);
  console.log(`📄 Updated ${path.basename(filePath)}`);
}

async function generateSqlMigrations(domains) {
  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
  
  for (const [index, domain] of domains.entries()) {
    const version = BigInt(timestamp) + BigInt(index);
    const fileName = `${version}_sync_${domain.key.toLowerCase()}_domain.sql`;
    const filePath = join(MIGRATIONS_DIR, fileName);

    const sql = `
-- Sync Domain: ${domain.name}
-- Generated by scripts/sync_domains.js

BEGIN;

INSERT INTO platform_domains (key, code, name, description, owner, status, repository_url, swagger_endpoint)
VALUES (
    '${domain.key}',
    '${domain.key}',
    '${domain.name}',
    '${(domain.description || '').replace(/'/g, "''")}',
    '${domain.owner || ''}',
    '${domain.status || 'planned'}',
    '${domain.repository_url || ''}',
    '${domain.swagger_endpoint || ''}'
)
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    owner = EXCLUDED.owner,
    status = EXCLUDED.status,
    repository_url = EXCLUDED.repository_url,
    swagger_endpoint = EXCLUDED.swagger_endpoint;

COMMIT;

/*
-- ROLLBACK SECTION
-- Note: This rollback deletes the domain. If this was an update, you must manually restore the previous values.
BEGIN;
DELETE FROM platform_domains WHERE key = '${domain.key}';
COMMIT;
*/
`;
    
    fs.writeFileSync(filePath, sql);
    console.log(`💾 Generated migration: ${fileName}`);
  }
}

main();
