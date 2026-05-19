/**
 * Deploy the markets-worker FastAPI service to the Hostinger VPS via SSH.
 *
 * Idempotent: installs system deps if missing, (re)creates the venv, refreshes
 * the systemd unit + env file, restarts, then health-checks the worker.
 *
 * Expects (env vars):
 *   VPS_IP, VPS_USER, VPS_PASSWORD          — SSH target
 *   SUPABASE_URL                            — required by worker
 *   SUPABASE_SERVICE_ROLE_KEY               — required by worker
 *   SUPABASE_JWT_SECRET                     — optional (defaults to '')
 *   OPENAI_API_KEY, ANTHROPIC_API_KEY,
 *   OPENROUTER_API_KEY                      — optional LLM provider keys
 *   MARKETS_WORKER_PORT                     — default 8001
 *
 * Writes:
 *   /etc/logic-nexus/markets-worker.env     — mode 600, root-owned env file
 *   /etc/systemd/system/markets-worker.service
 *   /home/SOSLogicPro/logicProSupabaseDev/logic-nexus-ai/services/markets-worker/.venv
 */
const { Client } = require('ssh2');

const host = process.env.VPS_IP;
const username = process.env.VPS_USER || 'root';
const password = process.env.VPS_PASSWORD;
const workerPort = String(process.env.MARKETS_WORKER_PORT || '8001').trim();

if (!host || !password) {
  console.error('Missing VPS_IP or VPS_PASSWORD environment variables');
  process.exit(1);
}

// Required worker config — fail fast if missing rather than letting uvicorn
// crash on import (pydantic-settings raises a confusing ValidationError).
const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — worker would fail to start');
  process.exit(1);
}

const REMOTE_APP_DIR = '/home/SOSLogicPro/logicProSupabaseDev/logic-nexus-ai';
const WORKER_DIR = `${REMOTE_APP_DIR}/services/markets-worker`;
const ENV_FILE = '/etc/logic-nexus/markets-worker.env';
const SERVICE_FILE = '/etc/systemd/system/markets-worker.service';

// Build the env file body. Keys with empty values are omitted so we don't
// shadow legitimate values that might already live in /etc/.../markets-worker.env.
const envEntries = {
  SUPABASE_URL: supabaseUrl,
  SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKey,
  SUPABASE_JWT_SECRET: (process.env.SUPABASE_JWT_SECRET || '').trim(),
  OPENAI_API_KEY: (process.env.OPENAI_API_KEY || '').trim(),
  ANTHROPIC_API_KEY: (process.env.ANTHROPIC_API_KEY || '').trim(),
  OPENROUTER_API_KEY: (process.env.OPENROUTER_API_KEY || '').trim(),
  ENVIRONMENT: 'production',
  LOG_LEVEL: 'INFO',
};
const envFileBody = Object.entries(envEntries)
  .filter(([, v]) => v !== '')
  .map(([k, v]) => `${k}=${v}`)
  .join('\n') + '\n';

// systemd unit — paths match the Jenkins-managed checkout. Bind to all
// interfaces because the request comes from inside the logicpro-web container
// via host.docker.internal; 127.0.0.1 inside the host is not reachable from
// the container without further plumbing.
const serviceBody = `[Unit]
Description=Logic Nexus AI — markets worker (FastAPI)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=${WORKER_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=${WORKER_DIR}/.venv/bin/uvicorn \\
    markets_worker.main:create_app \\
    --factory \\
    --host 0.0.0.0 \\
    --port ${workerPort} \\
    --proxy-headers \\
    --no-access-log \\
    --log-level info
Restart=on-failure
RestartSec=5
StartLimitBurst=10
StartLimitIntervalSec=600
LimitNOFILE=65535
StandardOutput=journal
StandardError=journal
SyslogIdentifier=markets-worker

[Install]
WantedBy=multi-user.target
`;

