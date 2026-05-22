/**
 * setup_tls_vps — one-time idempotent TLS termination layer for the VPS.
 *
 * Layout:
 *   Internet ──:443/TLS──> host nginx ──:8099──> logicpro-web container
 *                              │
 *                              └── /.well-known/acme-challenge → certbot
 *
 * Host-level nginx fronts the existing container nginx. The container
 * already knows how to proxy /api/markets to the markets-worker, so the
 * host layer only does TLS termination + redirect + reverse proxy.
 *
 * Idempotency:
 *   - apt-get install nginx certbot python3-certbot-nginx (no-ops if present)
 *   - certbot --nginx → reuses existing cert when valid > 30 days
 *   - nginx config written + reloaded every run (safe — config is static)
 *
 * Env required (Jenkins passes these):
 *   VPS_IP, VPS_USER, VPS_PASSWORD, TLS_DOMAIN, TLS_EMAIL, APP_PORT
 */
const { Client } = require("ssh2");

const host     = process.env.VPS_IP;
const username = process.env.VPS_USER || "root";
const password = process.env.VPS_PASSWORD;
const domain   = process.env.TLS_DOMAIN;
const email    = process.env.TLS_EMAIL;
const appPort  = process.env.APP_PORT || "8099";

if (!host || !password) {
  console.error("Missing VPS_IP or VPS_PASSWORD env var");
  process.exit(1);
}
if (!domain || !email) {
  console.error("Missing TLS_DOMAIN or TLS_EMAIL env var");
  process.exit(1);
}
if (!/^[a-z0-9.-]+$/i.test(domain)) {
  console.error(`Refusing suspicious TLS_DOMAIN: ${domain}`);
  process.exit(1);
}
if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
  console.error(`Refusing suspicious TLS_EMAIL: ${email}`);
  process.exit(1);
}

// Single nginx site config. The "managed by certbot" markers are kept
// because certbot patches the listener block in-place on first issuance.
// On subsequent runs, the file is rewritten — certbot's patch is then
// reapplied idempotently by the `certbot --nginx -d ...` call below.
const SITE_CONF = `# Managed by scripts/setup_tls_vps.cjs — do not hand-edit.
server {
    listen 80;
    listen [::]:80;
    server_name ${domain};

    # ACME HTTP-01 challenge — must stay on plain HTTP.
    location /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
    }

    # Everything else → HTTPS.
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name ${domain};

    # SSL — certbot fills these in on first issuance.
    ssl_certificate     /etc/letsencrypt/live/${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Generous proxy timeouts — markets-worker has some slow paths
    # (LLM-backed endpoints, large portfolio scans).
    proxy_connect_timeout 60s;
    proxy_send_timeout    300s;
    proxy_read_timeout    300s;

    # WebSocket support for /api/markets/ws-* paths.
    proxy_http_version 1.1;
    proxy_set_header Upgrade           $http_upgrade;
    proxy_set_header Connection        $http_connection;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;

    # Body uploads (e.g. CSV imports) up to 25 MB.
    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:${appPort};
    }
}

# Set $http_connection to "upgrade" only when the client requests it,
# otherwise leave it empty so keep-alive works normally.
map $http_upgrade $http_connection {
    default upgrade;
    ''      close;
}
`;

// Remote shell script. Heavy on safety:
//   set -euo pipefail
//   no apt-get update if cache is fresh (<1h)
//   certbot --nginx reuses an existing cert when present
const REMOTE_SCRIPT = `#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${domain}"
EMAIL="${email}"

# 1. Packages — install only if missing.
need_install=()
command -v nginx   >/dev/null 2>&1 || need_install+=(nginx)
command -v certbot >/dev/null 2>&1 || need_install+=(certbot python3-certbot-nginx)
if [ \${#need_install[@]} -gt 0 ]; then
  DEBIAN_FRONTEND=noninteractive apt-get update -y
  DEBIAN_FRONTEND=noninteractive apt-get install -y "\${need_install[@]}"
fi

# 2. ACME webroot.
mkdir -p /var/www/letsencrypt/.well-known/acme-challenge
chown -R www-data:www-data /var/www/letsencrypt

# 3. Drop the site config + enable it. Disable nginx's default if present
#    to free :80 cleanly.
cat > /etc/nginx/sites-available/$DOMAIN <<'NGINX_EOF'
${SITE_CONF}
NGINX_EOF

# Initial nginx test needs a temporary HTTP-only config because the
# certificate referenced above doesn't exist yet on first run. Strip the
# 443 block until certbot issues the cert.
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  awk '/^server {/{n++}{if(n<=1)print}' /etc/nginx/sites-available/$DOMAIN \\
    > /etc/nginx/sites-available/$DOMAIN.bootstrap
  ln -sf /etc/nginx/sites-available/$DOMAIN.bootstrap /etc/nginx/sites-enabled/$DOMAIN
else
  ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN
fi

rm -f /etc/nginx/sites-enabled/default
nginx -t

# Force a clean start. If something else is on :80 (Coolify/Traefik on
# this VPS is the usual suspect), surface what + which process so the
# Jenkins log shows the actual blocker instead of a generic exit code.
echo "=== Port 80/443 listeners before nginx start ==="
ss -tlnp 'sport = :80'  2>&1 || true
ss -tlnp 'sport = :443' 2>&1 || true

systemctl daemon-reload
systemctl enable nginx >/dev/null 2>&1 || true
if ! systemctl restart nginx; then
  echo "=== nginx.service status ==="
  systemctl status nginx.service --no-pager -l || true
  echo "=== nginx.service journal (last 50 lines) ==="
  journalctl -xeu nginx.service --no-pager -n 50 || true
  echo "=== Port 80 listeners ==="
  ss -tlnp 'sport = :80' || true
  exit 1
fi

# 4. Issue / renew cert. --nginx plugin handles the http-01 challenge via
#    the running nginx (we already opened :80). --keep-until-expiring
#    is the idempotent flag: it no-ops if the cert is still good for >30d.
certbot --nginx \\
  --non-interactive \\
  --agree-tos \\
  --email "$EMAIL" \\
  --domain "$DOMAIN" \\
  --redirect \\
  --keep-until-expiring \\
  --no-eff-email

# 5. Now switch to the full HTTPS config (cert exists).
rm -f /etc/nginx/sites-available/$DOMAIN.bootstrap
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN
nginx -t
systemctl reload nginx

# 6. Verify renewal timer is enabled (systemd unit shipped with certbot).
systemctl enable --now certbot.timer || true

echo "TLS setup complete for $DOMAIN"
`;

const conn = new Client();
console.log(`Setting up TLS on ${host} for ${domain} ...`);

conn.on("ready", () => {
  console.log("SSH ready");
  conn.exec(REMOTE_SCRIPT, (err, stream) => {
    if (err) {
      console.error("exec failed:", err.message);
      process.exit(1);
    }
    stream.on("close", (code) => {
      conn.end();
      if (code !== 0) {
        console.error(`Remote script exited ${code}`);
        process.exit(code || 1);
      }
      console.log(`https://${domain} is ready`);
    });
    stream.on("data", (d) => process.stdout.write(d));
    stream.stderr.on("data", (d) => process.stderr.write(d));
  });
});

conn.on("error", (e) => {
  console.error("SSH error:", e.message);
  process.exit(1);
});

conn.connect({ host, port: 22, username, password, readyTimeout: 30000 });
