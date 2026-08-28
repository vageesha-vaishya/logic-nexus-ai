// supabase/functions/main/index.ts
//
// Self-hosted's Edge Runtime is configured with `--main-service` pointing
// here (see deploy/selfhosted-supabase/docker-compose.yml's `functions`
// service). Every request under /functions/v1/* arrives here first; this
// router dispatches to the target function's own handler after performing
// JWT verification for any function not explicitly exempted.
//
// Dispatch mechanism
// -------------------
// Every function in this codebase (via `_shared/logger.ts`'s
// `serveWithLogger`, or directly) calls the global `Deno.serve(handler)` as
// a top-level side effect of module evaluation - this is the pattern
// Supabase Cloud's one-function-per-isolate model expects, and it is left
// completely unmodified here (zero changes to `_shared/logger.ts` or to any
// of the function files).
//
// To reuse that unmodified code under a single shared isolate, this router
// temporarily replaces the global `Deno.serve` with a capturing shim
// immediately before importing a function's module. The function's own
// top-level `Deno.serve(...)` call hands its handler to the shim instead of
// starting a real server; the router then restores the real `Deno.serve`
// and calls the captured handler directly with the actual request.
// `Deno.serve` is resolved as a global at call time (not a module-level
// binding captured at import time), so the shim intercepts the call
// regardless of how many layers of function calls sit between module
// evaluation and the `Deno.serve(...)` statement (e.g. `serveWithLogger`
// calling it internally on behalf of its caller).
//
// Static import map requirement
// ------------------------------
// The module is imported via `FUNCTION_IMPORTERS[name]()` from
// `function_importers.ts`, NOT a computed-string `import(`../${name}/index.ts`)`
// call. This is load-bearing, not stylistic: the real Supabase Rust Edge
// Runtime (`supabase/edge-runtime`), run with `--main-service`, builds its
// executable module graph via STATIC analysis of this entrypoint's imports
// at boot time, materializing only the files it can discover into an
// internal sandboxed compile directory. A computed-string dynamic import is
// invisible to that static analyzer, so the target file is never
// materialized and the import throws `Module not found` at request time -
// confirmed empirically against the live self-hosted runtime (see
// `.superpowers/sdd/2026-08-28-supabase-selfhost-phase4-batch1/task-2-report.md`).
// A plain string-literal argument to `import()`, even nested inside an
// object-literal value, IS discovered by the analyzer - that is the
// mechanism `function_importers.ts` relies on. See that file's own header
// for the regeneration procedure when adding functions to a future batch.
//
// Because Deno's module cache means re-importing a module a second time
// would NOT re-run its top-level `Deno.serve()` call, the captured handler
// is cached by function name after the first successful capture - this
// caching is required for correctness, not just an optimization.
//
// Concurrency: `Deno.serve` is a single global. If two concurrent requests
// arrive for two different, not-yet-cached functions, both could try to
// shim/restore it around the same time - one request's restore could land
// while the other's dynamic import is still in flight expecting the shim to
// still be active, causing that import to invoke the REAL `Deno.serve`
// inside a request handler. The shim-import-restore critical section is
// therefore serialized across ALL functions (not just per-function) via a
// simple promise-chained lock, so only one capture happens at a time
// globally. This only matters for cold-start races (first request to each
// function); once a function's handler is cached, subsequent requests never
// touch the lock or the shim at all.
//
// Router-level JWT gate
// ----------------------
// The router's own JWT check mirrors what production's actual Supabase API
// gateway (Kong) does for `verify_jwt = true`: validate the token's
// SIGNATURE and expiry against the project's `JWT_SECRET` - nothing more.
// It does NOT require any particular claim (no `sub` needed), because both
// the anon key and the service_role key are validly-signed JWTs with no
// `sub` claim, and BOTH pass production's gateway. Real, in-repo production
// callers depend on this: `net.http_post` cron jobs
// (`supabase/migrations/20260515141848_markets_t1_ingest_crons.sql` and
// similar) call `verify_jwt=true` `markets-ingest-*` functions with the
// service-role key, and `src/lib/supabase-functions.ts`'s
// `invokeAnonymous()` calls `verify_jwt=true` functions like
// `discover-email-settings`/`verify-email-credentials` with the anon key.
// Identity-level checks (requiring a real authenticated end user with a
// `sub` claim) are each function's OWN responsibility via its own internal
// `_shared/auth.ts` `requireAuth()` call where needed (e.g.
// `admin-reset-password`) - exactly how it already works on production,
// where the gateway only checks the signature and functions do their own
// deeper checks internally. `requireAuth()` itself is untouched by this
// router; it's still imported and used by individual function modules.
import { extractBearerToken } from "../_shared/auth.ts";
import { VERIFY_JWT_MAP } from "./verify_jwt_map.ts";
import { FUNCTION_IMPORTERS } from "./function_importers.ts";

// @ts-ignore
declare const Deno: any;
// @ts-ignore
declare const crypto: any;

type Handler = (req: Request) => Response | Promise<Response>;

