import { request as pwRequest } from '@playwright/test';
import { AUTH_STATE, resolveRoute, type PageDef, type ResolveContext } from '../pages';
import { readAccessToken, supabaseEnv } from './env';

// Resolved once per worker; dynamic routes (lead-detail) need the admin's access token.
const resolved = new Map<string, string>();

export async function routeFor(def: PageDef): Promise<string> {
  const hit = resolved.get(def.key);
  if (hit) return hit;
  const ctx: ResolveContext = {
    request: await pwRequest.newContext(),
    ...supabaseEnv(),
    accessToken: readAccessToken(AUTH_STATE),
  };
  const route = await resolveRoute(def, ctx);
  await ctx.request.dispose();
  resolved.set(def.key, route);
  return route;
}
