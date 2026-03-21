# Technical Design & Implementation Plan: Safe Data Import
**Project:** Legacy MGL Data Integration into Logic Pro CRM  
**Target Environment:** `logic-nexus-ai` (Supabase Production)  
**Tenant:** Miami Global Lines (MGL) | `9e2686ba-ef3c-42df-aea6-dcc880436b9f`

---

## 1. Executive Summary & Core Philosophy
This document outlines the architecture for an **additive data import** of legacy records into the live Logic Pro system. Unlike a standard migration, this process prioritizes the integrity of the existing data, ensuring that no production records are overwritten or deleted.

### The "Zero-Interference" Mandate:
* **Immutability:** Existing production records must not be deleted, modified, or overwritten.
* **Structural Integrity:** No existing database rules, RLS policies, or application features will be altered.
* **Collision Avoidance:** If a legacy record matches a "Live" record (e.g., same Company Name or Email), the import for that row will be skipped to prevent data corruption.
* **Data Hygiene:** Legacy "noise" (e.g., 'N/A', 'NULL' strings) is removed at the ingestion layer.

---

## 2. Data Architecture
To accommodate historical data without cluttering the primary CRM interface, the schema utilizes JSONB "Legacy Containers."
## Scope

This design covers importing csv data related to lead, opportunity, account, and contact from:

- `supabase/migrations/tempMGLData/MGL_Enquiry Data - Lead.csv`
- `supabase/migrations/tempMGLData/MGL_Enquiry Data - LeadRemark.csv`
- `supabase/migrations/tempMGLData/MGL_Enquiry Data - Opportunity.csv`
- `supabase/migrations/tempMGLData/MGL_Enquiry Data - OpportunityRemarks.csv`
- `supabase/migrations/tempMGLData/MGL_ContactList Account&Contact.csv`

Target platform:

- `logic-nexus-ai` Supabase backend
- Tenant scope: `Miami Global Lines`
- Tenant ID: `9e2686ba-ef3c-42df-aea6-dcc880436b9f`

This document is intentionally planning-only. No import execution is included in this phase.

connectivity check:
PGCONNECT_TIMEOUT=10 /opt/homebrew/bin/psql -h aws-1-ap-south-1.pooler.supabase.com -p 6543 -U postgres.gzhxgoigflftharcmdqj -d postgres -c "SELECT 1"



### 2.1 Database Enhancements (Additive SQL)
These columns provide a landing zone for non-standard legacy fields while maintaining a clean primary UI.

```sql
-- 1. Create JSONB 'Safe Zones' for legacy attributes
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS legacy_json JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS legacy_json JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS legacy_json JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS legacy_json JSONB DEFAULT '{}'::jsonb;

-- 2. Add Traceability Tags
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS import_run_id TEXT;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS import_run_id TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS import_run_id TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS import_run_id TEXT;
```

---


## Deep Analysis Findings

### 1) Current Target Schema Findings

From Supabase import:

- `public.leads` exists with multi-tenant controls, RLS, and relationships.
- Legacy-era required columns still include `first_name`, `last_name`, and tenant scoping.
- Canonical alignment also added CRM-friendly fields including:
  - `company_name`, `contact_name`, `job_position`, `priority`
  - Address fields and normalized phone checks/triggers
  - `company_name` and `contact_name` are enforced as non-null in canonical alignment import
