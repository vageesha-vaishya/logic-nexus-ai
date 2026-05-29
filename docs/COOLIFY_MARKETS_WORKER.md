# Coolify-hosted markets-worker (Path A)

The Sthira APK and the unified web SPA both need `markets-worker` reachable at `https://markets.sosservices.online`. Coolify on the VPS already owns `:443` via its bundled Traefik, so the host-nginx-and-certbot approach (`scripts/setup_tls_vps.cjs`) cannot bind the port. This doc captures the Coolify configuration that lets Coolify own the cert and route the domain directly to the worker container.

## Prerequisites

- Coolify reachable at `http://72.61.249.111:8000` (default panel port).
- DNS `markets.sosservices.online` already resolves to `72.61.249.111` — verified.
- Repo accessible to Coolify (this repo, branch `main`).
- Two Jenkins credentials don't move into Coolify — they're per-app env vars (see below).

## Step-by-step in the Coolify UI

1. **New Application** → "Public repository" or your Git source → URL of this repo → branch `main`.
2. **Build settings:**
   - Build pack: `Dockerfile`
   - Base directory: `services/markets-worker`
   - Dockerfile path (relative to base): `Dockerfile`
   - Port: `8000` (the Dockerfile's `EXPOSE 8000` + `uvicorn ... --port 8000`)
3. **Domain:** Add `markets.sosservices.online`. Coolify will request a Let's Encrypt cert via Traefik automatically. No manual certbot, no host nginx.
4. **Environment variables** (Settings → Environment). The required and optional sets, from `services/markets-worker/src/markets_worker/config.py`:

   | Var | Required | Notes |
   |---|---|---|
   | `SUPABASE_URL` | yes | `https://gzhxgoigflftharcmdqj.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | yes | Same value Jenkins uses (`supabase-service-role-key` cred) |
   | `SUPABASE_JWT_SECRET` | no | Default `""` — set when JWT verification is enabled |
   | `CORS_ALLOWED_ORIGINS` | yes for APK + web | Comma-separated: `https://localhost,capacitor://localhost,https://markets.sosservices.online` plus any web origin you serve from. The default in `config.py` is acceptable; override here to make it explicit. |
   | `UPSTASH_REDIS_REST_URL` | no | Required for rate-limit + RQ; without it, rate-limit fails open |
   | `UPSTASH_REDIS_REST_TOKEN` | no | As above |
   | `REDIS_URL` | no | Alternative for RQ when Upstash REST isn't used |
   | `ANTHROPIC_API_KEY` | no | LLM-backed routes (`/v1/portfolio/brief`, `/v1/research/*`) |
   | `OPENAI_API_KEY` | no | Same |
   | `OPENROUTER_API_KEY` | no | Same |
   | `FCM_SERVICE_ACCOUNT_JSON` | no | Push fan-out. ⚠ When set via a systemd `EnvironmentFile=` the value MUST be wrapped in single quotes: `FCM_SERVICE_ACCOUNT_JSON='{...}'`. systemd's env-file parser otherwise strips backslashes from unquoted values, destroying the `\n` escapes in the JSON `private_key` and producing `cryptography.InvalidPadding` at startup. In Coolify env-var UI the value goes in raw (no surrounding quotes); Coolify handles escaping itself. |
   | `GROWW_*` | no | Broker integration |
   | `BROKER_ENCRYPTION_KEY` | yes if broker creds stored | Symmetric key for at-rest broker secrets |
   | `WORKER_CONCURRENCY` | no | Default 4 |
   | `LOG_LEVEL` | no | Default `INFO` |
   | `ENVIRONMENT` | no | Default `production` |
5. **Deploy.** Coolify pulls, builds the image, runs the container, and provisions the cert. Watch logs in the panel.

## Verification

After Coolify reports the app as running:

```sh
# Real LE cert (not Traefik default)
echo | openssl s_client -servername markets.sosservices.online \
  -connect markets.sosservices.online:443 2>/dev/null \
  | openssl x509 -noout -subject -dates
# Expect: subject=CN=markets.sosservices.online + Let's Encrypt issuer

# Health endpoint
curl -s https://markets.sosservices.online/health
# Expect: {"status":"ok","service":"markets-worker"}

# A real worker route (with a valid Bearer token):
curl -s -H "Authorization: Bearer <user-jwt>" \
  https://markets.sosservices.online/v1/retail/risk-score
# Expect: 200 + JSON, not 503 / not Traefik default cert
```

## Jenkins after Coolify is wired

Once verified, set the Jenkins build parameter `COOLIFY_OWNS_MARKETS_WORKER=true` (added to `Jenkinsfile`). That skips:

- `Setup TLS (markets.sosservices.online)` — host nginx + certbot, no longer needed
- `Deploy Markets Worker to VPS` — systemd-based deploy, replaced by Coolify

Both stages stay in the file (for rollback in case Coolify is removed later) but become no-ops when the flag is true. Default is `false` to preserve current behaviour until you flip it.

## APK rebuild after Coolify is verified

Single command, set the production worker URL at build time. The mobile build script (`scripts/mobile-build-markets.sh`) accepts the `MARKETS_WORKER_URL` override.

```sh
MARKETS_WORKER_URL=https://markets.sosservices.online npm run mobile:build:markets
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

After this rebuild, the phone works from any internet connection — Wi-Fi, cellular, anywhere. The bundled `dist/` now points at the public HTTPS endpoint instead of your laptop LAN IP. `network_security_config.xml` will list `markets.sosservices.online` as a cleartext-permitted domain, but the actual requests are HTTPS and the base config blocks cleartext for everything else.

## Rollback

If Coolify proves problematic, flip `COOLIFY_OWNS_MARKETS_WORKER=false` in the next Jenkins build. The host-nginx + systemd stages will run again. You'd also need to stop the Coolify-managed worker container so it doesn't fight with the systemd unit for port 8001 (or have Coolify bind a different external port).
