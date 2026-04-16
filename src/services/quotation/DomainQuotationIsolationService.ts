import { logger } from '@/lib/logger';
import { PluginRegistry } from '@/services/plugins/PluginRegistry';

type ScopedDb = {
  from: (table: string, isGlobal?: boolean) => any;
};

type DomainPluginHook = 'beforeFetch' | 'afterFetch' | 'fetchError';
type DomainLifecycleHook = 'onDomainAssign' | 'onDomainRevoke' | 'onDomainSuspend' | 'onDomainResume';

type PluginConfigRecord = {
  json_settings?: Record<string, unknown> | null;
  config?: Record<string, unknown> | null;
  encrypted_secrets?: string | null;
};

type DomainPluginInstance = {
  key: string;
  domainId: string;
  domainCode: string;
  plugin: any;
  memorySpace: Map<string, unknown>;
  configContext: Record<string, unknown>;
  dataStore: Map<string, unknown>;
  status: 'active' | 'suspended' | 'revoked';
  startedAt: string;
};

export class DomainQuotationIsolationService {
  private readonly isolatedInstances = new Map<string, DomainPluginInstance>();

  private domainKey(domainId: string, domainCode: string): string {
    return `${String(domainId || '').trim()}:${String(domainCode || '').trim().toUpperCase()}`;
  }

  private async loadDomainPluginConfig(
    scopedDb: ScopedDb,
    domainId: string,
    pluginName: string,
  ): Promise<Record<string, unknown>> {
    const { data, error } = await scopedDb
      .from('domain_config', true)
      .select('json_settings, config, encrypted_secrets')
      .eq('domain_id', domainId)
      .eq('plugin_name', pluginName.toUpperCase())
      .eq('environment', 'prod')
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.warn('[DomainQuotationIsolationService] failed to load domain plugin config', {
        domainId,
        pluginName,
        message: error.message || 'unknown',
      });
      return {};
    }

