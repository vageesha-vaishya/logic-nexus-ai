# MGL Legacy Lead Migration Design (Phase 0 Analysis + Execution Plan)

## Scope

This design covers migration planning for legacy MGL lead data from:

- `supabase/migrations/tempMGLData/MGL_Enquiry Data - Lead.csv`
- `supabase/migrations/tempMGLData/MGL_Enquiry Data - LeadRemark.csv`
- `supabase/migrations/tempMGLData/MGL_Enquiry Data - Opportunity.csv`
- `supabase/migrations/tempMGLData/MGL_Enquiry Data - OpportunityRemarks.csv`
- `supabase/migrations/tempMGLData/MGL_ContactList Account&Contact.csv`

Target platform:

- `logic-nexus-ai` Supabase backend
- Tenant scope: `Miami Global Lines`
- Tenant ID: `9e2686ba-ef3c-42df-aea6-dcc880436b9f`

This document is intentionally planning-only. No migration execution is included in this phase.

## Deep Analysis Findings

### 1) Current Target Schema Findings

From Supabase migrations:

- `public.leads` exists with multi-tenant controls, RLS, and relationships.
- Legacy-era required columns still include `first_name`, `last_name`, and tenant scoping.
- Canonical alignment also added CRM-friendly fields including:
  - `company_name`, `contact_name`, `job_position`, `priority`
  - Address fields and normalized phone checks/triggers
  - `company_name` and `contact_name` are enforced as non-null in canonical alignment migration
- `public.opportunities` includes `lead_id` foreign key to `public.leads(id)` and tenant scoping.
- `legacy_metadata` does not yet exist on `public.leads` and must be added.
- `public.accounts` and `public.contacts` do not include `legacy_json` and need additive JSONB columns for unmapped legacy fields.

### 2) Source File Profile (`MGL_Enquiry Data - Lead.xlsx`)

Sheet: `Lead Data`

- Rows: `2,494`
- Columns: `47`
- Source key candidates:
  - `EnquiryID` (high-fill, unique-like legacy identifier; one duplicate observed in profile)
  - `EnquiryNo` (high-fill, unique-like business key)

Data quality observations:

- String sentinel values are widely used: `NULL`, `NA`, `N/A`.
- Some low-value/noise columns are almost always empty.
- Fields with useful business signal:
  - `CompanyName`, `EnquiryDate`, `EnquiryNo`, `PortOfOrigin`, `PortOfDischarge`, `Department`, `Remarks`, `DelRemarks`, `EnquiryType`, `sourceofcontact`, `SitName`, `IsDeleted`, `isapproved_enq`.

`SitName` in legacy data is treated as franchise identity for LogicPro franchise-level assignment.
Required MGL franchises from source/business input:

- `MUMBAI (MUM)`
- `Sales & Marketing`
- `New Jersey (EWR)`
- `Inside Sales Group`
- `CAM`
- `Hamid Hussaini`
- `CAIRO (CAI)`
- `BHOPAL (BHO)`
- `Toronto`

### 2.1) Source File Profile (`MGL_Enquiry Data - LeadRemark.xlsx`)

Sheet: `Lead Remark Data`

- Rows: `1,417`
- Columns:
  - `EnquiryID`, `EnquiryNo`, `CompanyName`, `NextActionDate`, `Remarks`, `Type`, `CurrentDate`, `__EMPTY`, `__EMPTY_1`

Data interpretation for target model:

- This sheet is treated as legacy activity/note timeline.
- `CompanyName` maps to LogicPro account candidate (`public.accounts.name`).
- Parent lead linkage is primarily via `EnquiryID` / `EnquiryNo`.
- Franchise for remark records should be derived from lead mapping first; tenant is always MGL.
- `__EMPTY` and `__EMPTY_1` are ignored unless future samples reveal business meaning.

### 2.2) Source File Profile (`MGL_Enquiry Data - Opportunity.xlsx`)

Sheet: `Enquiry Data`

- Rows: `2,992`
- Columns with high migration value:
  - `EnquiryID`, `EnquiryNo`, `EnquiryDate`, `CompanyName`, `ShipmentMoveDate`
  - `PortOfOrigin`, `PortOfDischarge`, `NoOfContainer`, `EnquiryType`
  - `Remarks`, `Description`, `Department`, `DelRemarks`
  - `CreatedOn`, `ModifiedOn`, `IsDeleted`, `IsDraft`, `isapproved`
  - `SitName`, `OriginCountry`, `DestinationCountry`
  - `Class`, `UNNo`, `PackingType`, `HazRemarks`, `IsHaz`, `Hazweight`, `HazVolume`

Data interpretation for target model:

- This sheet is the primary source for `public.opportunities`.
- Each source row produces one opportunity and at least one `opportunity_items` row.
- `EnquiryID` is used as deterministic opportunity key; `EnquiryNo` is secondary business key.
- Franchise assignment follows `SitName` mapping under MGL tenant scope.

### 2.3) Source File Profile (`MGL_Enquiry Data - OpportunityRemarks.xlsx`)

Sheet: `Enquiry Remark Data`

- Rows: `194`
- Columns:
  - `EnquiryID`, `EnquiryNo`, `CompanyName`, `NextActionDate`, `Remarks`, `Type`, `CurrentDate`, `__EMPTY`, `__EMPTY_1`

Data interpretation for target model:

- This sheet is used for opportunity timeline transitions into `public.opportunity_probability_history`.
- Rows are linked to migrated opportunity by `EnquiryID`, fallback `EnquiryNo`.
- Stage/probability events are derived from `Type` + `Remarks` keyword heuristics in chronological order.
- `CurrentDate` is used as `changed_at`; fallback `NextActionDate`.

