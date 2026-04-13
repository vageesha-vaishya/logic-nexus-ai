# AMRO Enterprise Enhancement - Architecture Clarification

## ⚠️ Important: Corrected Implementation

The original migration (`20260413100000`) created **DUPLICATE** tables that conflict with your existing comprehensive parts inventory system. This was **incorrect**.

The **corrected migration** (`20260413100001`) properly **EXTENDS** your existing tables instead of duplicating them.

---

## ✅ Your EXISTING Comprehensive System

You already have a **production-grade** parts and inventory management system:

### Parts Inventory Module (`/dashboard/amro/parts`)

| Existing Table | Purpose | Features |
|----------------|---------|----------|
| `parts_inventory` | Stock/on-hand tracking | quantity_on_hand, quantity_reserved, quantity_available, unit_cost, reorder_level |
| `amro_item_master` | Item definitions catalog | Part numbers, descriptions, item types, lifecycle status |
| `amro_stock_ledger_transactions` | Double-entry stock ledger | Quantity deltas, balance_after, valuation (FIFO/LIFO/weighted-average) |
| `amro_stock_valuation_layers` | Cost layers | FIFO/LIFO/weighted-average cost tracking |
| `reservations` | Part reservations | Links parts_inventory to work packages/tasks |
| `amro_purchase_orders` | Purchase orders | PO management with supplier FK |
| `amro_purchase_order_items` | PO line items | Links to parts_inventory and suppliers |
| `suppliers` | Supplier master data | Supplier codes, lead times, ratings |
| `amro_item_cross_references` | Alternate part numbers | Superseded parts mapping |
| `amro_item_uom_conversions` | Unit of measure | Conversion factors |
| `amro_aog_alerts` | AOG critical alerts | Shortage alerts with escalation |
| `amro_part_interchangeability` | Alternate/interchangeable parts | Direct, conditional, emergency substitution |
| `amro_inventory_reorder_queue` | Automated reorder triggers | Reorder point monitoring |
| `amro_inventory_scan_events` | Barcode/RFID scanning | Scan event logging |

**This is ALREADY ENTERPRISE-GRADE!** 🎉

---

## 🔧 What the CORRECTED Migration Does

### 1. **EXTENDS** `parts_inventory` with Aviation-Specific Fields

Instead of creating a duplicate `amro_materials_catalog`, we ADD columns to your existing `parts_inventory`:

```sql
ALTER TABLE public.parts_inventory
  ADD COLUMN IF NOT EXISTS nsn TEXT,  -- NATO Stock Number
  ADD COLUMN IF NOT EXISTS cage_code TEXT,  -- CAGE code for manufacturer ID
  ADD COLUMN IF NOT EXISTS nomenclature TEXT,  -- Standard aviation naming
  ADD COLUMN IF NOT EXISTS material_group TEXT,  -- consumable/rotable/expendable/repairable
  ADD COLUMN IF NOT EXISTS ercs_item BOOLEAN,  -- Engine Rotable Component Summary
  ADD COLUMN IF NOT EXISTS safety_item BOOLEAN,
  ADD COLUMN IF NOT EXISTS technical_documentation JSONB,  -- Manuals, drawings, MSDS
  ADD COLUMN IF NOT EXISTS cost_center TEXT,
  ADD COLUMN IF NOT EXISTS preferred_supplier_id UUID REFERENCES suppliers(id),
  ADD COLUMN IF NOT EXISTS procurement_type TEXT,  -- stock/purchase/consignment/loan
  ADD COLUMN IF NOT EXISTS wastage_factor NUMERIC,
  ADD COLUMN IF NOT EXISTS quantity_per_aircraft NUMERIC;
```

**Result**: Your existing parts inventory now supports aviation-specific enterprise features WITHOUT duplication.

### 2. **CREATES** Genuinely New Tooling Management Tables

You have **NO existing tool management system**, so we create:

| New Table | Purpose | Why It's New |
|-----------|---------|--------------|
| `amro_tooling_registry` | Master tooling data | No tool tracking exists |
| `amro_tooling_instances` | Physical tool instances with serials | No serial number tracking for tools |
| `amro_tool_reservations` | Tool reservation system | Tools ≠ Parts, need separate reservations |
| `amro_calibration_logs` | Calibration history | No calibration tracking exists |
| `amro_tool_maintenance_history` | Tool maintenance records | No tool maintenance tracking |

