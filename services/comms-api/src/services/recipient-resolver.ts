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
    if (intent.recipient_role_id) {
      // The platform doesn't carry a roles-as-table model — public.user_roles
      // stores role as an enum (tenant_admin | platform_admin | sales_manager |
      // user | viewer | franchise_admin | platform_domain_admin |
      // compliance_officer). The intent producer passes the desired role
      // name in payload.role_name; recipient_role_id is a stable marker
      // (any uuid the producer wants — typically gen_random_uuid()) that
      // keeps the CHECK constraint happy.
      const roleName = (intent.payload as Record<string, unknown> | null)?.['role_name'] as string | undefined;
      if (!roleName) {
        logger.info('recipient resolver: role fan-out skipped (payload.role_name not set)', {
          notificationId: intent.id,
          roleId: intent.recipient_role_id,
        });
        return [];
      }
      return this.resolveRole(intent.tenant_id, roleName);
    }
    if (intent.recipient_team_id) {
      // No teams/team_members table exists yet — drops cleanly.
      logger.info('recipient resolver: team fan-out unavailable (no teams table)', {
        notificationId: intent.id,
        teamId: intent.recipient_team_id,
      });
      return [];
    }
    return [];
  }

  private async resolveRole(tenantId: string, roleName: string): Promise<ResolvedRecipient[]> {
    try {
      // public.user_roles → set of user_ids with this role in the tenant.
      const { data: rows, error } = await (this.supabase as any)
        .from('user_roles')
        .select('user_id')
        .eq('tenant_id', tenantId)
        .eq('role', roleName);
      if (error || !rows?.length) {
        logger.info('recipient resolver: no users in role', {
          tenantId,
          roleName,
          error: error?.message,
          count: rows?.length ?? 0,
        });
        return [];
      }
      // De-duplicate user_ids (a user can hold the same role twice across
      // franchises) and resolve each to an email. resolveUser already
      // handles the auth.users lookup + WARN-on-miss.
      const uniqueIds = Array.from(new Set(rows.map((r: { user_id: string }) => r.user_id)));
      const resolved = await Promise.all(uniqueIds.map((id) => this.resolveUser(id as string)));
      return resolved.flat();
    } catch (err) {
      logger.warn('recipient resolver: role fan-out threw', {
        tenantId,
        roleName,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
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
