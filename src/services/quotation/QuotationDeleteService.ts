interface RpcCapableClient {
  rpc: (
    fn: string,
    params?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
}

export interface QuoteDeleteResultItem {
  quote_id: string;
  quote_number?: string;
  success: boolean;
  action: 'hard_deleted' | 'soft_deleted' | 'none';
  status_before?: string;
  status_after?: string;
  reason?: string;
  error?: string;
}

export interface QuoteDeleteSummary {
  requested: number;
  processed: number;
  hard_deleted: number;
  soft_deleted: number;
  failed: number;
  inventory_released: number;
  approvals_cancelled: number;
  cache_cleaned?: boolean;
}

export interface QuoteDeleteReport {
  ok: boolean;
  message: string;
  atomic_rolled_back: boolean;
  summary: QuoteDeleteSummary;
  results: QuoteDeleteResultItem[];
  stats: Array<{ tenant_id: string; status_counts: Record<string, number> }>;
}

export class QuotationDeleteService {
  constructor(private db: RpcCapableClient) {}

  private isMissingDetailedRpcError(error: unknown): boolean {
    const errorText =
      typeof error === 'string'
        ? error
        : error && typeof error === 'object'
        ? JSON.stringify(error)
        : '';

    return (
      errorText.includes('delete_quotes_cascade_detailed') &&
      errorText.includes('Could not find the function')
    );
  }

  async deleteQuotes(
    quoteIds: string[],
    reason?: string,
    options?: { forceHardDelete?: boolean; atomic?: boolean },
  ): Promise<QuoteDeleteReport> {
    const uniqueQuoteIds = Array.from(new Set(quoteIds.filter(Boolean)));
    if (uniqueQuoteIds.length === 0) {
      return {
        ok: true,
        message: 'No quotes selected',
        atomic_rolled_back: false,
        summary: {
          requested: 0,
          processed: 0,
          hard_deleted: 0,
          soft_deleted: 0,
          failed: 0,
          inventory_released: 0,
          approvals_cancelled: 0,
          cache_cleaned: false,
        },
        results: [],
        stats: [],
      };
    }

    const { data, error } = await this.db.rpc('delete_quotes_cascade_detailed', {
      p_quote_ids: uniqueQuoteIds,
      p_reason: reason || null,
      p_force_hard_delete: options?.forceHardDelete ?? false,
      p_atomic: options?.atomic ?? true,
    });

    if (error) {
      if (!this.isMissingDetailedRpcError(error)) {
        throw error;
      }

      const { error: legacyError } = await this.db.rpc('delete_quotes_cascade', {
        quote_ids: uniqueQuoteIds,
      });

      if (legacyError) {
        throw legacyError;
      }

      return {
        ok: true,
        message: 'Quotes processed successfully',
        atomic_rolled_back: false,
        summary: {
          requested: uniqueQuoteIds.length,
          processed: uniqueQuoteIds.length,
          hard_deleted: uniqueQuoteIds.length,
          soft_deleted: 0,
          failed: 0,
          inventory_released: 0,
          approvals_cancelled: 0,
          cache_cleaned: false,
        },
        results: uniqueQuoteIds.map((quoteId) => ({
          quote_id: quoteId,
          success: true,
          action: 'hard_deleted',
          reason: reason || 'Deleted via legacy cascade',
        })),
        stats: [],
      };
    }

    const report = (data || null) as QuoteDeleteReport | null;
    if (!report) {
      throw new Error('Quote deletion returned an empty response');
    }

    return report;
  }
}
