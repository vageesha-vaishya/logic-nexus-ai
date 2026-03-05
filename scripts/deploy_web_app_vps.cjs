const { Client } = require('ssh2');

const host = process.env.VPS_IP;
const username = process.env.VPS_USER || 'root';
const password = process.env.VPS_PASSWORD;
const gatewayPort = process.env.GATEWAY_PORT || '8100';
const appPort = process.env.APP_PORT || '8099';
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!host || !password) {
  console.error('Missing VPS_IP or VPS_PASSWORD environment variables');
  process.exit(1);
}
if (!anonKey) {
  console.error('Missing SUPABASE_ANON_KEY environment variable');
  process.exit(1);
}

const REMOTE_APP_DIR = '/home/SOSLogicPro/logicProSupabaseDev/logic-nexus-ai';
const SUPABASE_URL = `http://${host}:${gatewayPort}`;

const conn = new Client();
console.log(`Deploying LogicPro web to ${host}:${appPort} ...`);

conn.on('ready', () => {
  console.log('SSH ready');
  const escapedAnon = anonKey.replace(/'/g, "'\\''");
  const buildCmd = [
    `cd ${REMOTE_APP_DIR}`,
    `test -f ${REMOTE_APP_DIR}/Dockerfile || (echo "Missing Dockerfile at ${REMOTE_APP_DIR}/Dockerfile" && exit 1)`,
    `docker build -t logicpro-web --build-arg VITE_SUPABASE_URL='${SUPABASE_URL}' --build-arg VITE_SUPABASE_ANON_KEY='${escapedAnon}' -f ${REMOTE_APP_DIR}/Dockerfile ${REMOTE_APP_DIR}`,
    `(docker ps -a --format '{{.Names}}' | grep -q '^logicpro-web$' && docker rm -f logicpro-web || true)`,
    `docker run -d --name logicpro-web --restart unless-stopped -p ${appPort}:80 logicpro-web`
  ].join(' && ');
  conn.exec(buildCmd, (err, stream) => {
    if (err) return fail(err);
    stream.on('close', (code) => {
      conn.end();
      if (code === 0) {
        console.log(`LogicPro web is available at http://${host}:${appPort}`);
        process.exit(0);
      } else {
        console.error('Web deploy failed with exit code', code);
        process.exit(1);
      }
    }).on('data', d => process.stdout.write(d))
      .stderr.on('data', d => process.stderr.write(d));
  });
}).on('error', fail)
  .connect({ host, username, password, readyTimeout: 200000});

function fail(err) {
  console.error('Error:', err && err.message ? err.message : err);
  try { conn.end(); } catch {}
  process.exit(1);
}
