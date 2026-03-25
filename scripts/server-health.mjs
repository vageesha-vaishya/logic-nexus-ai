import process from "node:process";

function nowMs() {
  return Date.now();
}

function minAttempts(value, min = 3) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return min;
  return Math.max(min, Math.floor(n));
}

export async function probeHttp(url, { healthPath = "/", timeoutMs = 5000, okStatus = [] } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const target = new URL(healthPath || "/", url).toString();
    const res = await fetch(target, { method: "GET", signal: controller.signal });
    clearTimeout(t);
    if (res.ok) return { ok: true, status: res.status };
    if (Array.isArray(okStatus) && okStatus.includes(res.status)) return { ok: true, status: res.status };
    return { ok: false, status: res.status };
  } catch (error) {
    clearTimeout(t);
    const message = error && typeof error === "object" && "message" in error ? String(error.message) : String(error);
    return { ok: false, status: 0, error: message };
  }
}

export async function probeWithRetry(
  url,
  {
    healthPath = "/",
    timeoutMs = 5000,
    okStatus = [],
    attempts = 3,
    baseDelayMs = 250,
    maxDelayMs = 5000,
    delayFn = (ms) => new Promise((r) => setTimeout(r, ms)),
    logFn = null,
  } = {}
) {
  const tries = minAttempts(attempts, 3);
  let last = null;
  const startedAt = nowMs();
  for (let i = 1; i <= tries; i += 1) {
    last = await probeHttp(url, { healthPath, timeoutMs, okStatus });
    if (last.ok) return { ok: true, attempt: i, elapsedMs: nowMs() - startedAt, status: last.status };
    const backoff = Math.min(baseDelayMs * 2 ** (i - 1), maxDelayMs);
    if (logFn) logFn({ event: "retry", url, attempt: i, attempts: tries, backoffMs: backoff, status: last.status, error: last.error });
    if (i < tries) await delayFn(backoff);
  }
  return { ok: false, attempt: tries, elapsedMs: nowMs() - startedAt, status: last?.status || 0, error: last?.error };
}

export async function chooseEndpoint(
  {
    localUrl,
    remoteUrl,
    prefer = "local",
    healthPath = "/",
    timeoutMs = 5000,
    okStatus = [],
    attempts = 3,
    baseDelayMs = 250,
    maxDelayMs = 5000,
    delayFn = (ms) => new Promise((r) => setTimeout(r, ms)),
    logFn = null,
  } = {}
) {
  const preferLocal = prefer !== "remote";
  const firstKind = preferLocal ? "local" : "remote";
  const secondKind = preferLocal ? "remote" : "local";
  const firstUrl = preferLocal ? localUrl : remoteUrl;
  const secondUrl = preferLocal ? remoteUrl : localUrl;

  if (firstUrl) {
    const r = await probeWithRetry(firstUrl, { healthPath, timeoutMs, okStatus, attempts, baseDelayMs, maxDelayMs, delayFn, logFn });
    if (r.ok) return { kind: firstKind, url: firstUrl, probe: r };
  }
  if (secondUrl) {
    const r = await probeWithRetry(secondUrl, { healthPath, timeoutMs, okStatus, attempts, baseDelayMs, maxDelayMs, delayFn, logFn });
    if (r.ok) return { kind: secondKind, url: secondUrl, probe: r };
  }
  if (firstUrl) return { kind: firstKind, url: firstUrl, probe: { ok: false } };
  if (secondUrl) return { kind: secondKind, url: secondUrl, probe: { ok: false } };
  return { kind: "none", url: "", probe: { ok: false } };
}

export function isRemoteUrl(url) {
  if (!url) return false;
  const trimmed = String(url).trim();
  if (!trimmed) return false;
  return !/^https?:\/\/localhost(?::\d+)?\/?$/i.test(trimmed) && !/^https?:\/\/127\.0\.0\.1(?::\d+)?\/?$/i.test(trimmed);
}

export function setEnvVar(name, value) {
  if (!name) return;
  process.env[name] = value;
}
