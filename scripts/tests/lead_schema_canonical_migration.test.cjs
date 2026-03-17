const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { Client } = require('pg');
require('dotenv').config();

const DB_URL = process.env.LEAD_SCHEMA_TEST_DB_URL || process.env.DATABASE_URL;
const UPGRADE_FILE = path.join(__dirname, '../../supabase/migrations/20260316113000_lead_schema_canonical_alignment.sql');
const DOWNGRADE_FILE = path.join(__dirname, '../../supabase/migrations/reversible/20260316113000_lead_schema_canonical_alignment.down.sql');

if (!DB_URL) {
  console.error('LEAD_SCHEMA_TEST_DB_URL or DATABASE_URL is required');
  process.exit(1);
}

function stripTransaction(sql) {
  return sql
    .replace(/^\s*BEGIN\s*;\s*/im, '')
    .replace(/\s*COMMIT\s*;\s*$/im, '');
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertFails(client, sql, params) {
  await client.query('SAVEPOINT expected_failure');
  try {
    await client.query(sql, params);
  } catch (_error) {
    await client.query('ROLLBACK TO SAVEPOINT expected_failure');
    await client.query('RELEASE SAVEPOINT expected_failure');
    return;
  }
  await client.query('RELEASE SAVEPOINT expected_failure');
  throw new Error('Expected statement to fail but it succeeded');
}

async function run() {
  const client = new Client({ connectionString: DB_URL });
  const leadId = randomUUID();
  const badSalespersonId = randomUUID();

  const upgradeSql = stripTransaction(fs.readFileSync(UPGRADE_FILE, 'utf8'));
  const downgradeSql = stripTransaction(fs.readFileSync(DOWNGRADE_FILE, 'utf8'));

  await client.connect();

  try {
    await client.query('BEGIN');

    const tenantRow = await client.query(
      `SELECT id FROM public.tenants ORDER BY created_at NULLS LAST, id LIMIT 1`
    );
    assertCondition(tenantRow.rows.length === 1, 'At least one tenant is required for this test');
    const tenantId = tenantRow.rows[0].id;

    await client.query(
      `INSERT INTO public.leads (id, tenant_id, first_name, last_name, company, email, phone)
       VALUES ($1, $2, 'Initial', 'Lead', 'Legacy Co', 'legacy@example.com', '+12025550100')`,
      [leadId, tenantId]
    );

    await client.query(
      `DO $$
       BEGIN
         IF EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'leads'
             AND column_name = 'priority'
         ) THEN
           UPDATE public.leads
           SET priority = 'medium'
           WHERE priority IS NULL
             OR lower(trim(priority::text)) NOT IN ('low', 'medium', 'high', 'urgent', 'critical');
         END IF;
       END $$;`
    );

    const before = await client.query(
      `SELECT first_name, last_name, company
       FROM public.leads
       WHERE id = $1`,
      [leadId]
    );

    await client.query(upgradeSql);

    const profileRow = await client.query(
      `SELECT ru.id
       FROM public.res_users ru
       ORDER BY ru.created_at NULLS LAST, ru.id
       LIMIT 1`
    );
    assertCondition(profileRow.rows.length === 1, 'At least one profile/res_user is required for this test');
    const profileId = profileRow.rows[0].id;

    await client.query(
      `INSERT INTO public.crm_team (id, tenant_id, name)
       VALUES ('team-audit', $1, 'Audit Team')
       ON CONFLICT (id) DO NOTHING`,
      [tenantId]
    );

    await client.query(
      `INSERT INTO crm.tag (id, tenant_id, name)
       VALUES ('tag-audit', $1, 'Audit Tag')
       ON CONFLICT (id) DO NOTHING`,
      [tenantId]
    );

    await client.query(
      `UPDATE public.leads
       SET company_name = 'Legacy Co',
           address_line1 = '123 Harbor Street',
           address_line2 = 'Suite 100',
           city = 'Long Beach',
           state = 'CA',
           country = 'USA',
           website = 'https://example.com',
           contact_name = 'Initial Lead',
           title = 'Director',
           email = 'valid.person@example.com',
           job_position = 'Sales Director',
           phone = '(202) 555-0101',
           mobile = '202-555-0102',
           salesperson_id = $2,
           sales_team = 'team-audit',
           priority = 'urgent'
       WHERE id = $1`,
      [leadId, profileId]
    );

    await client.query(
      `INSERT INTO public.lead_tag_rel (lead_id, tag_id)
       VALUES ($1, 'tag-audit')
       ON CONFLICT DO NOTHING`,
      [leadId]
    );

    const after = await client.query(
      `SELECT first_name, last_name, company, phone, mobile, priority
       FROM public.leads
       WHERE id = $1`,
      [leadId]
    );

    assertCondition(after.rows.length === 1, 'Lead row should exist after upgrade');
    assertCondition(after.rows[0].first_name === before.rows[0].first_name, 'Existing first_name changed unexpectedly');
    assertCondition(after.rows[0].last_name === before.rows[0].last_name, 'Existing last_name changed unexpectedly');
    assertCondition(after.rows[0].company === before.rows[0].company, 'Existing company changed unexpectedly');
    assertCondition(after.rows[0].phone === '+2025550101', 'Phone should normalize to E.164');
    assertCondition(after.rows[0].mobile === '+2025550102', 'Mobile should normalize to E.164');
    assertCondition(after.rows[0].priority === 'urgent', 'Priority should accept canonical values');

    await assertFails(
      client,
      `UPDATE public.leads SET salesperson_id = $1 WHERE id = $2`,
      [badSalespersonId, leadId]
    );

    await assertFails(
      client,
      `UPDATE public.leads SET sales_team = 'missing-team' WHERE id = $1`,
      [leadId]
    );

    await client.query(downgradeSql);

    const postRollbackChecks = await client.query(
      `SELECT
         EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema = 'crm' AND table_name = 'tag'
         ) AS has_tag_table,
         EXISTS (
           SELECT 1 FROM pg_constraint c
           JOIN pg_class t ON t.oid = c.conrelid
           JOIN pg_namespace n ON n.oid = t.relnamespace
           WHERE n.nspname = 'public'
             AND t.relname = 'leads'
             AND c.conname = 'leads_sales_team_fkey'
         ) AS has_sales_team_fk`
    );

    assertCondition(postRollbackChecks.rows[0].has_tag_table === false, 'Rollback should remove crm.tag');
    assertCondition(postRollbackChecks.rows[0].has_sales_team_fk === false, 'Rollback should remove sales_team FK');

    await client.query('ROLLBACK');
    console.log('Lead schema canonical migration test passed');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
