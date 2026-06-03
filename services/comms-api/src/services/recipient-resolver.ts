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
      // Phase 6 Step 37 — canonical party → email path: core.parties for
      // display_name, core.email_links + core.email_addresses for the
      // primary address. Replaces the pre-Phase-2 detour through
      // party.external_refs.legacy_contact_id → public.contacts which
      // (a) violates the Phase 2 Step 7 .from('contacts') ban and
      // (b) breaks for any party created post-Phase-2 cutover that
      // doesn't carry a legacy_contact_id pointer.
      //
      // Same address-resolution pattern as the do_not_contact consumer
      // (services/comms-api/src/services/do-not-contact-consumer.ts via
      // comms.upsert_do_not_contact_suppressions): if a party has a
      // suppression on an address, the dispatcher will fan out here
      // and the delivery worker's isSuppressed() check (Step 30) will
      // block the send — consistent end-to-end.

      const { data: party, error: partyErr } = await (this.supabase as any)
        .schema('core')
        .from('parties')
        .select('id, party_type, display_name')
        .eq('id', partyId)
        .maybeSingle();
      if (partyErr || !party) {
        logger.warn('recipient resolver: party not found', {
          partyId,
          error: partyErr?.message,
        });
        return [];
      }

      // Pick the primary email link if present; otherwise the most
      // recently linked one. is_primary DESC sorts true ahead of false.
      const { data: link, error: linkErr } = await (this.supabase as any)
        .schema('core')
        .from('email_links')
        .select('email_id, is_primary, role')
        .eq('subject_type', 'core.party')
        .eq('subject_id', partyId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (linkErr || !link?.email_id) {
        logger.info('recipient resolver: party has no linked email', {
          partyId,
          partyType: party.party_type,
          error: linkErr?.message,
        });
        return [];
      }

      const { data: emailRow, error: emailErr } = await (this.supabase as any)
        .schema('core')
        .from('email_addresses')
        .select('email')
        .eq('id', link.email_id)
        .maybeSingle();
      if (emailErr || !emailRow?.email) {
        logger.info('recipient resolver: email_addresses row missing for link', {
          partyId,
          emailId: link.email_id,
          error: emailErr?.message,
        });
        return [];
      }

      const recipients: ResolvedRecipient[] = [
        {
          userId: partyId,
          channel: 'email',
          address: emailRow.email as string,
          displayName: party.display_name || null,
        },
      ];

      // Phase 6 SMS slice — fan out to SMS too when the party has a
      // phone linked. Mirrors the email path: prefer is_primary, then
      // most-recently-linked. Missing phone is a silent skip (lots of
      // parties won't have one). E.164 column on core.phone_numbers
      // is what Twilio's API expects, so no normalisation needed.
      try {
        const { data: phoneLink } = await (this.supabase as any)
          .schema('core')
          .from('phone_links')
          .select('phone_id, is_primary')
          .eq('subject_type', 'core.party')
          .eq('subject_id', partyId)
          .order('is_primary', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const phoneId = (phoneLink as { phone_id?: string } | null)?.phone_id;
        if (phoneId) {
          const { data: phoneRow } = await (this.supabase as any)
            .schema('core')
            .from('phone_numbers')
            .select('e164, whatsapp_capable')
            .eq('id', phoneId)
            .maybeSingle();
          const e164 = (phoneRow as { e164?: string } | null)?.e164;
          if (e164 && /^\+[1-9][0-9]{6,14}$/.test(e164)) {
            recipients.push({
              userId: partyId,
              channel: 'sms',
              address: e164,
              displayName: party.display_name || null,
            });
            // Add a WhatsApp recipient too when the phone is flagged
            // capable. Operators flip this column per-phone (default
            // false) so the chain only runs for confirmed-opted-in
            // numbers. The Twilio WhatsApp provider returns
            // permanent=true on 63017 (number not on WhatsApp) so a
            // mis-flagged number costs at most one failed delivery,
            // not a retry loop.
            if ((phoneRow as { whatsapp_capable?: boolean } | null)?.whatsapp_capable === true) {
              recipients.push({
                userId: partyId,
                channel: 'whatsapp',
                address: e164,
                displayName: party.display_name || null,
              });
            }
          }
        }
      } catch (err) {
        // Don't let an SMS lookup failure starve the email delivery.
        logger.warn('recipient resolver: party phone lookup threw', {
          partyId,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      return recipients;
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
      const displayName = (data.user.user_metadata?.full_name as string) || null;
      const recipients: ResolvedRecipient[] = [
        // 'in_app' is always available — useNotifications.ts reads
        // markets.notifications directly without going through
        // comms.deliveries. Skipped here.
        {
          userId,
          channel: 'email',
          address: data.user.email as string,
          displayName,
        },
      ];

      // Add a push recipient per active device token. One delivery
      // row per token so a multi-device user gets the same intent on
      // every device; the dedup unique index in comms.deliveries
      // (tenant, notification, channel, address) tolerates this
      // because the address is the unique token.
      try {
        const { data: tokens } = await (this.supabase as any)
          .schema('markets')
          .from('push_tokens')
          .select('token, platform')
          .eq('user_id', userId)
          .eq('is_active', true)
          .limit(20);
        for (const t of ((tokens ?? []) as Array<{ token: string; platform: string | null }>)) {
          if (!t.token) continue;
          recipients.push({
            userId,
            channel: 'push',
            address: t.token,
            displayName,
          });
        }
      } catch (err) {
        // Don't let a push lookup failure starve the email delivery.
        logger.warn('recipient resolver: push token lookup threw', {
          userId,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      return recipients;
    } catch (err) {
      logger.warn('recipient resolver: user lookup threw', {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }
}
