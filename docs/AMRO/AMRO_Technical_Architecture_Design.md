# Multi-Tenant AMRO System: Technical Architecture Design
## ATA-Aligned Maintenance Planning & Execution Platform

**Version:** 1.0
**Scope:** Logic Pro Enterprise AMRO System
**Standard Compliance:** ATA iSpec 2200, MSG-3, EASA/FAA Audit Requirements
**Date:** March 2026

---

## PAGE 1: EXECUTIVE SUMMARY & ARCHITECTURE PILLARS

### 1.1 System Vision
Logic Pro is a cloud-native, multi-tenant Aircraft Maintenance Repair & Operations (AMRO) platform designed to rival SAP Aviation, AMOS, and Trax by enforcing international maintenance standards while remaining operator-agnostic. The system serves as a "Planning Engine" that answers the core MRO question: **"Does Task X apply to Tail Number Y, and when is it due?"**

### 1.2 Enterprise Architecture Pillars

| Pillar | Requirement | Enterprise Benefit |
|--------|-------------|-------------------|
| **Multi-Tenancy** | Every data entity carries `tenant_id` + `franchise_id` | Complete data isolation; regulatory compliance (FAA/EASA audits) |
| **Applicability Engine** | JSON-based rules (serial ranges, engine types, SB status) | 3,000+ task library auto-filters to ~1,000 applicable per aircraft |
| **Master → Fleet Propagation** | Master MPD library auto-populates fleet MPD on aircraft addition | Eliminates manual task assignment; reduces human error |
| **Version Control** | All task definitions versioned; superseded tracking | Legal compliance for 5-year maintenance history |
| **Interval Normalization** | Task decoupled from intervals; multiple interval types per task | Supports "400 Hrs OR 24 Months" and "every 12mo for 5yr, then 6mo" logic |
| **Whichever Comes First (WCF)** | Real-time calculation of which limit hits first | Safety-critical: prevents deferred maintenance |
| **MTOSS Extension** | 7-segment code (Chapter-Section-Subject-Function-Subfunction-ID) | Granular reporting for international authorities |

### 1.3 Multi-Tenancy Model

```
Organization Hierarchy:
├── Tenant (Enterprise, e.g., "Aircharter Inc")
│   ├── Franchise-1 (Regional operator, e.g., "Aircharter EU")
│   │   ├── Fleet MPD (tenant_id=1, franchise_id=101)
│   │   └── Aircraft A, B, C
│   └── Franchise-2 (Aircharter APAC)
│       └── Fleet MPD (tenant_id=1, franchise_id=102)
└── Master MPD Library (system-wide, tenant_id=NULL, franchise_id=NULL)
```

**Data Isolation:** Every query **MUST** filter by `tenant_id AND franchise_id`. No exceptions. Enforce at the database layer with Row-Level Security (RLS) policies.

---

## PAGE 2: DATA MODEL & ENTITY HIERARCHY

### 2.1 ATA Code Hierarchy (Recursive)

