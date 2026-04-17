const { Client } = require('ssh2');

const host = process.env.VPS_IP;
const username = process.env.VPS_USER || 'root';
const password = process.env.VPS_PASSWORD;
const gatewayPort = process.env.GATEWAY_PORT || '8100';
const appPort = process.env.APP_PORT || '8099';
const anonKey = process.env.SUPABASE_ANON_KEY;
const amroApiUpstream = String(process.env.AMRO_API_UPSTREAM || '').trim();
const amroCandidatePorts = (process.env.AMRO_API_CANDIDATE_PORTS || '8031,3001')
  .split(',')
  .map((v) => v.trim())
  .filter((v) => /^\d+$/.test(v));
const amroWaitRetries = Math.max(1, Number(process.env.AMRO_API_WAIT_RETRIES || 20));
const amroWaitIntervalSec = Math.max(1, Number(process.env.AMRO_API_WAIT_INTERVAL_SEC || 2));
const deployBranch = (process.env.DEPLOY_BRANCH || process.env.BRANCH_NAME || 'main').trim();

if (!host || !password) {
  console.error('Missing VPS_IP or VPS_PASSWORD environment variables');
  process.exit(1);
}
if (!anonKey) {
  console.error('Missing SUPABASE_ANON_KEY environment variable');
  process.exit(1);
}

const REMOTE_APP_DIR = '/home/SOSLogicPro/logicProSupabaseDev/logic-nexus-ai';
const SUPABASE_URL = process.env.SUPABASE_URL || `http://${host}:${gatewayPort}`;

const conn = new Client();
console.log(`Deploying LogicPro web to ${host}:${appPort} ...`);

conn.on('ready', () => {
  console.log('SSH ready');
  const escapedAnon = anonKey.replace(/'/g, "'\\''");
  const escapedBranch = deployBranch.replace(/[^a-zA-Z0-9/_-]/g, '');
  const targetBranch = escapedBranch || 'main';
  const escapedCandidatePorts = amroCandidatePorts.join(' ');
  const buildCmd = [
    `cd ${REMOTE_APP_DIR}`,
    `test -f ${REMOTE_APP_DIR}/Dockerfile || (echo "Missing Dockerfile at ${REMOTE_APP_DIR}/Dockerfile" && exit 1)`,
    `test -d ${REMOTE_APP_DIR}/.git || (echo "Missing git repository at ${REMOTE_APP_DIR}" && exit 1)`,
    `git fetch --all --prune`,
    `git checkout -f ${targetBranch}`,
    `git reset --hard origin/${targetBranch}`,
    `echo "Building commit $(git rev-parse --short HEAD) on branch ${targetBranch}"`,
    `docker build -t logicpro-web --build-arg VITE_SUPABASE_URL='${SUPABASE_URL}' --build-arg VITE_SUPABASE_ANON_KEY='${escapedAnon}' --build-arg VITE_SUPABASE_PUBLISHABLE_KEY='${escapedAnon}' -f ${REMOTE_APP_DIR}/Dockerfile ${REMOTE_APP_DIR}`,
    `AMRO_PORT=''`,
    ...(amroApiUpstream ? [`AMRO_PORT='${amroApiUpstream.split(':').slice(-1)[0]}'`] : []),
    `AMRO_CANDIDATE_PORTS='${escapedCandidatePorts}'`,
    `if [ -n "$AMRO_PORT" ]; then curl -fsS --max-time 5 "http://127.0.0.1:$AMRO_PORT/health" >/dev/null 2>&1 || AMRO_PORT=''; fi`,
    `if [ -z "$AMRO_PORT" ]; then for p in $AMRO_CANDIDATE_PORTS; do curl -fsS --max-time 5 "http://127.0.0.1:$p/health" >/dev/null 2>&1 && AMRO_PORT=$p && break; done; fi`,
    `if [ -z "$AMRO_PORT" ]; then for i in $(seq 1 ${amroWaitRetries}); do for p in $AMRO_CANDIDATE_PORTS; do curl -fsS --max-time 5 "http://127.0.0.1:$p/health" >/dev/null 2>&1 && AMRO_PORT=$p && break; done; [ -n "$AMRO_PORT" ] && break; echo "Waiting for AMRO API on host ports: $AMRO_CANDIDATE_PORTS (attempt $i/${amroWaitRetries})"; sleep ${amroWaitIntervalSec}; done; fi`,
    `if [ -z "$AMRO_PORT" ]; then echo "AMRO API is not reachable on host. Expected one of: $AMRO_CANDIDATE_PORTS"; echo "--- docker ps (amro) ---"; docker ps -a --format '{{.Names}}\\t{{.Status}}\\t{{.Ports}}' | grep -i amro || true; echo "--- amro-api logs ---"; docker logs --tail 120 amro-api || true; exit 1; fi`,
    `AMRO_API_UPSTREAM_EFFECTIVE='host.docker.internal:'"$AMRO_PORT"`,
    `echo "Using AMRO upstream: $AMRO_API_UPSTREAM_EFFECTIVE"`,
    `(docker ps -a --format '{{.Names}}' | grep -q '^logicpro-web$' && docker rm -f logicpro-web || true)`,
    `docker run -d --name logicpro-web --restart unless-stopped -p ${appPort}:80 --add-host=host.docker.internal:host-gateway -e AMRO_API_UPSTREAM="$AMRO_API_UPSTREAM_EFFECTIVE" logicpro-web`,
    `WEB_HEALTH_OK=''`,
    `for i in $(seq 1 20); do curl -fsS --max-time 8 "http://127.0.0.1:${appPort}/api/v2/amro/health" >/dev/null 2>&1 && WEB_HEALTH_OK='yes' && break; sleep 2; done`,
    `if [ -z "$WEB_HEALTH_OK" ]; then echo 'logicpro-web started but AMRO proxy health failed'; echo '--- logicpro-web logs ---'; docker logs --tail 120 logicpro-web || true; exit 1; fi`
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
