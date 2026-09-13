import fs from 'node:fs';
import { ROUTES_FILE, type PageDef } from '../pages';

// Dynamic routes are resolved once, in auth.setup.ts (with a fresh token), and
// read back here — no token, no network, so a late engine can't hit an expired JWT.
let routes: Record<string, string> | undefined;

export function routeFor(def: PageDef): string {
  if (typeof def.route === 'string') return def.route;
  if (!routes) {
    if (!fs.existsSync(ROUTES_FILE)) {
      throw new Error(`${ROUTES_FILE} not found; did auth.setup.ts run (--project=setup)?`);
    }
    routes = JSON.parse(fs.readFileSync(ROUTES_FILE, 'utf8')) as Record<string, string>;
  }
  const route = routes[def.key];
  if (!route) throw new Error(`No resolved route for "${def.key}" in ${ROUTES_FILE}; re-run auth.setup.ts.`);
  return route;
}
