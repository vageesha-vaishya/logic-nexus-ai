# AMRO Enterprise: Tasks, Work Orders & Work Packages — Deep Analysis

---

## Core Concepts First

```
DIRECTIVE (What needs to be done legally/technically)
    │
    ▼
TASK (Unit of executable work derived from directive)
    │
    ▼
WORK ORDER / WO (Authorization to execute a set of tasks on an aircraft)
    │
    ▼
WORK PACKAGE / WP (Physical packet of documents handed to engineers on the floor)
    │
    ▼
SCHEDULING (When, who, where it happens)
```

These are **not the same thing** — a common source of confusion. Here's the full picture:

---

## Naming Conventions — AMRO SAS Enterprise Standard

All reference numbers follow a structured, hierarchical format to ensure traceability across the full maintenance lifecycle.

---

### Task Number

```
Format:   TSK-{ATA}-{TYPE}-{YYYYMM}-{SEQ:06d}

Fields from:
  TSK      — Fixed prefix (Task)
  {ATA}    — ATA chapter code, zero-padded to 4 digits (e.g. 3200)
  {TYPE}   — Work type code (see table below)
  {YYYYMM} — Year and month of task creation (e.g. 202401)
  {SEQ}    — Tenant-scoped 6-digit sequential number, zero-padded

Fields to:
  TSK      — Fixed prefix (Task)
  {Registration}    — Aircraft Registration Number
  {TYPE}   — Work type code (see table below)
  {YYYYMM} — Year and month of task creation (e.g. 202401)
  {SEQ}    — Tenant-scoped 6-digit sequential number, zero-padded


Example:   TSK-3200-AD-202401-000047

Type Codes:
  AD   Airworthiness Directive
  SB   Service Bulletin
  SC   Scheduled Maintenance (MPD)
  CM   Component Maintenance
  DF   Deferred Defect
  UN   Unscheduled / Non-routine
  MEL  Minimum Equipment List item
  IN   Inspection
  RE   Repair
  TR   Troubleshooting
  CC   Component Change
  CT   Component Test
  CE   Component Evaluation
  CF   Certification
  GE   General
  DIRECTIVES  Airworthiness Directive
  GENERAL  General
```

**Rule:** The task number is immutable once issued. Amendments are tracked via revision suffix (e.g. `TSK-3200-AD-202401-000047-R1`).

---

### Task Title

```
Format:   [{ATA Chapter Name}] {Directive/Procedure Reference} — {Brief Scope Description}

Example:  [Landing Gear] AD-DGCA-2024-32-005 — Main Gear Retraction System Inspection
          [Fuel System]  SB-BELL-429-28-012 — Fuel Boost Pump Replacement
          [Powerplant]   MPD-05-21-001 — Hot Section Borescope Inspection

Rules:
  • Max 120 characters
  • ATA chapter name in square brackets at the start
  • Directive/procedure reference before the dash separator
  • Scope description is actionable (verb + component + action)
  • Avoid abbreviations in the scope description
```

---

### Work Order Number

```
Format:   WO-{STATION}-{YYYY}{MM}-{SEQ:05d}

Fields:
  WO       — Fixed prefix (Work Order)
  {STATION}— ICAO station code of the maintenance base (e.g. VIDP, VABB, VOBL)
  {YYYY}   — 4-digit year
  {MM}     — 2-digit month
  {SEQ}    — Station-scoped 5-digit sequential number, resets per station per year

Example:   WO-VIDP-202401-00023

Maintenance Type suffix (appended where required for clarity):
  -LC  Line Check
  -AC  A-Check
  -BC  B-Check
  -CC  C-Check
  -DC  D-Check (Heavy Maintenance)
  -CM  Component Change
  -TR  Troubleshooting

Full example with type:  WO-VIDP-202401-00023-CC
```

**Rule:** One Work Order = one aircraft + one maintenance event. A WO number is never reused, even if the WO is cancelled.

---

### Work Package Number