- `public.opportunities` includes `lead_id` foreign key to `public.leads(id)` and tenant scoping.
- `legacy_json` does not yet exist on `public.leads` and must be added.
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
- Columns with high import value:
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
- Rows are linked to imported opportunity by `EnquiryID`, fallback `EnquiryNo`.
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
- Columns with high import value:
  - Account-level: `CustomerCode`, `CompanyName`, `TelNo`, `Address`, `Fax`, `WebSite`, `Email`, `ZipCode`, `CityName`, `StateName`, `CountryName`, `TaxID`, `sitename`, `ContCreatedOn`, `ContModifiedOn`, `IsActive`, `IsDeleted`
  - Contact-level: `ContactPerson`, `ContactPersonFirstName`, `ContactPersonLastName`, `Designation`, `MobNo`, `Email`, `Remarks`, `ContactCategoryID`, `sourceofcontact`, `Representative`, `CreatedByName`, `UpdatedByName`
  - Additional lineage and enrichment: `AccountNo`, `AccountDetail`, `CompanyGradation`, `CommodityList`, `BillTo`, `BillToCompanyName`, `BillToAddress`, `ContinentI`, `FilingDate`, `ITNNumber`, `IDNumber`, `IDNumberType`, `IRSNumber`, `SCAC`, `IATA`, `createdfrom`, `SiteId`, `EnquiryUrl`, `Flag`, `isapproved`

Data interpretation for target model:

- This sheet is the primary source for both `public.accounts` and `public.contacts`.
- Each row can upsert one account and one contact linked via `contacts.account_id`.
- Franchise assignment is derived from `sitename` under MGL tenant scope.
- Non-target columns and noncanonical values are preserved in `legacy_json`.

### 3) Key Constraint Implications for Data import

- All imported rows must include `tenant_id` for MGL.
- Leads must be assigned at franchise level; `franchise_id` must resolve from `SitName` and point to an MGL franchise (`tenant_id = 9e2686ba-ef3c-42df-aea6-dcc880436b9f`).
- To avoid constraint failures across mixed schema evolution, import payload should always populate:
  - `first_name` + `last_name` (safe fallback generation)
  - `company_name` + `contact_name` (canonical constraints)
- Phone values must survive E.164 normalization/checks or be set to `null`.
- For rerunnable import, raw `insert` is unsafe; `upsert` strategy is required.
- `public.opportunity_items.product_name` and `line_number` are required; synthetic line derivation is mandatory when source lacks itemized products.
- `public.opportunity_probability_history.new_stage` must always be a valid `public.opportunity_stage` enum value.
- `public.contacts.first_name` and `public.contacts.last_name` are required and must use deterministic fallback generation when source person name is missing.
- Any non-mapped legacy account/contact fields must be persisted in `legacy_json`.



## 3. Data Cleansing & Transformation Logic
Before records are committed to the database, they pass through a validation pipeline.

| Category | Rule | Logic |
| :--- | :--- | :--- |
| **Sentinel Values** | Scrubbing | Convert `N/A`, `NA`, `NONE`, `0`, and `0000-00-00` to database `NULL`. |
| **Identity** | Determinism | Generate `id` using **UUIDv5** based on the legacy `EnquiryID`. This prevents duplicates on re-runs. |
| **Collision** | Skip-on-Match | If `company_name` (Account) or `email` (Contact) exists in live data, the record is flagged and skipped. |
| **Tenancy** | Hard-Isolation | Force `tenant_id = '9e2686ba-ef3c-42df-aea6-dcc880436b9f'` on every row. |

### Foreign Key Safety and Parent Auto-Provisioning

The import must be resilient to missing parent references while remaining additive and tenant-safe. When a child record references a parent that does not exist, the import creates a minimal, deterministic parent record within the same tenant scope and links the child to it. This avoids FK failures without overwriting existing data.

**Primary FK targets for this scope**

- `leads.account_id` → `accounts`
- `leads.contact_id` → `contacts`
- `opportunities.lead_id` → `leads`
- `opportunities.account_id` → `accounts`
- `opportunities.contact_id` → `contacts`
- `opportunity_items.opportunity_id` → `opportunities`
- `opportunity_probability_history.opportunity_id` → `opportunities`
- `contacts.account_id` → `accounts`

**Parent creation rules**

- Parent creation is only permitted within the MGL tenant (`tenant_id = 9e2686ba-ef3c-42df-aea6-dcc880436b9f`).
- Parent creation is deterministic and idempotent using the same UUIDv5 strategy used for normal upserts.
- Parent creation never overwrites an existing record; it only inserts if the deterministic key does not exist.
- A parent created due to missing FK is tagged with:
  - `import_run_id`
  - `legacy_json` or `legacy_json` containing the originating legacy key and reason: `created_for_missing_fk`.
