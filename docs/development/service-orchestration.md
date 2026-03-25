# Development Service Orchestration

## Overview
This system ensures required backend services are started and healthy before the Vite dev server initializes. It provides health checks, exponential backoff retries, service dependency management, structured proxy errors, and standalone commands for starting and validating services.

## Commands
- Start orchestrated dev (services + Vite): `npm run dev`
- Start services only: `npm run services:start`
- Health check only: `npm run services:check`
- Start Vite directly (no orchestration): `npm run dev:vite`

## Configuration
File: `scripts/services.config.json`
- `id`: Unique id
- `name`: Display name
- `command`: Shell command to launch the service (optional)
- `urlEnv`: Environment variable for local service URL
- `defaultUrl`: Fallback local URL if `urlEnv` is not set
- `remoteUrlEnv`: Environment variable for remote service URL (optional)
- `remoteDefaultUrl`: Fallback remote URL (optional)
- `preferEndpoint`: `local` or `remote` (default `local`)
- `healthPath`: Path for health probe
- `required`: Whether the service is mandatory
- `requiredWhenRemote`: When true, the service becomes required when a remote URL is configured
- `probeTimeoutMs`: Connectivity probe timeout (default 5000ms)
- `probeAttempts`: Connectivity probe attempts (minimum 3)
- `retry`: `{ attempts, baseDelayMs, timeoutMs }`
- `dependsOn`: Array of service ids

Set endpoints in `.env`:
```
VITE_CRM_API_PROXY_TARGET=http://localhost:3011
VITE_AMRO_API_PROXY_TARGET=http://localhost:3001
VITE_TENANT_BRANDING_PROXY_TARGET=http://localhost:8787
VITE_CRM_API_PROXY_TARGET_REMOTE=https://api.example.com
VITE_AMRO_API_PROXY_TARGET_REMOTE=https://api.example.com
VITE_TENANT_BRANDING_PROXY_TARGET_REMOTE=https://api.example.com
```

## Dynamic Environment Detection
The orchestrator can derive remote URLs automatically (preserving the existing port) when explicit remote URLs are not provided.

Environment variables:
- `DEPLOYMENT_TYPE`: `local` or `remote` (forces mode)
- `SERVER_ENV`: `local` or `remote` (alias for `DEPLOYMENT_TYPE`)
- `SERVER_HOST`: Overrides detected hostname for remote URL construction
- `SERVER_PORT`: Overrides the port used when constructing URLs
- `NODE_ENV`: Influences intelligent defaults (`development`/`test` => local preference, `production` => remote preference)
- `HOST` / `DOMAIN`: Hostname/domain candidates used during intelligent default resolution
- `REMOTE_SCHEME`: `http` or `https` (forces remote scheme for derived remote URLs)
- `PREFER_HTTPS_REMOTE`: `true` or `false` (defaults to true when `REMOTE_SCHEME` is not set)
- `CLOUD_METADATA_TIMEOUT_MS`: Timeout for metadata endpoint probes (default `1200`)
- `LOG_LEVEL`: `debug` | `info` | `warn` | `error`
- `ENABLE_FALLBACK`: `true` or `false` (defaults to true)
- `STRICT_OPTIONAL_HEALTH`: `true` to emit optional-service unreachability as warnings, otherwise logs as info

Detection priority:
1. `DEPLOYMENT_TYPE` / `SERVER_ENV` force mode
2. Network interface analysis (public vs private IPv4)
3. Cloud metadata probing (AWS/GCP/Azure)
4. Intelligent defaults from `HOST`/`DOMAIN`, server context metadata, and `NODE_ENV`
5. Fallback to `localhost` if unresolved and fallback is enabled

## How It Works
1. `npm run dev` executes `scripts/dev-orchestrator.mjs`.
2. The orchestrator loads `scripts/services.config.json` and `.env`.
3. Each service selects an active endpoint (local vs remote) based on availability probes.
4. Services are started only when the selected endpoint is local and `command` is defined.
5. Required services are health-checked with retries and exponential backoff before starting Vite.
6. When all required services are healthy, Vite is started.
7. The Vite proxy returns a structured JSON error when upstream is unavailable, including guidance.
8. While Vite runs, the orchestrator periodically re-checks endpoint availability and restarts Vite if it switches an endpoint between local and remote.

## Adding A New Service
1. Add a block in `scripts/services.config.json`.
2. Define `urlEnv` and add to `.env`.
3. Optionally add `dependsOn` to enforce startup order.
4. Update `vite.config.ts` proxy if a new route is required.

## Troubleshooting
- If a service fails health checks:
  - Verify the service command in `services.config.json`.
  - Ensure the service provides a health endpoint at `healthPath`.
  - Adjust `retry.attempts`, `baseDelayMs`, and `timeoutMs`.
- To bypass orchestration temporarily, run `npm run dev:vite`.

## Logging
During orchestration, logs show each service start, retry attempts, and status changes, followed by Vite server start. Structured proxy errors include service name, target URL, and resolution hints.