### 2.4) Source File Profile (`MGL_ContactList Account&Contact.xlsx`)

Sheet: `ContactList`

- Rows: `9,379`
- Columns: `57`
- Source key candidates:
  - `ContactID` (legacy unique-like identifier)
  - `CustomerCode` (legacy business/customer code)
  - `CompanyName` (account identity key)
- Columns with high migration value:
  - Account-level: `CustomerCode`, `CompanyName`, `TelNo`, `Address`, `Fax`, `WebSite`, `Email`, `ZipCode`, `CityName`, `StateName`, `CountryName`, `TaxID`, `sitename`, `ContCreatedOn`, `ContModifiedOn`, `IsActive`, `IsDeleted`
  - Contact-level: `ContactPerson`, `ContactPersonFirstName`, `ContactPersonLastName`, `Designation`, `MobNo`, `Email`, `Remarks`, `ContactCategoryID`, `sourceofcontact`, `Representative`, `CreatedByName`, `UpdatedByName`
  - Additional lineage and enrichment: `AccountNo`, `AccountDetail`, `CompanyGradation`, `CommodityList`, `BillTo`, `BillToCompanyName`, `BillToAddress`, `ContinentI`, `FilingDate`, `ITNNumber`, `IDNumber`, `IDNumberType`, `IRSNumber`, `SCAC`, `IATA`, `createdfrom`, `SiteId`, `EnquiryUrl`, `Flag`, `isapproved`

Data interpretation for target model:

- This sheet is the primary source for both `public.accounts` and `public.contacts`.
- Each row can upsert one account and one contact linked via `contacts.account_id`.
- Franchise assignment is derived from `sitename` under MGL tenant scope.
- Non-target columns and noncanonical values are preserved in `legacy_json`.

### 3) Key Constraint Implications for Migration

- All migrated rows must include `tenant_id` for MGL.
- Leads must be assigned at franchise level; `franchise_id` must resolve from `SitName` and point to an MGL franchise (`tenant_id = 9e2686ba-ef3c-42df-aea6-dcc880436b9f`).
- To avoid constraint failures across mixed schema evolution, migration payload should always populate:
  - `first_name` + `last_name` (safe fallback generation)
  - `company_name` + `contact_name` (canonical constraints)
- Phone values must survive E.164 normalization/checks or be set to `null`.
- For rerunnable migration, raw `insert` is unsafe; `upsert` strategy is required.
- `public.opportunity_items.product_name` and `line_number` are required; synthetic line derivation is mandatory when source lacks itemized products.
- `public.opportunity_probability_history.new_stage` must always be a valid `public.opportunity_stage` enum value.
- `public.contacts.first_name` and `public.contacts.last_name` are required and must use deterministic fallback generation when source person name is missing.
- Any non-mapped legacy account/contact fields must be persisted in `legacy_json`.

## Planned Schema Changes

Apply these changes before data migration:

```sql
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS legacy_metadata JSONB DEFAULT '{}'::jsonb;
```

```sql
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS legacy_json JSONB DEFAULT '{}'::jsonb;
```

```sql
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS legacy_json JSONB DEFAULT '{}'::jsonb;
```

## Migration Strategy

### Strategy A: Idempotent Parent Migration (Leads) with Deterministic IDs

Because legacy ID is not a dedicated physical column in `public.leads`, use deterministic UUID generation per legacy key and upsert on `id`.

Deterministic ID recipe:

- Namespace seed: fixed UUID constant for this migration
- Input key: `tenant_id + ':' + EnquiryID`
- Output: stable UUIDv5 for `leads.id`

Result:

- Re-running script updates same rows instead of creating duplicates.
- No additional schema column is required beyond `legacy_metadata`.

### Strategy B: Two-Pass Relational Migration

Pass 1:

- Migrate leads into `public.leads`
- Build mapping registry in memory and persisted artifact:
  - `legacyLeadId -> newLeadUuid`

Pass 2:

- Migrate opportunity-like data from later sheets/files
- Resolve `lead_id` via mapping registry
- If missing mapping, treat as orphan and log to orphan output

### Strategy C: Data Cleaning Rules

For each cell:

- `trim()` all strings
- Convert sentinel values (`NULL`, `N/A`, `NA`, empty string, `-`) to `null`
- Numeric parsing only when values are valid numbers
- Date parsing to ISO-compatible values; invalid date -> `null`

### Strategy D: Franchise Provisioning + Franchise-Level Lead Assignment

Before lead upsert:

- Upsert all required MGL franchises into `public.franchises`.
- Build `sitNameToFranchiseId` mapping from normalized `SitName` to `franchises.id`.
- Set `leads.franchise_id` from this mapping on every migrated lead.

Franchise provisioning rules:

- `tenant_id` for every seeded franchise must be MGL tenant ID.
- Use stable, deterministic franchise `code` values (globally unique), for example:
  - `MGL-MUMBAI-MUM`
  - `MGL-SALES-MARKETING`
  - `MGL-NEW-JERSEY-EWR`
  - `MGL-INSIDE-SALES-GROUP`
  - `MGL-CAM`
  - `MGL-HAMID-HUSSAINI`
  - `MGL-CAIRO-CAI`
  - `MGL-BHOPAL-BHO`
  - `MGL-TORONTO`

Unknown `SitName` handling:

- If `SitName` is missing/blank/unmapped, route to fallback franchise `MGL-SALES-MARKETING`.
- Preserve original `SitName` in `legacy_metadata.raw.SitName` for auditability.