- Parent creation must not cross franchise boundaries. If franchise is unknown, use `franchise_id = null` and preserve the source franchise hint in legacy metadata.

**Parent creation minimum fields**

- `accounts`: `id`, `tenant_id`, `name`, `import_run_id`, `legacy_json`
- `contacts`: `id`, `tenant_id`, `account_id`, `first_name`, `last_name`, `import_run_id`, `legacy_json`
- `leads`: `id`, `tenant_id`, `franchise_id`, `first_name`, `last_name`, `company_name`, `contact_name`, `import_run_id`, `legacy_json`
- `opportunities`: `id`, `tenant_id`, `lead_id`, `account_id`, `import_run_id`, `legacy_json`

**Conflict behavior**

- If a conflict is detected on a parent key but the existing parent is under a different tenant or franchise scope, the child record is quarantined into an orphan log and skipped for that run.

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
- Set `leads.franchise_id` from this mapping on every imported lead.

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
- Preserve original `SitName` in `legacy_json.raw.SitName` for auditability.

### Strategy E: Account-First Then Leads Then Activities

Chosen execution order for this import:

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
- Account uniqueness for import upsert:
  - deterministic `accounts.id` using `tenant_id + normalized(CompanyName)`
  - preserve original company text in `legacy_json` for traceability

### Strategy E.1: Parent Creation Workflow for Missing FKs

When a child row references a missing parent, resolve in the following order:

1. **Lookup by deterministic ID** from the legacy business key.
2. **Create minimal parent record** if the deterministic ID does not exist.
3. **Link child to newly created parent** and continue the import.

Priority for parent creation:

1. `accounts` for `contacts` or `leads`
2. `contacts` for `leads` or `opportunities`
3. `leads` for `opportunities`
4. `opportunities` for `opportunity_items` or `opportunity_probability_history`

This sequencing ensures FK readiness while preserving the zero-interference mandate.

### Strategy F: Opportunity Bundle import (`opportunities`, `opportunity_items`, `opportunity_probability_history`)

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

### Strategy G: Account + Contact Bundle import (`accounts`, `contacts`) from `ContactList`

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
- `contacts.account_id` is always resolved from imported account map by normalized `CompanyName`.
- If `CompanyName` is missing for a row, skip contact upsert and log orphan in `orphans_contacts_missing_account.json`.

Contact fallback name rules:

- `first_name` <- `ContactPersonFirstName` when present, else first token of `ContactPerson`.
- `last_name` <- `ContactPersonLastName` when present, else remaining tokens of `ContactPerson`.
- If still missing, set `first_name = 'MGL'`, `last_name = 'Contact-' + ContactID`.

### Strategy H: Contracts (if present in source)

If the source includes contract data, import follows the same FK-safe pattern:

- Contract parent references (`account_id`, `opportunity_id`, `contact_id`) must resolve before contract insert.
- If the parent is missing, create the parent using the minimal parent creation rules above.
- Contract records are tagged with `import_run_id` and legacy key metadata.
- Contract creation never overwrites an existing contract; it is strictly upsert-by-deterministic-key.

### Governance and Control Standards

- import data governance follows stage-gate approvals: design sign-off, dry-run sign-off, production-readiness sign-off, and final reconciliation sign-off.
- Every import execution must have a unique `run_id` and immutable execution manifest that records source files, checksums, target tenant, operator, start/end timestamps, and import version.
- Use additive-only schema evolution for import support columns and keep rollback-safe scripts for all data uploade. No schema changes allowed except adding json column
- Enforce strict non-breaking behavior: no destructive updates to existing APIs, UI workflows, or integration contracts during import . 
- Keep tenant-franchise hierarchy guarantees (`Platform -> Admin -> Multi-Tenant -> Multi-Franchisee`) as mandatory acceptance criteria for each run.