```
Format:   {WO_NUMBER}/WP{SEQ:02d}-{ATA}

Fields:
  {WO_NUMBER} — Parent Work Order number (full)
  WP          — Fixed infix (Work Package)
  {SEQ}       — 2-digit sequential number within the WO
  {ATA}       — ATA chapter code this package covers (4 digits)

Example:   WO-VIDP-202401-00023/WP01-0500   (Time Limits / Airworthiness)
           WO-VIDP-202401-00023/WP02-2100   (Air Conditioning)
           WO-VIDP-202401-00023/WP03-2800   (Fuel System)
           WO-VIDP-202401-00023/WP04-3200   (Landing Gear)
           WO-VIDP-202401-00023/WP05-7100   (Powerplant)
```

**Rule:** A Work Package belongs to exactly one Work Order. Its ATA code reflects the primary ATA chapter; multi-ATA packages use the dominant chapter.

---

### Job Card Number

```
Format:   {WP_NUMBER}/JC{ATA}{SEQ:03d}

Fields:
  {WP_NUMBER} — Parent Work Package number (full)
  JC          — Fixed infix (Job Card)
  {ATA}       — ATA chapter (4 digits, matches or sub-chapter of parent WP)
  {SEQ}       — 3-digit sequential number within the WP, zero-padded

Example:   WO-VIDP-202401-00023/WP04-3200/JC3200001
           WO-VIDP-202401-00023/WP04-3200/JC3210002   (sub-chapter: Nose Gear)
           WO-VIDP-202401-00023/WP04-3200/JC3220003   (sub-chapter: Main Gear)
```

**Rule:** Each Job Card maps to exactly one Task record (`public.tasks.id`). The Job Card is the physical sign-off document; the Task is the digital record. They share a 1:1 relationship.

---

### Naming Convention Summary Table

| Entity | Format Pattern | Example |
|---|---|---|
| **Task Number** | `TSK-{ATA}-{TYPE}-{YYYYMM}-{SEQ:06d}` | `TSK-3200-AD-202401-000047` |
| **Task Title** | `[{ATA Name}] {Ref} — {Scope}` | `[Landing Gear] AD-DGCA-2024-32-005 — Retraction Inspection` |
| **Work Order** | `WO-{STATION}-{YYYY}{MM}-{SEQ:05d}` | `WO-VIDP-202401-00023` |
| **Work Package** | `{WO}/WP{SEQ:02d}-{ATA}` | `WO-VIDP-202401-00023/WP04-3200` |
| **Job Card** | `{WP}/JC{ATA}{SEQ:03d}` | `WO-VIDP-202401-00023/WP04-3200/JC3200001` |

**Hierarchy:** Job Card ⊂ Work Package ⊂ Work Order ⊃ Tasks (via `tasks.work_order_id`)

---

## Phase 1 — Directive Ingestion (Source of Truth)

```
┌─────────────────────────────────────────────────────────────┐
│  REGULATORY / OEM SOURCES                                   │
│  ─────────────────────────────────────────────────────────  │
│  • Airworthiness Directives (ADs) — DGCA / FAA / EASA      │
│  • Service Bulletins (SBs) — Boeing / Airbus / Bell        │
│  • Maintenance Planning Document (MPD)                      │
│  • Aircraft Maintenance Manual (AMM)                        │
│  • Component Maintenance Manual (CMM)                       │
└─────────────────┬───────────────────────────────────────────┘
                  │  [MANUAL] Planning Engineer reviews and
                  │  enters into system or imports via FlyPal
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  public.directives (Master Record)                          │
│  ─────────────────────────────────────────────────────────  │
│  directive_no, ata_code, threshold_hours, threshold_cycles  │
│  threshold_calendar, estimated_man_hours, is_mandatory      │
└─────────────────────────────────────────────────────────────┘
```

**Manual Intervention:** Planning engineer validates, categorizes, and assigns ATA chapter.
Nothing is automated here — regulatory compliance requires human review.

---

## Phase 2 — Task Creation

A **Task** is the smallest executable unit of maintenance work. One directive can generate
**one task per aircraft** it applies to.