### Strategy E: Account-First Then Leads Then Activities

Chosen execution order for this migration:

1. Upsert accounts from `Lead` + `LeadRemark` company names.
2. Upsert leads with strict tenant/franchise assignment.
3. Upsert activities from `LeadRemark` and attach:
   - `lead_id` via `EnquiryID`/`EnquiryNo` mapping registry
   - `account_id` via `CompanyName` mapping registry

Reason for this sequence:

- Reduces orphan account references in leads and activities.
- Keeps account ownership consistent under MGL tenant and franchise-aware scoping.
- Improves replay safety for multi-pass upsert runs.

Account provisioning and scoping rules:

- Tenant for all created accounts is always MGL (`9e2686ba-ef3c-42df-aea6-dcc880436b9f`).
- Franchise assignment preference:
  1. derive from mapped lead by `EnquiryID`/`EnquiryNo`
  2. derive from `SitName` map if available in source joins
  3. fallback `franchise_id = null` (tenant-level account under MGL) when franchise cannot be identified
- Account uniqueness for migration upsert:
  - deterministic `accounts.id` using `tenant_id + normalized(CompanyName)`
  - preserve original company text in `legacy_metadata` for traceability

### Strategy F: Opportunity Bundle Migration (`opportunities`, `opportunity_items`, `opportunity_probability_history`)

Execution order after leads/accounts:

1. Upsert opportunities from `Opportunity.xlsx`.
2. Upsert baseline opportunity items from same source.
3. Upsert probability history transitions from `OpportunityRemarks.xlsx`.

Deterministic IDs:

- `opportunities.id` <- UUIDv5(`tenant_id + ':opportunity:' + EnquiryID`)
- `opportunity_items.id` <- UUIDv5(`opportunity_id + ':line:' + line_number`)
- `opportunity_probability_history.id` <- UUIDv5(`opportunity_id + ':history:' + changed_at + ':' + sequence`)

Stage and probability derivation rules:

- Stage base mapping:
  - `IsDeleted = 1` -> `closed_lost`
  - `IsDraft = 1` -> `prospecting`
  - `isapproved = 1` -> `proposal`
  - otherwise -> `qualification`
- Probability defaults by stage:
  - `prospecting` -> `10`
  - `qualification` -> `25`
  - `needs_analysis` -> `40`
  - `value_proposition` -> `55`
  - `proposal` -> `70`
  - `negotiation` -> `85`
  - `closed_won` -> `100`
  - `closed_lost` -> `0`
- Opportunity remarks transition overrides:
  - text contains `quote`, `proposal` -> `proposal`
  - text contains `follow up`, `callback`, `revert` -> `qualification`
  - text contains `negotiat`, `rate discussion` -> `negotiation`
  - text contains `won`, `booked`, `confirmed` -> `closed_won`
  - text contains `lost`, `cancel`, `drop` -> `closed_lost`

### Strategy G: Account + Contact Bundle Migration (`accounts`, `contacts`) from `ContactList`

Execution order before lead/opportunity linkage:

1. Upsert accounts from normalized `CompanyName` + `CustomerCode`.
2. Upsert contacts from `ContactID` rows with resolved `account_id`.
3. Reuse `companyNameToAccountId` for lead/opportunity/account linkage.

Deterministic IDs:

- `accounts.id` <- UUIDv5(`tenant_id + ':account:' + normalized(CompanyName)`)
- `contacts.id` <- UUIDv5(`tenant_id + ':contact:' + ContactID`)

Account/contact dedupe and linkage rules:

- Account upsert conflict target is `id` from deterministic account key.
- Contact upsert conflict target is `id` from deterministic contact key.
- `contacts.account_id` is always resolved from migrated account map by normalized `CompanyName`.
- If `CompanyName` is missing for a row, skip contact upsert and log orphan in `orphans_contacts_missing_account.json`.

Contact fallback name rules:

- `first_name` <- `ContactPersonFirstName` when present, else first token of `ContactPerson`.
- `last_name` <- `ContactPersonLastName` when present, else remaining tokens of `ContactPerson`.
- If still missing, set `first_name = 'MGL'`, `last_name = 'Contact-' + ContactID`.

## Enterprise Migration Process Standards

### Governance and Control Standards

- Migration governance follows stage-gate approvals: design sign-off, dry-run sign-off, production-readiness sign-off, and final reconciliation sign-off.
- Every migration execution must have a unique `run_id` and immutable execution manifest that records source files, checksums, target tenant, operator, start/end timestamps, and migration version.
- Use additive-only schema evolution for migration support columns and keep rollback-safe scripts for all schema changes.
- Enforce strict non-breaking behavior: no destructive updates to existing APIs, UI workflows, or integration contracts during migration rollout.
- Keep tenant-franchise hierarchy guarantees (`Platform -> Admin -> Multi-Tenant -> Multi-Franchisee`) as mandatory acceptance criteria for each run.

### Logging and Audit Standards

- Maintain structured logs at five levels: `run`, `batch`, `record`, `orphan`, and `validation`.
- Required log fields for all entries: `run_id`, `phase`, `entity`, `tenant_id`, `franchise_id`, `source_file`, `source_sheet`, `legacy_key`, `target_id`, `status`, `error_code`, `error_message`, `attempt`, `timestamp`.
- Persist logs to migration artifacts with deterministic naming:
  - `migration_run_manifest_<run_id>.json`
  - `migration_batch_metrics_<run_id>.jsonl`
  - `migration_record_errors_<run_id>.jsonl`
  - `migration_orphans_<entity>_<run_id>.jsonl`
  - `migration_validation_report_<run_id>.json`
