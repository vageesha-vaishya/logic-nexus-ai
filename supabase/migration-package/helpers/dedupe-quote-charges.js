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

async function main() {
  const { url, key } = loadConfig();
  const supabase = createClient(url, key);
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');
  const getArgVal = (name) => {
    const pref = `--${name}=`;
    const hit = [...args].find(a => a.startsWith(pref));
    return hit ? hit.slice(pref.length) : null;
  };
  const quotationNumber = getArgVal('quotation-number') || getArgVal('quotation');
  const quotationId = getArgVal('quotation-id');
  const optionIdArg = getArgVal('option-id');

  let scannedOptions = 0;
  let groupsWithDup = 0;
  let deletedRows = 0;

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

  let from = 0;
  const step = 500;
  while (true) {
    let options;
    if (targetedOptionIds && targetedOptionIds.length) {
      const slice = targetedOptionIds.slice(from, from + step);
      if (!slice.length) break;
      const { data: opts } = await supabase
        .from('quotation_version_options')
        .select('id')
        .in('id', slice);
      options = opts || [];
    } else {
      const { data: opts, error } = await supabase
        .from('quotation_version_options')
        .select('id')
        .range(from, from + step - 1);
      if (error) throw error;
      options = opts || [];
    }
    if (!options || options.length === 0) break;

    for (const opt of options) {
      const optionId = opt.id;
      const { data: rows, error: rErr } = await supabase
        .from('quote_charges')
        .select('id, leg_id, charge_side_id, category_id, basis_id, unit, currency_id, sort_order, updated_at, created_at')
        .eq('quote_option_id', optionId)
        .order('updated_at', { ascending: false })
        .order('sort_order', { ascending: false });
      if (rErr) throw rErr;
      const groups = new Map();
      for (const row of rows || []) {
        const key = [
          String(optionId),
          String(row.leg_id ?? ''),
          String(row.charge_side_id ?? ''),
          String(row.category_id ?? ''),
          String(row.basis_id ?? ''),
          String(row.unit ?? ''),
          String(row.currency_id ?? ''),
        ].join('|');
        const arr = groups.get(key) || [];
        arr.push(row);
        groups.set(key, arr);
      }
      for (const [key, arr] of groups.entries()) {
        if (arr.length <= 1) continue;
        groupsWithDup += 1;
        const sorted = arr.slice().sort((a, b) => {
          const au = a.updated_at || a.created_at || '1970-01-01T00:00:00Z';
          const bu = b.updated_at || b.created_at || '1970-01-01T00:00:00Z';
          if (au > bu) return -1;
          if (au < bu) return 1;
          const as = Number(a.sort_order || 0);
          const bs = Number(b.sort_order || 0);
          return bs - as;
        });
        const keep = sorted[0].id;
        const removeIds = sorted.slice(1).map((x) => x.id);
        if (removeIds.length) {
          if (!dryRun) {
            const { error: dErr } = await supabase
              .from('quote_charges')
              .delete()
              .in('id', removeIds);
            if (dErr) throw dErr;
          }
          deletedRows += removeIds.length;
        }
      }
      scannedOptions += 1;
    }
    from += step;
  }

  console.log(JSON.stringify({ scannedOptions, groupsWithDup, deletedRows, dryRun }, null, 2));
}

main().catch((e) => {
  console.error(e && e.message ? e.message : String(e));
  process.exit(1);
});