### Logging and Audit Standards

- Maintain structured logs at five levels: `run`, `batch`, `record`, `orphan`, and `validation`.
- Required log fields for all entries: `run_id`, `phase`, `entity`, `tenant_id`, `franchise_id`, `source_file`, `source_sheet`, `legacy_key`, `target_id`, `status`, `error_code`, `error_message`, `attempt`, `timestamp`.
- Persist logs to import artifacts with deterministic naming:
  - `import_run_manifest_<run_id>.json`
  - `import_batch_metrics_<run_id>.jsonl`
  - `import_record_errors_<run_id>.jsonl`
  - `import_orphans_<entity>_<run_id>.jsonl`
  - `import_validation_report_<run_id>.json`
- Store reconciliation SQL outputs and row counts per table for audit replay and compliance verification.
- Mask or hash PII fields in operational logs when full values are not required for troubleshooting.

---
### Incremental Import Standards

- Import mode supports `full_initial` and `incremental_delta`.
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
  - targeted delete only for import-tagged rows when explicitly approved
- Every failed run produces a corrective action list with root-cause category and replay instructions.

### Security and Compliance Standards

- Use service credentials only in controlled runtime; never store secrets in source artifacts.
- Enforce tenant and franchise scoping in every payload before write operations.
- Restrict import execution to approved operators and maintain execution audit trail.
- Preserve lineage fields (`legacy_json` / `legacy_json`) for traceability and regulatory audits.

## Incremental import Process (Runbook)

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

## Rollback Process for imported Data

### Rollback Triggers

- Trigger rollback workflow for any `P0` event, unresolved `P1` integrity failure, or business-rejected reconciliation result.
- Trigger rollback workflow when tenant/franchise scope validation fails for any imported entity.
- Trigger rollback workflow when import run is marked `failed` after retry policy exhaustion.

### Rollback Scope Controls

- Rollback always targets import-tagged rows only, scoped by:
  - `tenant_id = 9e2686ba-ef3c-42df-aea6-dcc880436b9f`
  - lineage markers in `legacy_json` or `legacy_json`
  - impacted `run_id` in import artifacts
- Rollback does not delete non-import business rows and does not perform broad table truncation.
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
- End-to-end run duration: monitor actual duration vs approved import window.
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
- `legacy_json` <- full normalized raw row plus import audit envelope

### Account Core Column Mapping

- `tenant_id` <- fixed MGL tenant UUID
- `franchise_id` <- derived from linked lead franchise when resolvable, else `null`
- `id` <- deterministic UUIDv5 from `tenant_id + normalized(CompanyName)`
- `name` <- `CompanyName`
- `account_type` <- `'prospect'`
- `status` <- `'active'`
- `description` <- `"imported from MGL legacy enquiry data"`
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
- `is_primary` <- `true` for first imported contact per `account_id` with valid email/phone, else `false`
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
- Raw remark row and linkage keys are persisted in import artifact logs for replay/audit

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

- `opportunity_id` <- resolved imported opportunity UUID
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

Lead/opportunity/activity rows keep original source fields under `legacy_json`; account/contact rows keep original source fields under `legacy_json`. Envelope shape:

- `legacy_system`: `"MGL-legacy-enquiry"`
- `legacy_primary_key`: `EnquiryID`
- `legacy_business_key`: `EnquiryNo`
- `source_file`: original xlsx filename
- `source_sheet`: `Lead Data`
- `imported_at`: runtime timestamp
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
2. Run `ALTER TABLE` for `legacy_json` and `legacy_json`.
3. Build import runtime config:
   - Supabase URL and service role key
   - fixed MGL tenant ID
   - deterministic UUID namespace