```
┌──────────────────────────────────────────────────────────────────┐
│  STEP 1 — Aircraft Applicability Check          [MANUAL]         │
│  ────────────────────────────────────────────────────────────    │
│  Planning Engineer determines which aircraft (by model/MSN)      │
│  are subject to this directive.                                  │
│  Sets: assembly_models, aircraft_template_id                     │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 2 — Task Generation                    [SEMI-AUTOMATED]    │
│  ────────────────────────────────────────────────────────────    │
│  For each applicable aircraft:                                   │
│  • task_number   = "TSK-{ATA}-{TYPE}-{YYYYMM}-{SEQ:06d}"        │
│                    e.g. TSK-3200-AD-202401-000047                │
│  • task_category = "directives" / "scheduled" / "unscheduled"   │
│  • procedure_reference = ATA chapter reference                   │
│  • estimated_duration_hours = directive.estimated_man_hours      │
│  • aircraft_id   = resolved from registration + serial_number    │
│  • ata_code_id   = resolved from ata_codes table                 │
│  • status        = "pending"                                     │
│                                                                  │
│  Source: flypal_configured_directives_create_tasks (edge fn)     │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 3 — Task Due Date Calculation          [SEMI-AUTOMATED]    │
│  ────────────────────────────────────────────────────────────    │
│  Based on:                                                       │
│  • Last Done Date (actual_end_date)                              │
│  • Aircraft current hours / cycles / landings                    │
│  • Directive threshold (hours / cycles / calendar)               │
│                                                                  │
│  Due At = Last Done + Threshold                                  │
│  Remaining = Due At − Current                                    │
│  planned_start_date = Due At − man_hours/8 − 1 buffer day        │
│                                                                  │
│  [MANUAL] Planning engineer reviews and overrides if needed      │
│  (extensions, concessions, earlier opportunity)                  │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ public.tasks  │
                    │ status:       │
                    │ "pending"     │
                    └──────────────┘
```

---

## Phase 3 — Work Order (WO) Creation

A **Work Order** is the **official authorization** to perform maintenance. It is a legal document
in aviation. It groups related tasks on **one aircraft** for **one maintenance event**.

```
┌──────────────────────────────────────────────────────────────────┐
│  STEP 4 — Opportunity Planning              [MANUAL — KEY STEP]  │
│  ────────────────────────────────────────────────────────────    │
│  Planning Engineer identifies a maintenance "window":            │
│  • Aircraft goes out of service (AOG / scheduled check)          │
│  • Station / MRO facility available                              │
│  • Manpower available                                            │
│  • Parts / materials confirmed                                   │
│                                                                  │
│  Decision: Which tasks can be grouped into this maintenance       │
│  event? (due tasks + opportunistic tasks + open defects)         │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 5 — Work Order Creation               [MANUAL + SYSTEM]    │
│  ────────────────────────────────────────────────────────────    │
│  public.work_orders:                                             │
│  • aircraft_id         = specific tail number                    │
│  • maintenance_type    = "line" / "base" / "component"           │
│  • work_order_number   = "WO-{STATION}-{YYYY}{MM}-{SEQ:05d}"     │
│                          e.g. WO-VIDP-202401-00023               │
│  • planned_start_date  = when aircraft goes in                   │
│  • planned_end_date    = when aircraft must return to service     │
│  • station             = MRO location                            │
│  • status              = "planning"                              │
│                                                                  │
│  [MANUAL] MOC (Maintenance Operations Control) or Planning       │
│  Engineer creates WO and sets the window dates.                  │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 6 — Task Assignment to Work Order     [MANUAL + SYSTEM]    │
│  ────────────────────────────────────────────────────────────    │
│  Planning Engineer selects tasks to include in this WO:          │
│  • All tasks due within the maintenance window                   │
│  • Tasks within ±10% of threshold (to avoid another shop visit)  │
│  • Open MEL (Minimum Equipment List) items                       │
│  • Non-routine findings from previous checks                     │
│                                                                  │
│  System: tasks.work_order_id = work_orders.id                    │
│  tasks.status → "not_started"                                    │
│                                                                  │
│  [MANUAL] Approval step: Quality / Planning sign-off required    │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 7 — WO Approval & Release             [MANUAL — CRITICAL]  │
│  ────────────────────────────────────────────────────────────    │
│  • Planning Manager reviews scope, man-hours, materials          │
│  • Finance approves cost estimate                                │
│  • Quality/CAMO (Continuing Airworthiness Management Org)        │
│    reviews regulatory compliance                                 │
│  • WO status: "planning" → "approved"                            │
│                                                                  │
│  Without approval, no physical work can begin.                   │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │  public.work_orders  │
                │  status: "approved"  │
                └─────────────────────┘
```