// `Handler | null` - `null` is a cached sentinel for "this function name
// terminally failed to produce a handler" (import threw, or the module
// never called `Deno.serve`). See Finding 5 in
// `.superpowers/sdd/2026-08-28-supabase-selfhost-phase4-batch1/final-review-fix-report.md`:
// without caching the failure, every subsequent request for a known-broken
// function name would re-enter the global import lock and retry for
// nothing, slowing down cold-start capture for OTHER, unrelated functions.
const handlerCache = new Map<string, Handler | null>();

// Promise-chained lock serializing the shim-import-restore critical section
// across ALL functions. See header comment for why this must be global
// rather than per-function.
let importLock: Promise<unknown> = Promise.resolve();

async function getHandler(name: string): Promise<Handler | null> {
  // Checked via `.has()`, not truthiness, so a cached `null` (terminal
  // failure) is treated as a real cache hit and short-circuits here -
  // BEFORE touching `importLock` at all - rather than re-entering the lock
  // and retrying a known-broken import on every request.
  if (handlerCache.has(name)) {
    return handlerCache.get(name) ?? null;
  }

  // Chain onto the global lock so only one capture (for any function) runs
  // at a time. Concurrent requests for the SAME function will each chain
  // their own `attempt` here, but the re-check below after acquiring the
  // lock means only the first one actually imports; the rest just read the
  // cache that first one populated.
  const attempt = importLock.then(async () => {
    // Re-check: another caller may have captured (or failed) this
    // function's handler while we were waiting for the lock.
    if (handlerCache.has(name)) {
      return handlerCache.get(name) ?? null;
    }

    // Look up the static importer BEFORE touching Deno.serve at all - a name
    // with no registered importer (not in this batch, or simply unknown)
    // should fail the same way it would have failed at import time, without
    // installing/restoring the shim for nothing. In practice the router
    // below already checks `FUNCTION_IMPORTERS` before ever calling
    // `getHandler`, so this is defensive rather than a normal path.
    const importer = FUNCTION_IMPORTERS[name];
    if (!importer) {
      throw new Error(`No static importer registered for function '${name}'`);
    }

    const realServe = Deno.serve;
    let captured: Handler | null = null;

    Deno.serve = (...args: any[]) => {
      // Deno.serve supports a few call signatures; capture the handler
      // regardless of which one the function uses:
      //   Deno.serve(handler)
      //   Deno.serve(options, handler)
      //   Deno.serve({ fetch: handler, ... })
      if (typeof args[0] === "function") {
        captured = args[0];
      } else if (args.length > 1 && typeof args[1] === "function") {
        captured = args[1];
      } else if (args[0] && typeof args[0].fetch === "function") {
        captured = args[0].fetch;
      }
      // The real Deno.serve returns an HttpServer-like object with a
      // `.finished` promise. Nothing in these functions reads the return
      // value (Deno.serve is invoked as a bare top-level statement in every
      // one of them), but return a harmless stand-in in case something ever
      // does.
      return { finished: Promise.resolve() };
    };

    try {
      await importer();
    } catch (err) {
      // Cache the terminal failure so repeat requests for this same broken
      // function fail fast (see the `.has()` check above) instead of
      // re-entering the lock and re-running a doomed import. The actual
      // error is logged by the router's caller, which has the request
      // context (function name, whether this is the first occurrence).
      handlerCache.set(name, null);
      throw err;
    } finally {
      // Always restore the real Deno.serve before releasing the lock, even
      // if the import threw - otherwise a failed import for one function
      // would leave the shim installed for whichever function's import
      // (or router request) runs next.
      Deno.serve = realServe;
    }

    // Cache the outcome either way - including a `null` capture (the
    // module imported fine but never called `Deno.serve`), which is just
    // as terminal as a thrown import: re-importing the same module again
    // would be a no-op under Deno's module cache, so there is no point
    // retrying it.
    handlerCache.set(name, captured);
    return captured;
  });

  // Advance the lock to this attempt regardless of outcome, so a failed
  // capture doesn't poison the chain for later, unrelated function imports.
  importLock = attempt.catch(() => undefined);
  return attempt;
}

// ---------------------------------------------------------------------------
// Router-level JWT signature verification
// ---------------------------------------------------------------------------
// Deliberately NOT identity verification. Matches production's actual
// Supabase API gateway behavior for `verify_jwt = true`: check the token is
// present, is a well-formed HS256 JWT, its signature verifies against
// `JWT_SECRET`, and it isn't expired. No claim (e.g. `sub`) is required, so
// the anon key and the service_role key - both validly-signed JWTs with no
// `sub` claim - are accepted, same as on production. See the header comment
// above for why this matters and what depends on it.

