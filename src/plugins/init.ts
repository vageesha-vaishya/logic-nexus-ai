import { PluginRegistry } from '../services/plugins/PluginRegistry';
import { LogisticsPlugin } from './logistics/LogisticsPlugin';
import { BankingPlugin } from './banking/BankingPlugin';
import { TradingPlugin } from './trading/TradingPlugin';
import { InsurancePlugin } from './insurance/InsurancePlugin';
import { CustomsPlugin } from './customs/CustomsPlugin';
import { TelecomPlugin } from './telecom/TelecomPlugin';
import { RealEstatePlugin } from './real_estate/RealEstatePlugin';
import { EcommercePlugin } from './ecommerce/EcommercePlugin';

/**
 * Initializes all registered plugins.
 * This should be called at application startup.
 */
export function initializePlugins() {
  console.log('[Plugins] Initializing plugins...');
  
  // Register Logistics Plugin
  const logisticsPlugin = new LogisticsPlugin();
  PluginRegistry.register(logisticsPlugin);

  // Register Banking Plugin
  const bankingPlugin = new BankingPlugin();
  PluginRegistry.register(bankingPlugin);

  // Register Trading Plugin
  const tradingPlugin = new TradingPlugin();
  PluginRegistry.register(tradingPlugin);

  // Register Insurance Plugin
  const insurancePlugin = new InsurancePlugin();
  PluginRegistry.register(insurancePlugin);

  // Register Customs Plugin
  const customsPlugin = new CustomsPlugin();
  PluginRegistry.register(customsPlugin);

  // Register Telecom Plugin
  const telecomPlugin = new TelecomPlugin();
  PluginRegistry.register(telecomPlugin);

  // Register Real Estate Plugin
  const realEstatePlugin = new RealEstatePlugin();
  PluginRegistry.register(realEstatePlugin);

  // Register E-commerce Plugin
  const ecommercePlugin = new EcommercePlugin();
  PluginRegistry.register(ecommercePlugin);
  
  console.log('[Plugins] Initialization complete.');
}
