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
// immediately before dynamically importing a function's module. The
// function's own top-level `Deno.serve(...)` call hands its handler to the
// shim instead of starting a real server; the router then restores the real
// `Deno.serve` and calls the captured handler directly with the actual
// request. `Deno.serve` is resolved as a global at call time (not a
// module-level binding captured at import time), so the shim intercepts the
// call regardless of how many layers of function calls sit between module
// evaluation and the `Deno.serve(...)` statement (e.g. `serveWithLogger`
// calling it internally on behalf of its caller).
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
      await import(`../${name}/index.ts`);
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
  // Path arrives as /functions/v1/<name>[/...] from Kong; extract <name>.
  const segments = url.pathname.split("/").filter(Boolean);
  const functionsIdx = segments.indexOf("functions");
  const name = functionsIdx >= 0 && segments.length > functionsIdx + 2
    ? segments[functionsIdx + 2]
    : null;

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
