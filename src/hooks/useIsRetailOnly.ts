/**
 * useIsRetailOnly — true when the user's active membership is the
 * Sthira retail (SOS-RETAIL franchise) entry.
 *
 * Used by RetailAudienceGuard to block retail-only users from
 * navigating into CRM-flavored /dashboard/* routes. During membership
 * load this returns false (treat unknown as "not retail") so we never
 * block a B2B user mid-fetch.
 *
 * If the user holds multiple memberships (retail + a B2B tenant) the
 * answer reflects the *active* one — switching membership via
 * useMemberships().switchMembership() will flip this on the next render.
 */
import { useMemberships } from "./useMemberships";

export function useIsRetailOnly(): boolean {
  const { activeMembership } = useMemberships();
  return activeMembership?.is_retail ?? false;
}
