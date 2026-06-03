// Phase 7 UIM Step 8.1 — uimHealth query.
//
// Static response — same shape as the 4b.10 shim. apiVersion now
// reads 'v1' (the /api/v1/uim/graphql path the v2 schema serves);
// the legacy shim also said 'v1' so this is a no-op for consumers.

import { builder } from '../builder.js';
import { UimHealthRef } from '../types/health.js';

const UIM_GRAPHQL_SUBGRAPH_PATH = '/api/v1/uim/contracts/uim-subgraph.graphql';

builder.queryFields((t) => ({
  uimHealth: t.field({
    type: UimHealthRef,
    description: 'Service health snapshot.',
    resolve: () => ({
      status: 'ok',
      apiVersion: 'v1',
      schemaPath: UIM_GRAPHQL_SUBGRAPH_PATH,
    }),
  }),
}));