---

## Phase 4 — Work Package (WP) Creation

A **Work Package** is the **physical document set** handed to technicians on the hangar floor.
It is a subset of a Work Order — typically organized by ATA chapter, trade
(avionics/structures/powerplant), or work zone.

```
┌──────────────────────────────────────────────────────────────────┐
│  STEP 8 — Work Package Decomposition        [MANUAL — KEY STEP]  │
│  ────────────────────────────────────────────────────────────    │
│  From one Work Order, the Planning Engineer creates multiple WPs: │
│                                                                  │
│  WO-VIDP-202401-00023-CC  (C-Check, VT-ABC)                      │
│  ├── WO-VIDP-202401-00023/WP01-0500  ATA 05 — Time Limits        │
│  ├── WO-VIDP-202401-00023/WP02-2100  ATA 21 — Air Conditioning   │
│  ├── WO-VIDP-202401-00023/WP03-2800  ATA 28 — Fuel System        │
│  ├── WO-VIDP-202401-00023/WP04-3200  ATA 32 — Landing Gear       │
│  └── WO-VIDP-202401-00023/WP05-7100  ATA 71 — Powerplant         │
│                                                                  │
│  Each WP is assigned to a specific trade / work center.          │
│  Each WP contains: task cards, AMM references, material lists,   │
│  tooling requirements, sign-off sheets.                          │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 9 — Task Cards Generation             [SEMI-AUTOMATED]     │
│  ────────────────────────────────────────────────────────────    │
│  For each task in the WP:                                        │
│  • Task Card printed/generated with:                             │
│    - Step-by-step procedure (from AMM/CMM)                       │
│    - Required tools and equipment                                │
│    - Required materials / parts (P/N, Q/N)                       │
│    - Required qualifications (A&P / type-rated)                  │
│    - Sign-off fields (inspector + certifying engineer)           │
│    - Safety precautions                                          │
│  • QR code / barcode linking to digital record                   │
│                                                                  │
│  [MANUAL] Quality Engineer reviews task card content before      │
│  release to hangar.                                              │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 10 — WP Release to Hangar             [MANUAL — CRITICAL]  │
│  ────────────────────────────────────────────────────────────    │
│  • Production Planning stamps / releases WP                      │
│  • Shift supervisor receives physical WP package                 │
│  • WP status: "scheduled" → "in_progress"                        │
│  • tasks.status → "in_progress" as each task starts              │
└──────────────────────────────────────────────────────────────────┘
```

---

## Phase 5 — Scheduling

```
┌──────────────────────────────────────────────────────────────────┐
│  SCHEDULING DIMENSIONS                                           │
│  ────────────────────────────────────────────────────────────    │
│                                                                  │
│  1. AIRCRAFT SCHEDULE (AOC / Fleet Planning)    [MANUAL]         │
│     • When is the aircraft available?                            │
│     • Revenue vs. maintenance trade-off                          │
│     • Slot booking at MRO station                                │
│                                                                  │
│  2. MANPOWER SCHEDULE (Production Planning)     [MANUAL]         │
│     • Total man-hours required = Σ task.estimated_duration_hours │
│     • Available technicians × shift hours                        │
│     • Trade breakdown: structures 40%, avionics 30%, etc.        │
│     • Overtime planning if required                              │
│                                                                  │
│  3. MATERIAL SCHEDULE (Stores / Procurement)    [SEMI-AUTO]      │
│     • All parts identified from task cards                       │
│     • Lead time vs. planned_start_date gap check                 │
│     • AOG kits pre-staged                                        │
│                                                                  │
│  4. TASK SEQUENCING (Production Planning)       [MANUAL + LOGIC] │
│     • Tasks have dependencies (can't paint before repair)        │
│     • Critical path identified (longest dependency chain)        │
│     • tasks.sequence_order drives hangar floor execution order   │
│     • Parallel tracks where possible (different zones)           │
│                                                                  │
│  5. DAILY PRODUCTION MEETING                    [MANUAL]         │
│     • Shift supervisor + Planning + Quality + Stores             │
│     • Task completion status reviewed                            │
│     • Blockers: missing parts, awaiting engineer, tooling        │
│     • Re-sequencing if needed                                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Complete Flow Chart

```
REGULATORY SOURCE
      │
      ▼
