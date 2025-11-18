#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadConfig() {
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

async function main() {
  const { url, key } = await loadConfig();
  const supabase = createClient(url, key);

  let updatedOptions = 0;
  let insertedLegs = 0;
  let reindexedOptions = 0;
  let rowsUpdated = 0;

  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');
  const reindex = args.has('--reindex');
  const getArgVal = (name) => {
    const pref = `--${name}=`;
    const hit = [...args].find(a => a.startsWith(pref));
    return hit ? hit.slice(pref.length) : null;
  };
  const quotationNumber = getArgVal('quotation-number') || getArgVal('quotation');
  const quotationId = getArgVal('quotation-id');
  const optionIdArg = getArgVal('option-id');

  async function resolveTargetOptionIds() {
    if (optionIdArg) return [optionIdArg];
    let qId = quotationId;
    if (!qId && quotationNumber) {
      const { data: qs1 } = await supabase
        .from('quotations')
        .select('id, quotation_number, number, quote_number')
        .or(`quotation_number.eq.${quotationNumber},number.eq.${quotationNumber},quote_number.eq.${quotationNumber}`)
        .limit(1);
      qId = (qs1 && qs1[0]?.id) || null;
    }
    if (!qId) return null;
    const { data: versions } = await supabase
      .from('quotation_versions')
      .select('id')
      .eq('quotation_id', qId);
    const versionIds = (versions || []).map(v => v.id);
    if (versionIds.length === 0) return null;
    const { data: opts } = await supabase
      .from('quotation_version_options')
      .select('id')
      .in('quotation_version_id', versionIds);
    return (opts || []).map(o => o.id);
  }

  const targetedOptionIds = await resolveTargetOptionIds();

  async function fetchOptionsBatch(from, step) {
    if (targetedOptionIds && targetedOptionIds.length) {
      const slice = targetedOptionIds.slice(from, from + step);
      if (slice.length === 0) return [];
      const { data: opts } = await supabase
        .from('quotation_version_options')
        .select('id, tenant_id')
        .in('id', slice);
      return opts || [];
    }
    const { data: options, error } = await supabase
      .from('quotation_version_options')
      .select('id, tenant_id')
      .range(from, from + step - 1);
    if (error) throw error;
    return options || [];
  }

  let from = 0;
  const step = 500;
  while (true) {
    const options = await fetchOptionsBatch(from, step);
    if (!options || options.length === 0) break;

    for (const opt of options) {
      const optionId = opt.id;
      const tenantId = opt.tenant_id;
      const { data: quoteLegs, error: qErr } = await supabase
        .from('quote_legs')
        .select('id, leg_number')
        .eq('quote_option_id', optionId);
      if (qErr) throw qErr;
      const { data: compLegs, error: cErr } = await supabase
        .from('quotation_version_option_legs')
        .select('id, leg_order')
        .eq('quotation_version_option_id', optionId);
      if (cErr) throw cErr;
      const desired = new Set((quoteLegs || []).map((l) => Number(l.leg_number || 0)));
      const existing = new Set((compLegs || []).map((l) => Number(l.leg_order || 0)));
      const missing = Array.from(desired).filter((o) => !existing.has(o));
      if (missing.length) {
        const rows = missing.map((order) => ({ tenant_id: tenantId, quotation_version_option_id: optionId, leg_order: order }));
        if (!dryRun) {
          const { error: insErr } = await supabase.from('quotation_version_option_legs').insert(rows);
          if (insErr) throw insErr;
        }
        insertedLegs += rows.length;
        updatedOptions += 1;
      }

      if (reindex) {
        const comp = (compLegs || []).slice().sort((a, b) => Number(a.leg_order || 0) - Number(b.leg_order || 0));
        const targetOrders = Array.from(desired).sort((a, b) => a - b);
        const useSequential = targetOrders.length === 0 ? comp.map((_, i) => i + 1) : targetOrders;
        const seen = new Set();
        let hasDup = false;
        for (const o of comp.map((x) => Number(x.leg_order || 0))) {
          if (seen.has(o)) { hasDup = true; break; }
          seen.add(o);
        }
        const mismatch = hasDup || comp.length !== useSequential.length || comp.some((row, idx) => Number(row.leg_order || 0) !== useSequential[idx]);
        if (mismatch) {
          for (let i = 0; i < comp.length; i++) {
            const row = comp[i];
            const newOrder = useSequential[Math.min(i, useSequential.length - 1)];
            if (Number(row.leg_order || 0) === newOrder) continue;
            if (!dryRun) {
              const { error: upErr } = await supabase
                .from('quotation_version_option_legs')
                .update({ leg_order: newOrder })
                .eq('id', row.id);
              if (upErr) throw upErr;
            }
            rowsUpdated += 1;
          }
          reindexedOptions += 1;
        }
      }
    }
    from += step;
  }

  console.log(JSON.stringify({ updatedOptions, insertedLegs, reindexedOptions, rowsUpdated, dryRun, reindex }, null, 2));
}

main().catch((e) => {
  console.error(e && e.message ? e.message : String(e));
  process.exit(1);
});