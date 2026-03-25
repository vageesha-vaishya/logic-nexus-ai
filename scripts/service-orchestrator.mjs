import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import process from "node:process";
import path from "node:path";
import dotenv from "dotenv";
import { chooseEndpoint, isRemoteUrl, setEnvVar } from "./server-health.mjs";
import { createLogger, determineDeploymentContext, rewriteUrlPreservePort } from "./deployment-env.mjs";

const rootDir = path.resolve(process.cwd());
dotenv.config({ path: path.join(rootDir, ".env") });

const args = new Set(process.argv.slice(2));
const startOnly = args.has("--start-only");
const checkOnly = args.has("--check-only");
const checkStrict = args.has("--check-strict");
const configPath = path.join(rootDir, "scripts", "services.config.json");

function now() {
  return new Date().toISOString();
}

const logger = createLogger();

function log(kind, msg) {
  const payload = { event: kind, message: msg };
  if (kind === "error") return logger.error(payload);
  if (kind === "warn") return logger.warn(payload);
  if (kind === "debug" || kind === "retry") return logger.debug(payload);
  if (kind === "ready" || kind === "start" || kind === "check" || kind === "info") return logger.info(payload);
  return logger.info(payload);
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function expandUrl(envName, fallback) {
  const v = process.env[envName];
  if (v && v.trim()) return v.trim();
  return fallback;
}

async function readConfig() {
  const raw = await readFile(configPath, "utf-8");
  const json = JSON.parse(raw);
  const byId = {};
  const deployment = await determineDeploymentContext({ env: process.env, logger });
  for (const s of json.services) {
    const localUrl = expandUrl(s.localUrlEnv || s.urlEnv, s.localDefaultUrl || s.defaultUrl);
    const remoteUrl = expandUrl(s.remoteUrlEnv, s.remoteDefaultUrl);
    const preferEndpoint = s.preferEndpoint || "local";
    const hasRemote = Boolean(remoteUrl && String(remoteUrl).trim());

    const derivedRemoteUrl =
      !hasRemote && deployment.type === "remote" && deployment.host
        ? rewriteUrlPreservePort(localUrl, { host: deployment.host, portOverride: deployment.portOverride })
        : "";

    const remoteCandidate = hasRemote ? remoteUrl : derivedRemoteUrl || null;

    const requiredAuto =
      Boolean(s.required) ||
      Boolean(s.requiredWhenRemote && remoteCandidate && isRemoteUrl(remoteCandidate));

    const preferLocalBootstrap = Boolean(s.command) && preferEndpoint !== "remote" && !remoteCandidate;
    const selection = preferLocalBootstrap
      ? { kind: "local", url: localUrl, probe: { ok: false, skipped: true } }
      : await chooseEndpoint({
          localUrl,
          remoteUrl: remoteCandidate,
          prefer: preferEndpoint,
          healthPath: s.healthPath || "/",
          timeoutMs: typeof s.probeTimeoutMs === "number" ? s.probeTimeoutMs : 5000,
          okStatus: s.okStatus || [],
          attempts: Math.min(3, s.probeAttempts || s.retry?.attempts || 3),
          baseDelayMs: s.probeBaseDelayMs || 250,
          maxDelayMs: s.probeMaxDelayMs || 5000,
          logFn: ({ attempt, attempts, backoffMs }) => {
            log("retry", `${s.name} probe failed, attempt ${attempt}/${attempts}, waiting ${backoffMs}ms`);
          },
        });

    const url = selection.url || localUrl;
    const activeEndpoint = selection.kind;

    const targetEnvVar = s.localUrlEnv || s.urlEnv;
    if (targetEnvVar && url) setEnvVar(targetEnvVar, url);

    byId[s.id] = {
      ...s,
      url,
      localUrl,
      remoteUrl: remoteCandidate || "",
      preferEndpoint,
      activeEndpoint,
      required: requiredAuto,
    };
  }
  return byId;
}

async function checkHealth(url, healthPath, timeoutMs, okStatus = []) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const target = new URL(healthPath || "/", url).toString();
    const res = await fetch(target, { method: "GET", signal: controller.signal });
    clearTimeout(t);
    if (res.ok) return true;
    if (Array.isArray(okStatus) && okStatus.includes(res.status)) return true;
    return false;
  } catch {
    clearTimeout(t);
    return false;
  }
}

