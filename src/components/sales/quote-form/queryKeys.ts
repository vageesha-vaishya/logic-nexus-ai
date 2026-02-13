export const quoteKeys = {
  all: ['quote'] as const,
  lists: () => [...quoteKeys.all, 'list'] as const,
  list: (filters: string) => [...quoteKeys.lists(), { filters }] as const,
  details: () => [...quoteKeys.all, 'detail'] as const,
  detail: (id: string) => [...quoteKeys.details(), id] as const,
  
  // Reference Data
  reference: {
    all: ['reference'] as const,
    ports: () => [...quoteKeys.reference.all, 'ports'] as const,
    carriers: () => [...quoteKeys.reference.all, 'carriers'] as const,
    services: (tenantId?: string) => [...quoteKeys.reference.all, 'services', { tenantId }] as const,
    accounts: (tenantId?: string) => [...quoteKeys.reference.all, 'accounts', { tenantId }] as const,
    opportunities: (tenantId?: string) => [...quoteKeys.reference.all, 'opportunities', { tenantId }] as const,
    contacts: (tenantId?: string) => [...quoteKeys.reference.all, 'contacts', { tenantId }] as const,
    shippingTerms: () => [...quoteKeys.reference.all, 'shipping-terms'] as const,
  },

  // Quote hydration (loading existing quote for editing)
  hydration: (quoteId: string) => [...quoteKeys.all, 'hydration', quoteId] as const,
};
