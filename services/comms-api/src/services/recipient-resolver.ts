// Phase 6 comms-api — recipient resolver.
//
// core.notifications carries polymorphic recipients (user / role / team).
// The dispatcher needs concrete addresses per channel. This resolver maps:
//
//   recipient_user_id  → 1 row in core.users → email + (later) phone +
//                        push tokens from comms.push_tokens
//   recipient_role_id  → users with that role in the tenant
//   recipient_team_id  → users in that team
//
// For Step 3 skeleton we only resolve recipient_user_id to email via
// auth.users.email. Role / team fan-out + per-user channel preference is
// the next slice. The plan calls out tenant-level + per-user delivery
// preferences (comms.md §5); those tables don't exist yet.

import { SupabaseClient } from '@supabase/supabase-js';

import { logger } from '../utils/logger.js';
import type {
  ChannelKind,
  NotificationIntent,
  ResolvedRecipient,
} from '../types/comms.types.js';

export class RecipientResolver {
  constructor(private supabase: SupabaseClient) {}

  async resolve(intent: NotificationIntent): Promise<ResolvedRecipient[]> {
    if (intent.recipient_user_id) {
      return this.resolveUser(intent.recipient_user_id);
    }
    if (intent.recipient_role_id || intent.recipient_team_id) {
      // Role/team fan-out — not in Step 3 skeleton. Return empty so the
      // dispatcher logs + skips rather than dropping into an inconsistent
      // state. A non-empty resolver arrives in the next slice once
      // user_roles + teams membership is queryable from here.
      logger.info('recipient resolver: role/team fan-out not implemented yet', {
        notificationId: intent.id,
        roleId: intent.recipient_role_id,
        teamId: intent.recipient_team_id,
      });
      return [];
    }
    return [];
  }

  private async resolveUser(userId: string): Promise<ResolvedRecipient[]> {
    try {
      const { data, error } = await (this.supabase as any).auth.admin.getUserById(userId);
      if (error || !data?.user?.email) {
        logger.warn('recipient resolver: user lookup failed', {
          userId,
          error: error?.message,
        });
        return [];
      }
      const channels: ChannelKind[] = ['email'];
      // 'in_app' is always available — useNotifications.ts reads markets.notifications
      // directly without a comms.deliveries delivery attempt. Skipped here.
      return channels.map((channel) => ({
        userId,
        channel,
        address: data.user.email as string,
        displayName: (data.user.user_metadata?.full_name as string) || null,
      }));
    } catch (err) {
      logger.warn('recipient resolver: user lookup threw', {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }
}
