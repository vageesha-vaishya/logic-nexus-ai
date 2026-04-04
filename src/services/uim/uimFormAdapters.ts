import type { UimNodeKey } from '@/modules/uim/forms/types';
import { uimApiRequest } from './uimApi';

export type UimEntityPayload = Record<string, unknown>;

export type UimEntityResponse = {
  id: string;
  output?: Record<string, unknown>;
  message?: string;
};

const endpointMap: Record<UimNodeKey, string> = {
  overview: '/forms/overview',
  'item-master': '/forms/item-master',
  'stock-ledger': '/forms/stock-ledger',
  reservations: '/forms/reservations',
  'issue-consume': '/forms/issue-consume',
  restock: '/forms/restock',
  locations: '/forms/locations',
  analytics: '/forms/analytics',
};

export async function createUimEntity(node: UimNodeKey, payload: UimEntityPayload): Promise<UimEntityResponse> {
  return uimApiRequest<UimEntityResponse, UimEntityPayload>({
    method: 'POST',
    path: endpointMap[node],
    body: payload,
  });
}

export async function listUimEntities(node: UimNodeKey, limit = 25, offset = 0): Promise<{
  output: {
    records: Array<Record<string, unknown>>;
    count: number;
    limit: number;
    offset: number;
    node_key: UimNodeKey;
  };
}> {
  return uimApiRequest({
    method: 'GET',
    path: `${endpointMap[node]}?limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(String(offset))}`,
  });
}

export async function getUimEntity(node: UimNodeKey, id: string): Promise<{
  output: Record<string, unknown>;
}> {
  return uimApiRequest({
    method: 'GET',
    path: `${endpointMap[node]}/${id}`,
  });
}

export async function updateUimEntity(
  node: UimNodeKey,
  id: string,
  payload: UimEntityPayload,
): Promise<UimEntityResponse> {
  return uimApiRequest<UimEntityResponse, UimEntityPayload>({
    method: 'PATCH',
    path: `${endpointMap[node]}/${id}`,
    body: payload,
  });
}

export async function deleteUimEntity(node: UimNodeKey, id: string): Promise<{
  id: string;
  message: string;
}> {
  return uimApiRequest({
    method: 'DELETE',
    path: `${endpointMap[node]}/${id}`,
  });
}
