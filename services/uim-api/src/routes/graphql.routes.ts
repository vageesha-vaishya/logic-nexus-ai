// Phase 7 UIM Step 8 — yoga GraphQL handler mount.
//
// Mounts the yoga handler at POST /api/v1/uim/graphql (GET for
// introspection / GraphiQL in dev). This is the canonical
// subgraph path. The 4b.10 substring-dispatcher shim was deleted
// in slice 8.7 after the callsite audit confirmed zero production
// callers — see docs/plans/2026-06-03-uim-graphql-step8-design.md
// §14a.

import { Router } from 'express';

import { yoga } from '../graphql/server.js';

const router = Router();

// Yoga handles both GET (introspection / GraphiQL in dev) and POST
// (queries). Single all() handler for the canonical path.
router.all('/v1/uim/graphql', async (req, res) => {
  await yoga.handle(req, res);
});

export default router;
