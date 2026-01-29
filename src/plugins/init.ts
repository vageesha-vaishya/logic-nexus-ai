import { PluginRegistry } from '../services/plugins/PluginRegistry';
import { LogisticsPlugin } from './logistics/LogisticsPlugin';

/**
 * Initializes all registered plugins.
 * This should be called at application startup.
 */
export function initializePlugins() {
  console.log('[Plugins] Initializing plugins...');
  
  // Register Logistics Plugin
  const logisticsPlugin = new LogisticsPlugin();
  PluginRegistry.register(logisticsPlugin);
  
  console.log('[Plugins] Initialization complete.');
}