- Store reconciliation SQL outputs and row counts per table for audit replay and compliance verification.
- Mask or hash PII fields in operational logs when full values are not required for troubleshooting.

### Incremental Migration Standards

- Migration mode supports `full_initial` and `incremental_delta`.
- Incremental extraction watermark is based on source timestamps with fallback order:
  - `ContModifiedOn` / `ModifiedOn` / `CurrentDate` / `CreatedOn` / `EnquiryDate`
- Each successful run persists a watermark state per source file and sheet with:
  - `last_successful_watermark`
  - `last_processed_legacy_key`
  - `run_id`
  - `processed_row_count`
- Delta selection includes safety window overlap to handle late-arriving updates; dedupe remains guaranteed by deterministic IDs plus upsert.
- Incremental reruns are idempotent and can be replayed without row explosion through `upsert` on deterministic primary keys.

### Data Quality and Validation Standards

- Pre-load data quality checks:
  - mandatory key availability (`EnquiryID`, `EnquiryNo`, `ContactID`, `CompanyName`)
  - date parseability and timezone normalization
  - enum normalization and allowed-value checks
  - phone/email format normalization with null fallback
- Post-load checks include:
  - source vs target count reconciliation by entity and by franchise
  - duplicate detection by deterministic key and by legacy business key
  - FK integrity verification across leads/accounts/contacts/opportunities/items/history
  - stage-probability consistency and enum integrity
- Severity classification:
  - `P0`: tenant boundary violation, unauthorized cross-franchise linkage, destructive overwrite
  - `P1`: FK breakage, high orphan ratio, invalid enum insert
  - `P2`: optional-field data loss, normalization fallback usage

### Failure Handling and Recovery Standards

- Batch failures use bounded retries with exponential backoff and jitter.
- Poison records are isolated into error artifacts and excluded from blocking healthy records in the same run.
- Recovery is checkpoint-based using persisted watermark and batch progress metadata.
- Rollback strategy:
  - logical rollback via deterministic re-upsert of corrected records
  - targeted delete only for migration-tagged rows when explicitly approved
- Every failed run produces a corrective action list with root-cause category and replay instructions.

### Security and Compliance Standards

- Use service credentials only in controlled runtime; never store secrets in source artifacts.
- Enforce tenant and franchise scoping in every payload before write operations.
- Restrict migration execution to approved operators and maintain execution audit trail.
- Preserve lineage fields (`legacy_metadata` / `legacy_json`) for traceability and regulatory audits.

## Incremental Migration Process (Runbook)

1. Initialize `run_id` and write run manifest with source inventory and checksums.
2. Load last successful watermark state for each source sheet.
3. Extract delta rows using watermark + safety overlap.
4. Normalize and stage rows with deterministic IDs and dedupe keys.
5. Execute ordered upserts by dependency graph:
   - franchises -> accounts -> contacts -> leads -> activities -> opportunities -> opportunity_items -> opportunity_probability_history
6. Persist batch metrics and orphan/error artifacts continuously.
7. Run reconciliation and validation SQL pack.
8. If validations pass, commit watermark advancement and publish run summary.
9. If validations fail, freeze watermark advancement, publish failure report, and prepare replay plan.

## Rollback Process for Migrated Data

### Rollback Triggers

- Trigger rollback workflow for any `P0` event, unresolved `P1` integrity failure, or business-rejected reconciliation result.
- Trigger rollback workflow when tenant/franchise scope validation fails for any migrated entity.
- Trigger rollback workflow when migration run is marked `failed` after retry policy exhaustion.

### Rollback Scope Controls

- Rollback always targets migration-tagged rows only, scoped by:
  - `tenant_id = 9e2686ba-ef3c-42df-aea6-dcc880436b9f`
  - lineage markers in `legacy_metadata` or `legacy_json`
  - impacted `run_id` in migration artifacts
- Rollback does not delete non-migration business rows and does not perform broad table truncation.
- Rollback applies in reverse dependency order to protect FK integrity:
  - `opportunity_probability_history` -> `opportunity_items` -> `opportunities` -> `activities` -> `contacts` -> `leads` -> `accounts`

### Rollback Execution Procedure

1. Freeze incremental watermark advancement and mark run as `rollback_in_progress`.
2. Export pre-rollback snapshot counts by entity and franchise for audit evidence.
3. Build rollback candidate set from `run_id` and lineage predicates.
4. Perform dry-run rollback query with row counts and FK pre-checks.
5. Execute transactional targeted delete per entity in reverse dependency order.
6. Re-validate tenant/franchise isolation, FK integrity, and row counts after rollback.
7. Publish rollback report with deleted row counts, preserved row counts, and unresolved exceptions.
8. Reset run state to `ready_for_replay` and keep last successful watermark unchanged.

### Rollback Validation Gates

- Gate 1: post-rollback FK integrity must be `100%`.
- Gate 2: cross-tenant and cross-franchise leakage incidents must be `0`.
- Gate 3: row counts for unaffected entities must remain unchanged.
- Gate 4: rollback report and approval evidence must be attached before replay authorization.

### Replay After Rollback

- Replay starts from last successful watermark baseline, not from failed watermark.
- Replay requires corrected transformation rules or source fixes documented in corrective action register.
- Replay run must produce clean reconciliation and clear all blocking `P0`/`P1` conditions before cutover continuation.

## Operational KPI Dashboard Checklist

### Run Health KPIs