```sql
-- TABLE: ata_codes
-- Self-referencing to allow unlimited nesting (21 → 21-10 → 21-10-01)

CREATE TABLE ata_codes (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  code VARCHAR(20) NOT NULL,  -- e.g., "21", "21-10", "21-10-01"
  description TEXT,
  parent_id UUID REFERENCES ata_codes(id),  -- NULL for root (Chapter)
  level SMALLINT,  -- 1=Chapter, 2=Section, 3=Subject, 4+=Detail
  chapter_code VARCHAR(2),  -- Denormalized for quick rollup queries

  -- Enterprise tracking
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,

  UNIQUE(tenant_id, code),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

**Benefit:** Recursive structure enables cost/man-hour rollup from task→section→chapter. Example query:
```sql
SELECT parent_id, SUM(estd_man_hours)
FROM maintenance_tasks
WHERE tenant_id=$1 AND ATA hierarchically under '21-10'
GROUP BY parent_id;
```

### 2.2 Maintenance Task Definition (The "What")

```sql
CREATE TABLE maintenance_tasks (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  franchise_id UUID,  -- NULL = Master MPD; populated = Fleet MPD

  -- Task Identity
  task_code VARCHAR(50) NOT NULL,  -- e.g., "21-10-00-040-001"
  ata_code_id UUID NOT NULL REFERENCES ata_codes(id),
  mtoss_code VARCHAR(20),  -- 7-segment extension: Ch-Sec-Sub-Fn-SubFn-ID
  description TEXT NOT NULL,

  -- Task Classification
  skill_type VARCHAR(50) NOT NULL,  -- ENUM: AIRFRAME, ENGINE, AVIONICS, HYDRAULIC
  task_type VARCHAR(50),  -- ENUM: INSPECTION, REPLACEMENT, OVERHAUL, TEST
  estd_man_hours DECIMAL(8,2) NOT NULL,  -- Always linked to skill_type

  -- Version Control (Legal Compliance)
  version_number INT DEFAULT 1,
  superseded_by_id UUID REFERENCES maintenance_tasks(id),  -- Points to newer version
  effective_date DATE NOT NULL,
  obsolete_date DATE,

  -- Applicability Rules (JSON)
  applicability_rules JSONB NOT NULL DEFAULT '{}',  -- See Section 2.4

  -- Source Documentation (The "Why")
  source_type VARCHAR(50),  -- ENUM: MPD, AD (Airworthiness Directive), SB (Service Bulletin), MRB
  source_ref VARCHAR(100),  -- e.g., "SB-21-1234-56"
  revision_date DATE,

  -- Audit Trail
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by_id UUID,
  is_active BOOLEAN DEFAULT true,

  UNIQUE(tenant_id, franchise_id, task_code, version_number),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (franchise_id) REFERENCES franchises(id)
);
```

### 2.3 Task Intervals (The "When") - Normalized Separation

```sql
CREATE TABLE task_intervals (
  id UUID PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES maintenance_tasks(id) ON DELETE CASCADE,

  -- Interval Type (Polymorphic)
  interval_type VARCHAR(50) NOT NULL,  -- ENUM: FLIGHT_HOURS, CALENDAR_MONTHS, LANDINGS, CYCLES
  interval_value INT NOT NULL,  -- e.g., 400 for hours, 24 for months

  -- Grace Period (Tolerance Rule)
  grace_period_type VARCHAR(20),  -- ENUM: PERCENT, DAYS
  grace_period_value INT,  -- e.g., 10 (for 10%), 30 (for 30 days)

  -- Sequence Logic
  effective_from_interval INT DEFAULT 0,  -- e.g., "every 6mo AFTER first 12mo"
  repeat_count INT,  -- NULL = infinite; 5 = repeat 5 times

  -- Interval Dependencies
  depends_on_interval_id UUID REFERENCES task_intervals(id),  -- Chain intervals

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);
```

**Benefit:** Separating intervals from tasks allows complex logic like:
- "Inspect every 12 months for 5 years, then every 6 months thereafter"
- "400 Flight Hours OR 24 Calendar Months (whichever comes first)"

### 2.4 Applicability Rules JSON Schema (Enterprise Filter)

```json
{
  "applicability_rules": {
    "inclusive_conditions": {
      "engine_types": ["PT6A-67P", "PT6A-114A"],
      "serial_number_ranges": [
        { "min": 100, "max": 250 },
        { "min": 300, "max": 500 }
      ],
      "aircraft_models": ["PC-12", "PC-12NG"],
      "manufacturing_date_range": {
        "from": "2010-01-01",
        "to": "2020-12-31"
      }
    },
    "exclusive_conditions": {
      "engine_types": ["PT6A-20A"],  -- Task does NOT apply to this
      "serial_ranges_excluded": [
        { "min": 1, "max": 99 }
      ]
    },
    "service_bulletin_dependencies": [
      {
        "sb_number": "SB-27-3456",
        "status": "embodied",  -- Task applies ONLY if SB is embodied
        "applicability_type": "mandatory"  -- or "conditional"
      }
    ],
    "modification_dependencies": [
      {
        "modification_id": "MOD-12345",
        "mod_status": "installed",
        "applicability_type": "mandatory"
      }
    ],
    "special_rules": {
      "high_altitude_operations": true,  -- Task applies to high-alt aircraft only
      "extended_range_aircraft": false
    }
  }
}
```

**Benefit:** Single JSONB column eliminates hundreds of nullable columns while enabling complex filtering.

### 2.5 Aircraft-Task Link (Realized Maintenance Schedule)

```sql
CREATE TABLE aircraft_maintenance_tasks (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  franchise_id UUID NOT NULL,

  -- Aircraft & Task
  aircraft_id UUID NOT NULL REFERENCES aircraft(id),
  task_id UUID NOT NULL REFERENCES maintenance_tasks(id),

  -- Realization Tracking
  task_activated_date DATE NOT NULL,  -- When this task became active for this aircraft

  -- Interval Snapshots (De-normalized for performance)
  primary_interval_id UUID REFERENCES task_intervals(id),
  primary_interval_type VARCHAR(50),
  primary_interval_value INT,

  -- Execution History
  last_completed_date DATE,
  last_completed_flight_hours DECIMAL(10,1),
  last_completed_landings INT,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,

  UNIQUE(tenant_id, aircraft_id, task_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

---

## PAGE 3: MULTI-TENANCY & APPLICABILITY ENGINE

### 3.1 Multi-Tenant Data Isolation Strategy

**Rule:** Every query must include both filters:
```sql
WHERE tenant_id = $1 AND (franchise_id = $2 OR franchise_id IS NULL)
```

**Implementation:**
- Row-Level Security (RLS) policies on all maintenance tables
- Trigger-based `updated_at` auto-update
- Application-layer middleware enforces `tenant_id` context

```sql
-- Example RLS Policy
CREATE POLICY tenant_isolation ON maintenance_tasks
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

ALTER TABLE maintenance_tasks ENABLE ROW LEVEL SECURITY;
```

### 3.2 Master MPD → Fleet MPD Propagation

**Workflow:**

```
1. Maintenance Engineer uploads "Master MPD" (3,000+ generic tasks)
   → All records: tenant_id=NULL, franchise_id=NULL

2. New Aircraft Added (e.g., Pilatus PC-12, S/N 123456)
   → System triggers: apply_master_mpd_to_aircraft()

3. Function executes for each Master task:
   - Call: is_task_applicable(task_id, aircraft_id)
   - If TRUE → INSERT aircraft_maintenance_task (clone with franchise_id)
   - If FALSE → skip

4. Result: ~1,000 applicable tasks auto-populated in Fleet MPD
```

### 3.3 Applicability Check Function (PostgreSQL)

```sql
CREATE OR REPLACE FUNCTION is_task_applicable(
  p_task_id UUID,
  p_aircraft_id UUID,
  p_tenant_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_aircraft_model VARCHAR;
  v_aircraft_sn VARCHAR;
  v_aircraft_engine_type VARCHAR;
  v_mfg_date DATE;
  v_applicability JSONB;
  v_rule JSONB;
BEGIN
  -- Fetch aircraft attributes
  SELECT model, serial_number, engine_type, manufacturing_date
  INTO v_aircraft_model, v_aircraft_sn, v_aircraft_engine_type, v_mfg_date
  FROM aircraft
  WHERE id = p_aircraft_id AND tenant_id = p_tenant_id;

  -- Fetch task applicability rules
  SELECT applicability_rules
  INTO v_applicability
  FROM maintenance_tasks
  WHERE id = p_task_id AND tenant_id = p_tenant_id;

  -- If no rules defined, task applies to all
  IF v_applicability IS NULL OR v_applicability = '{}'::jsonb THEN
    RETURN TRUE;
  END IF;

  -- Check INCLUSIVE conditions (must match at least one)
  IF v_applicability -> 'inclusive_conditions' IS NOT NULL THEN

    -- Engine type check
    IF v_applicability -> 'inclusive_conditions' -> 'engine_types' IS NOT NULL THEN
      IF NOT (v_applicability -> 'inclusive_conditions' ->> 'engine_types' @> to_jsonb(v_aircraft_engine_type))
      THEN RETURN FALSE;
      END IF;
    END IF;

    -- Serial number range check
    FOR v_rule IN
      SELECT jsonb_array_elements(v_applicability -> 'inclusive_conditions' -> 'serial_number_ranges')
    LOOP
      IF v_aircraft_sn::INT BETWEEN (v_rule ->> 'min')::INT AND (v_rule ->> 'max')::INT THEN
        EXIT;  -- Match found
      END IF;
    END LOOP;
    IF v_rule IS NULL THEN RETURN FALSE; END IF;

    -- Aircraft model check
    IF v_applicability -> 'inclusive_conditions' -> 'aircraft_models' IS NOT NULL THEN
      IF NOT (v_applicability -> 'inclusive_conditions' ->> 'aircraft_models' @> to_jsonb(v_aircraft_model))
      THEN RETURN FALSE;
      END IF;
    END IF;

  END IF;

  -- Check EXCLUSIVE conditions (must NOT match)
  IF v_applicability -> 'exclusive_conditions' IS NOT NULL THEN
    IF v_applicability -> 'exclusive_conditions' ->> 'engine_types' @> to_jsonb(v_aircraft_engine_type)
    THEN RETURN FALSE;
    END IF;
  END IF;

  -- Check Service Bulletin dependencies
  IF v_applicability -> 'service_bulletin_dependencies' IS NOT NULL THEN
    FOR v_rule IN
      SELECT jsonb_array_elements(v_applicability -> 'service_bulletin_dependencies')
    LOOP
      IF (v_rule ->> 'applicability_type') = 'mandatory' THEN
        -- Verify SB is embodied
        IF NOT EXISTS (
          SELECT 1 FROM service_bulletins
          WHERE aircraft_id = p_aircraft_id
            AND sb_number = (v_rule ->> 'sb_number')
            AND embodied_date IS NOT NULL
        ) THEN
          RETURN FALSE;
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Usage: SELECT is_task_applicable('task-id', 'aircraft-id', 'tenant-id');
```

### 3.4 UI/UX Applicability Filter (React/TypeScript)

```typescript
// Frontend Filter Component
const FilterAircraftTasks = ({ aircraftId }: Props) => {
  const [filteredTasks, setFilteredTasks] = useState([]);

  useEffect(() => {
    // Call backend endpoint that uses is_task_applicable()
    fetchApplicableTasks(aircraftId).then((tasks) => {
      // Shows only ~1,000 relevant tasks instead of 3,000+
      setFilteredTasks(tasks);
    });
  }, [aircraftId]);

  return (
    <select onChange={(e) => filterByAircraft(e.target.value)}>
      <option>Filter by Aircraft...</option>
      {filteredTasks.map(task => (
        <option key={task.id}>{task.task_code}: {task.description}</option>
      ))}
    </select>
  );
};
```

---

## PAGE 4: BUSINESS LOGIC & "PLANNING ENGINE"

### 4.1 Next Due Calculation (PostgreSQL)

The core question: **"When is Task X due for Tail Number Y?"**

```sql
CREATE OR REPLACE FUNCTION calculate_next_due(
  p_aircraft_task_id UUID,
  p_current_flight_hours DECIMAL,
  p_current_calendar_date DATE
)
RETURNS TABLE(
  interval_id UUID,
  interval_type VARCHAR,
  next_due_value INT,
  next_due_date DATE,
  next_due_hours DECIMAL,
  remaining_hours DECIMAL,
  remaining_days INT,
  due_status VARCHAR,  -- 'GREEN', 'YELLOW' (grace), 'RED' (overdue)
  which_comes_first VARCHAR  -- WCF: 'HOURS' or 'CALENDAR'
) AS $$
BEGIN
  RETURN QUERY
  WITH task_data AS (
    SELECT amt.id, amt.last_completed_flight_hours, amt.last_completed_date
    FROM aircraft_maintenance_tasks amt
    WHERE amt.id = p_aircraft_task_id
  ),
  interval_data AS (
    SELECT
      ti.id,
      ti.interval_type,
      ti.interval_value,
      ti.grace_period_type,
      ti.grace_period_value,
      td.last_completed_flight_hours,
      td.last_completed_date
    FROM task_intervals ti
    CROSS JOIN task_data td
    WHERE ti.task_id = (SELECT task_id FROM aircraft_maintenance_tasks WHERE id = p_aircraft_task_id)
      AND ti.is_active = TRUE
  ),
  due_calculations AS (
    SELECT
      id,
      interval_type,
      interval_value,

      -- Next Due for FLIGHT_HOURS
      CASE
        WHEN interval_type = 'FLIGHT_HOURS' THEN
          last_completed_flight_hours + interval_value
        ELSE NULL
      END::DECIMAL AS next_due_hours,

      -- Next Due for CALENDAR_MONTHS
      CASE
        WHEN interval_type = 'CALENDAR_MONTHS' THEN
          last_completed_date + (interval_value || ' months')::INTERVAL
        ELSE NULL
      END::DATE AS next_due_date,

      -- Grace Period Calculation
      CASE
        WHEN grace_period_type = 'PERCENT' THEN
          interval_value * grace_period_value / 100
        WHEN grace_period_type = 'DAYS' AND interval_type = 'CALENDAR_MONTHS' THEN
          grace_period_value
        ELSE 0
      END::INT AS grace_value,

      grace_period_type
    FROM interval_data
  )
  SELECT
    id,
    interval_type,
    interval_value,
    next_due_date,
    next_due_hours,
    CASE
      WHEN next_due_hours IS NOT NULL
      THEN (next_due_hours - p_current_flight_hours)::DECIMAL
      ELSE NULL
    END AS remaining_hours,
    CASE
      WHEN next_due_date IS NOT NULL
      THEN (next_due_date - p_current_calendar_date)::INT
      ELSE NULL
    END AS remaining_days,
    -- DUE STATUS (GREEN/YELLOW/RED)
    CASE
      WHEN interval_type = 'FLIGHT_HOURS' THEN
        CASE
          WHEN p_current_flight_hours >= next_due_hours THEN 'RED'
          WHEN p_current_flight_hours >= (next_due_hours - grace_value) THEN 'YELLOW'
          ELSE 'GREEN'
        END
      WHEN interval_type = 'CALENDAR_MONTHS' THEN
        CASE
          WHEN p_current_calendar_date >= next_due_date THEN 'RED'
          WHEN p_current_calendar_date >= (next_due_date - (grace_value || ' days')::INTERVAL)::DATE THEN 'YELLOW'
          ELSE 'GREEN'
        END
    END::VARCHAR AS due_status,
    -- WHICHEVER COMES FIRST (WCF)
    CASE
      WHEN next_due_hours IS NOT NULL AND next_due_date IS NOT NULL THEN
        CASE
          WHEN (next_due_hours - p_current_flight_hours) <= (next_due_date - p_current_calendar_date)::DECIMAL
          THEN 'HOURS'
          ELSE 'CALENDAR'
        END
      WHEN next_due_hours IS NOT NULL THEN 'HOURS'
      ELSE 'CALENDAR'
    END::VARCHAR AS which_comes_first
  FROM due_calculations
  ORDER BY
    CASE
      WHEN interval_type = 'FLIGHT_HOURS' THEN COALESCE(next_due_hours, 999999)
      WHEN interval_type = 'CALENDAR_MONTHS' THEN COALESCE(EXTRACT(DAY FROM (next_due_date - p_current_calendar_date)), 999999)
      ELSE 999999
    END ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Usage: SELECT * FROM calculate_next_due('aircraft-task-id', 2450.5, '2026-03-26');
```

### 4.2 Whichever Comes First (WCF) Rule

**Safety-Critical Logic:** If Task X is due at 400 Hours AND 24 Months, flag whichever limit hits first.

```sql
-- Dashboard View: WCF Status for Aircraft
CREATE OR REPLACE VIEW v_aircraft_maintenance_status AS
SELECT
  a.tail_number,
  mt.task_code,
  mt.description,
  cnd.next_due_hours,
  cnd.next_due_date,
  cnd.remaining_hours,
  cnd.remaining_days,
  cnd.which_comes_first,  -- Primary display column
  cnd.due_status,

  -- Enterprise reporting
  CASE
    WHEN cnd.due_status = 'RED' THEN CONCAT(mt.task_code, ' OVERDUE')
    WHEN cnd.due_status = 'YELLOW' THEN CONCAT(mt.task_code, ' - ', cnd.which_comes_first, ' in ', LEAST(cnd.remaining_hours::INT, cnd.remaining_days), ' units')
    ELSE CONCAT(mt.task_code, ' - GREEN')
  END AS alert_message
FROM aircraft a
JOIN aircraft_maintenance_tasks amt ON a.id = amt.aircraft_id
JOIN maintenance_tasks mt ON amt.task_id = mt.id
CROSS JOIN LATERAL calculate_next_due(
  amt.id,
  a.current_flight_hours,
  CURRENT_DATE
) cnd
ORDER BY
  CASE WHEN cnd.due_status = 'RED' THEN 0
       WHEN cnd.due_status = 'YELLOW' THEN 1
       ELSE 2
  END,
  LEAST(cnd.remaining_hours::INT, cnd.remaining_days) ASC;
```

### 4.3 Task Grouping & Check Packaging (A-Check, Annual, C-Check)

```sql
CREATE TABLE maintenance_checks (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  franchise_id UUID NOT NULL,

  check_type VARCHAR(50) NOT NULL,  -- ENUM: A_CHECK, B_CHECK, C_CHECK, ANNUAL, HEAVY_MAINTENANCE
  check_code VARCHAR(20) UNIQUE,  -- e.g., "CHK-A1", "CHK-ANNUAL"
  description TEXT,
  typical_duration_hours DECIMAL(8,2),

  -- Check triggers
  primary_interval_id UUID REFERENCES task_intervals(id),  -- Frequency

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE check_task_mappings (
  id UUID PRIMARY KEY,
  check_id UUID NOT NULL REFERENCES maintenance_checks(id),
  task_id UUID NOT NULL REFERENCES maintenance_tasks(id),

  -- Sequencing
  task_sequence INT,
  mandatory BOOLEAN DEFAULT true,

  UNIQUE(check_id, task_id)
);

-- Example: A-Check contains 20 tasks (inspection, lubrication, etc.)
-- When A-Check is scheduled, all 20 tasks are marked due
```

---

## PAGE 5: IMPLEMENTATION CONSTRAINTS & ENTERPRISE STANDARDS

### 5.1 Data Integrity Constraints (FAA/EASA Audit-Ready)

```sql
-- Constraint 1: skill_type must match estd_man_hours
ALTER TABLE maintenance_tasks
  ADD CONSTRAINT valid_skill_man_hours CHECK (
    estd_man_hours > 0 AND skill_type IN ('AIRFRAME', 'ENGINE', 'AVIONICS', 'HYDRAULIC')
  );

-- Constraint 2: version_number auto-increment on update
CREATE TRIGGER maintenance_tasks_version_increment
BEFORE UPDATE ON maintenance_tasks
FOR EACH ROW
WHEN (OLD.description IS DISTINCT FROM NEW.description
   OR OLD.applicability_rules IS DISTINCT FROM NEW.applicability_rules)
BEGIN
  NEW.version_number = OLD.version_number + 1;
  NEW.updated_at = CURRENT_TIMESTAMP;
END;

-- Constraint 3: superseded_by_id must point to same ATA code
ALTER TABLE maintenance_tasks
  ADD CONSTRAINT valid_supersession CHECK (
    superseded_by_id IS NULL OR
    EXISTS (SELECT 1 FROM maintenance_tasks mt2 WHERE mt2.id = superseded_by_id
            AND mt2.ata_code_id = maintenance_tasks.ata_code_id)
  );

-- Constraint 4: No tenants can see each other's data
ALTER TABLE maintenance_tasks
  ADD CONSTRAINT tenant_franchise_isolation CHECK (
    (tenant_id IS NOT NULL) AND
    (franchise_id IS NULL OR tenant_id = (SELECT tenant_id FROM franchises WHERE id = franchise_id))
  );
```

### 5.2 MTOSS Extension (7-Segment Code)

Enterprise systems use MTOSS (Maintenance Task Oriented Support System) for granular reporting:

```
Format: XX-XX-XX-XXX-XXX-XXX
        └─ Chapter
          └─ Section
            └─ Subject
              └─ Function (040 = Cleaning, 050 = Inspection, 060 = Overhaul)
                └─ Subfunction
                  └─ Unique ID

Example: 21-10-00-040-001 = Air Conditioning → Compression → Cleaning (1st task)
         21-10-00-050-002 = Air Conditioning → Compression → Inspection (2nd task)
```

```sql
-- MTOSS lookup table for reporting
CREATE TABLE mtoss_functions (
  code VARCHAR(3) PRIMARY KEY,
  description VARCHAR(100),
  category VARCHAR(50)
);

INSERT INTO mtoss_functions (code, description, category) VALUES
  ('040', 'Cleaning', 'Maintenance'),
  ('050', 'Inspection', 'Maintenance'),
  ('060', 'Overhaul', 'Maintenance'),
  ('070', 'Removal', 'Maintenance'),
  ('080', 'Installation', 'Maintenance'),
  ('090', 'Test', 'Verification');
```

### 5.3 Version Control for Legal Compliance

Every time an MPD task changes, a new version is created. The old version remains for historical queries.

```sql
-- Example: Retrieve maintenance requirements from 5 years ago
SELECT task_code, description, estd_man_hours, effective_date
FROM maintenance_tasks
WHERE aircraft_id = 'aircraft-123'
  AND effective_date <= '2021-03-26'
  AND (obsolete_date IS NULL OR obsolete_date > '2021-03-26')
  AND superseded_by_id IS NULL;
```

### 5.4 Standardized Skill Sets & Labor Planning

```sql
CREATE TABLE skill_types (
  code VARCHAR(50) PRIMARY KEY,
  description VARCHAR(100),
  certification_required BOOLEAN,
  min_experience_years INT,
  average_hourly_cost DECIMAL(10,2)
);

INSERT INTO skill_types VALUES
  ('AIRFRAME', 'Airframe Technician', true, 5, 85.00),
  ('ENGINE', 'Engine Technician', true, 8, 95.00),
  ('AVIONICS', 'Avionics Technician', true, 6, 110.00),
  ('HYDRAULIC', 'Hydraulic Systems', true, 5, 90.00);

-- Constraint: All maintenance_tasks.skill_type MUST exist in skill_types
ALTER TABLE maintenance_tasks
  ADD FOREIGN KEY (skill_type) REFERENCES skill_types(code);
```

### 5.5 Recommended Database Indexes (Performance)

```sql
-- Applicability filtering (fast aircraft → task lookup)
CREATE INDEX idx_task_applicability_rules ON maintenance_tasks USING GIN (applicability_rules);
CREATE INDEX idx_aircraft_model_engine ON aircraft(model, engine_type, tenant_id);

-- Next Due calculations (common dashboard queries)
CREATE INDEX idx_aircraft_task_completion ON aircraft_maintenance_tasks(aircraft_id, last_completed_date, last_completed_flight_hours);
CREATE INDEX idx_task_intervals ON task_intervals(task_id, interval_type, is_active);

-- Multi-tenancy isolation
CREATE INDEX idx_tenant_isolation ON maintenance_tasks(tenant_id, franchise_id);
CREATE INDEX idx_tenant_isolation_ata ON ata_codes(tenant_id);

-- Audit trail
CREATE INDEX idx_task_created_at ON maintenance_tasks(created_at DESC);
```

### 5.6 Audit Trail & Compliance Reporting

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  franchise_id UUID,
  entity_type VARCHAR(50),  -- e.g., 'maintenance_task', 'aircraft'
  entity_id UUID,
  action VARCHAR(20),  -- INSERT, UPDATE, DELETE
  old_values JSONB,
  new_values JSONB,
  changed_by_id UUID,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Trigger on all maintenance tables
CREATE TRIGGER audit_maintenance_tasks_changes
AFTER UPDATE OR DELETE ON maintenance_tasks
FOR EACH ROW
EXECUTE FUNCTION audit_log_trigger();
```

---

## IMPLEMENTATION ROADMAP

| Phase | Component | Timeline |
|-------|-----------|----------|
| **Phase 1** | ATA Hierarchy + Master MPD Ingestion | Week 1-2 |
| **Phase 2** | Multi-Tenancy Layer + RLS Policies | Week 2-3 |
| **Phase 3** | Applicability Engine (JSON + Function) | Week 3-4 |
| **Phase 4** | Next Due Calculation + WCF Logic | Week 4-5 |
| **Phase 5** | Dashboard + React Filters | Week 5-6 |
| **Phase 6** | Audit Trail + Compliance Reporting | Week 6-7 |

---

## KEY TAKEAWAYS

✅ **Multi-Tenancy:** Every entity carries `tenant_id + franchise_id`; RLS enforces isolation.

✅ **Applicability Engine:** JSON-based rules + PostgreSQL function handles 3,000+ → ~1,000 auto-filtering.

✅ **Master → Fleet Propagation:** Single source of truth; auto-populates on aircraft addition.

✅ **WCF Logic:** Real-time calculation of which interval limit hits first (safety-critical).

✅ **Version Control:** Legal compliance via task versioning + superseded tracking.

✅ **Enterprise Standards:** MTOSS codes, skill-based labor planning, EASA/FAA audit-ready.

✅ **Normalization:** Intervals separated from tasks enable "every 12mo for 5yr, then 6mo" logic.

---

**Document Classification:** Technical Design | Internal Use | March 2026