    const row = (data || {}) as PluginConfigRecord;
    const mergedConfig = row.json_settings || row.config || {};
    return {
      ...mergedConfig,
      encryptedSecrets: row.encrypted_secrets || null,
    };
  }

  private getLifecycleHandler(plugin: any, hook: DomainLifecycleHook): ((payload: Record<string, unknown>) => void) | null {
    const handler = plugin?.[hook];
    return typeof handler === 'function' ? handler : null;
  }

  private getHookHandlerName(hook: DomainPluginHook): string {
    const hookNameMap: Record<DomainPluginHook, string> = {
      beforeFetch: 'onDomainQuotationBeforeFetch',
      afterFetch: 'onDomainQuotationAfterFetch',
      fetchError: 'onDomainQuotationError',
    };
    return hookNameMap[hook];
  }

  private invokeLifecycleHook(plugin: any, hook: DomainLifecycleHook, payload: Record<string, unknown>): void {
    const handler = this.getLifecycleHandler(plugin, hook);
    if (handler) {
      handler(payload);
    }
  }

  private spawnIsolatedInstance(
    domainId: string,
    domainCode: string,
    plugin: any,
    configContext: Record<string, unknown>,
  ): DomainPluginInstance {
    const key = this.domainKey(domainId, domainCode);
    const existing = this.isolatedInstances.get(key);
    if (existing && existing.status !== 'revoked') {
      existing.status = 'active';
      existing.configContext = { ...existing.configContext, ...configContext };
      return existing;
    }

    const instance: DomainPluginInstance = {
      key,
      domainId,
      domainCode: String(domainCode).toUpperCase(),
      plugin,
      memorySpace: new Map<string, unknown>(),
      configContext: { ...configContext },
      dataStore: new Map<string, unknown>(),
      status: 'active',
      startedAt: new Date().toISOString(),
    };
    this.isolatedInstances.set(key, instance);
    return instance;
  }

  async resolveQuoteIdsForDomain(scopedDb: ScopedDb, domainId: string): Promise<string[]> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!domainId || !uuidRegex.test(domainId)) {
      logger.warn('[DomainQuotationIsolationService] Invalid domainId (not a UUID), skipping resolution', { domainId });
      return [];
    }

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

  ensurePluginIsolation(domainCode: string, domainId?: string): void {
    const plugin = PluginRegistry.getPluginByDomain(domainCode);
    if (!plugin) {
      throw new Error(`No quotation plugin is registered for ${domainCode}`);
    }
    if (domainId) {
      this.spawnIsolatedInstance(domainId, domainCode, plugin, {});
    }
  }

  async onDomainAssign(
    scopedDb: ScopedDb,
    payload: { domainId: string; domainCode: string; assignedBy?: string; tenantId?: string | null },
  ): Promise<void> {
    const plugin = PluginRegistry.getPluginByDomain(payload.domainCode);
    if (!plugin) {
      throw new Error(`No quotation plugin is registered for ${payload.domainCode}`);
    }
    const configContext = await this.loadDomainPluginConfig(scopedDb, payload.domainId, payload.domainCode);
    const instance = this.spawnIsolatedInstance(payload.domainId, payload.domainCode, plugin, configContext);
    this.invokeLifecycleHook(plugin, 'onDomainAssign', {
      domainId: payload.domainId,
      domainCode: payload.domainCode,
      tenantId: payload.tenantId || null,
      assignedBy: payload.assignedBy || null,
      configContext: instance.configContext,
      startedAt: instance.startedAt,
    });
  }

  onDomainRevoke(payload: { domainId: string; domainCode: string; revokedBy?: string; tenantId?: string | null }): void {
    const key = this.domainKey(payload.domainId, payload.domainCode);
    const instance = this.isolatedInstances.get(key);
    if (!instance) return;
    this.invokeLifecycleHook(instance.plugin, 'onDomainRevoke', {
      domainId: payload.domainId,
      domainCode: payload.domainCode,
      tenantId: payload.tenantId || null,
      revokedBy: payload.revokedBy || null,
      startedAt: instance.startedAt,
    });
    instance.memorySpace.clear();
    instance.dataStore.clear();
    instance.status = 'revoked';
    this.isolatedInstances.delete(key);
  }

  onDomainSuspend(payload: { domainId: string; domainCode: string; suspendedBy?: string; tenantId?: string | null }): void {
    const key = this.domainKey(payload.domainId, payload.domainCode);
    const instance = this.isolatedInstances.get(key);
    if (!instance) return;
    instance.status = 'suspended';
    this.invokeLifecycleHook(instance.plugin, 'onDomainSuspend', {
      domainId: payload.domainId,
      domainCode: payload.domainCode,
      tenantId: payload.tenantId || null,
      suspendedBy: payload.suspendedBy || null,
    });
  }

  onDomainResume(payload: { domainId: string; domainCode: string; resumedBy?: string; tenantId?: string | null }): void {
    const key = this.domainKey(payload.domainId, payload.domainCode);
    const instance = this.isolatedInstances.get(key);
    if (!instance) return;
    instance.status = 'active';
    this.invokeLifecycleHook(instance.plugin, 'onDomainResume', {
      domainId: payload.domainId,
      domainCode: payload.domainCode,
      tenantId: payload.tenantId || null,
      resumedBy: payload.resumedBy || null,
    });
  }

  getIsolatedInstanceState(domainId: string, domainCode: string): {
    isActive: boolean;
    isSuspended: boolean;
    hasInstance: boolean;
  } {
    const instance = this.isolatedInstances.get(this.domainKey(domainId, domainCode));
    return {
      hasInstance: Boolean(instance),
      isActive: instance?.status === 'active',
      isSuspended: instance?.status === 'suspended',
    };
  }

  runPluginHook(domainCode: string, hook: DomainPluginHook, payload: Record<string, unknown> & { domainId?: string }): void {
    const plugin = PluginRegistry.getPluginByDomain(domainCode) as any;
    if (!plugin) return;

    const handlerName = this.getHookHandlerName(hook);
    const handler = plugin?.[handlerName];
    if (payload?.domainId) {
      const key = this.domainKey(String(payload.domainId), domainCode);
      const instance = this.isolatedInstances.get(key);
      if (instance?.status === 'suspended') {
        return;
      }
      if (!instance) {
        this.spawnIsolatedInstance(String(payload.domainId), domainCode, plugin, {});
      }
    }
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