**These are TRULY NEW capabilities** for your MRO system.

### 3. **EXTENDS** Compliance Management

You have basic compliance (`compliance_obligations`, `compliance_records`), we ADD aviation-specific:

| New Table | Relationship to Existing |
|-----------|-------------------------|
| `amro_compliance_ad_sb_registry` | NEW - AD/SB regulatory feed from FAA/EASA |
| `amro_compliance_requirements_enhanced` | EXTENDS - Links to `compliance_obligations` and `compliance_records` |
| `amro_compliance_documents` | NEW - Document attachments for compliance |

---

## 🗂️ Correct Architecture

### Materials/Parts Flow

```
┌─────────────────────────────────────────────────────────┐
│                   EXISTING SYSTEM                        │
│                                                          │
│  parts_inventory (enhanced with aviation fields)        │
│  ├── quantity_on_hand, quantity_reserved                │
│  ├── nsn, cage_code, nomenclature (NEW)                 │
│  ├── material_group, ercs_item (NEW)                    │
│  └── technical_documentation (NEW)                      │
│                                                          │
│  amro_item_master (item definitions)                    │
│  amro_stock_ledger_transactions (double-entry)          │
│  reservations (part reservations for WPs)               │
│  amro_purchase_orders + items (procurement)             │
│  suppliers (supplier master)                            │
└─────────────────────────────────────────────────────────┘
```

### Tooling Flow (NEW)

```
┌─────────────────────────────────────────────────────────┐
│                   NEW TOOLING SYSTEM                     │
│                                                          │
│  amro_tooling_registry (master tool definitions)        │
│  ├── tool_code, tool_name, manufacturer                 │
│  ├── tool_category, specifications                      │
│  └── calibration_required, calibration_interval_days    │
│                                                          │
│  amro_tooling_instances (physical tools)                │
│  ├── serial_number, current_status                      │
│  ├── last_calibration_date, next_calibration_due        │
│  └── calibration_status (auto-updated by trigger)       │
│                                                          │
│  amro_tool_reservations (tool bookings)                 │
│  amro_calibration_logs (calibration certificates)       │
│  amro_tool_maintenance_history (maintenance records)    │
└─────────────────────────────────────────────────────────┘
```

### Compliance Flow

```
┌─────────────────────────────────────────────────────────┐
│              EXISTING + ENHANCED COMPLIANCE              │
│                                                          │
│  compliance_obligations (EXISTING)                       │
│  ├── Base regulatory obligations                         │
│  └── Links to regulators, obligations                    │
│                                                          │
│  compliance_records (EXISTING)                           │
│  ├── Compliance decisions and sign-offs                  │
│  └── Audit trail                                         │
│                                                          │
│  amro_compliance_ad_sb_registry (NEW)                    │
│  ├── AD/SB feed from FAA, EASA, etc.                     │
│  ├── directive_number, effective_date, deadline          │
│  └── applicable_to_fleet, affected_aircraft              │
│                                                          │
│  amro_compliance_requirements_enhanced (NEW)             │
│  ├── Links to compliance_obligations (FK)                │
│  ├── Links to amro_compliance_ad_sb_registry (FK)        │
│  ├── Digital signatures with SHA-256 hashing             │
│  └── Exemptions, deviations, audit trail                 │
│                                                          │
│  amro_compliance_documents (NEW)                         │
│  └── Supporting documents (ADs, SBs, work cards)         │
└─────────────────────────────────────────────────────────┘
```

---

## 🚫 What NOT to Use

### ❌ DO NOT USE These Tables (from incorrect migration 20260413100000):

| Table | Why Not | What to Use Instead |
|-------|---------|---------------------|
| `amro_materials_catalog` | Duplicate of `parts_inventory` + `amro_item_master` | Use `parts_inventory` (enhanced) |
| `amro_material_suppliers` | Duplicate concept | Use `parts_inventory.preferred_supplier_id` |
| `amro_material_reservations` | Duplicate of `reservations` | Use `reservations` table |
| `amro_purchase_orders` (from Apr 13) | Conflicts with Apr 10 version | Use `amro_purchase_orders` (from Apr 10) |

### ✅ DO USE These Tables (from corrected migration 20260413100001):

