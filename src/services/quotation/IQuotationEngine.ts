
import { RequestContext, LineItem, QuoteResult, ValidationResult } from './types';

/**
 * Task 2.1: Define IQuotationEngine interface
 * This interface defines the contract for all domain-specific quotation engines.
 * Implementations (e.g., LogisticsQuotationEngine, BankingQuotationEngine) must adhere to this contract.
 */
export interface IQuotationEngine {
  /**
   * Calculates a quote based on the provided context and items.
   * @param context Contextual information (tenant, user, currency, etc.)
   * @param items List of items to quote
   * @returns Promise resolving to the quote result
   */
  calculate(context: RequestContext, items: LineItem[]): Promise<QuoteResult>;

  /**
   * Validates the request before calculation.
   * @param context Contextual information
   * @param items List of items to validate
   * @returns Validation result
   */
  validate(context: RequestContext, items: LineItem[]): Promise<ValidationResult>;
}
