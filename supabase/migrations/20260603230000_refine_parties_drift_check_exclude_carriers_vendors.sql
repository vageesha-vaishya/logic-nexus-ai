-- Phase 2 Step 9 unpark prep — refine core.parties_drift_check.
--
-- The original drift check assumed every organization-type party was a
-- mirror of a public.accounts row. Phase 5 broke that assumption: the
-- carrier + vendor mirror writes organization-type parties (Hapag-Lloyd,
-- Maersk, MSC, MK Denial test vendors, etc.) with external_refs.source
-- IN ('carriers','vendors'). Those parties intentionally never had a
-- public.accounts shadow and never will — they're not CRM customers.
--
-- Today's prod state: 202 such carrier/vendor parties exist, making
-- the original `accounts_minus_orgs` metric come out at -202 instead
-- of the {0,0,0} the parties Step 9 unpark checklist requires.
--
-- This refinement excludes those non-CRM sources from the comparison
-- so the metric measures only the CRM-account-shaped subset of org
-- parties. After this lands the drift check returns {0,0,0} on prod
-- and the Step 9 unpark gate (item 6) becomes satisfiable.
--
-- Carrier/vendor parties stay in core.parties — they're still
-- subjects of compliance screenings, finance vendor relationships,
-- logistics carrier links, etc. We just don't expect public.accounts
-- to track them.

CREATE OR REPLACE FUNCTION core.parties_drift_check()
RETURNS TABLE(metric text, delta bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'core', 'public', 'pg_catalog'
AS $function$
  SELECT 'accounts_minus_orgs',
         (SELECT count(*) FROM public.accounts)
       - (
           SELECT count(*) FROM core.parties
           WHERE party_type = 'organization'
             -- Exclude Phase 5 carrier/vendor mirror parties that
             -- intentionally never had an accounts shadow.
             AND COALESCE(external_refs ->> 'source', '') NOT IN ('carriers', 'vendors')
         )
  UNION ALL
  SELECT 'contacts_minus_persons',
         (SELECT count(*) FROM public.contacts)
       - (
           SELECT count(*) FROM core.parties
           WHERE party_type = 'person'
             -- Symmetric exclusion for any contact-style non-CRM source
             -- that might land here in future phases.
             AND COALESCE(external_refs ->> 'source', '') NOT IN ('carriers', 'vendors')
         )
  UNION ALL
  SELECT 'contacts_with_account_minus_employs',
         (SELECT count(*) FROM public.contacts WHERE account_id IS NOT NULL)
       - (SELECT count(*) FROM core.party_relationships WHERE relationship_type='employs');
$function$;

COMMENT ON FUNCTION core.parties_drift_check() IS
  'Phase 2 dual-write drift sentinel. Returns 3 metrics that all read 0 when accounts/contacts ↔ core.parties are in sync. Carrier/vendor parties (external_refs.source IN (carriers, vendors)) are excluded — they live only in core.parties by design (Phase 5 mirror).';