| Table | Purpose |
|-------|---------|
| `parts_inventory` (enhanced) | Your existing parts with new aviation fields |
| `amro_tooling_registry` | NEW - Tool master definitions |
| `amro_tooling_instances` | NEW - Physical tool tracking |
| `amro_tool_reservations` | NEW - Tool reservation system |
| `amro_calibration_logs` | NEW - Calibration certificates |
| `amro_compliance_ad_sb_registry` | NEW - AD/SB regulatory feed |
| `amro_compliance_requirements_enhanced` | NEW - Enhanced compliance with digital signatures |

---

## 🔌 Updated API Integration

### Materials API Should Use Existing Tables

The Materials API needs to be **REWRITTEN** to use your existing tables:

```typescript
// ❌ WRONG (uses duplicate tables)
const material = await supabase
  .from('amro_materials_catalog')
  .select('*')
  .eq('id', materialId);

// ✅ CORRECT (uses existing enhanced table)
const material = await supabase
  .from('parts_inventory')
  .select(`
    *,
    supplier:suppliers(*),
    item_master:amro_item_master(*)
  `)
  .eq('id', materialId);
```

### Tooling API is Correct ( genuinely new functionality)

```typescript
// ✅ CORRECT (no existing equivalent)
const tool = await supabase
  .from('amro_tooling_registry')
  .select(`
    *,
    instances:amro_tooling_instances(*)
  `)
  .eq('id', toolId);
```

---

## 📋 Migration Application Order

### Step 1: Drop Incorrect Tables (if already applied)

```sql
-- ONLY IF you applied 20260413100000 (incorrect migration)
DROP TABLE IF EXISTS public.amro_materials_catalog CASCADE;
DROP TABLE IF EXISTS public.amro_material_suppliers CASCADE;
DROP TABLE IF EXISTS public.amro_material_reservations CASCADE;
-- Keep amro_purchase_orders from April 10 migration, not April 13
```

### Step 2: Apply Corrected Migration

```bash
supabase db push
# This applies: 20260413100001_amro_enterprise_enhancement_corrected.sql
```

### Step 3: Verify Tables

```sql
-- Check enhanced parts_inventory columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'parts_inventory' 
  AND column_name IN ('nsn', 'cage_code', 'nomenclature', 'material_group', 'ercs_item')
ORDER BY column_name;

-- Check new tooling tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE 'amro_tooling%' 
   OR table_name LIKE 'amro_calibration%'
   OR table_name LIKE 'amro_compliance_ad_sb%'
ORDER BY table_name;
```

---

## 🎯 Summary

| Aspect | Original (WRONG) | Corrected (RIGHT) |
|--------|------------------|-------------------|
| **Approach** | Create parallel tables | EXTEND existing tables |
| **Materials** | `amro_materials_catalog` (duplicate) | Enhance `parts_inventory` (existing) |
| **Reservations** | `amro_material_reservations` (duplicate) | Use `reservations` (existing) |
| **Purchase Orders** | New `amro_purchase_orders` (conflict) | Use Apr 10 `amro_purchase_orders` |
| **Tooling** | ✅ New tables (correct) | ✅ New tables (correct) |
| **Compliance** | ✅ Extended tables (correct) | ✅ Extended with FK to existing (better) |
| **Integration** | Requires data sync | Native integration |
| **Data Integrity** | Risk of inconsistency | Single source of truth |

---

## 🚀 Next Steps

1. ✅ **DO NOT APPLY** the original `20260413100000` migration
2. ✅ **APPLY** the corrected `20260413100001` migration
3. ✅ **UPDATE** Materials API to use existing `parts_inventory` instead of `amro_materials_catalog`
4. ✅ **KEEP** Tooling API as-is (genuinely new functionality)
5. ✅ **TEST** all integrations with existing parts inventory module

---

## 📚 File Reference

| File | Status | Purpose |
|------|--------|---------|
| `20260413100000_amro_enterprise_enhancement_schema.sql` | ❌ **DO NOT USE** | Incorrect - creates duplicates |
| `20260413100001_amro_enterprise_enhancement_corrected.sql` | ✅ **USE THIS** | Correct - extends existing |
| `AMRO_ENTERPRISE_ARCHITECTURE.md` | ✅ This file | Architecture clarification |

---

**Your existing parts inventory system is already enterprise-grade!** The enhancement should build on top of it, not replace it.
