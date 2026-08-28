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
import { requireAuth } from "../_shared/auth.ts";
import { VERIFY_JWT_MAP } from "./verify_jwt_map.ts";
import { FUNCTION_IMPORTERS } from "./function_importers.ts";

// @ts-ignore
declare const Deno: any;

type Handler = (req: Request) => Response | Promise<Response>;

const handlerCache = new Map<string, Handler>();

// Promise-chained lock serializing the shim-import-restore critical section
// across ALL functions. See header comment for why this must be global
// rather than per-function.
let importLock: Promise<unknown> = Promise.resolve();

async function getHandler(name: string): Promise<Handler | null> {
  const cached = handlerCache.get(name);
  if (cached) return cached;

  // Chain onto the global lock so only one capture (for any function) runs
  // at a time. Concurrent requests for the SAME function will each chain
  // their own `attempt` here, but the re-check below after acquiring the
  // lock means only the first one actually imports; the rest just read the
  // cache that first one populated.
  const attempt = importLock.then(async () => {
    // Re-check: another caller may have captured this function's handler
    // while we were waiting for the lock.
    const alreadyCached = handlerCache.get(name);
    if (alreadyCached) return alreadyCached;

    // Look up the static importer BEFORE touching Deno.serve at all - a name
    // with no registered importer (not in this batch, or simply unknown)
    // should fail the same way it would have failed at import time, without
    // installing/restoring the shim for nothing.
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
    } finally {
      // Always restore the real Deno.serve before releasing the lock, even
      // if the import threw - otherwise a failed import for one function
      // would leave the shim installed for whichever function's import
      // (or router request) runs next.
      Deno.serve = realServe;
    }

    if (captured) {
      handlerCache.set(name, captured);
    }
    return captured;
  });

  // Advance the lock to this attempt regardless of outcome, so a failed
  // capture doesn't poison the chain for later, unrelated function imports.
  importLock = attempt.catch(() => undefined);
  return attempt;
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
    const { user, error } = await requireAuth(req);
    if (error || !user) {
      return new Response(
        JSON.stringify({ error: error || "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  let handler: Handler | null;
  try {
    handler = await getHandler(name);
  } catch (_err) {
    return new Response(
      JSON.stringify({ error: `Function '${name}' not found or failed to load` }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!handler) {
    return new Response(
      JSON.stringify({ error: `Function '${name}' did not register a handler via Deno.serve` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  return handler(req);
});