4. Upsert MGL franchises from approved `SitName` list and build `sitNameToFranchiseId` map.
5. Read `Lead Data`, `LeadRemark`, `Opportunity`, `OpportunityRemarks`, and `ContactList` sheets and normalize values.
6. Upsert accounts from merged company names in `Lead`, `LeadRemark`, and `ContactList` and build `companyNameToAccountId` map.
7. Transform and upsert contacts from `ContactList` with account linkage and `legacy_json`.
8. Persist contact orphan report (`missing_company`, `missing_account`) for reconciliation.
9. Transform and upsert leads payload + `legacy_json` (including `franchise_id`).
10. Persist lead mapping registry (`legacyLeadId/EnquiryNo -> lead_uuid`) to artifact file.
11. Transform and upsert activities from `LeadRemark` with lead/account linkage.
12. Persist activity orphan report (`missing_lead`, `missing_account`) for reconciliation.
13. Transform and upsert opportunities from `Opportunity` with lead/account/franchise linkage.
14. Transform and upsert `opportunity_items` baseline lines from `Opportunity`.
15. Transform and upsert `opportunity_probability_history` from `OpportunityRemarks`.
16. Persist opportunity orphan reports (`missing_lead`, `missing_opportunity`, `inference_fallback`) for reconciliation.
17. Run post-load validation queries:
   - total imported rows for tenant
   - total imported accounts for tenant
   - total imported contacts for tenant
   - total imported activities for tenant
   - total imported opportunities for tenant
   - total imported opportunity items
   - total imported opportunity probability history rows
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
19. Execute downstream child import using mapping registry with orphan logging.
20. Final reconciliation and import sign-off report.

## 4. Implementation Workflow

### Phase 1: Environment Setup
* Configure the Node.js environment on the macOS workstation.
* Verify Supabase Service Role credentials (required to bypass RLS for administrative imports).

### Phase 2: Sequential Execution
Data must be imported in a specific order to maintain relational integrity:
1.  **Accounts:** Establish the company entities first.
2.  **Contacts:** Link individuals to their respective Accounts.
3.  **Leads:** Import historical inquiries.
4.  **Opportunities:** Import shipment/deal data and link to Leads/Accounts via deterministic UUIDs.

### Phase 3: The "Safe-Insert" Script
The implementation uses the `@supabase/supabase-js` library with specific conflict handling.

**Key Logic Fragment:**
```javascript
const { data, error } = await supabase
  .from('leads')
  .upsert(records, { 
    onConflict: 'id', 
    ignoreDuplicates: true // Critical: Prevents overwriting live data
  });
```

---

## 5. Post-Import Audit & Reconciliation
Immediately following the import, run these verification queries to prove system safety.

### 5.1 Integrity Audit
```sql
-- Verify no "Live" data was tagged with an import ID
SELECT count(*) as accidental_modifications
FROM public.leads 
WHERE created_at > '2026-01-20' AND import_run_id IS NOT NULL;

-- Verify 100% of imported data is isolated to the MGL Tenant
SELECT count(*) as isolation_breaches
FROM public.opportunities
WHERE import_run_id = 'MGL_IMPORT_2026_03' 
AND tenant_id != '9e2686ba-ef3c-42df-aea6-dcc880436b9f';
```

### 5.2 Quality Report
Generate a summary of skipped records (collisions) to provide to the business stakeholders. Any record that failed the "Identity Gate" or "Collision Gate" is logged in a `rejections_log.json` rather than forced into the system.

---

## 6. Rollback Procedure
If the import results in unexpected UI behavior, the entire batch can be removed without impacting live production data.

```sql
-- Targeted Rollback
DELETE FROM public.leads WHERE import_run_id = 'MGL_IMPORT_2026_03';
DELETE FROM public.opportunities WHERE import_run_id = 'MGL_IMPORT_2026_03';
```

---

## 7. Next Steps for Implementation
1.  **Dry Run:** Execute the script against a local Docker instance or a staging project first.
2.  **Schema Update:** Apply the additive SQL changes to the production database.
3.  **Final Execution:** Run the Node.js import utility and generate the Reconciliation Report.
