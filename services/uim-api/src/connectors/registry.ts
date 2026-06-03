// Phase 7 UIM Step 7.4 — connector registry.
//
// Maps uim.integrations.vendor → ConnectorAdapter
// implementation. The outbox dispatcher + inbound receiver look
// up the right adapter here rather than hard-coding per-vendor
// switches.
//
// To add a new connector:
//   1. Create services/uim-api/src/connectors/<vendor>/.adapter.ts.
//   2. Import it here and register in CONNECTOR_REGISTRY.
//   3. Insert a uim.integrations row with vendor='<vendor>'.

import type { ConnectorAdapter } from './types.js';
import { echoConnector } from './echo.adapter.js';

const CONNECTOR_REGISTRY: Record<string, ConnectorAdapter> = {
  [echoConnector.vendorCode]: echoConnector,
};

export function getConnector(vendorCode: string | null | undefined): ConnectorAdapter | null {
  if (!vendorCode) return null;
  return CONNECTOR_REGISTRY[vendorCode] ?? null;
}

export function listConnectors(): ConnectorAdapter[] {
  return Object.values(CONNECTOR_REGISTRY);
}
