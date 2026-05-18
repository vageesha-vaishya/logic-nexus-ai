import http from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.MARKETS_WORKER_PORT || 8001);

function json(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function hash32(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom01(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function buildLtp(symbol, exchange) {
  const seed = hash32(`${exchange}:${symbol}`);
  const base = 100 + (seed % 4500);
  const drift = (seed % 100) / 100;
  const jitter = (seededRandom01(seed + Date.now() / 60000) - 0.5) * 5;
  const ltp = Number((base + drift + jitter).toFixed(2));
  const prev = Number((ltp - ((seed % 200) / 100 - 1)).toFixed(2));
  const change = Number((ltp - prev).toFixed(2));
  const change_pct = prev !== 0 ? Number(((change / prev) * 100).toFixed(2)) : 0;
  return { symbol, exchange, ltp, prev_close: prev, change, change_pct, ts: new Date().toISOString() };
}

function isoDateDaysAgo(daysAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function buildChart(symbol, exchange, interval, lookback) {
  const bars = [];
  const seed = hash32(`${exchange}:${symbol}:${interval}`);
  const n = Math.max(20, Math.min(Number(lookback || 365), 365));

  let lastClose = 100 + (seed % 3000);
  for (let i = n - 1; i >= 0; i--) {
    const t = (n - i) / n;
    const wave = Math.sin((t * Math.PI * 6) + (seed % 17)) * (10 + (seed % 30));
    const noise = (seededRandom01(seed + i) - 0.5) * 6;
    const close = Math.max(1, Number((lastClose + wave * 0.15 + noise).toFixed(2)));
    const open = Number((close + (seededRandom01(seed + i + 101) - 0.5) * 4).toFixed(2));
    const high = Number((Math.max(open, close) + seededRandom01(seed + i + 202) * 5).toFixed(2));
    const low = Number((Math.min(open, close) - seededRandom01(seed + i + 303) * 5).toFixed(2));
    const volume = Math.floor(100000 + seededRandom01(seed + i + 404) * 900000);
    lastClose = close;

    bars.push({
      time: isoDateDaysAgo(i),
      open,
      high,
      low,
      close,
      volume,
    });
  }

  return {
    symbol,
    exchange,
    interval,
    bars,
    ma: {},
    count: bars.length,
    mock: true,
  };
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { status: "ok", service: "markets-worker-mock" });
    }

    if (req.method === "GET" && url.pathname === "/ready") {
      return json(res, 200, { status: "ready", checks: { supabase: false, mock: true } });
    }

    if (req.method === "GET" && url.pathname === "/v1/ltp") {
      const exchange = String(url.searchParams.get("exchange") || "NSE").toUpperCase();
      const symbolsParam = String(url.searchParams.get("symbols") || "").trim();
      const symbols = symbolsParam
        ? symbolsParam.split(",").map((s) => decodeURIComponent(s).trim()).filter(Boolean)
        : [];
      const items = symbols.map((sym) => buildLtp(sym, exchange));
      return json(res, 200, { exchange, items, mock: true });
    }

    if (req.method === "GET" && url.pathname.startsWith("/v1/chart/")) {
      const symbol = decodeURIComponent(url.pathname.replace("/v1/chart/", "")).trim();
      const exchange = String(url.searchParams.get("exchange") || "NSE").toUpperCase();
      const interval = String(url.searchParams.get("interval") || "1d").toLowerCase();
      const lookback = Number(url.searchParams.get("lookback") || 365);
      return json(res, 200, buildChart(symbol.toUpperCase(), exchange, interval, lookback));
    }

    return json(res, 404, { error: "Not found", path: url.pathname });
  } catch (e) {
    return json(res, 500, { error: "Internal error" });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`[markets-worker-mock] listening on http://127.0.0.1:${PORT}\n`);
});
