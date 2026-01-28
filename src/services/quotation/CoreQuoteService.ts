
import { DomainService } from '../DomainService';
import { IQuotationEngine } from './IQuotationEngine';
import { LogisticsQuotationEngine } from './engines/LogisticsQuotationEngine';
import { BankingQuotationEngine } from './engines/BankingQuotationEngine';
import { TelecomQuotationEngine } from './engines/TelecomQuotationEngine';
import { RequestContext, LineItem, QuoteResult, ValidationResult } from './types';

/**
 * Task 2.2: Implement CoreQuoteService
 * This service acts as the orchestrator, delegating quotation requests to the appropriate
 * domain-specific engine based on the tenant's platform domain.
 */
export class CoreQuoteService {
  private static engines: Map<string, IQuotationEngine> = new Map();

  static {
    // Register available engines
    // In a real microservices architecture, this might be dynamic discovery
    this.registerEngine('LOGISTICS', new LogisticsQuotationEngine());
    this.registerEngine('BANKING', new BankingQuotationEngine());
    this.registerEngine('TELECOM', new TelecomQuotationEngine());
  }

  /**
   * Registers an engine for a specific domain code.
   * @param domainCode The unique code for the domain (e.g., 'LOGISTICS')
   * @param engine The engine implementation
   */
  public static registerEngine(domainCode: string, engine: IQuotationEngine) {
    this.engines.set(domainCode.toUpperCase(), engine);
  }

  /**
   * Main entry point for calculating a quote.
   * Delegates to the appropriate engine based on the domainId in the context.
   */
  public static async calculate(context: RequestContext, items: LineItem[]): Promise<QuoteResult> {
    const engine = await this.resolveEngine(context.domainId);
    
    // First validate
    const validation = await engine.validate(context, items);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Then calculate
    return engine.calculate(context, items);
  }

  /**
   * Resolves the correct engine instance for a given domain ID.
   */
  private static async resolveEngine(domainId: string): Promise<IQuotationEngine> {
    // 1. Fetch the domain details to get the code
    // We assume the caller provides the domainId (from the tenant record)
    const domains = await DomainService.getAllDomains();
    const domain = domains.find(d => d.id === domainId);

    if (!domain) {
      throw new Error(`Domain with ID ${domainId} not found.`);
    }

    // 2. Look up the engine by code
    const engine = this.engines.get(domain.code.toUpperCase());

    if (!engine) {
      throw new Error(`No quotation engine registered for domain code: ${domain.code}`);
    }

    return engine;
  }
}
