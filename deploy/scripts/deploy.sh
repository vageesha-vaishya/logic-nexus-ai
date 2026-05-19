#!/usr/bin/env bash
# Repeatable deploy on an already-installed VPS.
#
# Idempotent:
#   1. git pull (defaults to origin/main)
#   2. npm ci + npm run build (frontend)
#   3. pip install -e . (worker, only if pyproject.toml changed)
#   4. Re-link systemd unit + Nginx block if they changed in-repo
#   5. systemctl restart markets-worker
#   6. nginx -t && systemctl reload nginx
#
# Run as root (it sudoes to `markets` for user-scoped steps).

set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/srv/logic-nexus}"
SERVICE_USER="markets"
WORKER_DIR="${REPO_ROOT}/services/markets-worker"
BRANCH="${BRANCH:-main}"

if [[ "$EUID" -ne 0 ]]; then
  echo "ERROR: run as root (sudo bash deploy/scripts/deploy.sh)" >&2
  exit 1
fi

cd "${REPO_ROOT}"

echo "▶ Pulling ${BRANCH}"
sudo -u "${SERVICE_USER}" git fetch --quiet origin
sudo -u "${SERVICE_USER}" git checkout --quiet "${BRANCH}"
PREV_SHA=$(sudo -u "${SERVICE_USER}" git rev-parse HEAD)
sudo -u "${SERVICE_USER}" git pull --ff-only --quiet origin "${BRANCH}"
NEW_SHA=$(sudo -u "${SERVICE_USER}" git rev-parse HEAD)

if [[ "${PREV_SHA}" == "${NEW_SHA}" ]]; then
  echo "  (already at ${NEW_SHA:0:7})"
else
  echo "  ${PREV_SHA:0:7} → ${NEW_SHA:0:7}"
fi

CHANGED=$(sudo -u "${SERVICE_USER}" git diff --name-only "${PREV_SHA}" "${NEW_SHA}" || echo "")

# ── Frontend ─────────────────────────────────────────────────────────────────
echo "▶ Frontend build"
sudo -u "${SERVICE_USER}" bash -c "cd '${REPO_ROOT}' && npm ci --no-audit --no-fund"
sudo -u "${SERVICE_USER}" bash -c "cd '${REPO_ROOT}' && npm run build"

# ── Worker dependencies ──────────────────────────────────────────────────────
if echo "${CHANGED}" | grep -qE "^services/markets-worker/pyproject\.toml$" \
   || [[ ! -d "${WORKER_DIR}/.venv" ]]; then
  echo "▶ Worker deps changed — reinstalling"
  sudo -u "${SERVICE_USER}" "${WORKER_DIR}/.venv/bin/pip" install -U pip
  sudo -u "${SERVICE_USER}" "${WORKER_DIR}/.venv/bin/pip" install -e "${WORKER_DIR}"
else
  echo "▶ Worker deps unchanged"
fi

# ── systemd + Nginx unit refresh ─────────────────────────────────────────────
if echo "${CHANGED}" | grep -qE "^deploy/systemd/"; then
  echo "▶ systemd unit changed — relinking"
  install -o root -g root -m 0644 \
    "${REPO_ROOT}/deploy/systemd/markets-worker.service" \
    /etc/systemd/system/markets-worker.service
  systemctl daemon-reload
fi

if echo "${CHANGED}" | grep -qE "^deploy/nginx/"; then
  echo "▶ Nginx config changed — relinking + validating"
  install -o root -g root -m 0644 \
    "${REPO_ROOT}/deploy/nginx/logic-nexus.conf" \
    /etc/nginx/sites-available/logic-nexus.conf
  nginx -t
fi

# ── Restart services ─────────────────────────────────────────────────────────
echo "▶ Restart markets-worker"
systemctl restart markets-worker

echo "▶ Reload Nginx"
systemctl reload nginx

# ── Smoke ────────────────────────────────────────────────────────────────────
echo "▶ Smoke check"
sleep 3
if curl -fsS -o /dev/null -w "  worker /healthz: HTTP %{http_code}\n" \
   http://127.0.0.1:8001/healthz; then
  :
else
  echo "  worker /healthz: not responding — check 'journalctl -u markets-worker -n 100'"
  exit 1
fi

echo
echo "✓ deployed ${NEW_SHA:0:7}"
