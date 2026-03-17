import { logger } from '@/lib/logger';
import { PluginRegistry } from '@/services/plugins/PluginRegistry';

type ScopedDb = {
  from: (table: string, isGlobal?: boolean) => any;
};

type DomainPluginHook = 'beforeFetch' | 'afterFetch' | 'fetchError';

export class DomainQuotationIsolationService {
  async resolveQuoteIdsForDomain(scopedDb: ScopedDb, domainId: string): Promise<string[]> {
    const { data, error } = await scopedDb
      .from('quotation_domain', true)
      .select('quote_id')
      .eq('domain_id', domainId)
      .eq('is_active', true);

    if (error) {
      throw new Error(error.message || 'Failed to resolve domain quotation mapping');
    }

    return Array.from(new Set((data || []).map((row: any) => String(row.quote_id || '')).filter(Boolean)));
  }

  ensurePluginIsolation(domainCode: string): void {
    const plugin = PluginRegistry.getPluginByDomain(domainCode);
    if (!plugin) {
      throw new Error(`No quotation plugin is registered for ${domainCode}`);
    }
  }

  runPluginHook(domainCode: string, hook: DomainPluginHook, payload: Record<string, unknown>): void {
    const plugin = PluginRegistry.getPluginByDomain(domainCode) as any;
    if (!plugin) return;

    const hookNameMap: Record<DomainPluginHook, string> = {
      beforeFetch: 'onDomainQuotationBeforeFetch',
      afterFetch: 'onDomainQuotationAfterFetch',
      fetchError: 'onDomainQuotationError',
    };
    const handlerName = hookNameMap[hook];
    const handler = plugin?.[handlerName];
    if (typeof handler === 'function') {
      handler(payload);
    }

    logger.debug('[DomainQuotationIsolationService] plugin hook executed', {
      domainCode,
      hook,
      hasHandler: typeof handler === 'function',
      component: 'DomainQuotationIsolationService',
    });
  }
}
