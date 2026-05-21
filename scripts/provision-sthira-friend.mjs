#!/usr/bin/env node
/**
 * provision-sthira-friend — closed-beta admin provisioning.
 *
 * Walks a single friend through the chain of state they need before they
 * can do anything useful in the Sthira app: tenant/franchise binding,
 * a default portfolio, and a worker-side signal-generation kickoff.
 *
 * Idempotent — re-running for the same email is safe and converges to the
 * same end state.
 *
 * Usage:
 *   SUPABASE_URL=...                          \
 *   SUPABASE_SERVICE_ROLE_KEY=...             \
 *   MARKETS_WORKER_URL=http://127.0.0.1:8001  \
 *     node scripts/provision-sthira-friend.mjs friend@example.com [--portfolio-name "Anil's portfolio"]
 *
 * Env precedence: command-line flags > env vars > .env file (loaded
 * automatically if present). The script logs each step and never edits
 * any field that already exists.
 *
 * Companion: docs/runbooks/2026-05-21-friend-onboarding.md.
 */
import { readFileSync, existsSync } from 'node:fs';
import process from 'node:process';

// ─── env loading (.env + process.env) ─────────────────────────────────────

function loadDotenv() {
  try {
    if (!existsSync('.env')) return;
    const text = readFileSync('.env', 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const [, k, raw] = m;
      if (process.env[k] !== undefined) continue;
      // Strip matched outer quotes if present
      let v = raw;
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[k] = v;
    }
  } catch { /* best effort */ }
}
loadDotenv();

// ─── arg parsing ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.length < 1 || args[0].startsWith('-')) {
  console.error('Usage: node scripts/provision-sthira-friend.mjs <friend-email> [--portfolio-name "..."]');
  process.exit(1);
}
const email = args[0].toLowerCase().trim();
const portfolioNameIdx = args.indexOf('--portfolio-name');
const portfolioName    = portfolioNameIdx >= 0 ? args[portfolioNameIdx + 1] : 'My Portfolio';

// ─── env required ────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WORKER_URL   = process.env.MARKETS_WORKER_URL || 'http://127.0.0.1:8001';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('✗ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (env or .env).');
  process.exit(1);
}

// ─── helpers ──────────────────────────────────────────────────────────────

const log    = (msg) => console.log(`  ${msg}`);
const ok     = (msg) => console.log(`\x1b[32m  ✓\x1b[0m ${msg}`);
const skip   = (msg) => console.log(`\x1b[33m  →\x1b[0m ${msg}`);
const fatal  = (msg) => { console.error(`\x1b[31m  ✗\x1b[0m ${msg}`); process.exit(1); };

