// Phase 7 UIM Step 8.5 — integration health queries.

import { GraphQLError } from 'graphql';

import { builder } from '../builder.js';
import { IntegrationRef, type IntegrationRow } from '../types/integration.js';
import { DlqRetryableRowRef, type DlqRetryableRowShape } from '../types/dlq-row.js';

const INTEGRATION_SELECT =
  'id, tenant_id, vendor_name, vendor_code, kind, lifecycle_state, vendor_risk_class, config, created_at, updated_at';

builder.queryFields((t) => ({
  integrations: t.field({
    type: [IntegrationRef],
    description:
      'List integrations for the caller tenant. Ordered by vendor_name ASC.',
    args: {
      limit: t.arg.int({ defaultValue: 100 }),
      lifecycleState: t.arg.string({ required: false }),
    },
    resolve: async (_parent, args, ctx): Promise<IntegrationRow[]> => {
      const { tenantId, supabase } = ctx;
      const limitRaw = Number(args.limit ?? 100);
      const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 100, 1), 500);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = (supabase as any)
        .schema('uim')
        .from('integrations')
        .select(INTEGRATION_SELECT)
        .eq('tenant_id', tenantId)
        .order('vendor_name', { ascending: true })
        .limit(limit);
      if (args.lifecycleState) {
        query = query.eq('lifecycle_state', String(args.lifecycleState));
      }
      const { data, error } = await query;
      if (error) {
        throw new GraphQLError(`Failed to list integrations: ${error.message}`, {
          extensions: { code: 'UIM_INTEGRATIONS_LIST_ERROR' },
        });
      }
      return (data ?? []) as IntegrationRow[];
    },
  }),

  integration: t.field({
    type: IntegrationRef,
    nullable: true,
    description: 'Fetch a single integration by id, scoped to tenant.',
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: async (_parent, args, ctx): Promise<IntegrationRow | null> => {
      const { tenantId, supabase } = ctx;
      const id = String(args.id || '').trim();
      if (!id) {
        throw new GraphQLError('id is required', {
          extensions: { code: 'INVALID_REQUEST' },
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .schema('uim')
        .from('integrations')
        .select(INTEGRATION_SELECT)
        .eq('tenant_id', tenantId)
        .eq('id', id)
        .limit(1)
        .maybeSingle();
      if (error) {
        throw new GraphQLError(`Failed to fetch integration: ${error.message}`, {
          extensions: { code: 'UIM_INTEGRATION_FETCH_ERROR' },
        });
      }
      return (data as IntegrationRow | null) ?? null;
    },
  }),

  webhookDlqRetryable: t.field({
    type: [DlqRetryableRowRef],
    description:
      'DLQ rows whose backoff window has elapsed and which still have attempts left. Joined with their owning webhook_subscriptions.',
    args: {
      limit: t.arg.int({ defaultValue: 50 }),
    },
    resolve: async (_parent, args, ctx): Promise<DlqRetryableRowShape[]> => {
      const { tenantId, supabase } = ctx;
      const limitRaw = Number(args.limit ?? 50);
      const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 200);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .schema('uim')
        .from('v_dlq_retryable')
        .select(
          'id, tenant_id, subscription_id, target_url, attempts, max_attempts, first_failed_at, last_failed_at, ready_at, error',
        )
        .eq('tenant_id', tenantId)
        .order('first_failed_at', { ascending: true })
        .limit(limit);
      if (error) {
        throw new GraphQLError(`Failed to list DLQ retryable rows: ${error.message}`, {
          extensions: { code: 'UIM_DLQ_LIST_ERROR' },
        });
      }
      return (data ?? []) as DlqRetryableRowShape[];
    },
  }),
}));