- Run completion status: `success` / `partial_success` / `failed` for each `run_id`.
- End-to-end run duration: monitor actual duration vs approved migration window.
- Throughput: rows processed per minute by entity (`accounts`, `contacts`, `leads`, `activities`, `opportunities`, `opportunity_items`, `opportunity_probability_history`).
- Retry intensity: retry count per batch and retry ratio per run.

### Data Integrity KPIs

- Upsert success ratio: successful records / attempted records per entity.
- Orphan ratio: orphan records / attempted records per entity with alerting on abnormal spikes.
- FK integrity score: `100%` expected for non-orphan inserted rows.
- Duplicate suppression ratio: duplicate legacy keys prevented by deterministic upsert.

### Data Quality KPIs

- Mandatory field conformance: percent of rows meeting required key and non-null rules.
- Enum conformance: percent of rows with valid enum values at insert time.
- Contact linkage quality: percent of contacts with valid `account_id` (excluding approved orphans).
- Normalization fallback rate: percent of rows requiring fallback parsing for names/phones/dates.

### Tenant and Franchise Isolation KPIs

- Tenant compliance: `100%` of inserted rows must have `tenant_id = 9e2686ba-ef3c-42df-aea6-dcc880436b9f`.
- Franchise compliance: `100%` of scoped rows must resolve to MGL-owned franchises only.
- Cross-tenant leakage incidents: required value is `0`.
- Cross-franchise unauthorized linkage incidents: required value is `0`.

### Incremental Delta KPIs

- Watermark lag: time difference between latest source update and last successful processed watermark.
- Delta freshness: elapsed time from source update to target visibility.
- Delta replay count: number of replayed incremental runs required for stable convergence.
- Late-arriving update capture rate: percent of overlap-window updates successfully absorbed.

### Alerts and Escalation Thresholds

- Critical (`P0`) alert triggers:
  - any tenant/franchise isolation breach
  - any destructive overwrite or unauthorized delete
  - any credential/security control violation
- High (`P1`) alert triggers:
  - FK integrity below `99.9%`
  - orphan ratio above approved threshold for an entity
  - repeated batch failures beyond retry policy
- Medium (`P2`) alert triggers:
  - normalization fallback rate above baseline
  - DQ conformance drift from dry-run benchmark

### Dashboard Review Cadence

- During run: review KPI dashboard every batch cycle and at each entity boundary.
- Post-run: publish run summary with KPI snapshot and exception register.
- Weekly during incremental phase: trend review of watermark lag, orphan ratio, and replay count.
- Phase exit requirement: no unresolved `P0`/`P1` exceptions and KPI trend stable for two consecutive cycles.

## Proposed Mapping (Current File Only)

This is initial mapping and will be extended when additional legacy sheets are provided.

### Lead Core Column Mapping

- `tenant_id` <- fixed MGL tenant UUID
- `franchise_id` <- lookup from `SitName` via `sitNameToFranchiseId` map
- `id` <- deterministic UUIDv5 from `EnquiryID`
- `first_name` <- `'MGL'` (fallback static for missing person-level names)
- `last_name` <- `EnquiryNo` or `EnquiryID` fallback
- `company` <- `CompanyName`
- `company_name` <- `CompanyName`
- `contact_name` <- `CompanyName` fallback or `'Unknown Contact'`
- `title` <- `Department` (temporary semantic mapping)
- `job_position` <- `Department` (if used)
- `status` <- derive from flags:
  - `IsDeleted = 1` -> `lost`
  - else `new`
- `source` <- mapped from `EnquiryType` / `sourceofcontact`:
  - email-like -> `email`
  - phone/telecall-like -> `phone`
  - otherwise -> `other`
- `description` <- compose short business context:
  - `PortOfOrigin -> PortOfDischarge`, `Department`, `ShipmentMoveDate`, `NoOfContainer`
- `notes` <- merged text from `Remarks` and `DelRemarks`
- `created_at` <- `CreatedOn` fallback `EnquiryDate`
- `updated_at` <- `ModifiedOn` fallback `CreatedOn`
- `legacy_metadata` <- full normalized raw row plus migration audit envelope

### Account Core Column Mapping

- `tenant_id` <- fixed MGL tenant UUID
- `franchise_id` <- derived from linked lead franchise when resolvable, else `null`
- `id` <- deterministic UUIDv5 from `tenant_id + normalized(CompanyName)`
- `name` <- `CompanyName`
- `account_type` <- `'prospect'`
- `status` <- `'active'`
- `description` <- `"Migrated from MGL legacy enquiry data"`
- `legacy_json` (if column exists) <- source lineage envelope including first seen `EnquiryNo`/`EnquiryID`

### Account + Contact Mapping (from `ContactList Account&Contact`)

Accounts mapping:

- `tenant_id` <- fixed MGL tenant UUID
- `franchise_id` <- lookup from `sitename` via `sitNameToFranchiseId`, fallback `MGL-SALES-MARKETING`
- `id` <- deterministic UUIDv5 from normalized `CompanyName`
- `name` <- `CompanyName`
- `account_number` <- `AccountNo` fallback `CustomerCode`
- `account_site` <- `SiteId`
- `status` <- derive from flags (`IsDeleted = 1` -> `inactive`, `IsActive = 1` -> `active`, else `pending`)
- `account_type` <- `'customer'` when `IsSepatraCustomer = 'Yes'`, else `'prospect'`
- `industry` <- `ContactCategoryID`
- `website` <- `WebSite`
- `phone` <- normalized `TelNo`
- `email` <- normalized `Email` when valid
- `fax` <- normalized `Fax`
- `tax_id` <- `TaxID`
- `billing_street` <- `Address`
- `billing_city` <- `CityName`
- `billing_state` <- `StateName`
- `billing_postal_code` <- `ZipCode`
- `billing_country` <- `CountryName`
- `shipping_street` <- `BillToAddress` fallback `Address`
- `shipping_city` <- `CityName`
- `shipping_state` <- `StateName`
- `shipping_postal_code` <- `ZipCode`
- `shipping_country` <- `CountryName`
- `description` <- merged `Remarks`, `AccountDetail`, `CommodityList`
- `created_at` <- `ContCreatedOn`
- `updated_at` <- `ContModifiedOn`
- `legacy_json` <- full normalized source row plus unmapped account-specific fields

