#!/usr/bin/env bash
# First-time install on an Ubuntu 22.04+ Hostinger VPS. Run as root once.
#
# What this does:
#   1. APT install Node 20, Python 3.12, Nginx, Certbot, build tooling.
#   2. Create `markets` system user (no shell login) + /var/log/markets.
#   3. Symlink the bundled systemd unit + Nginx server block.
#   4. Create a Python venv with the worker dependencies.
#
# What you do AFTER this script:
#   - Fill in /srv/logic-nexus/.env (deploy/env.example is the template).
#   - `certbot --nginx -d retail.your-domain.com` for TLS.
#   - `bash deploy/scripts/deploy.sh` for the first build + restart.
#   - `crontab -u markets -e` and paste deploy/crontab.example.

set -euo pipefail

if [[ "$EUID" -ne 0 ]]; then
  echo "ERROR: run as root (sudo bash deploy/scripts/install.sh)" >&2
  exit 1
fi

REPO_ROOT="${REPO_ROOT:-/srv/logic-nexus}"
SERVICE_USER="markets"
SERVICE_HOME="/srv/logic-nexus"

echo "▶ APT update + install base tooling"
apt-get update -y
apt-get install -y \
  curl ca-certificates git build-essential \
  python3.12 python3.12-venv python3.12-dev \
  nginx certbot python3-certbot-nginx \
  pkg-config

echo "▶ Install Node 20 via NodeSource"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v//;s/\..*//')" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "▶ Create service user '${SERVICE_USER}'"
if ! id "${SERVICE_USER}" >/dev/null 2>&1; then
  useradd --system --home "${SERVICE_HOME}" --shell /usr/sbin/nologin "${SERVICE_USER}"
fi

echo "▶ Make sure the repo + log dirs exist + ownership is right"
install -d -o "${SERVICE_USER}" -g "${SERVICE_USER}" \
  "${REPO_ROOT}" "/var/log/markets"
chown -R "${SERVICE_USER}:${SERVICE_USER}" "${REPO_ROOT}"

echo "▶ Python venv for markets-worker"
WORKER_DIR="${REPO_ROOT}/services/markets-worker"
if [[ ! -d "${WORKER_DIR}/.venv" ]]; then
  sudo -u "${SERVICE_USER}" python3.12 -m venv "${WORKER_DIR}/.venv"
fi
sudo -u "${SERVICE_USER}" "${WORKER_DIR}/.venv/bin/pip" install -U pip
# Install the worker as an editable install — `pip install -e .` reads
# pyproject.toml's dependency list (FastAPI, supabase-py, yfinance, …).
sudo -u "${SERVICE_USER}" "${WORKER_DIR}/.venv/bin/pip" install -e "${WORKER_DIR}"

echo "▶ Link systemd unit"
install -o root -g root -m 0644 \
  "${REPO_ROOT}/deploy/systemd/markets-worker.service" \
  /etc/systemd/system/markets-worker.service
systemctl daemon-reload

echo "▶ Link Nginx server block"
install -o root -g root -m 0644 \
  "${REPO_ROOT}/deploy/nginx/logic-nexus.conf" \
  /etc/nginx/sites-available/logic-nexus.conf
ln -sf /etc/nginx/sites-available/logic-nexus.conf \
       /etc/nginx/sites-enabled/logic-nexus.conf
# Disable the default catch-all so our server_name takes precedence.
rm -f /etc/nginx/sites-enabled/default
nginx -t

echo
echo "✓ install complete. Next steps:"
echo "    1) cp deploy/env.example /srv/logic-nexus/.env && \$EDITOR /srv/logic-nexus/.env"
echo "       (then: chown markets:markets /srv/logic-nexus/.env && chmod 600 /srv/logic-nexus/.env)"
echo "    2) Edit /etc/nginx/sites-available/logic-nexus.conf — replace 'retail.your-domain.com'."
echo "    3) certbot --nginx -d <your-domain>"
echo "    4) bash deploy/scripts/deploy.sh"
echo "    5) systemctl enable --now markets-worker && systemctl reload nginx"
echo "    6) crontab -u markets -e   (paste deploy/crontab.example)"
