import { SupabaseClient } from '@supabase/supabase-js';
import { ScopedDataAccess } from '@/lib/db/access';

export interface QuoteGenerationStage {
  stage: string;
  elapsed_ms: number;
  option_count?: number;
  unknown_carrier_count?: number;
  route_gap_count?: number;
  details?: Record<string, unknown>;
}

export interface QuoteGenerationMetricPayload {
  tenant_id: string;
  user_id?: string;
  request_id: string;
  mode: string;
  smart_mode: boolean;
  duration_ms: number;
  total_options: number;
  issues_count: number;
  unknown_carrier_count: number;
  route_gap_count: number;
  status: 'success' | 'failure';
  error_message?: string;
  timeline: QuoteGenerationStage[];
}

export interface QuoteGenerationMetricSummary {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  avgDurationMs: number;
  p95DurationMs: number;
  p50DurationMs: number;
  averageOptions: number;
  unknownCarrierIncidents: number;
  routeGapIncidents: number;
}

export class HybridRouteMetricsService {
  constructor(private db: SupabaseClient | ScopedDataAccess) {}

  async record(payload: QuoteGenerationMetricPayload): Promise<void> {
    const { error } = await this.db.from('quote_generation_metrics').insert(payload);
    if (error) throw error;
  }

  async getSummary(tenantId: string, lookbackHours = 24): Promise<QuoteGenerationMetricSummary> {
    const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.db
      .from('quote_generation_metrics')
      .select('duration_ms, total_options, status, unknown_carrier_count, route_gap_count')
      .eq('tenant_id', tenantId)
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const rows = (data || []) as Array<{
      duration_ms?: number;
      total_options?: number;
      status?: string;
      unknown_carrier_count?: number;
      route_gap_count?: number;
    }>;

    if (rows.length === 0) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        successRate: 0,
        avgDurationMs: 0,
        p95DurationMs: 0,
        p50DurationMs: 0,
        averageOptions: 0,
        unknownCarrierIncidents: 0,
        routeGapIncidents: 0,
      };
    }

    const durations = rows.map((row) => Number(row.duration_ms || 0)).sort((a, b) => a - b);
    const p95Index = Math.max(0, Math.floor(durations.length * 0.95) - 1);
    const p50Index = Math.max(0, Math.floor(durations.length * 0.5) - 1);
    const successfulRequests = rows.filter((row) => row.status === 'success').length;
    const failedRequests = rows.length - successfulRequests;
    const durationTotal = durations.reduce((sum, value) => sum + value, 0);
    const optionsTotal = rows.reduce((sum, row) => sum + Number(row.total_options || 0), 0);
    const unknownCarrierIncidents = rows.reduce((sum, row) => sum + Number(row.unknown_carrier_count || 0), 0);
    const routeGapIncidents = rows.reduce((sum, row) => sum + Number(row.route_gap_count || 0), 0);

    return {
      totalRequests: rows.length,
      successfulRequests,
      failedRequests,
      successRate: Number(((successfulRequests / rows.length) * 100).toFixed(2)),
      avgDurationMs: Number((durationTotal / rows.length).toFixed(2)),
      p95DurationMs: Number(durations[p95Index]?.toFixed(2) || 0),
      p50DurationMs: Number(durations[p50Index]?.toFixed(2) || 0),
      averageOptions: Number((optionsTotal / rows.length).toFixed(2)),
      unknownCarrierIncidents,
      routeGapIncidents,
    };
  }
}