Contacts mapping:

- `tenant_id` <- fixed MGL tenant UUID
- `franchise_id` <- lookup from `sitename` via `sitNameToFranchiseId`, fallback account franchise
- `id` <- deterministic UUIDv5 from `ContactID`
- `account_id` <- lookup from `companyNameToAccountId` using normalized `CompanyName`
- `first_name` <- `ContactPersonFirstName` fallback parsed first token from `ContactPerson` fallback `'MGL'`
- `last_name` <- `ContactPersonLastName` fallback parsed remainder of `ContactPerson` fallback `'Contact-' + ContactID`
- `title` <- `Designation`
- `email` <- normalized `Email` when valid
- `phone` <- normalized `TelNo`
- `mobile` <- normalized `MobNo`
- `notes` <- merged `Remarks`, `ContactCategoryID`, `CommodityList`, and `Representative`
- `department` <- `sitename`
- `lead_source` <- `sourceofcontact` fallback `createdfrom`
- `lifecycle_stage` <- `'customer'` when `isapproved = 1`, else `'lead'`
- `is_primary` <- `true` for first migrated contact per `account_id` with valid email/phone, else `false`
- `created_at` <- `ContCreatedOn`
- `updated_at` <- `ContModifiedOn`
- `legacy_json` <- full normalized source row plus unmapped contact-specific fields

Unmapped source fields preserved in `accounts.legacy_json` and/or `contacts.legacy_json`:

- `QBCustomerName`, `qbid`, `ContinentI`, `ITNNumber`, `IDNumber`, `IDNumberType`, `IRSNumber`, `FilingDate`, `SCAC`, `IATA`
- `Attachment`, `isSepatraPartner`, `SepatraCustomer`, `SepatraCustomerId`, `isconsolidatedreport`, `CompanyGradation`
- `BillTo`, `BillToCompanyName`, `EnquiryUrl`, `CreatedByName`, `UpdatedByName`, `Flag`

### Activity Core Column Mapping (from `LeadRemark`)

- `tenant_id` <- fixed MGL tenant UUID
- `franchise_id` <- linked lead franchise if lead match found, else account franchise if available, else `null`
- `lead_id` <- lookup by `EnquiryID` first, fallback `EnquiryNo`
- `account_id` <- lookup by normalized `CompanyName`
- `activity_type` <- `'note'` (default for remark timeline entries)
- `status` <- `'completed'` when `CurrentDate` exists else `'planned'`
- `priority` <- `'medium'`
- `subject` <- derived from `Type` with fallback `'Legacy Remark'`
- `description` <- `Remarks`
- `due_date` <- `NextActionDate`
- `completed_at` <- `CurrentDate` when status is completed
- `created_at` <- `CurrentDate` fallback `NextActionDate`
- `updated_at` <- `CurrentDate` fallback `created_at`
- Raw remark row and linkage keys are persisted in migration artifact logs for replay/audit

### Opportunity Core Column Mapping (from `Opportunity`)

- `tenant_id` <- fixed MGL tenant UUID
- `franchise_id` <- lookup from `SitName` via `sitNameToFranchiseId`, fallback `MGL-SALES-MARKETING`
- `id` <- deterministic UUIDv5 from `EnquiryID`
- `name` <- `EnquiryNo + ' - ' + CompanyName` fallback `EnquiryNo`
- `description` <- merged `Remarks`, `Description`, route (`PortOfOrigin -> PortOfDischarge`), and `Department`
- `stage` <- derived from `IsDeleted`, `IsDraft`, `isapproved`, and keyword hints in remarks
- `probability` <- derived from stage probability map
- `close_date` <- `ShipmentMoveDate` (date portion)
- `account_id` <- lookup from `companyNameToAccountId`
- `lead_id` <- lookup from `legacyLeadId/EnquiryNo -> lead_uuid`
- `lead_source` <- mapped from `EnquiryType` (`By Email` -> `email`, telecall/phone -> `phone`, otherwise `other`)
- `next_step` <- `DelRemarks` fallback `PickupRemark`
- `type` <- `Department`
- `forecast_category` <- derived (`closed_won`: `Commit`, `proposal/negotiation`: `Best Case`, others: `Pipeline`)
- `expected_revenue` <- `null` (not available in source)
- `created_at` <- `CreatedOn` fallback `EnquiryDate`
- `updated_at` <- `ModifiedOn` fallback `CreatedOn`
- `closed_at` <- `updated_at` when stage in (`closed_won`, `closed_lost`) else `null`
- `salesforce_opportunity_id` <- `null`
- `salesforce_sync_status` <- `'pending'`
- `salesforce_last_synced` <- `null`
- `salesforce_error` <- `null`
- `primary_quote_id` <- `null`

### Opportunity Items Column Mapping (from `Opportunity`)