function base64UrlDecode(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

// Memoized HMAC key import - `JWT_SECRET` doesn't change at runtime, and
// re-importing it on every request would be wasteful.
let jwtSecretKeyPromise: Promise<any> | null = null;
function getJwtSecretKey(): Promise<any> {
  if (!jwtSecretKeyPromise) {
    const secret = Deno.env.get("JWT_SECRET");
    if (!secret) {
      // Fail loudly rather than silently accepting every token: a missing
      // JWT_SECRET means this container is misconfigured (see
      // deploy/selfhosted-supabase/docker-compose.yml's `functions` service
      // env block, which sets it from the stack's `.env`).
      jwtSecretKeyPromise = null;
      throw new Error("JWT_SECRET is not configured for the functions container");
    }
    jwtSecretKeyPromise = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
  }
  return jwtSecretKeyPromise;
}

async function verifyJwtSignature(req: Request): Promise<{ ok: boolean; error?: string }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { ok: false, error: "Missing Authorization header" };
  }

  const token = extractBearerToken(authHeader);
  if (!token) {
    return { ok: false, error: "Invalid Authorization header format" };
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return { ok: false, error: "Malformed JWT" };
  }
  const [headerB64, payloadB64, signatureB64] = parts;

  let header: any;
  let payload: any;
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64)));
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
  } catch {
    return { ok: false, error: "Malformed JWT" };
  }

  if (header?.alg !== "HS256") {
    return { ok: false, error: `Unsupported JWT algorithm '${header?.alg}'` };
  }

  let signature: Uint8Array;
  try {
    signature = base64UrlDecode(signatureB64);
  } catch {
    return { ok: false, error: "Malformed JWT signature" };
  }

  let key: any;
  try {
    key = await getJwtSecretKey();
  } catch (err) {
    console.error("[main/index.ts] JWT verification misconfigured:", err);
    return { ok: false, error: "Server misconfiguration" };
  }

  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const valid = await crypto.subtle.verify("HMAC", key, signature, signedData);
  if (!valid) {
    return { ok: false, error: "Invalid JWT signature" };
  }

  if (typeof payload?.exp === "number" && Date.now() >= payload.exp * 1000) {
    return { ok: false, error: "JWT expired" };
  }

  return { ok: true };
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  // `deploy/selfhosted-supabase/kong.yml`'s `functions-v1` route has
  // `strip_path: true` for its `/functions/v1/` path prefix, so by the time a
  // request reaches this router, Kong has already removed that prefix - a
  // request to `.../functions/v1/admin-reset-password` arrives here as just
  // `/admin-reset-password`, with no literal "functions" segment present at
  // all. The function name is therefore the FIRST path segment; this matches
  // Supabase's own documented self-hosted main-service router pattern, which
  // this project's Kong config was adapted from.
  //
  // A fallback for the unstripped `/functions/v1/<name>` shape is kept too
  // (defensive, e.g. local/manual testing against the function directly
  // without going through Kong), but it is not the shape Kong actually sends.
  const segments = url.pathname.split("/").filter(Boolean);
  const functionsIdx = segments.indexOf("functions");
  const name = functionsIdx >= 0 && segments.length > functionsIdx + 2
    ? segments[functionsIdx + 2]
    : (segments.length > 0 ? segments[0] : null);

  if (!name) {
    return new Response(
      JSON.stringify({ error: "Could not determine target function from path" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Default true (Supabase's own platform default) when the map has no
  // entry - matches production's behavior for any function not explicitly
  // exempted in config.toml.
  const requiresJwt = VERIFY_JWT_MAP[name] !== false;

  if (requiresJwt) {
    const { ok, error } = await verifyJwtSignature(req);
    if (!ok) {
      return new Response(
        JSON.stringify({ error: error || "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  // Distinguish "not registered at all" (a clean 404 - this name simply
  // isn't in this batch, or doesn't exist) from "registered but failed to
  // import/capture" (a 500, logged - see Finding 3). Checking
  // `FUNCTION_IMPORTERS` directly here, before ever calling `getHandler`,
  // is what makes that distinction possible: any exception out of
  // `getHandler` from this point on means the importer existed but the
  // import itself is broken.
  if (!FUNCTION_IMPORTERS[name]) {
    return new Response(
      JSON.stringify({ error: `Function '${name}' not found` }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  let handler: Handler | null;
  try {
    handler = await getHandler(name);
  } catch (err) {
    // The old version of this catch block discarded `err` entirely and
    // always returned a generic 404, indistinguishable from "this function
    // name isn't in the map at all". Now that case is handled above, so
    // reaching here always means the importer existed but importing/
    // evaluating its module threw - log the real error for `docker logs`
    // and return 500, not 404.
    console.error(`[main/index.ts] Failed to load function '${name}':`, err);
    return new Response(
      JSON.stringify({ error: `Function '${name}' failed to load` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!handler) {
    console.error(
      `[main/index.ts] Function '${name}' did not register a handler via Deno.serve` +
        " (or a previous attempt failed and was cached - see earlier logs)",
    );
    return new Response(
      JSON.stringify({ error: `Function '${name}' did not register a handler via Deno.serve` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    return await handler(req);
  } catch (err) {
    console.error(`[main/index.ts] Handler for '${name}' threw:`, err);
    return new Response(
      JSON.stringify({ error: `Function '${name}' failed` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
