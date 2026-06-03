// Phase 7 UIM Step 8.1 — yoga GraphQL handler mount.
//
// Mounts the yoga handler at /api/v1/uim/graphql/v2 alongside the
// 4b.10 shim at /api/v1/uim/graphql. After 8.6 caller audit + 8.7
// cleanup, /v2 renames to / and this file becomes the canonical
// graphql.routes.ts.

import { Router } from 'express';

import { yoga } from '../graphql/server.js';

const router = Router();

// Yoga handles both GET (introspection / GraphiQL in dev) and POST
// (queries). It expects to own the request/response cycle so we
// hand it both methods at the same path.
router.all('/v1/uim/graphql/v2', async (req, res) => {
  // graphql-yoga is a fetch-style handler; the express adapter is
  // a thin shim provided by yoga itself.
  // See: https://the-guild.dev/graphql/yoga-server/docs/integrations/integration-with-express
  await yoga.handle(req, res);
});

export default router;
