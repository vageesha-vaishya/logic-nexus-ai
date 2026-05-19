# Hostinger VPS deploy bundle

One-time install + repeatable deploys for the Logic Nexus AI stack on a single
Ubuntu 22.04+ Hostinger VPS. Stack:

```
                   Internet
                       │
                  [ Hostinger VPS ]
                       │
                   Nginx :443  (TLS via Let's Encrypt)
                  /                \
   /  (static)                      \  /api/markets-worker/*  (reverse proxy)
   ▼                                 ▼
  dist/  (Vite build)         markets-worker :8001
                              (FastAPI under systemd)
```

- **Frontend**: Vite production build, served as static files by Nginx.
- **Worker**: FastAPI on `127.0.0.1:8001`, managed by systemd, with a 2-stage
  uvicorn → reload-on-failure setup.
- **Database**: Remote Supabase (no DB on the VPS).
- **Cron**: daily signal generation + weekly OHLC backfill via system cron.
- **Secrets**: in `/srv/logic-nexus/.env`, mode 600, owned by `markets`.

## What this bundle contains

| File | Purpose |
|---|---|
| `scripts/install.sh` | First-time install (run once as root). |
| `scripts/deploy.sh` | Repeatable deploys: pull, build, restart. |
| `systemd/markets-worker.service` | systemd unit for the worker. |
| `nginx/logic-nexus.conf` | Nginx server block (TLS + static + reverse proxy). |
| `env.example` | Env-var template — do not commit your filled copy as `.env`. |
| `crontab.example` | Cron entries the `markets` user should have. |

## Quick start

On a fresh Hostinger Ubuntu 22.04+ VPS as `root`:

```bash
# 1. Get the repo to the box
git clone https://github.com/vageesha-vaishya/logic-nexus-ai.git /srv/logic-nexus
cd /srv/logic-nexus

# 2. Install dependencies, create the `markets` user, lay down systemd/Nginx units
bash deploy/scripts/install.sh

# 3. Fill in secrets (you'll be opening this in $EDITOR — paste values)
cp deploy/env.example /srv/logic-nexus/.env
$EDITOR /srv/logic-nexus/.env
chown markets:markets /srv/logic-nexus/.env
chmod 600 /srv/logic-nexus/.env

# 4. TLS (replace with your domain)
certbot --nginx -d retail.your-domain.com

# 5. First build + bring the worker up
bash deploy/scripts/deploy.sh
systemctl enable --now markets-worker
systemctl reload nginx

# 6. Cron — paste deploy/crontab.example contents
crontab -u markets -e
```

Repeat deploys after that are one line:

```bash
bash deploy/scripts/deploy.sh
```

## Sanity-check checklist after first deploy

- `systemctl status markets-worker` → active (running)
- `curl -fsS https://retail.your-domain.com/ | head -2` → returns the SPA shell
- `curl -fsS https://retail.your-domain.com/api/markets-worker/v1/retail/behavioral/market-stress -H "Authorization: Bearer test"` → returns `{"detail":"Invalid JWT…"}` (route is wired, auth rejecting test token)
- `sudo -u markets crontab -l` → shows the two cron entries
- `sudo -u markets /srv/logic-nexus/services/markets-worker/.venv/bin/python -m markets_worker.cli signals:daily` → completes without error, prints a count

## What's not in this bundle (deliberately)

- **No database migrations runner.** Supabase migrations are applied via the
  MCP `apply_migration` tool or `supabase db push` against the remote project,
  not from the VPS.
- **No Redis.** The CLI scheduler (`markets_worker.cli`) is the cron-driven
  path; the RQ-based `scheduler.py` is the optional richer path if you later
  add a Redis instance.
- **No log shipper.** Worker logs go to journalctl; Nginx logs to
  `/var/log/nginx/`. Wire to Vector/Loki/etc. when you're ready.
