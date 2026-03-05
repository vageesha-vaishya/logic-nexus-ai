const crypto = require('crypto');

function b64url(input) {
  const b64 = Buffer.isBuffer(input) ? input.toString('base64') : Buffer.from(String(input)).toString('base64');
  return b64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signJwt(secret, payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encHeader = b64url(JSON.stringify(header));
  const encPayload = b64url(JSON.stringify(payload));
  const data = `${encHeader}.${encPayload}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest();
  const encSig = b64url(sig);
  return `${data}.${encSig}`;
}

function makeKeys(secret, ref) {
  const iss = 'supabase';
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60 * 24 * 365 * 10;
  const anon = signJwt(secret, { iss, ref, role: 'anon', iat: now, exp });
  const service = signJwt(secret, { iss, ref, role: 'service_role', iat: now, exp });
  return { anon, service };
}

function main() {
  const secret = process.env.JWT_SECRET || process.argv[2];
  const ref = process.env.PROJECT_REF || process.argv[3] || 'local-dev';
  if (!secret) {
    console.error('Usage: node scripts/generate_supabase_keys.cjs <JWT_SECRET> [PROJECT_REF]');
    process.exit(1);
  }
  const { anon, service } = makeKeys(secret, ref);
  console.log('VITE_SUPABASE_PUBLISHABLE_KEY=' + anon);
  console.log('VITE_SUPABASE_ANON_KEY=' + anon);
  console.log('SUPABASE_SERVICE_ROLE_KEY=' + service);
}

main();
