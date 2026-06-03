// Phase 7 UIM Step 8.1 — yoga server handler.
//
// Exports an Express-compatible request handler that the routes
// layer mounts at POST /api/v1/uim/graphql/v2 during the Phase A
// migration window (per design doc §9). After 8.6 cutover, the
// shim deletes and this mount renames to /api/v1/uim/graphql.

import { createYoga } from 'graphql-yoga';
import { createClient } from '@supabase/supabase-js';

import { schema } from './schema.js';
import type { GraphQLContext } from './builder.js';
import { buildLoaders } from './loaders/index.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { GraphQLError } from 'graphql';

function getServiceRoleClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('uim-api requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

export const yoga = createYoga<{ req: AuthRequest }, GraphQLContext>({
  schema,
  graphqlEndpoint: '/api/v1/uim/graphql/v2',
  // Express CORS middleware is already applied by app.ts. Yoga
  // would otherwise emit duplicate CORS headers.
  cors: false,
  // The frontend posts queries with credentials; this matches
  // the existing REST routes' Access-Control-Allow-Credentials
  // posture (handled at the Express layer).
  context: ({ req }) => {
    const auth = req as AuthRequest;
    if (!auth.userId || !auth.tenantId) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHORIZED', status: 401 },
      });
    }
    const supabase = getServiceRoleClient();
    return {
      userId: auth.userId,
      tenantId: auth.tenantId,
      franchiseId: auth.franchiseId ?? null,
      supabase,
      loaders: buildLoaders({ supabase, tenantId: auth.tenantId }),
    };
  },
  // Loose introspection / playground default — auth middleware
  // already gates access, and depth/cost limits ship in slice 8.4.
  graphiql: process.env.NODE_ENV !== 'production',
  // Keep error messages informative — Pothos/yoga don't leak SQL
  // errors verbatim, our resolvers wrap their own DB errors with
  // GraphQLError + extensions.code.
  maskedErrors: false,
});
