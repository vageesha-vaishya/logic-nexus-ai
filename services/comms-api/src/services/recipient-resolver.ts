// Phase 6 comms-api — recipient resolver.
//
// core.notifications carries polymorphic recipients (user / role / team /
// party / direct-address). The dispatcher needs concrete addresses per
// channel. This resolver maps:
//
//   recipient_user_id    → auth.users.email + (later) push tokens
//   recipient_address    → the literal address (Step 6 — customer-facing
//                          sends; the trigger resolved it at emit time)
//   recipient_party_id   → core.parties → primary email (Step 6 wires
//                          the column, bridge from parties to a real
//                          email is TODO; for now logged + skipped if
//                          recipient_address isn't co-set)
//   recipient_role_id    → users with that role (not yet)
//   recipient_team_id    → users in that team (not yet)

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
    // Step 6: direct address wins when present (the trigger pre-resolved it).
    // recipient_party_id may be co-set for traceability — we don't need to
    // round-trip through it when the address is already known.
    if (intent.recipient_address) {
      return [
        {
          userId: intent.recipient_party_id || intent.id,
          channel: 'email',
          address: intent.recipient_address,
          displayName: null,
        },
      ];
    }
    if (intent.recipient_user_id) {
      return this.resolveUser(intent.recipient_user_id);
    }
    if (intent.recipient_party_id) {
      return this.resolveParty(intent.recipient_party_id);
    }
    if (intent.recipient_role_id || intent.recipient_team_id) {
      logger.info('recipient resolver: role/team fan-out not implemented yet', {
        notificationId: intent.id,
        roleId: intent.recipient_role_id,
        teamId: intent.recipient_team_id,
      });
      return [];
    }
    return [];
  }

  private async resolveParty(partyId: string): Promise<ResolvedRecipient[]> {
    try {
      // core.parties.external_refs.legacy_contact_id → public.contacts.email
      // Backfilled + maintained by core.dual_write_from_contacts (Phase 6 Step 7).
      const { data: party, error: partyErr } = await (this.supabase as any)
        .schema('core')
        .from('parties')
        .select('id, party_type, external_refs, display_name')
        .eq('id', partyId)
        .maybeSingle();
      if (partyErr || !party) {
        logger.warn('recipient resolver: party not found', {
          partyId,
          error: partyErr?.message,
        });
        return [];
      }
      const legacyContactId = (party.external_refs as Record<string, unknown> | null)?.['legacy_contact_id'] as
        | string
        | undefined;
      if (!legacyContactId) {
        logger.info('recipient resolver: party has no legacy_contact_id', {
          partyId,
          partyType: party.party_type,
        });
        return [];
      }
      const { data: contact, error: contactErr } = await (this.supabase as any)
        .from('contacts')
        .select('email, first_name, last_name')
        .eq('id', legacyContactId)
        .maybeSingle();
      if (contactErr || !contact?.email) {
        logger.info('recipient resolver: contact has no email', {
          partyId,
          legacyContactId,
          error: contactErr?.message,
        });
        return [];
      }
      const displayName =
        [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || party.display_name || null;
      return [
        {
          userId: partyId,
          channel: 'email',
          address: contact.email as string,
          displayName,
        },
      ];
    } catch (err) {
      logger.warn('recipient resolver: party lookup threw', {
        partyId,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
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
