import { IPlugin } from './IPlugin';
import { CoreQuoteService } from '../quotation/CoreQuoteService';

export class PluginRegistry {
  private static plugins: Map<string, IPlugin> = new Map();

  static register(plugin: IPlugin) {
    this.plugins.set(plugin.id, plugin);
    
    // Auto-register engine with CoreQuoteService
    // This bridges Phase 3 Plugins with Phase 2 CoreQuoteService
    if (plugin.domainCode) {
      CoreQuoteService.registerEngine(plugin.domainCode, plugin.getQuotationEngine());
    }
    
    console.log(`[PluginRegistry] Registered: ${plugin.name} (${plugin.id})`);
  }

  static getPlugin(id: string): IPlugin | undefined {
    return this.plugins.get(id);
  }

  static getAllPlugins(): IPlugin[] {
    return Array.from(this.plugins.values());
  }

  static getPluginByDomain(domainCode: string): IPlugin | undefined {
    return Array.from(this.plugins.values()).find(p => p.domainCode === domainCode);
  }
}