[M] DIRECTIVE REVIEW & ENTRY ──────────────────────────────┐
      │                                                     │
      ▼                                                 REJECTED
[A] DIRECTIVE STORED (public.directives)                    │
      │                                                     │
      ▼                                              ◄──────┘
[M] AIRCRAFT APPLICABILITY CHECK
      │
      ├── Applicable ──────────────────────────────────────┐
      │                                                    │
      ▼                                                    │
[A] TASK GENERATED (public.tasks, status=pending)          │
      │                                                    │
      ▼                                                    │
[M] DUE DATE REVIEW & OVERRIDE                             │
      │                                                    │
      ▼                                                    │
[M] OPPORTUNITY WINDOW IDENTIFIED                          │
      │                                                    │
      ▼                                                    │
[M] WORK ORDER CREATED (public.work_orders)                │
      │                                                    │
      ▼                                                    │
[M] TASKS ASSIGNED TO WORK ORDER                           │
      │  (tasks.work_order_id set)                         │
      ▼                                                    │
[M] MATERIAL & MANPOWER PLANNING                           │
      │                                                    │
      ▼                                                    │
[M] WO APPROVAL (Planning Mgr + Quality + Finance) ────────┤
      │                                               NOT APPROVED
      ▼                                                    │
[M] WORK PACKAGE DECOMPOSITION (by ATA/trade) ◄────────────┘
      │
      ▼
[M/A] TASK CARDS GENERATED
      │
      ▼
[M] QUALITY REVIEW OF TASK CARDS
      │
      ▼
[M] WP RELEASED TO HANGAR (status=in_progress)
      │
      ├── [TECHNICIAN] Task Executed
      │         │
      │         ▼
      │   [M] INSPECTOR SIGN-OFF
      │         │
      │         ▼
      │   task.status = "completed"
      │
      ▼
[M] ALL TASKS COMPLETE?
      ├── NO → Daily production meeting → Re-plan
      └── YES ─────────────────────────────────────────────┐
                                                           │
                                                           ▼
                                              [M] CERTIFYING ENGINEER
                                                  SIGNS CRS (Certificate
                                                  of Release to Service)
                                                           │
                                                           ▼
                                              WO status = "completed"
                                                           │
                                                           ▼
                                              [A] AIRCRAFT RECORDS UPDATED
                                              (new actual_end_date,
                                               actual_work_hours,
                                               next due date recalculated)
```

**Legend:** `[M]` = Manual intervention required | `[A]` = Automated | `[M/A]` = Semi-automated

---

## Summary: Key Relationships

| Object | What it represents | Created by | Groups |
|---|---|---|---|
| **Directive** | Legal/technical requirement | Planning Engineer | — |
| **Task** | Unit of executable work for 1 aircraft | System (from directive) | Belongs to 1 WO |
| **Work Order** | Authorization for a maintenance event | Planning Engineer | Many tasks on 1 aircraft |
| **Work Package** | Physical document set for hangar floor | Production Planning | Subset of WO tasks by trade/ATA |
| **Schedule** | When/who/where the WO executes | Production Planning | Assigns WP to shift/technician |

---

## Critical Enterprise Rules

1. **No task can be closed without a licensed engineer sign-off** — this is regulatory (ICAO Annex 6)
2. **Work Order must be approved before any physical work starts** — legal liability
3. **A task belongs to exactly one Work Order** — splitting tasks across WOs is not permitted
4. **Work Packages are always subsets of one Work Order** — they never span WOs
5. **Task completion resets the due date** — the system must recalculate `next_due = actual_end_date + threshold`
6. **Uncompleted tasks in a closed WO** must be carried over to a new WO — they cannot simply be deleted

---

## FlyPal System Context

In this system the import pipeline follows this sequence before tasks reach the WO/WP stage:

```
1. flypal_configured_directives_parse_frequency
       → is_frequency_parsed_success = true
       → Populates: threshold_hours, threshold_cycles, threshold_calendar,
                    threshold_landings, calendar_unit, threshold_rins,
                    threshold_hobbs, effective_from_2_actual_end_hours,
                    effective_from_2_actual_end_date,
                    current_2_aircraft_current_flight_hours,
                    current_2_aircraft_current_landings,
                    current_2_aircraft_current_reading_date

