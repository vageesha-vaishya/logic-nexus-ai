import type { ApiRequest, ApiResponse } from '@/pages/api/_utils/types';

export const UIM_SUBGRAPH_SCHEMA = `
schema {
  query: Query
}

type Query {
  uimHealth: UimHealth!
  uimProjectionItems(limit: Int = 50, offset: Int = 0): [UimProjectionItem!]!
  uimInventoryItem(id: ID!): UimInventoryItem
}

type UimHealth {
  status: String!
  apiVersion: String!
  schemaPath: String!
}

type UimProjectionItem {
  inventory_item_id: ID!
  projected_available_quantity: Float!
  projected_reserved_quantity: Float!
  projected_consumed_quantity: Float!
  replay_version: Float!
  updated_at: String!
}

type UimInventoryItem {
  id: ID!
  catalog_item_id: ID
  quantity: Float!
  status: String!
  location_id: String
  updated_at: String!
}
`.trim();

export default async function handler(_req: ApiRequest, res: ApiResponse) {
  res.setHeader('Content-Type', 'application/graphql; charset=utf-8');
  res.status(200).end(UIM_SUBGRAPH_SCHEMA);
}