async function waitUntilHealthy(service, maxAttempts, baseDelayMs, timeoutMs) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt += 1;
    const ok = await checkHealth(service.url, service.healthPath, timeoutMs, service.okStatus);
    if (ok) {
      log("ready", `${service.name} at ${service.url}`);
      return true;
    }
    const backoff = Math.min(baseDelayMs * 2 ** (attempt - 1), 5000);
    log("retry", `${service.name} not ready (${service.url}), attempt ${attempt}/${maxAttempts}, waiting ${backoff}ms`);
    await delay(backoff);
  }
  return false;
}

function spawnService(command, cwd) {
  const shell = process.platform === "win32" ? "cmd.exe" : "bash";
  const args = process.platform === "win32" ? ["/c", command] : ["-lc", command];
  const child = spawn(shell, args, { cwd, stdio: "pipe", env: process.env });
  child.stdout.on("data", (d) => process.stdout.write(d));
  child.stderr.on("data", (d) => process.stderr.write(d));
  return child;
}

function topoSort(services) {
  const indeg = {};
  const graph = {};
  for (const id of Object.keys(services)) {
    indeg[id] = 0;
    graph[id] = [];
  }
  for (const id of Object.keys(services)) {
    for (const dep of services[id].dependsOn || []) {
      indeg[id] += 1;
      graph[dep].push(id);
    }
  }
  const q = Object.keys(indeg).filter((k) => indeg[k] === 0);
  const order = [];
  while (q.length) {
    const u = q.shift();
    order.push(u);
    for (const v of graph[u]) {
      indeg[v] -= 1;
      if (indeg[v] === 0) q.push(v);
    }
  }
  return order;
}

function shouldStartLocalService(service) {
  if (!service.command) return false;
  if (service.activeEndpoint === "remote") return false;
  return true;
}

function logOptionalUnavailable(service) {
  const strictMode = checkStrict || String(process.env.STRICT_OPTIONAL_HEALTH || "").trim().toLowerCase() === "true";
  const kind = strictMode ? "warn" : "info";
  const suffix = strictMode ? "" : " (optional service; continuing)";
  log(kind, `${service.name} is optional and not reachable at ${service.url}${suffix}`);
}

