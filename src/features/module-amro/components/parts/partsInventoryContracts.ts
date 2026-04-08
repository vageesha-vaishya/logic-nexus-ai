import type { PartInventoryRecord } from './mockPartsInventoryData';

export type PartsCatalogQuery = {
  page: number;
  pageSize: number;
  search?: string;
  status?: PartInventoryRecord['status'] | 'all';
  criticality?: PartInventoryRecord['criticality'] | 'all';
};

export type PartsCatalogResponse = {
  items: PartInventoryRecord[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  requestId?: string;
};

export type PartsCatalogError = {
  code: 'NETWORK' | 'VALIDATION' | 'UNAUTHORIZED' | 'SERVER' | 'UNKNOWN';
  message: string;
  requestId?: string;
};

export type PartsCatalogApi = {
  listParts: (query: PartsCatalogQuery) => Promise<PartsCatalogResponse>;
};