async function pgRest(path, init = {}, schema = 'public') {
  // PostgREST exposes one schema by default ("api" on this project) and
  // routes other schemas via `Accept-Profile` (read) / `Content-Profile`
  // (write). Set both so the helper works for either side without callers
  // having to know which they're doing.
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey:            SERVICE_KEY,
      Authorization:     `Bearer ${SERVICE_KEY}`,
      'Content-Type':    'application/json',
      'Accept-Profile':  schema,
      'Content-Profile': schema,
      ...(init.headers || {}),
    },
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`${path} ${resp.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function authAdmin(path) {
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`auth/admin/${path} ${resp.status}: ${text}`);
  return JSON.parse(text);
}

// ─── steps ────────────────────────────────────────────────────────────────

console.log(`\n\x1b[1mProvisioning ${email}\x1b[0m\n`);

// 1. Resolve auth user by email
let user;
try {
  // Admin search is paginated — for small user counts just list all
  const data = await authAdmin(`users?per_page=1000`);
  const list = data.users || data;
  user = list.find((u) => (u.email || '').toLowerCase() === email);
  if (!user) {
    fatal(`No auth.users row found for ${email}. The friend must sign up via /auth first; this script only links existing accounts.`);
  }
  ok(`Found auth user ${user.id}`);
} catch (e) {
  fatal(`auth.users lookup failed: ${e.message}`);
}

// 2. Resolve Sthira Retail tenant + franchise
let tenantId;
let franchiseId;
try {
  const tenants = await pgRest('tenants?select=id&slug=eq.sthira-retail&limit=1');
  if (!tenants?.length) fatal('No tenant with slug=sthira-retail. Run migration 20260521143940 first.');
  tenantId = tenants[0].id;

  const franchises = await pgRest(`franchises?select=id&tenant_id=eq.${tenantId}&code=eq.sthira-default&limit=1`);
  if (!franchises?.length) fatal('No franchise with code=sthira-default. Run migration 20260521143940 first.');
  franchiseId = franchises[0].id;
  ok(`Sthira Retail tenant ${tenantId} / franchise ${franchiseId}`);
} catch (e) {
  fatal(`tenant/franchise lookup failed: ${e.message}`);
}

// 3. Ensure user_roles row binds the user to this tenant+franchise
try {
  const existing = await pgRest(
    `user_roles?select=id,role&user_id=eq.${user.id}&tenant_id=eq.${tenantId}&franchise_id=eq.${franchiseId}&limit=1`,
  );
  if (existing?.length) {
    skip(`user_roles row already exists (role=${existing[0].role})`);
  } else {
    await pgRest('user_roles', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        user_id:      user.id,
        role:         'user', // closed-beta convention — see docs/runbooks/2026-05-21-friend-onboarding.md
        tenant_id:    tenantId,
        franchise_id: franchiseId,
      }),
    });
    ok('Inserted user_roles row (role=user)');
  }
} catch (e) {
  fatal(`user_roles insert failed: ${e.message}`);
}

// 4. Ensure a markets.portfolios row exists for the user
let portfolioId;
try {
  const existing = await pgRest(
    `portfolios?select=id,name&owner_user_id=eq.${user.id}&tenant_id=eq.${tenantId}&limit=1`,
    {},
    'markets',
  );
  if (existing?.length) {
    portfolioId = existing[0].id;
    skip(`Portfolio already exists: ${existing[0].name} (${portfolioId})`);
  } else {
    const created = await pgRest('portfolios', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        tenant_id:     tenantId,
        franchise_id:  franchiseId,
        owner_user_id: user.id,
        name:          portfolioName,
        mode:          'paper', // until a real broker is linked
        base_currency: 'INR',
        holder_type:   'self_directed',
      }),
    }, 'markets');
    portfolioId = created[0].id;
    ok(`Inserted portfolio ${portfolioId} (${portfolioName})`);
  }
} catch (e) {
  fatal(`portfolio insert failed: ${e.message}`);
}

// 5. Fire the worker bootstrap so signals start generating + daily job is scheduled
try {
  const resp = await fetch(`${WORKER_URL}/v1/jobs/bootstrap-portfolio`, {
    method:  'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ portfolio_id: portfolioId }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    // Don't fatal on this — the friend can use the app even if signals
    // bootstrap later. Surface clearly so the operator notices.
    console.warn(`\x1b[33m  ⚠\x1b[0m worker bootstrap failed (${resp.status}): ${text}`);
    console.warn('     The portfolio still exists; signals will generate after the next worker restart.');
    console.warn(`     Retry manually: curl -X POST ${WORKER_URL}/v1/jobs/bootstrap-portfolio -d '{"portfolio_id":"${portfolioId}"}'`);
  } else {
    const json = await resp.json();
    ok(`Worker bootstrap queued (immediate=${json.immediate_job_id}, daily=${json.daily_job_id})`);
  }
} catch (e) {
  console.warn(`\x1b[33m  ⚠\x1b[0m worker unreachable: ${e.message}`);
  console.warn(`     Friend can still use the app; trigger bootstrap when the worker is back up.`);
}

console.log(`\n\x1b[32m✓ ${email} is ready.\x1b[0m\n`);
console.log(`  user_id      = ${user.id}`);
console.log(`  tenant_id    = ${tenantId}`);
console.log(`  franchise_id = ${franchiseId}`);
console.log(`  portfolio_id = ${portfolioId}`);
console.log(`\nNext: send them the Sthira install link. On first login they'll see the portfolio above.\n`);