2. flypal_configured_directives_id_match
       → is_row_processed_success = true
       → Populates: directive_id (FK to public.directives)

3. flypal_configured_directives_create_tasks
       → is_task_created_success = true
       → Creates: public.tasks record per row
       → Resolves: aircraft_id (from registration + serial_number)
       → Resolves: ata_code_id (from ata_code string)
       → Populates: created_task_id (FK back to public.tasks)

4. [MANUAL] Planning Engineer assigns tasks to a Work Order
       → tasks.work_order_id = work_orders.id

5. [MANUAL] Work Order approved and Work Packages created
       → WP decomposed by ATA chapter / trade
       → Task cards released to hangar floor
```

### Verify tasks created from FlyPal import

```sql
-- All tasks created from flypal_configured_directives
SELECT t.*
FROM public.tasks t
WHERE t.id IN (
  SELECT fcd.created_task_id
  FROM flypal.flypal_configured_directives fcd
  WHERE fcd.created_task_id IS NOT NULL
);

-- Summary by aircraft and status
SELECT
  t.aircraft_id,
  t.status,
  COUNT(*) AS task_count,
  SUM(t.estimated_duration_hours) AS total_man_hours
FROM public.tasks t
WHERE t.id IN (
  SELECT fcd.created_task_id
  FROM flypal.flypal_configured_directives fcd
  WHERE fcd.created_task_id IS NOT NULL
)
GROUP BY t.aircraft_id, t.status
ORDER BY t.aircraft_id, t.status;
```



Naming Convention
                                                     │
│                                                                                              │
│ ┌─────────────────────────────────────┬───────────────────────────┐                          │
│ │               Before                │           After           │                          │
│ ├─────────────────────────────────────┼───────────────────────────┤                          │
│ │ CFG-DIR-ab198f14-1778311245029-4338 │ TSK-3400-SB-202601-004338 │                          │
│ ├─────────────────────────────────────┼───────────────────────────┤                          │
│ │ CFG-DIR-ab198f14-1778311245029-4339 │ TSK-3400-SB-202601-004339 │                          │
│ ├─────────────────────────────────────┼───────────────────────────┤                          │
│ │ CFG-DIR-ab198f14-1778311245029-4340 │ TSK-2300-SB-202601-004340 │                          │
│ ├─────────────────────────────────────┼───────────────────────────┤                          │
│ │ TSK-VT-ACG SB 33-027 R1             │ TSK-3300-SB-202601-004304 │                          │
│ └─────────────────────────────────────┴───────────────────────────┘  

ype Code Mapping Reference                                                                  │
│                                                                                              │
│ ┌──────────────────────────────┬────────────────────┐                                        │
│ │     Input category_code      │    Output TYPE     │                                        │
│ ├──────────────────────────────┼────────────────────┤                                        │
│ │ AD                           │ AD                 │                                        │
│ ├──────────────────────────────┼────────────────────┤                                        │
│ │ SB, SBS, ASB                 │ SB                 │                                        │
│ ├──────────────────────────────┼────────────────────┤                                        │
│ │ SC, SCHEDULED, MPD           │ SC                 │                                        │
│ ├──────────────────────────────┼────────────────────┤                                        │
│ │ CM, COMPONENT                │ CM                 │                                        │
│ ├──────────────────────────────┼────────────────────┤                                        │
│ │ DF, DEFERRED                 │ DF                 │                                        │
│ ├──────────────────────────────┼────────────────────┤                                        │
│ │ UN, UNSCHEDULED              │ UN                 │                                        │
│ ├──────────────────────────────┼────────────────────┤                                        │
│ │ MEL                          │ MEL                │                                        │
│ ├──────────────────────────────┼────────────────────┤                                        │
│ │ DIRECTIVES, GENERAL, unknown │ SC / AD (fallback) │                                        │
│ └──────────────────────────────┴────────────────────┘            