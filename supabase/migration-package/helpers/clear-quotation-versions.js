#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadConfig() {
  const configPath = path.join(__dirname, '../new-supabase-config.env');
  if (!fs.existsSync(configPath)) throw new Error('new-supabase-config.env not found');
  const cfg = {};
  fs.readFileSync(configPath, 'utf-8')
    .split('\n')
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .forEach((line) => {
      const [key, ...values] = line.split('=');
      cfg[key.trim()] = values.join('=').trim().replace(/["']/g, '');
    });
  const url = cfg.NEW_SUPABASE_URL;
  const key = cfg.NEW_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing NEW_SUPABASE_URL or NEW_SUPABASE_SERVICE_ROLE_KEY');
  return { url, key };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const { url, key } = loadConfig();
  const supabase = createClient(url, key);
  const args = new Set(process.argv.slice(2));
  const getArgVal = (name) => {
    const pref = `--${name}=`;
    const hit = [...args].find(a => a.startsWith(pref));
    return hit ? hit.slice(pref.length) : null;
  };
  const quotationNumber = getArgVal('quotation-number') || getArgVal('quotation');
  const quotationIdArg = getArgVal('quotation-id');
  const dryRun = args.has('--dry-run');
  const emitSql = args.has('--emit-sql');

  if (emitSql) {
    if (!quotationNumber && !quotationIdArg) throw new Error('Provide --quotation-number or --quotation-id');
    const sql = quotationIdArg ? `BEGIN;

WITH v AS (
  SELECT id FROM public.quotation_versions WHERE quote_id = '${quotationIdArg}'
), o AS (
  SELECT id FROM public.quotation_version_options WHERE quotation_version_id IN (SELECT id FROM v)
), ql AS (
  SELECT id FROM public.quote_legs WHERE quote_option_id IN (SELECT id FROM o)
), vl AS (
  SELECT id FROM public.quotation_version_option_legs WHERE quotation_version_option_id IN (SELECT id FROM o)
)

DELETE FROM public.quote_charges
WHERE quote_option_id IN (SELECT id FROM o)
   OR leg_id IN (SELECT id FROM ql);

DELETE FROM public.quote_legs WHERE id IN (SELECT id FROM ql);
DELETE FROM public.quotation_version_option_legs WHERE id IN (SELECT id FROM vl);
DELETE FROM public.quotation_version_options WHERE id IN (SELECT id FROM o);
DELETE FROM public.quotation_versions WHERE id IN (SELECT id FROM v);

COMMIT;` : `BEGIN;

WITH q AS (
  SELECT id FROM public.quotes
  WHERE quote_number = '${quotationNumber}'
     OR quotation_number = '${quotationNumber}'
     OR number = '${quotationNumber}'
  LIMIT 1
), v AS (
  SELECT id FROM public.quotation_versions WHERE quote_id IN (SELECT id FROM q)
), o AS (
  SELECT id FROM public.quotation_version_options WHERE quotation_version_id IN (SELECT id FROM v)
), ql AS (
  SELECT id FROM public.quote_legs WHERE quote_option_id IN (SELECT id FROM o)
), vl AS (
  SELECT id FROM public.quotation_version_option_legs WHERE quotation_version_option_id IN (SELECT id FROM o)
)

DELETE FROM public.quote_charges
WHERE quote_option_id IN (SELECT id FROM o)
   OR leg_id IN (SELECT id FROM ql);

DELETE FROM public.quote_legs WHERE id IN (SELECT id FROM ql);
DELETE FROM public.quotation_version_option_legs WHERE id IN (SELECT id FROM vl);
DELETE FROM public.quotation_version_options WHERE id IN (SELECT id FROM o);
DELETE FROM public.quotation_versions WHERE id IN (SELECT id FROM v);

COMMIT;`;
    console.log(sql);
    return;
  }

  let quoteId = quotationIdArg || null;
  if (!quoteId) {
    if (!quotationNumber) throw new Error('Provide --quotation-number or --quotation-id');
    const { data: qRow, error: qErr } = await supabase
      .from('quotes')
      .select('id, quote_number, quotation_number, number')
      .or(`quote_number.eq.${quotationNumber},quotation_number.eq.${quotationNumber},number.eq.${quotationNumber}`)
      .limit(1);
    if (qErr) throw qErr;
    quoteId = (Array.isArray(qRow) && qRow[0]?.id) || null;
    if (!quoteId) throw new Error(`Quote not found for number: ${quotationNumber}`);
  }

  const { data: versions, error: vErr } = await supabase
    .from('quotation_versions')
    .select('id')
    .eq('quote_id', quoteId);
  if (vErr) throw vErr;
  const versionIds = (versions || []).map(v => v.id);

  let optionIds = [];
  if (versionIds.length) {
    const { data: opts, error: oErr } = await supabase
      .from('quotation_version_options')
      .select('id')
      .in('quotation_version_id', versionIds);
    if (oErr) throw oErr;
    optionIds = (opts || []).map(o => o.id);
  }

  let quoteLegIds = [];
  if (optionIds.length) {
    const { data: legs1, error: lErr1 } = await supabase
      .from('quote_legs')
      .select('id')
      .in('quote_option_id', optionIds);
    if (lErr1) throw lErr1;
    quoteLegIds = (legs1 || []).map(l => l.id);
  }

  let compLegIds = [];
  if (optionIds.length) {
    const { data: legs2, error: lErr2 } = await supabase
      .from('quotation_version_option_legs')
      .select('id')
      .in('quotation_version_option_id', optionIds);
    if (lErr2) throw lErr2;
    compLegIds = (legs2 || []).map(l => l.id);
  }

  let deleted = { charges: 0, quote_legs: 0, comp_legs: 0, options: 0, versions: 0 };

  if (!dryRun) {
    // Delete quote_charges by option and leg ids
    const batches = chunk(optionIds, 1000);
    for (const b of batches) {
      if (b.length) {
        const { error: d1 } = await supabase.from('quote_charges').delete().in('quote_option_id', b);
        if (d1) throw d1;
      }
    }
    const legBatches = chunk(quoteLegIds, 1000);
    for (const b of legBatches) {
      if (b.length) {
        const { error: d2 } = await supabase.from('quote_charges').delete().in('leg_id', b);
        if (d2) throw d2;
      }
    }
  }
  // Count charges removed (approximate): fetch counts for reporting
  const { count: chargesCountOpt } = await supabase.from('quote_charges').select('id', { count: 'exact', head: true }).in('quote_option_id', optionIds);
  const { count: chargesCountLeg } = await supabase.from('quote_charges').select('id', { count: 'exact', head: true }).in('leg_id', quoteLegIds);
  deleted.charges = Number(chargesCountOpt || 0) + Number(chargesCountLeg || 0);

  if (!dryRun) {
    // Delete legs
    for (const b of chunk(quoteLegIds, 1000)) {
      if (!b.length) continue;
      const { error: dl1 } = await supabase.from('quote_legs').delete().in('id', b);
      if (dl1) throw dl1;
    }
    for (const b of chunk(compLegIds, 1000)) {
      if (!b.length) continue;
      const { error: dl2 } = await supabase.from('quotation_version_option_legs').delete().in('id', b);
      if (dl2) throw dl2;
    }
  }
  deleted.quote_legs = quoteLegIds.length;
  deleted.comp_legs = compLegIds.length;

  if (!dryRun) {
    // Delete options and versions
    for (const b of chunk(optionIds, 1000)) {
      if (!b.length) continue;
      const { error: do1 } = await supabase.from('quotation_version_options').delete().in('id', b);
      if (do1) throw do1;
    }
    for (const b of chunk(versionIds, 1000)) {
      if (!b.length) continue;
      const { error: dv1 } = await supabase.from('quotation_versions').delete().in('id', b);
      if (dv1) throw dv1;
    }
  }
  deleted.options = optionIds.length;
  deleted.versions = versionIds.length;

  console.log(JSON.stringify({ quoteId, versionIds, optionIds, quoteLegIds, compLegIds, deleted, dryRun }, null, 2));
}

main().catch((e) => {
  console.error(e && e.message ? e.message : String(e));
  process.exit(1);
});