async function main() {
  const services = await readConfig();
  const order = topoSort(services);
  const processes = new Map();
  let viteProcess = null;
  let restartQueued = false;

  if (checkOnly) {
    log("info", checkStrict ? "Health check mode (strict)" : "Health check mode");
  } else if (startOnly) {
    log("info", "Service start mode (no Vite)");
  } else {
    log("info", "Dev mode (services then Vite)");
  }

  process.on("SIGINT", () => {
    for (const [, p] of processes) {
      try {
        p.kill("SIGTERM");
      } catch {}
    }
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    for (const [, p] of processes) {
      try {
        p.kill("SIGTERM");
      } catch {}
    }
    process.exit(0);
  });

  for (const id of order) {
    const s = services[id];
    const deps = s.dependsOn || [];
    if (deps.length) {
      for (const dep of deps) {
        const depSvc = services[dep];
        if (depSvc.required) {
          const r = await waitUntilHealthy(depSvc, depSvc.retry.attempts, depSvc.retry.baseDelayMs, depSvc.retry.timeoutMs);
          if (!r) {
            log("error", `Dependency ${depSvc.name} failed to become ready`);
            process.exit(1);
          }
        }
      }
    }
    if (shouldStartLocalService(s) && !checkOnly) {
      log("start", `${s.name} -> ${s.command}`);
      const child = spawnService(s.command, rootDir);
      processes.set(id, child);
    } else {
      const mode = s.activeEndpoint === "remote" ? `remote (${s.url})` : `local (${s.url})`;
      log("check", `${s.name} ${mode}, health will be verified`);
    }
  }

  let allOk = true;
  if (checkOnly) {
    for (const id of order) {
      const s = services[id];
      const attempts = s.required || checkStrict ? s.retry.attempts : Math.min(2, s.retry.attempts);
      const ok = await waitUntilHealthy(s, attempts, s.retry.baseDelayMs, s.retry.timeoutMs);
      if (!ok) {
        if (s.required) {
          allOk = false;
          log("error", `${s.name} failed health checks at ${s.url}`);
        } else {
          logOptionalUnavailable(s);
        }
      }
    }
  } else {
    const requiredIds = order.filter((id) => services[id].required);
    for (const id of requiredIds) {
      const s = services[id];
      const ok = await waitUntilHealthy(s, s.retry.attempts, s.retry.baseDelayMs, s.retry.timeoutMs);
      if (!ok) {
        allOk = false;
        log("error", `${s.name} failed health checks at ${s.url}`);
      }
    }
    const optionalIds = order.filter((id) => !services[id].required);
    for (const id of optionalIds) {
      const s = services[id];
      const attempts = Math.min(2, Math.max(1, Math.floor((s.retry?.attempts ?? 3) / 6)));
      waitUntilHealthy(s, attempts, s.retry?.baseDelayMs ?? 500, s.retry?.timeoutMs ?? 5000).then((ok) => {
        if (!ok) {
          logOptionalUnavailable(s);
        }
      });
    }
  }

  if (!allOk) {
    log("error", "Required services are not ready. Aborting.");
    process.exit(1);
  }

  if (checkOnly) {
    log("info", "Health checks completed");
    process.exit(0);
  }

  if (!startOnly) {
    log("start", "Vite dev server");
    viteProcess = spawnService("vite", rootDir);
    processes.set("vite", viteProcess);
  }

  if (!checkOnly) {
    const monitorIntervalMs = 15000;
    setInterval(async () => {
      if (!viteProcess || viteProcess.killed) return;
      let changed = false;
      for (const id of order) {
        const s = services[id];
        const hasRemote = Boolean(s.remoteUrl && String(s.remoteUrl).trim());
        if (!hasRemote) continue;
        const selection = await chooseEndpoint({
          localUrl: s.localUrl,
          remoteUrl: s.remoteUrl,
          prefer: s.preferEndpoint || "local",
          healthPath: s.healthPath || "/",
          timeoutMs: typeof s.probeTimeoutMs === "number" ? s.probeTimeoutMs : 5000,
          okStatus: s.okStatus || [],
          attempts: 3,
          baseDelayMs: 250,
          maxDelayMs: 2000,
        });
        if (selection && selection.url && selection.url !== s.url) {
          s.url = selection.url;
          s.activeEndpoint = selection.kind;
          const targetEnvVar = s.localUrlEnv || s.urlEnv;
          if (targetEnvVar) setEnvVar(targetEnvVar, selection.url);
          log("info", `${s.name} switching to ${selection.kind} (${selection.url})`);
          changed = true;
        }
      }
      if (changed && !restartQueued && viteProcess) {
        restartQueued = true;
        setTimeout(() => {
          try {
            viteProcess.kill("SIGTERM");
          } catch {}
          log("start", "Vite dev server (restarted due to endpoint switch)");
          viteProcess = spawnService("vite", rootDir);
          processes.set("vite", viteProcess);
          restartQueued = false;
        }, 500);
      }
    }, monitorIntervalMs);
  }
}

main().catch((e) => {
  log("error", String(e?.stack || e?.message || e));
  process.exit(1);
});
