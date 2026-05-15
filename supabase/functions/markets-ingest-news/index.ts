// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types.d.ts" />

// markets-ingest-news — fetches RSS items from a free Indian-market news
// source, dedupes by URL, and bulk-inserts into markets.news_events.
//
// Per design doc 2026-05-14 §11 T2 ("Data ingestion: NSE/BSE EOD prices,
// BSE StAR MF NAVs, news (free APIs to start)").
//
// SCAFFOLD scope (this version):
//   ✓ Pulls from one RSS source (MoneyControl markets RSS by default).
//   ✓ Parses items (title, link, pubDate, description).
//   ✓ Dedupes against markets.news_events by raw_url.
//   ✓ Bulk-inserts new rows.
//   ✓ Service-role auth (this is a system/cron function — not user-facing).
//
// NOT yet:
//   ✗ Scheduling — invoke manually for now; cron via pg_cron / Supabase cron later.
//   ✗ Multi-source merging (NSE corporate announcements, BSE, ET, LiveMint, etc.).
//   ✗ Instrument tagging — `instruments` column populated only if the headline
//     mentions a known symbol in markets.instruments (very lightweight pass).
//   ✗ Sentiment scoring via LLM Gateway — added when budget + Anthropic key wired.
//     (Once enabled, set markets.news_events.sentiment_score from
//      callLLM('markets.news_sentiment', ...).)
//
// Auth: Authorization: Bearer <service_role_key> OR an admin user JWT.
//       This function uses the supabaseAdmin (service-role) client for writes.

declare const Deno: any;
import { serveWithLogger } from "../_shared/logger.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireServiceRoleOrAdmin } from "../_shared/auth.ts";
// xml parser provided via import_map.json
// @ts-ignore — Deno-only import map
import { parse as parseXml } from "xml";

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

// Default multi-source fan-out — MoneyControl feeds (no API key, no rate-limit headers).
// Override via the request body:
//   • { source: "<url>", source_name?: "..." }       → single source
//   • { sources: [ { url, name }, ... ] }            → custom list
interface SourceSpec { url: string; name: string; }

// Indian-market RSS sources. MoneyControl's RSS stopped publishing fresh items
// in Apr 2024, and as of 2026-05-15 their Akamai edge returns 403 to Supabase
// edge function IPs (bot detection). Removed; Economic Times + LiveMint cover
// the same beat and publish in real-time.
const DEFAULT_SOURCES: SourceSpec[] = [
  { url: "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms", name: "economictimes_markets" },
  { url: "https://www.livemint.com/rss/markets",                                  name: "livemint_markets" },
];

// Drop items older than this. Defends against a feed that starts serving stale
// archives (which is exactly what MoneyControl did) — without this, the
// ingestion loop would keep re-trying year-old items, burning enrich budget
// and producing useless briefs.
const MAX_AGE_DAYS = 7;

interface NewsItem {
  title: string;
  link: string;       // canonical URL — used as dedupe key
  pubDate: string | null;
  description: string | null;
  sourceName: string; // attached after parse to track which feed produced the item
}

interface PerSourceResult {
  source: string;
  source_name: string;
  fetched: number;
  inserted: number;
  duplicates: number;
  errors: number;
  error_message?: string | null;
}

