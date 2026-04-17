const { Client } = require('ssh2');

const host = process.env.VPS_IP;
const username = process.env.VPS_USER || 'root';
const password = process.env.VPS_PASSWORD;
const appPort = process.env.APP_PORT || '8099';

if (!host || !password) {
  console.error('Missing VPS_IP or VPS_PASSWORD');
  process.exit(2);
}

const conn = new Client();
const watchdogMs = 90_000;
const watchdog = setTimeout(() => {
  console.error(`Validation timed out after ${watchdogMs}ms`);
  try { conn.end(); } catch {}
  process.exit(3);
}, watchdogMs);

const cmd = [
  "set -e",
  "timeout 20s docker inspect logicpro-web --format '{{range .Config.Env}}{{println .}}{{end}}' | grep AMRO_API_UPSTREAM",
  "timeout 20s docker exec logicpro-web sh -c \"grep -n 'proxy_pass' /etc/nginx/conf.d/default.conf\"",
  `timeout 20s curl -fsS --max-time 10 http://127.0.0.1:${appPort}/api/v2/amro/health >/dev/null`,
].join(' && ');

conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) {
      clearTimeout(watchdog);
      console.error(err);
      process.exit(2);
    }
    stream.on('close', (code) => {
      clearTimeout(watchdog);
      conn.end();
      process.exit(code || 0);
    });
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
  });
}).on('error', (err) => {
  clearTimeout(watchdog);
  console.error(err);
  process.exit(2);
}).connect({
  host,
  username,
  password,
  readyTimeout: 20_000,
});
