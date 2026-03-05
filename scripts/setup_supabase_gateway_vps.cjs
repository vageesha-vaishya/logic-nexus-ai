const { Client } = require('ssh2');

const host = process.env.VPS_IP;
const username = process.env.VPS_USER || 'root';
const password = process.env.VPS_PASSWORD;
const gatewayPort = process.env.GATEWAY_PORT || '8100';

if (!host || !password) {
  console.error('Missing VPS_IP or VPS_PASSWORD environment variables');
  process.exit(1);
}

const REMOTE_BASE = '/home/SOSLogicPro/logicProSupabaseDev';
const REMOTE_CONF = `${REMOTE_BASE}/nginx-supabase.conf`;
const CONF_CONTENT = [
  'server {',
  '  listen 80;',
  '  server_name _;',
  '  location / {',
  '    proxy_set_header Host $host;',
  '    proxy_set_header X-Real-IP $remote_addr;',
  '    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
  '    proxy_set_header X-Forwarded-Proto $scheme;',
  '    proxy_pass http://supabase-kong:8000;',
  '  }',
  '}',
].join('\n');

const conn = new Client();
console.log(`Setting up Supabase gateway on ${host}:${gatewayPort} ...`);

function execPromise(cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      stream.on('close', (code) => {
        if (code === 0) resolve(code);
        else reject(new Error(`Command failed (${code}): ${cmd}`));
      }).on('data', (d) => process.stdout.write(d))
        .stderr.on('data', (d) => process.stderr.write(d));
    });
  });
}

conn.on('ready', async () => {
  console.log('SSH ready');
  try {
    // Ensure base directory
    await execPromise(`mkdir -p ${REMOTE_BASE}`);
    console.log('Base directory ensured:', REMOTE_BASE);
    
    // Write config via here-doc (avoids SFTP hangs)
    const escaped = CONF_CONTENT.replace(/[$`\\]/g, '\\$&');
    await execPromise(`bash -lc 'cat > ${REMOTE_CONF} <<\"EOF\"\n${escaped}\nEOF'`);
    console.log('Config uploaded:', REMOTE_CONF);
    
    // Ensure network and run container
    await execPromise(`docker network ls --format '{{.Name}}' | grep -q '^supabase-network$' || docker network create supabase-network`);
    console.log('Docker network ready: supabase-network');
    
    await execPromise(`(docker ps -a --format '{{.Names}}' | grep -q '^supabase-gateway$' && docker rm -f supabase-gateway || true)`);
    console.log('Old gateway container removed if existed');
    
    await execPromise(`docker run -d --name supabase-gateway --restart unless-stopped --network supabase-network -p ${gatewayPort}:80 -v ${REMOTE_CONF}:/etc/nginx/conf.d/default.conf:ro nginx:stable`);
    console.log(`Supabase gateway is ready at http://${host}:${gatewayPort}`);
    
    try { conn.end(); } catch {}
    process.exit(0);
  } catch (err) {
    fail(err);
  }
}).on('error', fail)
  .connect({
    host,
    username,
    password,
    port: 22,
    readyTimeout: 200000,
    keepaliveInterval: 15000,
    keepaliveCountMax: 12,
  });

function fail(err) {
  console.error('Error:', err && err.message ? err.message : err);
  try { conn.end(); } catch {}
  process.exit(1);
}
