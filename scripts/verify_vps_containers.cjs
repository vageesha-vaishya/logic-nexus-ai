const { Client } = require('ssh2');

const host = process.env.VPS_IP;
const username = process.env.VPS_USER || 'root';
const password = process.env.VPS_PASSWORD;

if (!host || !password) {
  console.error('Missing VPS_IP or VPS_PASSWORD environment variables');
  process.exit(1);
}

const conn = new Client();

function execPromise(cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      let errOut = '';
      stream.on('close', (code) => {
        if (code === 0) resolve(out.trim());
        else reject(new Error(errOut.trim() || `Command failed (${code})`));
      }).on('data', (d) => { out += d.toString(); })
        .stderr.on('data', (d) => { errOut += d.toString(); });
    });
  });
}

conn.on('ready', async () => {
  try {
    const names = await execPromise("docker ps --format '{{.Names}}'");
    const list = names.split('\n').filter(Boolean);
    const hasGateway = list.includes('supabase-gateway');
    const hasWeb = list.includes('logicpro-web');
    console.log('Containers:', list.join(', '));
    if (!hasGateway || !hasWeb) {
      if (!hasGateway) console.error('Missing container: supabase-gateway');
      if (!hasWeb) console.error('Missing container: logicpro-web');
      conn.end();
      process.exit(1);
    }
    console.log('Verified: supabase-gateway and logicpro-web are running');
    conn.end();
    process.exit(0);
  } catch (err) {
    console.error('Verification failed:', err.message || err);
    try { conn.end(); } catch {}
    process.exit(1);
  }
}).on('error', (err) => {
  console.error('SSH error:', err.message || err);
  process.exit(1);
}).connect({
  host,
  username,
  password,
  port: 22,
  readyTimeout: 60000,
  keepaliveInterval: 15000,
  keepaliveCountMax: 8,
});