- `opportunity_id` <- resolved migrated opportunity UUID
- `line_number` <- `1` (base line item)
- `product_name` <- `Department` fallback `'Freight Service'`
- `description` <- composed from `EnquiryType`, route, and hazmat fields (`Class`, `UNNo`, `PackingType`)
- `quantity` <- parsed `NoOfContainer` fallback `1`
- `unit_price` <- `0`
- `discount_percent` <- `0`
- `discount_amount` <- `0`
- `tax_amount` <- `0`
- `line_total` <- `0`
- `created_at` <- opportunity `created_at`
- `updated_at` <- opportunity `updated_at`

Optional second line:

- Create `line_number = 2` with `product_name = 'Hazardous Handling'` when `IsHaz = 1` or hazmat columns are present.
- `quantity` <- parsed `Hazweight` fallback `1`
- `unit_price` and `line_total` remain `0` pending commercial pricing source.

### Opportunity Probability History Mapping (from `OpportunityRemarks`)

- `opportunity_id` <- lookup by `EnquiryID`, fallback `EnquiryNo`
- `old_stage` <- previous derived stage in chronological sequence per opportunity
- `new_stage` <- derived from `Type` + `Remarks` keyword mapping
- `old_probability` <- previous probability in sequence
- `new_probability` <- stage-probability map output for `new_stage`
- `changed_by` <- `null`
- `changed_at` <- `CurrentDate` fallback `NextActionDate`
- One sequence is maintained per opportunity ordered by `changed_at`, then source row index.

### Legacy Metadata Envelope

Lead/opportunity/activity rows keep original source fields under `legacy_metadata`; account/contact rows keep original source fields under `legacy_json`. Envelope shape:

- `legacy_system`: `"MGL-legacy-enquiry"`
- `legacy_primary_key`: `EnquiryID`
- `legacy_business_key`: `EnquiryNo`
- `source_file`: original xlsx filename
- `source_sheet`: `Lead Data`
- `migrated_at`: runtime timestamp
- `raw`: all original columns (normalized)

## Upsert and Batch Plan

- Batch size: `500`
- API operation: `.upsert(batch, { onConflict: 'id' })`
- Selection feedback: request `id` and the preserved legacy key from metadata for map validation
- Retry:
  - per-batch bounded retry with exponential backoff
  - failed batch written to error artifact with row payload + error

## Orphan Management Plan (Opportunity + Child Data)

Opportunity-level orphan handling:

- If lead mapping is missing for opportunity row:
  - set `lead_id = null`
  - keep `account_id` and tenant/franchise scope intact
  - record orphan in `orphans_opportunity_lead.json`

Opportunity item orphan handling:

- If opportunity UUID cannot be resolved, skip item upsert and log source row in `orphans_opportunity_items.json`.

Probability history orphan handling:

- If opportunity UUID cannot be resolved from `EnquiryID`/`EnquiryNo`, skip history insert and log in `orphans_probability_history.json`.
- If stage inference fails, use fallback `new_stage = qualification`, `new_probability = 25`, and mark `inference_fallback = true` in orphan/audit artifacts.

## Step-by-Step Execution Plan

1. Pre-flight snapshot and backup strategy confirmation.
2. Run `ALTER TABLE` for `legacy_metadata` and `legacy_json`.
3. Build migration runtime config:
   - Supabase URL and service role key
   - fixed MGL tenant ID
   - deterministic UUID namespace
4. Upsert MGL franchises from approved `SitName` list and build `sitNameToFranchiseId` map.
5. Read `Lead Data`, `LeadRemark`, `Opportunity`, `OpportunityRemarks`, and `ContactList` sheets and normalize values.
6. Upsert accounts from merged company names in `Lead`, `LeadRemark`, and `ContactList` and build `companyNameToAccountId` map.
7. Transform and upsert contacts from `ContactList` with account linkage and `legacy_json`.
8. Persist contact orphan report (`missing_company`, `missing_account`) for reconciliation.
9. Transform and upsert leads payload + `legacy_metadata` (including `franchise_id`).
10. Persist lead mapping registry (`legacyLeadId/EnquiryNo -> lead_uuid`) to artifact file.
11. Transform and upsert activities from `LeadRemark` with lead/account linkage.
12. Persist activity orphan report (`missing_lead`, `missing_account`) for reconciliation.
13. Transform and upsert opportunities from `Opportunity` with lead/account/franchise linkage.
14. Transform and upsert `opportunity_items` baseline lines from `Opportunity`.
15. Transform and upsert `opportunity_probability_history` from `OpportunityRemarks`.
16. Persist opportunity orphan reports (`missing_lead`, `missing_opportunity`, `inference_fallback`) for reconciliation.
17. Run post-load validation queries:
   - total migrated rows for tenant
   - total migrated accounts for tenant
   - total migrated contacts for tenant
   - total migrated activities for tenant
   - total migrated opportunities for tenant
   - total migrated opportunity items
   - total migrated opportunity probability history rows
   - franchise distribution check by `franchise_id`
   - records with null `franchise_id` count (should be zero after fallback mapping)
   - duplicate check by legacy key in metadata
   - duplicate check by `ContactID` mapping in contacts
   - contact linkage check (`contacts.account_id` presence)
   - activity linkage check (`lead_id` and/or `account_id` presence)
   - opportunity linkage check (`lead_id` and/or `account_id` presence)
   - probability history stage enum validity check
   - null/constraint audit
18. Prepare for quote-level synchronization once quote sheets are provided.
19. Execute downstream child migration using mapping registry with orphan logging.
20. Final reconciliation and migration sign-off report.

## Phase-wise Implementation Plan

### Phase 0: Governance and Readiness

- Confirm migration scope, ownership matrix, approval chain, and success criteria.
- Freeze source file versions for the run and capture checksums.
- Baseline target environment health, storage capacity, and RLS policy checks.
- Exit criteria: governance approvals complete and environment readiness report approved.