interface IngestResult {
  total_fetched: number;
  total_inserted: number;
  total_duplicates: number;
  total_errors: number;
  sources: PerSourceResult[];
  sample_titles: string[];
  enrich_triggered?: boolean;
}

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    // Authorize — service-role OR an admin user JWT.
    const auth = await requireServiceRoleOrAdmin(req, supabaseAdmin, logger);
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ error: auth.error }),
        { status: auth.status, headers: jsonHeaders },
      );
    }

    // Parse optional body for source override.
    //   { source: "<url>", source_name?: "..." }  → single source
    //   { sources: [ { url, name }, ... ] }       → custom multi-source list
    //   (no body)                                  → DEFAULT_SOURCES
    let sources: SourceSpec[] = DEFAULT_SOURCES;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (typeof body?.source === "string" && body.source.startsWith("http")) {
          sources = [{ url: body.source, name: String(body.source_name ?? "custom") }];
        } else if (Array.isArray(body?.sources) && body.sources.length > 0) {
          sources = body.sources
            .map((s: any) => ({ url: String(s?.url ?? ""), name: String(s?.name ?? "custom") }))
            .filter((s: SourceSpec) => s.url.startsWith("http"));
          if (sources.length === 0) sources = DEFAULT_SOURCES;
        }
      } catch {
        // No body → defaults; not an error.
      }
    }

    logger.info("markets-ingest-news start", { sources: sources.map((s) => s.name) });

    // 1. Fetch + parse each source. Per-source failures don't abort other sources.
    const perSource: PerSourceResult[] = [];
    const allItems: NewsItem[] = [];

    for (const src of sources) {
      const res: PerSourceResult = {
        source: src.url,
        source_name: src.name,
        fetched: 0,
        inserted: 0,
        duplicates: 0,
        errors: 0,
        error_message: null,
      };
      try {
        const resp = await fetch(src.url, {
          headers: {
            "user-agent":
              "Mozilla/5.0 (compatible; SOS-Nexus markets-ingest-news/1.1; +https://example.com)",
            accept: "application/rss+xml, application/xml, text/xml, */*;q=0.5",
          },
        });
        if (!resp.ok) {
          res.errors = 1;
          res.error_message = `upstream_${resp.status}`;
          logger.warn("source fetch failed", { source: src.name, status: resp.status });
        } else {
          const xmlText = await resp.text();
          const items = extractRssItems(xmlText).map((it) => ({ ...it, sourceName: src.name }));
          res.fetched = items.length;
          allItems.push(...items);
        }
      } catch (e: any) {
        res.errors = 1;
        res.error_message = e?.message ?? String(e);
        logger.warn("source fetch threw", { source: src.name, error: res.error_message });
      }
      perSource.push(res);
    }

    if (allItems.length === 0) {
      const empty: IngestResult = {
        total_fetched: 0,
        total_inserted: 0,
        total_duplicates: 0,
        total_errors: perSource.reduce((acc, s) => acc + s.errors, 0),
        sources: perSource,
        sample_titles: [],
        enrich_triggered: false,
      };
      return new Response(JSON.stringify(empty), { headers: jsonHeaders });
    }

    // 2a. Drop stale items. A feed serving old archives (MoneyControl, 2024-04)
    //     would otherwise re-trigger enrichment on year-old news forever.
    //     Items without a parseable pubDate are kept (assumed fresh).
    const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 3600 * 1000;
    const freshByAge = allItems.filter((i) => {
      if (!i.pubDate) return true;
      const t = Date.parse(i.pubDate);
      if (!Number.isFinite(t)) return true;
      return t >= cutoff;
    });
    const droppedStale = allItems.length - freshByAge.length;
    if (droppedStale > 0) {
      logger.info("dropped stale items", {
        max_age_days: MAX_AGE_DAYS,
        dropped: droppedStale,
        kept: freshByAge.length,
      });
    }

    // 2b. Dedupe across all sources at once. A url that appears in multiple
    //    feeds is normal (top-news echoes business etc.) — we keep the first
    //    occurrence by url, and only insert urls not already in news_events.
    const seen = new Set<string>();
    const uniqueItems = freshByAge.filter((i) => {
      if (!i.link || seen.has(i.link)) return false;
      seen.add(i.link);
      return true;
    });
    // 3. Bulk insert with conflict-resolution. We previously did a
    //    `select raw_url where raw_url in (long list)` dedupe, but article
    //    URLs from Economic Times push that IN-clause past the upstream URL
    //    size limit (~4KB) and the whole call 500s with a TypeError.
    //
    //    Now: rely on the partial unique index `news_events_raw_url_uidx`
    //    and let Postgres reject duplicates via ON CONFLICT DO NOTHING.
    //    The `Prefer: resolution=ignore-duplicates` header is supabase-js'
    //    sugar for that; only successfully-inserted rows come back in
    //    `select()`, so `inserted - rows.length` gives us the dup count.
    let inserted = 0;
    let insertedIds: string[] = [];
    let insertError: string | null = null;
    if (uniqueItems.length > 0) {
      const rows = uniqueItems.map((i) => ({
        ts: i.pubDate ? new Date(i.pubDate).toISOString() : new Date().toISOString(),
        source: i.sourceName,
        title: i.title.slice(0, 500),
        body: i.description ? i.description.slice(0, 4000) : null,
        instruments: [] as string[],
        raw_url: i.link,
        metadata: {} as Record<string, unknown>,
      }));

      const { data: insertedRows, error: insertErr } = await (supabaseAdmin as any)
        .schema("markets")
        .from("news_events")
        .upsert(rows, { onConflict: "raw_url", ignoreDuplicates: true })
        .select("id, source");

      if (insertErr) {
        logger.error("insert failed", { error: insertErr.message });
        insertError = insertErr.message;
      } else {
        insertedIds = (insertedRows ?? []).map((r: any) => r.id as string);
        inserted = insertedIds.length;

        const sourceCounts: Record<string, number> = {};
        for (const r of insertedRows ?? []) {
          const name = String((r as any).source);
          sourceCounts[name] = (sourceCounts[name] ?? 0) + 1;
        }
        for (const s of perSource) {
          s.inserted = sourceCounts[s.source_name] ?? 0;
          s.duplicates = Math.max(0, s.fetched - s.inserted - s.errors);
        }
      }
    } else {
      for (const s of perSource) s.duplicates = s.fetched;
    }

    // 4. Fire-and-forget invoke markets-enrich-news with the new IDs.
    // We use a direct fetch with the service-role key instead of
    // `supabaseAdmin.functions.invoke(...)` because the supabase-js helper
    // does NOT consistently forward the service-role Authorization header
    // when called from inside another edge function — it gets stripped or
    // replaced with the anon key, which then 401s on the receiving end.
    let enrichTriggered = false;
    if (insertedIds.length > 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      if (supabaseUrl && serviceRoleKey) {
        try {
          fetch(`${supabaseUrl}/functions/v1/markets-enrich-news`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${serviceRoleKey}`,
              "apikey": serviceRoleKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ news_event_ids: insertedIds }),
          })
            .then(async (resp) => {
              if (!resp.ok) {
                const txt = await resp.text().catch(() => "");
                logger.warn("enrich invoke returned non-2xx", {
                  status: resp.status,
                  body: txt.slice(0, 500),
                });
              }
            })
            .catch((e: any) => {
              logger.warn("enrich invoke fetch threw", { error: e?.message ?? String(e) });
            });
          enrichTriggered = true;
        } catch (e: any) {
          logger.warn("could not schedule enrich invoke", { error: e?.message ?? String(e) });
        }
      } else {
        logger.warn("missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env; cannot trigger enrich");
      }
    }

    const result: IngestResult = {
      total_fetched: allItems.length,
      total_inserted: inserted,
      total_duplicates: Math.max(0, uniqueItems.length - inserted),
      total_errors:
        perSource.reduce((acc, s) => acc + s.errors, 0) +
        (insertError ? uniqueItems.length : 0),
      sources: perSource,
      sample_titles: uniqueItems.slice(0, 5).map((i) => i.title),
      enrich_triggered: enrichTriggered,
    };

    logger.info("markets-ingest-news done", result);
    return new Response(JSON.stringify(result), { headers: jsonHeaders });
  } catch (e: any) {
    logger.error("markets-ingest-news unhandled error", { error: e?.message ?? String(e) });
    return new Response(
      JSON.stringify({ error: e?.message ?? "Internal server error" }),
      { status: 500, headers: jsonHeaders },
    );
  }
}, "markets-ingest-news");

// ─── RSS parsing helpers ───────────────────────────────────────────────

type RawRssItem = Omit<NewsItem, "sourceName">;

function extractRssItems(xml: string): RawRssItem[] {
  const parsed: any = parseXml(xml);

  // RSS 2.0 shape: rss.channel.item[]
  const channel = parsed?.rss?.channel ?? parsed?.channel;
  if (!channel) return [];

  const rawItems = Array.isArray(channel.item)
    ? channel.item
    : channel.item
    ? [channel.item]
    : [];

  return rawItems
    .map((it: any): RawRssItem | null => {
      const link = textOf(it.link);
      const title = textOf(it.title);
      if (!link || !title) return null;
      return {
        title: title.trim(),
        link: link.trim(),
        pubDate: textOf(it.pubDate),
        description: textOf(it.description),
      };
    })
    .filter((x: RawRssItem | null): x is RawRssItem => x !== null);
}

function textOf(node: unknown): string | null {
  if (node == null) return null;
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (typeof node === "object") {
    // xml@2.1.3 wraps text in { "#text": "..." } when attrs exist.
    const obj = node as any;
    if (typeof obj["#text"] === "string") return obj["#text"];
    if (typeof obj["$value"] === "string") return obj["$value"];
  }
  return null;
}
