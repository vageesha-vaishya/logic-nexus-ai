const { Client } = require('ssh2');
const fs = require('fs');

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
const CONF_CONTENT = `
server {
  listen 80;
  server_name _;
  location / {
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass http://supabase-kong:8000;
  }
}
`.trim();

const conn = new Client();
console.log(`Setting up Supabase gateway on ${host}:${gatewayPort} ...`);

conn.on('ready', () => {
  console.log('SSH ready');
  // Ensure base directory
  conn.exec(`mkdir -p ${REMOTE_BASE}`, (err, stream) => {
    if (err) return fail(err);
    stream.on('close', () => {
      // Upload conf
      conn.sftp((err, sftp) => {
        if (err) return fail(err);
        const ws = sftp.createWriteStream(REMOTE_CONF);
        ws.on('error', fail);
        ws.on('close', () => {
          console.log('Config uploaded:', REMOTE_CONF);
          // Ensure network and run container
          const cmd = [
            `docker network ls --format '{{.Name}}' | grep -q '^supabase-network$' || docker network create supabase-network`,
            `(docker ps -a --format '{{.Names}}' | grep -q '^supabase-gateway$' && docker rm -f supabase-gateway || true)`,
            `docker run -d --name supabase-gateway --restart unless-stopped --network supabase-network -p ${gatewayPort}:80 -v ${REMOTE_CONF}:/etc/nginx/conf.d/default.conf:ro nginx:stable`
          ].join(' && ');
          conn.exec(cmd, (err, stream) => {
            if (err) return fail(err);
            stream.on('close', (code) => {
              conn.end();
              if (code === 0) {
                console.log(`Supabase gateway is ready at http://${host}:${gatewayPort}`);
                process.exit(0);
              } else {
                console.error('Gateway setup failed with exit code', code);
                process.exit(1);
              }
            }).on('data', d => process.stdout.write(d))
              .stderr.on('data', d => process.stderr.write(d));
          });
        });
        ws.write(CONF_CONTENT);
        ws.end();
      });
    });
  });
}).on('error', fail)
  .connect({ host, username, password, readyTimeout: 200000 });

function fail(err) {
  console.error('Error:', err && err.message ? err.message : err);
  try { conn.end(); } catch {}
  process.exit(1);
}