### Phase 1: Schema and Control Plane Preparation

- Apply additive schema changes for `legacy_metadata` and `legacy_json`.
- Define run manifest format, watermark format, and artifact naming conventions.
- Prepare franchise master map for MGL and fallback handling.
- Exit criteria: schema verified, controls documented, and dry-run config approved.

Phase 1 execution started deliverables:

- Schema migration artifact prepared for additive columns in:
  - `public.leads.legacy_metadata`
  - `public.accounts.legacy_json`
  - `public.contacts.legacy_json`
- Run manifest format for execution:
  - `run_id`, `migration_version`, `mode`, `tenant_id`, `operator_id`, `started_at`, `finished_at`, `status`
  - `source_files[]` with `file_name`, `sheet_name`, `checksum_sha256`, `row_count`
  - `artifacts` pointers for metrics, errors, orphans, and validation reports
- Watermark format for incremental control:
  - `source_file`, `source_sheet`, `last_successful_watermark`, `last_processed_legacy_key`, `run_id`, `processed_row_count`, `updated_at`
- MGL franchise master map baseline:
  - `MUMBAI (MUM)` -> `MGL-MUMBAI-MUM`
  - `Sales & Marketing` -> `MGL-SALES-MARKETING`
  - `New Jersey (EWR)` -> `MGL-NEW-JERSEY-EWR`
  - `Inside Sales Group` -> `MGL-INSIDE-SALES-GROUP`
  - `CAM` -> `MGL-CAM`
  - `Hamid Hussaini` -> `MGL-HAMID-HUSSAINI`
  - `CAIRO (CAI)` -> `MGL-CAIRO-CAI`
  - `BHOPAL (BHO)` -> `MGL-BHOPAL-BHO`
  - `Toronto` -> `MGL-TORONTO`
  - fallback -> `MGL-SALES-MARKETING`

### Phase 2: Profiling and Data Quality Baseline

- Profile each source sheet for key completeness, null distribution, and duplicates.
- Produce baseline DQ report and threshold values for acceptable orphan/error rates.
- Finalize field-level mapping and normalization rule matrix.
- Exit criteria: DQ baseline signed off and mapping matrix locked for run.

### Phase 3: Dry Run in Staging

- Execute end-to-end full migration in staging with production-like config.
- Capture artifacts: manifests, batch metrics, orphan/error logs, and validation results.
- Tune transformation and retry rules based on dry-run findings.
- Exit criteria: no P0/P1 issues and reconciliation within accepted tolerance.

### Phase 4: Production Initial Full Load

- Execute full initial migration for MGL tenant under controlled change window.
- Monitor run-level KPIs: throughput, error rate, orphan rate, and FK integrity.
- Publish initial reconciliation report and unresolved issue register.
- Exit criteria: full-load sign-off with approved exception list.

### Phase 5: Incremental Delta Cycles

- Run incremental deltas using watermark process on agreed cadence.
- Validate net-new and changed records by entity and franchise.
- Maintain cumulative reconciliation dashboard across cycles.
- Exit criteria: stable incremental runs with repeatable success metrics.

### Phase 6: Business Validation and UAT

- Validate record usability in CRM modules for leads/accounts/contacts/opportunities.
- Perform franchise-level sampling with business owners.
- Confirm activity timeline continuity and opportunity stage history quality.
- Exit criteria: business acceptance from MGL stakeholders.

### Phase 7: Cutover and Hypercare

- Perform final pre-cutover delta and reconciliation.
- Announce cutover, enable operational usage, and start hypercare monitoring.
- Resolve residual P2 issues with controlled replay runs.
- Exit criteria: hypercare KPIs stable and no open critical defects.

### Phase 8: Closure and Audit Packaging

- Consolidate all run artifacts, validation reports, and approval evidence.
- Publish final migration closure report with lessons learned and replay cookbook.
- Archive watermark state and migration manifests for audit retention.
- Exit criteria: formal closure approval and audit package completed.

## Validation Checklist

- Tenant isolation:
  - every inserted row has `tenant_id = 9e2686ba-ef3c-42df-aea6-dcc880436b9f`
- Franchise isolation:
  - every inserted lead has `franchise_id` belonging to an MGL franchise
  - no lead mapped to franchise owned by another tenant
- Account tenancy:
  - every inserted account has MGL `tenant_id`
  - no account mapped to franchise owned by another tenant
- Contact tenancy and linkage:
  - every inserted contact has MGL `tenant_id`
  - no contact mapped to franchise owned by another tenant
  - every non-orphan contact has valid `account_id`
- Idempotency:
  - rerun does not increase row count unexpectedly
- Integrity:
  - no FK violations in opportunities pass
  - no FK violations in `opportunity_items.opportunity_id`
  - no FK violations in `opportunity_probability_history.opportunity_id`
  - no FK violations for activity `lead_id` / `account_id`
- Data quality:
  - no disallowed enum values
  - `opportunity_probability_history.new_stage` and `old_stage` must be valid enum values
  - no invalid E.164 phone values persisted
- Traceability:
  - every migrated lead row keeps old ID inside `legacy_metadata`
  - every migrated account/contact row keeps full legacy payload in `legacy_json`

## Extension Points for Next Data Sheets

When you provide additional legacy sheets, this design will be expanded with:

- Cross-sheet parent-child key map definitions
- Sheet-specific transformation matrices
- Lead/opportunity cross-linking heuristics
- Quote/opportunity synchronization rules
- Final reconciliation SQL pack
