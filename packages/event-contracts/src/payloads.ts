/**
 * TypeScript payload interfaces matching the JSON Schemas in ./schemas/.
 *
 * The JSON Schema files are the source of truth for the contract; these
 * TypeScript types mirror them for compile-time safety.
 *
 * When a new event is added: write the schema + this payload type + a test case.
 */

import type { ModuleName } from "./types.js";

export interface CoreTenantCreatedV1 {
  name: string;
  status: "trial" | "active";
  created_by_user_id: string;
  residency_region?: "ap-south-1" | "eu-west-1" | "us-east-1";
  plan_id?: string | null;
}

export interface CoreUserCreatedV1 {
  email: string;
  display_name: string;
  provisioning_kind: "self_signup" | "invited" | "sso_jit" | "admin_created";
  oauth_provider?: "google" | "microsoft" | null;
  invited_by_user_id?: string | null;
}

export interface CoreUserInvitedV1 {
  email: string;
  invited_by_user_id: string;
  role_id?: string | null;
  module_codes?: ModuleName[];
  expires_at: string;
}

export interface CorePartyCreatedV1 {
  party_type: "person" | "organization";
  display_name: string;
  legal_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  source_kind:
    | "sales_lead_conversion"
    | "self_signup"
    | "manual_create"
    | "import"
    | "integration_sync"
    | "logistics_party_promotion";
  source_id?: string | null;
}

export type PartyFieldDiff = { before: unknown; after: unknown };
export interface CorePartyUpdatedV1 {
  changes: Record<string, PartyFieldDiff>;
}

export interface CorePartyMergedV1 {
  merged_into_party_id: string;
  deprecated_party_ids: string[];
  merge_kind: "manual_human" | "ai_suggested_human_approved" | "import_dedup";
  merged_by_user_id: string | null;
  ai_invocation_id?: string | null;
}

export interface CorePartyDeletedV1 {
  soft_delete_at: string;
  hard_delete_eligible_at: string;
  requested_by_user_id?: string | null;
  reason: "user_request" | "tenant_admin_purge" | "compliance_purge" | "merge_consolidation";
  retention_class_override?: string | null;
}

export interface CoreMembershipGrantedV1 {
  user_id: string;
  role_id?: string | null;
  module_codes: ModuleName[];
  granted_by_user_id: string;
  granted_via?: "admin_ui" | "subscription_change" | "invitation_acceptance" | "sso_jit";
}

export interface CoreMembershipRevokedV1 {
  user_id: string;
  role_id?: string | null;
  module_codes: ModuleName[];
  revoked_by_user_id: string;
  reason:
    | "admin_action"
    | "subscription_downgrade"
    | "subscription_cancelled"
    | "tenant_suspended"
    | "policy_violation"
    | "user_left_tenant";
}

/**
 * Topic → payload-type lookup. Phase 0 covers only the 9 core events; business
 * module topics get added to this map as their outbox publishers go live.
 */
export interface TopicPayloadMap {
  "core.tenant.created": CoreTenantCreatedV1;
  "core.user.created": CoreUserCreatedV1;
  "core.user.invited": CoreUserInvitedV1;
  "core.party.created": CorePartyCreatedV1;
  "core.party.updated": CorePartyUpdatedV1;
  "core.party.merged": CorePartyMergedV1;
  "core.party.deleted": CorePartyDeletedV1;
  "core.membership.granted": CoreMembershipGrantedV1;
  "core.membership.revoked": CoreMembershipRevokedV1;
}

export type KnownTopic = keyof TopicPayloadMap;