// Shell-escape a value for single-quoted heredoc body.
const shEscape = (s) => String(s).replace(/'/g, "'\\''");
const escapedEnv = shEscape(envFileBody);
const escapedService = shEscape(serviceBody);

const conn = new Client();
console.log(`Deploying markets-worker to ${host}:${workerPort} ...`);

conn.on('ready', () => {
  console.log('SSH ready');

  const cmd = [
    // 1. System deps. Python 3.12 is not in Ubuntu 22.04's default repos,
    //    so use deadsnakes. Idempotent: 'apt-get install -y' is a no-op when
    //    already satisfied.
    `set -e`,
    `command -v python3.12 >/dev/null 2>&1 || {
       echo '▶ Installing python3.12 via deadsnakes';
       apt-get update -qq;
       apt-get install -y -qq software-properties-common;
       add-apt-repository -y ppa:deadsnakes/ppa;
       apt-get update -qq;
     }`,
    `apt-get install -y -qq python3.12 python3.12-venv python3.12-dev build-essential pkg-config curl`,

    // 2. Env file (mode 600, root). Created/refreshed each run so secrets stay current.
    `mkdir -p /etc/logic-nexus && chmod 700 /etc/logic-nexus`,
    `cat >${ENV_FILE} <<'__MARKETS_ENV__'\n${escapedEnv}__MARKETS_ENV__`,
    `chmod 600 ${ENV_FILE}`,

    // 3. Ensure the repo checkout exists (Jenkins clones it for the web deploy,
    //    but the markets-worker stage may run on a fresh VPS or out of order).
    `test -d ${REMOTE_APP_DIR}/.git || (echo "Missing git repository at ${REMOTE_APP_DIR}. Run the web deploy stage first to clone."; exit 1)`,
    `test -f ${WORKER_DIR}/pyproject.toml || (echo "Missing ${WORKER_DIR}/pyproject.toml"; exit 1)`,

    // 4. venv + install. The worker is `pip install -e .` so subsequent pushes
    //    pick up code changes without reinstalling.
    `cd ${WORKER_DIR}`,
    `test -d .venv || python3.12 -m venv .venv`,
    `.venv/bin/pip install -q -U pip wheel setuptools`,
    `.venv/bin/pip install -q -e .`,

    // 5. systemd unit.
    `cat >${SERVICE_FILE} <<'__MARKETS_UNIT__'\n${escapedService}__MARKETS_UNIT__`,

    // 5b. UFW allow for docker bridge → host:$PORT. The worker runs on
    //     the host (not a container), so traffic from logicpro-web crosses
    //     UFW. AMRO is a container so Docker's own iptables rules bypass
    //     UFW — that's why AMRO worked out of the box and markets didn't.
    `if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q 'Status: active'; then
       DOCKER_SUBNET=$(docker network inspect bridge --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}' 2>/dev/null || true);
       if [ -n "$DOCKER_SUBNET" ]; then
         ufw allow from "$DOCKER_SUBNET" to any port ${workerPort} proto tcp comment 'docker -> markets-worker' >/dev/null;
         echo "  ufw: allowed $DOCKER_SUBNET -> ${workerPort}/tcp";
       else
         echo "  ufw: could not detect docker bridge subnet";
       fi;
     else
       echo "  ufw: not active, skipping firewall rule";
     fi`,

    // 5c. Reload + restart.
    `systemctl daemon-reload`,
    `systemctl enable --quiet markets-worker`,
    `systemctl restart markets-worker`,

    // 6. Health probe — read HTTP status, don't trust curl's exit code.
    //    Same pattern as the deploy_web_app_vps.cjs fix.
    `WORKER_HEALTH_OK=''; WORKER_HEALTH_CODE=''`,
    `for i in $(seq 1 30); do
       WORKER_HEALTH_CODE=$(curl -s --max-time 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:${workerPort}/health" 2>/dev/null || true);
       if [ "$WORKER_HEALTH_CODE" = "200" ]; then WORKER_HEALTH_OK='yes'; break; fi;
       echo "markets-worker health probe $i/30: http_code=$WORKER_HEALTH_CODE";
       sleep 2;
     done`,
    `if [ -z "$WORKER_HEALTH_OK" ]; then
       echo "markets-worker did not become healthy (last http_code=$WORKER_HEALTH_CODE)";
       echo '--- markets-worker journal (last 80 lines) ---';
       journalctl -u markets-worker -n 80 --no-pager || true;
       exit 1;
     fi`,
    `echo "markets-worker health: 200 OK on port ${workerPort}"`,
  ].join(' && ');

  conn.exec(cmd, (err, stream) => {
    if (err) return fail(err);
    stream
      .on('close', (code) => {
        conn.end();
        if (code === 0) {
          console.log(`markets-worker is running at http://${host}:${workerPort} (host-only — proxied via /api/markets)`);
          process.exit(0);
        } else {
          console.error('markets-worker deploy failed with exit code', code);
          process.exit(1);
        }
      })
      .on('data', (d) => process.stdout.write(d))
      .stderr.on('data', (d) => process.stderr.write(d));
  });
}).on('error', fail)
  .connect({ host, username, password, readyTimeout: 200000 });

function fail(err) {
  console.error('Error:', err && err.message ? err.message : err);
  try { conn.end(); } catch { /* ignore */ }
  process.exit(1);
}
