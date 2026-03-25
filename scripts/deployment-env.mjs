import os from "node:os";
import process from "node:process";

function normalizeLogLevel(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "debug" || v === "info" || v === "warn" || v === "error") return v;
  return "info";
}

export function createLogger({ level = process.env.LOG_LEVEL } = {}) {
  const active = normalizeLogLevel(level);
  const order = { debug: 10, info: 20, warn: 30, error: 40 };
  function emit(kind, payload) {
    if (order[kind] < order[active]) return;
    const ts = new Date().toISOString();
    const msg = typeof payload === "string" ? payload : JSON.stringify(payload);
    process.stdout.write(`[${ts}] ${kind.toUpperCase().padEnd(5)} ${msg}\n`);
  }
  return {
    debug: (p) => emit("debug", p),
    info: (p) => emit("info", p),
    warn: (p) => emit("warn", p),
    error: (p) => emit("error", p),
    level: active,
  };
}

function isTruthy(value) {
  const v = String(value || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function isPrivateIpv4(ip) {
  const parts = String(ip).split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function isLoopbackHost(host) {
  const h = String(host || "").trim().toLowerCase();
  return h === "localhost" || h === "127.0.0.1";
}

export function classifyHost(host) {
  const h = String(host || "").trim();
  if (!h) return { kind: "unknown", host: "" };
  if (isLoopbackHost(h)) return { kind: "local", host: h };
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return { kind: isPrivateIpv4(h) ? "local" : "remote", host: h };
  if (h.endsWith(".local")) return { kind: "local", host: h };
  return { kind: "remote", host: h };
}

async function fetchWithTimeout(url, { timeoutMs = 1200, headers = {} } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "GET", headers, signal: controller.signal });
    clearTimeout(t);
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (error) {
    clearTimeout(t);
    const message = error && typeof error === "object" && "message" in error ? String(error.message) : String(error);
    return { ok: false, status: 0, error: message };
  }
}

async function detectCloudMetadata({ logger, timeoutMs = 1200 } = {}) {
  const awsHost = await fetchWithTimeout("http://169.254.169.254/latest/meta-data/public-hostname", { timeoutMs });
  if (awsHost.ok && awsHost.text) return { provider: "aws", host: awsHost.text.trim() };

  const gcpHost = await fetchWithTimeout("http://metadata.google.internal/computeMetadata/v1/instance/hostname", {
    timeoutMs,
    headers: { "Metadata-Flavor": "Google" },
  });
  if (gcpHost.ok && gcpHost.text) return { provider: "gcp", host: gcpHost.text.trim() };

  const azureMeta = await fetchWithTimeout("http://169.254.169.254/metadata/instance/compute?api-version=2021-02-01", {
    timeoutMs,
    headers: { Metadata: "true" },
  });
  if (azureMeta.ok && azureMeta.text) {
    try {
      const json = JSON.parse(azureMeta.text);
      const name = json?.name ? String(json.name).trim() : "";
      if (name) return { provider: "azure", host: name };
    } catch {}
  }

  logger?.debug({ event: "cloudMetadata", provider: null });
  return { provider: null, host: "" };
}

function detectNetworkContext({ logger, networkInterfacesFn } = {}) {
  try {
    const nets = (networkInterfacesFn || os.networkInterfaces)();
    const ipv4 = [];
    for (const name of Object.keys(nets || {})) {
      for (const addr of nets[name] || []) {
        if (addr && addr.family === "IPv4" && !addr.internal && addr.address) ipv4.push(addr.address);
      }
    }
    const hasPrivate = ipv4.some(isPrivateIpv4);
    const hasPublic = ipv4.some((ip) => !isPrivateIpv4(ip));
    const primary = ipv4.find((ip) => !isPrivateIpv4(ip)) || ipv4[0] || "";
    logger?.debug({ event: "networkInterfaces", ipv4Count: ipv4.length, hasPrivate, hasPublic, primary });
    return { ipv4, hasPrivate, hasPublic, primary };
  } catch (error) {
    const message = error && typeof error === "object" && "message" in error ? String(error.message) : String(error);
    logger?.warn({ event: "networkInterfaces", error: message });
    return { ipv4: [], hasPrivate: false, hasPublic: false, primary: "" };
  }
}

function pickEnvHostname(env) {
  const candidates = [
    env.SERVER_HOST,
    env.DOMAIN,
    env.HOST,
    env.PUBLIC_HOST,
    env.PUBLIC_URL,
    env.VERCEL_URL,
    env.RENDER_EXTERNAL_HOSTNAME,
    env.RAILWAY_PUBLIC_DOMAIN,
    env.FLY_APP_NAME ? `${env.FLY_APP_NAME}.fly.dev` : "",
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean);

  for (const c of candidates) {
    try {
      const u = c.includes("://") ? new URL(c) : null;
      const host = u ? u.hostname : c;
      if (host) return host;
    } catch {
      return c;
    }
  }
  return "";
}

function parsePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function detectServerContextMetadata(env, logger) {
  try {
    const nodeEnv = String(env.NODE_ENV || "").trim().toLowerCase();
    const hostname = String(env.HOSTNAME || "").trim();
    const containerized =
      String(env.KUBERNETES_SERVICE_HOST || "").trim() !== "" ||
      String(env.KUBERNETES_PORT || "").trim() !== "" ||
      String(env.DOCKER_CONTAINER || "").trim() !== "" ||
      String(env.CONTAINER || "").trim().toLowerCase() === "true";
    const cloudHints = [
      env.AWS_EXECUTION_ENV ? "aws" : "",
      env.GOOGLE_CLOUD_PROJECT ? "gcp" : "",
      env.WEBSITE_SITE_NAME ? "azure" : "",
      env.K_SERVICE ? "gcp-cloud-run" : "",
      env.VERCEL ? "vercel" : "",
      env.RENDER ? "render" : "",
      env.RAILWAY_ENVIRONMENT ? "railway" : "",
    ].filter(Boolean);
    const cloud = cloudHints.length > 0;
    logger?.debug({ event: "serverContext", nodeEnv, hostname, containerized, cloudHints });
    return { nodeEnv, hostname, containerized, cloud, cloudHints };
  } catch (error) {
    const message = error && typeof error === "object" && "message" in error ? String(error.message) : String(error);
    logger?.warn({ event: "serverContext", error: message });
    return { nodeEnv: "", hostname: "", containerized: false, cloud: false, cloudHints: [] };
  }
}

export async function determineDeploymentContext({ env = process.env, logger = createLogger(), networkInterfacesFn, metadataDetector } = {}) {
  const forced = String(env.DEPLOYMENT_TYPE || env.SERVER_ENV || "").trim().toLowerCase();
  const fallbackEnabled = env.ENABLE_FALLBACK === undefined ? true : isTruthy(env.ENABLE_FALLBACK);
  const portOverride = String(env.SERVER_PORT || "").trim();
  const explicitHost = String(env.SERVER_HOST || "").trim();
  const envHost = pickEnvHostname(env);
  const metadataTimeoutMs = parsePositiveInt(env.CLOUD_METADATA_TIMEOUT_MS, 1200);
  const context = detectServerContextMetadata(env, logger);

  logger.debug({
    event: "deploymentIndicators",
    forced,
    explicitHost,
    envHost,
    nodeEnv: context.nodeEnv,
    containerized: context.containerized,
    cloudHints: context.cloudHints,
    fallbackEnabled,
    metadataTimeoutMs,
  });

  if (forced === "local" || forced === "remote") {
    const host = forced === "local" ? "localhost" : explicitHost || envHost;
    logger.info({ event: "deployment", method: "forced", forced, host: host || "", portOverride: portOverride || "" });
    return { type: forced, host: host || "", portOverride: portOverride || "", source: "forced", fallbackEnabled };
  }

  if (forced) {
    logger.warn({ event: "deployment", method: "forced", warning: "Invalid DEPLOYMENT_TYPE/SERVER_ENV value", value: forced });
  }

  if (explicitHost) {
    const c = classifyHost(explicitHost);
    logger.info({ event: "deployment", method: "SERVER_HOST", host: explicitHost, classified: c.kind });
    return { type: c.kind === "local" ? "local" : "remote", host: explicitHost, portOverride: portOverride || "", source: "env", fallbackEnabled };
  }

  const network = detectNetworkContext({ logger, networkInterfacesFn });
  if (network.hasPublic && network.primary) {
    logger.info({ event: "deployment", method: "network", type: "remote", host: network.primary });
    return { type: "remote", host: network.primary, portOverride: portOverride || "", source: "network", fallbackEnabled };
  }

  const detectMetadata = metadataDetector || detectCloudMetadata;
  const meta = await detectMetadata({ logger, timeoutMs: metadataTimeoutMs });
  if (meta.host) {
    logger.info({ event: "deployment", method: "cloudMetadata", provider: meta.provider, host: meta.host, type: "remote" });
    return { type: "remote", host: meta.host, portOverride: portOverride || "", source: "cloud", fallbackEnabled };
  }

  if (envHost) {
    const c = classifyHost(envHost);
    logger.info({ event: "deployment", method: "HOST/DOMAIN", host: envHost, classified: c.kind });
    return { type: c.kind === "local" ? "local" : "remote", host: envHost, portOverride: portOverride || "", source: "defaults", fallbackEnabled };
  }

  if (context.containerized || context.cloud || context.nodeEnv === "production") {
    const hostCandidate = context.hostname || network.primary || "";
    const c = classifyHost(hostCandidate);
    if (hostCandidate && c.kind !== "unknown") {
      const type = c.kind === "local" && context.nodeEnv !== "production" ? "local" : "remote";
      logger.info({ event: "deployment", method: "serverContext", type, host: hostCandidate, nodeEnv: context.nodeEnv });
      return { type, host: hostCandidate, portOverride: portOverride || "", source: "defaults", fallbackEnabled };
    }
  }

  if (context.nodeEnv === "development" || context.nodeEnv === "test") {
    logger.info({ event: "deployment", method: "nodeEnvDefault", type: "local", host: "localhost", nodeEnv: context.nodeEnv });
    return { type: "local", host: "localhost", portOverride: portOverride || "", source: "defaults", fallbackEnabled };
  }

  if (network.hasPrivate && network.primary) {
    logger.info({ event: "deployment", method: "privateNetwork", type: "local", host: "localhost" });
    return { type: "local", host: "localhost", portOverride: portOverride || "", source: "network", fallbackEnabled };
  }

  if (!fallbackEnabled) {
    logger.error({ event: "deployment", method: "fallbackDisabled", error: "Unable to determine deployment environment" });
    return { type: "unknown", host: "", portOverride: portOverride || "", source: "unknown", fallbackEnabled };
  }

  logger.warn({ event: "deployment", method: "fallback", type: "local", host: "localhost" });
  return { type: "local", host: "localhost", portOverride: portOverride || "", source: "fallback", fallbackEnabled };
}

export function rewriteUrlPreservePort(baseUrl, { host, forceHost = false, portOverride = "" } = {}) {
  const u = new URL(baseUrl);
  if (forceHost || host) u.hostname = host || u.hostname;
  if (portOverride) u.port = String(portOverride);
  const protocolOverride = String(process.env.REMOTE_SCHEME || process.env.SERVER_SCHEME || "").trim().toLowerCase();
  if (protocolOverride === "http" || protocolOverride === "https") {
    u.protocol = `${protocolOverride}:`;
  } else {
    const preferHttps = process.env.PREFER_HTTPS_REMOTE === undefined ? true : isTruthy(process.env.PREFER_HTTPS_REMOTE);
    if (preferHttps) u.protocol = "https:";
  }
  return u.toString().replace(/\/$/, "");
}
