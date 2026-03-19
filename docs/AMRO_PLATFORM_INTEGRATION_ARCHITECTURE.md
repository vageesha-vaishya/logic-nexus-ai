# AMRO-Logic Nexus-AI Integration Architecture
## Comprehensive Technical Design & Implementation Guide

**Document ID:** ARCH-AMRO-INTEGRATION-001
**Version:** 1.0.0
**Date:** 2026-03-19
**Status:** Complete Technical Design
**Owner:** Architecture & Integration Engineering Team
**Scope:** End-to-end AMRO integration with logic-nexus-ai platform

---

## Executive Summary

This document defines the complete technical architecture for integrating the AMRO (Asset Maintenance, Repair, and Operations) domain with the Logic Nexus-AI platform. The integration leverages Supabase PostgreSQL database, implements enterprise-grade APIs, and provides real-time data synchronization for aviation maintenance operations.

**Integration Objectives:**
- Seamless data synchronization between AMRO operations and platform services
- Real-time predictive analytics for maintenance optimization
- Regulatory compliance tracking (FAA, EASA, ISO 55000)
- High-performance handling of 10,000+ concurrent maintenance records
- Secure access control for sensitive aviation maintenance data

**Key Deliverables:**
1. Database schema mapping & migrations
2. REST/GraphQL API layer with versioning
3. AMRO-specific business logic services
4. Real-time data pipeline architecture
5. Authentication & authorization framework
6. Aviation-grade error handling & validation
7. Performance optimization strategies
8. Comprehensive testing framework
9. Production deployment architecture
10. Complete documentation & runbooks

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Database Schema Mapping](#2-database-schema-mapping)
3. [API Layer Design](#3-api-layer-design)
4. [Business Logic Implementation](#4-business-logic-implementation)
5. [Real-Time Data Pipeline](#5-real-time-data-pipeline)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Error Handling & Validation](#7-error-handling--validation)
8. [Performance Optimization](#8-performance-optimization)
9. [Testing Strategy](#9-testing-strategy)
10. [Deployment Architecture](#10-deployment-architecture)
11. [Documentation & Runbooks](#11-documentation--runbooks)

---

## 1. System Architecture Overview

### 1.1 Integration Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Client Applications                          │
│  ├─ Web Dashboard (React)   ├─ Mobile App (React Native)          │
│  └─ Field Technician Tools  └─ Compliance & Reporting              │
└────────────────────┬────────────────────────────────────────────────┘
                     │
     ┌───────────────┼───────────────┐
     ↓               ↓               ↓
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ REST API v1  │ │ GraphQL API  │ │ WebSocket    │
│ /api/amro    │ │ Subscriptions│ │ Real-time    │
└──────────────┘ └──────────────┘ └──────────────┘
     │               │               │
     └───────────────┼───────────────┘
                     ↓
     ┌───────────────────────────────────┐
     │   API Layer (NestJS)              │
     │  ├─ Controllers                   │
     │  ├─ Guards (Auth, RBAC, RLS)     │
     │  └─ Interceptors (Logging, etc)  │
     └───────────────┬───────────────────┘
                     ↓
     ┌───────────────────────────────────┐
     │   Business Logic Layer            │
     │  ├─ AMRO Services                │
     │  │  ├─ WorkOrderService          │
     │  │  ├─ MaintenanceScheduler      │
     │  │  ├─ InventoryManager          │
     │  │  ├─ ComplianceTracker         │
     │  │  └─ RepairOrderProcessor      │
     │  ├─ Integration Services         │
     │  │  ├─ DataSyncService           │
     │  │  ├─ EventPublisher            │
     │  │  └─ AnalyticsConnector        │
     │  └─ External Adapters            │
     │     ├─ SAP PM Integration        │
     │     ├─ Maximo Integration        │
     │     └─ ERP Bridge                │
     └───────────────┬───────────────────┘
                     ↓
     ┌───────────────────────────────────┐
     │   Data Layer (Supabase)           │
     │  ├─ Operational Schema            │
     │  │  ├─ aircraft                   │
     │  │  ├─ components                 │
     │  │  ├─ work_orders                │
     │  │  ├─ maintenance_tasks          │
     │  │  ├─ inventory_items            │
     │  │  ├─ compliance_records         │
     │  │  └─ repair_orders              │
     │  ├─ Immutable Audit Schema       │
     │  │  ├─ mro_audit.records         │
     │  │  └─ mro_audit.trails          │
     │  └─ RLS Policies (Multi-tenant)  │
     │     └─ Tenant isolation           │
     └───────────────┬───────────────────┘
                     ↓
┌─────────────────────────────────────────┐
│   Observability & Integration           │
│  ├─ Kafka (Event Streaming)            │
│  ├─ OpenTelemetry (Tracing)            │
│  ├─ Prometheus (Metrics)               │
│  ├─ ELK Stack (Logging)                │
│  └─ Redis (Caching)                    │
└─────────────────────────────────────────┘
```

### 1.2 Technology Stack

```
Frontend
├─ React 18+ (Web Dashboard)
├─ React Native 0.72+ (Mobile)
└─ TypeScript (Type safety)

Backend
├─ Node.js 18+ LTS
├─ NestJS 10+ (Framework)
├─ TypeScript (Type safety)
└─ Express (HTTP)

Database
├─ PostgreSQL 15+ (Primary)
├─ Supabase (Managed PG + Auth + RLS)
├─ Redis (Caching & Sessions)
└─ Elasticsearch (Full-text search)

Integration & Events
├─ Kafka 3.x+ (Event streaming)
├─ Apache NiFi (Data pipelines)
└─ Webhooks (External integrations)

Observability
├─ OpenTelemetry (Distributed tracing)
├─ Prometheus (Metrics)
├─ Grafana (Visualization)
├─ ELK Stack (Logging)
└─ Jaeger (Trace visualization)

Testing
├─ Jest (Unit & integration tests)
├─ Supertest (API testing)
├─ Cypress (E2E testing)
├─ K6 (Load testing)
└─ OWASP ZAP (Security testing)

Deployment
├─ Docker (Containerization)
├─ Kubernetes (Orchestration)
├─ ArgoCD (GitOps)
└─ Helm (Package management)
```

### 1.3 High-Level Data Flow

```
AMRO Operations
     │
     ├─→ Create Work Order
     │   └─→ REST API POST /api/amro/v1/work-orders
     │       └─→ WorkOrderService.createWorkOrder()
     │           ├─→ Validate (Aviation rules, inventory)
     │           ├─→ Insert to PostgreSQL (work_orders table)
     │           ├─→ Publish Kafka event (amro.work_order.created)
     │           ├─→ Audit log to mro_audit.records
     │           └─→ Response to client
     │
     ├─→ Schedule Maintenance
     │   └─→ MaintenanceScheduler.scheduleTask()
     │       ├─→ Check aircraft availability
     │       ├─→ Allocate technician & parts
     │       ├─→ Check certifications (RBAC)
     │       ├─→ Update work_orders status
     │       └─→ Emit Kafka event (amro.maintenance.scheduled)
     │
     ├─→ Execute Maintenance
     │   └─→ Mobile app sends task updates (offline-first)
     │       ├─→ Local AsyncStorage cache
     │       ├─→ Digital signature capture
     │       ├─→ Evidence attachment (photos)
     │       └─→ Sync to API when online
     │           ├─→ WorkOrderService.submitTaskExecution()
     │           ├─→ Validate against compliance rules
     │           ├─→ Update database
     │           ├─→ Publish Kafka event
     │           └─→ Append to audit trail
     │
     ├─→ Real-time Analytics Pipeline
     │   └─→ Kafka Consumer (AMRO data stream)
     │       ├─→ Apache NiFi (ETL transformation)
     │       ├─→ Feature engineering for ML
     │       ├─→ Store in Data Lake
     │       └─→ AI model inference
     │           ├─→ Predictive maintenance
     │           ├─→ Parts shortage prediction
     │           └─→ Compliance risk scoring
     │
     └─→ Report & Compliance
         └─→ Analytics API
             ├─→ Dashboard visualization
             ├─→ Export reports (PDF)
             ├─→ Audit trail replay
             └─→ Compliance scorecard
```

---

## 2. Database Schema Mapping

### 2.1 Domain-to-Platform Mapping Strategy

**Approach:** AMRO entities map to `platform_domains` structure with tenant isolation

```
Platform Structure:
├─ tenants (multi-tenancy)
├─ organizations (customer org hierarchy)
├─ users (IAM)
├─ roles (RBAC)
└─ domain-specific tables

AMRO Domain Mapping:
├─ aircraft (serialized asset registry)
├─ components (serialized parts with LLP tracking)
├─ work_orders (maintenance order management)
├─ maintenance_tasks (task execution)
├─ inventory_items (parts stock)
├─ compliance_records (regulatory tracking)
├─ repair_orders (corrective maintenance)
├─ maintenance_events (execution audit)
└─ mro_audit.* (immutable audit trail)
```

### 2.2 Operational Schema (PostgreSQL)

#### Core Tables

**Table: aircraft**
```sql
CREATE TABLE public.aircraft (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),

  -- Aircraft identification
  tail_number VARCHAR(20) NOT NULL,
  icao_code VARCHAR(10),
  registration_number VARCHAR(50),

  -- Aircraft details
  aircraft_model VARCHAR(100) NOT NULL,
  manufacturer VARCHAR(100),
  year_manufactured INT,
  serial_number VARCHAR(100) UNIQUE,

  -- Operational status
  status VARCHAR(50) CHECK (status IN ('active', 'maintenance', 'grounded', 'retired')) DEFAULT 'active',
  service_status VARCHAR(50) CHECK (service_status IN ('in_service', 'scheduled_maintenance', 'emergency_maintenance')) DEFAULT 'in_service',

  -- Flight hours & cycles
  total_flight_hours DECIMAL(12,2) DEFAULT 0,
  total_cycles INT DEFAULT 0,
  last_maintenance_date TIMESTAMP,
  next_scheduled_maintenance TIMESTAMP,

  -- Location tracking
  current_location VARCHAR(255),
  home_base VARCHAR(255),

  -- Metadata
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT aircraft_unique_per_tenant UNIQUE (tenant_id, tail_number)
);

CREATE INDEX idx_aircraft_tenant_status ON public.aircraft(tenant_id, status);
CREATE INDEX idx_aircraft_next_maintenance ON public.aircraft(next_scheduled_maintenance);
ALTER TABLE public.aircraft ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_aircraft ON public.aircraft
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

**Table: components** (Serialized parts with LLP tracking)
```sql
CREATE TABLE public.components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  aircraft_id UUID NOT NULL REFERENCES public.aircraft(id) ON DELETE CASCADE,

  -- Part identification
  part_number VARCHAR(50) NOT NULL,
  serial_number VARCHAR(100) NOT NULL UNIQUE,
  batch_number VARCHAR(50),

  -- Component details
  component_type VARCHAR(50) NOT NULL, -- engine, hydraulics, avionics, etc.
  component_name VARCHAR(255),
  manufacturer VARCHAR(100),
  ata_chapter VARCHAR(10), -- Air Transport Association chapter

  -- Life-Limited Part (LLP) tracking
  llp_hours DECIMAL(10,2),
  llp_cycles INT,
  llp_calendar_days INT,

  -- Current usage
  current_hours DECIMAL(10,2) DEFAULT 0,
  current_cycles INT DEFAULT 0,
  current_calendar_days INT DEFAULT 0,

  -- Status
  status VARCHAR(50) CHECK (status IN ('serviceable', 'unserviceable', 'undergoing_maintenance', 'reserved')) DEFAULT 'serviceable',

  -- Installation tracking
  installed_at TIMESTAMP,
  removed_at TIMESTAMP,
  location_on_aircraft VARCHAR(255),

  -- Maintenance tracking
  last_overhaul_date TIMESTAMP,
  next_scheduled_overhaul TIMESTAMP,
  overhaul_interval_hours DECIMAL(10,2),

  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT component_unique_serial UNIQUE (tenant_id, serial_number)
);

CREATE INDEX idx_components_aircraft ON public.components(aircraft_id);
CREATE INDEX idx_components_status ON public.components(status);
CREATE INDEX idx_components_llp ON public.components(llp_hours, current_hours);
ALTER TABLE public.components ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_components ON public.components
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

**Table: work_orders** (Main maintenance orders)
```sql
CREATE TABLE public.work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  aircraft_id UUID NOT NULL REFERENCES public.aircraft(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),

  -- Work order identification
  work_order_number VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- Work order type & source
  work_type VARCHAR(50) CHECK (work_type IN ('preventive', 'corrective', 'regulatory', 'inspection')) NOT NULL,
  priority VARCHAR(50) CHECK (priority IN ('critical', 'high', 'medium', 'low')) DEFAULT 'medium',

  -- Source tracking (what triggered this WO)
  source_type VARCHAR(50) CHECK (source_type IN ('routine_schedule', 'defect_report', 'inspection_finding', 'ad_sb_requirement', 'customer_request')),
  source_id VARCHAR(100), -- Reference to triggering defect, AD, etc.

  -- Maintenance classification
  maintenance_type VARCHAR(50) CHECK (maintenance_type IN ('line', 'base', 'intermediate', 'heavy_maintenance')),

  -- Planning details
  estimated_labor_hours DECIMAL(8,2),
  estimated_downtime_minutes INT,
  estimated_cost DECIMAL(12,2),

  -- Scheduling
  scheduled_start_date TIMESTAMP,
  scheduled_end_date TIMESTAMP,
  actual_start_date TIMESTAMP,
  actual_completion_date TIMESTAMP,

  -- Status tracking
  status VARCHAR(50) CHECK (status IN ('draft', 'approved', 'scheduled', 'in_progress', 'on_hold', 'completed', 'closed', 'cancelled')) DEFAULT 'draft',
  completion_percentage INT DEFAULT 0,

  -- Assignment
  assigned_to UUID REFERENCES public.users(id),
  supervisor_id UUID REFERENCES public.users(id),

  -- Compliance tracking
  is_compliant_with_regulations BOOLEAN DEFAULT FALSE,
  compliance_notes TEXT,
  regulatory_deadline TIMESTAMP,

  -- Metadata
  created_by UUID REFERENCES public.users(id) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT wo_unique_per_tenant UNIQUE (tenant_id, work_order_number)
);

CREATE INDEX idx_work_orders_tenant_status ON public.work_orders(tenant_id, status);
CREATE INDEX idx_work_orders_aircraft ON public.work_orders(aircraft_id);
CREATE INDEX idx_work_orders_scheduled ON public.work_orders(scheduled_start_date);
CREATE INDEX idx_work_orders_regulatory ON public.work_orders(regulatory_deadline);
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_work_orders ON public.work_orders
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

**Table: maintenance_tasks** (Individual tasks within work orders)
```sql
CREATE TABLE public.maintenance_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,

  -- Task identification
  task_sequence INT NOT NULL,
  task_name VARCHAR(255),
  description TEXT,

  -- Procedure reference
  procedure_reference VARCHAR(255), -- e.g., "ATA 27-30-01"
  maintenance_manual_reference VARCHAR(255),

  -- Task execution details
  estimated_duration_minutes INT,
  required_technician_rating VARCHAR(100),
  required_certifications JSONB, -- Array of required certifications
  tools_required JSONB,

  -- Execution tracking
  status VARCHAR(50) CHECK (status IN ('pending', 'assigned', 'in_progress', 'on_hold', 'completed', 'failed', 'deferred')) DEFAULT 'pending',
  assigned_technician_id UUID REFERENCES public.users(id),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,

  -- Compliance
  requires_inspection BOOLEAN DEFAULT FALSE,
  inspection_type VARCHAR(100),
  signed_by_technician UUID REFERENCES public.users(id),
  signed_at TIMESTAMP,

  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT task_unique_sequence UNIQUE (work_order_id, task_sequence)
);

CREATE INDEX idx_maintenance_tasks_work_order ON public.maintenance_tasks(work_order_id);
CREATE INDEX idx_maintenance_tasks_technician ON public.maintenance_tasks(assigned_technician_id);
CREATE INDEX idx_maintenance_tasks_status ON public.maintenance_tasks(status);
ALTER TABLE public.maintenance_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_maintenance_tasks ON public.maintenance_tasks
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

**Table: inventory_items** (Parts stock management)
```sql
CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),

  -- Part identification
  part_number VARCHAR(50) NOT NULL,
  part_name VARCHAR(255),
  manufacturer VARCHAR(100),
  ata_chapter VARCHAR(10),

  -- Stock quantities
  quantity_on_hand INT DEFAULT 0,
  quantity_reserved INT DEFAULT 0,
  quantity_available INT AS (quantity_on_hand - quantity_reserved) STORED,
  reorder_level INT,
  reorder_quantity INT,

  -- Location
  warehouse_location VARCHAR(255),
  bin_number VARCHAR(50),

  -- Supplier info
  primary_supplier_id UUID,
  supplier_lead_time_days INT,
  unit_cost DECIMAL(12,2),

  -- Status
  status VARCHAR(50) CHECK (status IN ('in_stock', 'low_stock', 'out_of_stock', 'obsolete')) DEFAULT 'in_stock',
  is_critical_part BOOLEAN DEFAULT FALSE,

  -- Metadata
  last_restock_date TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT inventory_unique_per_tenant UNIQUE (tenant_id, part_number, warehouse_location)
);

CREATE INDEX idx_inventory_status ON public.inventory_items(status);
CREATE INDEX idx_inventory_critical ON public.inventory_items(is_critical_part);
CREATE INDEX idx_inventory_reorder ON public.inventory_items(quantity_available, reorder_level);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_inventory ON public.inventory_items
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

**Table: compliance_records** (Regulatory tracking)
```sql
CREATE TABLE public.compliance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  aircraft_id UUID REFERENCES public.aircraft(id) ON DELETE CASCADE,

  -- Compliance identification
  record_type VARCHAR(50) CHECK (record_type IN ('ad', 'sb', 'mel', 'cdl', 'inspection', 'certification')),
  record_number VARCHAR(100),
  issued_by VARCHAR(100), -- FAA, EASA, etc.

  -- Requirement details
  title VARCHAR(255),
  description TEXT,
  effective_date TIMESTAMP NOT NULL,
  deadline_date TIMESTAMP NOT NULL,

  -- Compliance status
  status VARCHAR(50) CHECK (status IN ('active', 'deferred', 'compliant', 'waived', 'superseded')) DEFAULT 'active',
  completion_date TIMESTAMP,

  -- Compliance evidence
  is_compliant BOOLEAN,
  compliance_proof_document_url VARCHAR(500),
  verified_by UUID REFERENCES public.users(id),
  verified_date TIMESTAMP,

  -- Metadata
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT compliance_unique UNIQUE (tenant_id, record_type, record_number, aircraft_id)
);

CREATE INDEX idx_compliance_aircraft ON public.compliance_records(aircraft_id);
CREATE INDEX idx_compliance_deadline ON public.compliance_records(deadline_date);
CREATE INDEX idx_compliance_status ON public.compliance_records(status);
ALTER TABLE public.compliance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_compliance ON public.compliance_records
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

**Table: repair_orders** (Corrective maintenance orders)
```sql
CREATE TABLE public.repair_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  aircraft_id UUID NOT NULL REFERENCES public.aircraft(id) ON DELETE CASCADE,
  work_order_id UUID REFERENCES public.work_orders(id),

  -- Repair order identification
  repair_order_number VARCHAR(50) NOT NULL,

  -- Defect details
  defect_description TEXT NOT NULL,
  failure_mode VARCHAR(255),
  failure_severity VARCHAR(50) CHECK (failure_severity IN ('minor', 'major', 'critical')),

  -- Root cause analysis
  root_cause_analysis TEXT,
  root_cause_determined BOOLEAN DEFAULT FALSE,
  root_cause_determined_date TIMESTAMP,

  -- Repair execution
  repair_method VARCHAR(255),
  replacement_part_id UUID REFERENCES public.components(id),
  repair_status VARCHAR(50) CHECK (repair_status IN ('reported', 'analyzing', 'approved', 'in_repair', 'completed', 'tested', 'closed')) DEFAULT 'reported',

  -- Quality assurance
  inspection_required BOOLEAN DEFAULT TRUE,
  inspected_by UUID REFERENCES public.users(id),
  inspection_date TIMESTAMP,
  inspection_result VARCHAR(50) CHECK (inspection_result IN ('pass', 'fail', 'rework_required')),

  -- Cost tracking
  parts_cost DECIMAL(12,2),
  labor_cost DECIMAL(12,2),
  total_repair_cost DECIMAL(12,2),

  -- Metadata
  reported_by UUID REFERENCES public.users(id),
  reported_date TIMESTAMP NOT NULL,
  completed_date TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT ro_unique_per_tenant UNIQUE (tenant_id, repair_order_number)
);

CREATE INDEX idx_repair_orders_aircraft ON public.repair_orders(aircraft_id);
CREATE INDEX idx_repair_orders_status ON public.repair_orders(repair_status);
CREATE INDEX idx_repair_orders_severity ON public.repair_orders(failure_severity);
ALTER TABLE public.repair_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_repair_orders ON public.repair_orders
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

### 2.3 Immutable Audit Schema

```sql
CREATE SCHEMA mro_audit;

-- Immutable audit records (append-only)
CREATE TABLE mro_audit.records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Event identification
  event_type VARCHAR(100) NOT NULL,
  record_type VARCHAR(100) NOT NULL,

  -- Entity references
  related_entity_id UUID,
  related_entity_type VARCHAR(100),
  related_work_order_id UUID,

  -- User & context
  actor_id UUID,
  actor_role VARCHAR(100),
  action VARCHAR(100) NOT NULL,

  -- Event details
  context JSONB,
  previous_state JSONB,
  new_state JSONB,

  -- Cryptography
  signature BYTEA,
  signature_algorithm VARCHAR(50),
  previous_hash BYTEA,

  -- Compliance
  regulatory_context JSONB,

  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT audit_records_immutable CHECK (created_at IS NOT NULL)
);

CREATE INDEX idx_mro_audit_records_entity ON mro_audit.records(related_entity_id, created_at DESC);
CREATE INDEX idx_mro_audit_records_tenant_time ON mro_audit.records(tenant_id, created_at DESC);
CREATE INDEX idx_mro_audit_records_type ON mro_audit.records(record_type, event_type);

-- Prevent any modifications to audit records
CREATE OR REPLACE FUNCTION mro_audit.prevent_audit_updates()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit records are immutable and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_records_immutable
  BEFORE UPDATE OR DELETE ON mro_audit.records
  FOR EACH ROW
  EXECUTE FUNCTION mro_audit.prevent_audit_updates();
```

### 2.4 Schema Dependencies & Relationships

```
Tenant (platform)
  ├─ Aircraft
  │  ├─ Components (serialized parts)
  │  ├─ Work Orders
  │  │  ├─ Maintenance Tasks (individual steps)
  │  │  └─ Work Order Materials (parts allocation)
  │  ├─ Repair Orders
  │  ├─ Compliance Records
  │  └─ Maintenance Events (audit trail)
  │
  ├─ Inventory Items
  │  └─ Supplier Relationships
  │
  └─ mro_audit.records (immutable audit trail for all operations)
```

---

## 3. API Layer Design

### 3.1 REST API Architecture

**Base URL:** `https://api.logic-nexus-ai.com/api/amro/v1`

**Versioning Strategy:** SemVer with 2-version support
- Current: v1.1.x (active)
- Deprecated: v1.0.x (support window: 6 months)

#### Work Orders API

```typescript
// GET /api/amro/v1/work-orders
// List work orders with pagination and filtering
interface GetWorkOrdersRequest {
  page?: number;              // default: 1
  pageSize?: number;          // default: 25, max: 100
  aircraft_id?: UUID;
  status?: WorkOrderStatus;
  work_type?: WorkOrderType;
  priority?: Priority;
  scheduled_start_date__gte?: ISO8601DateTime;
  scheduled_start_date__lte?: ISO8601DateTime;
  sort_by?: 'created_at' | 'scheduled_date' | 'priority';
  sort_order?: 'asc' | 'desc';
}

interface WorkOrderListResponse {
  data: WorkOrder[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  _links: {
    self: string;
    first: string;
    last: string;
    next?: string;
    prev?: string;
  };
}

// POST /api/amro/v1/work-orders
// Create new work order
interface CreateWorkOrderRequest {
  aircraft_id: UUID;
  title: string;
  description?: string;
  work_type: 'preventive' | 'corrective' | 'regulatory' | 'inspection';
  priority: 'critical' | 'high' | 'medium' | 'low';
  source_type?: SourceType;
  source_id?: string;
  maintenance_type?: 'line' | 'base' | 'intermediate' | 'heavy_maintenance';
  estimated_labor_hours?: number;
  estimated_downtime_minutes?: number;
  estimated_cost?: number;
  scheduled_start_date?: ISO8601DateTime;
  scheduled_end_date?: ISO8601DateTime;
}

interface WorkOrder {
  id: UUID;
  work_order_number: string;
  title: string;
  aircraft_id: UUID;
  status: WorkOrderStatus;
  priority: Priority;
  work_type: WorkOrderType;
  estimated_labor_hours: number;
  estimated_downtime_minutes: number;
  scheduled_start_date?: ISO8601DateTime;
  scheduled_end_date?: ISO8601DateTime;
  actual_start_date?: ISO8601DateTime;
  actual_completion_date?: ISO8601DateTime;
  completion_percentage: number;
  assigned_to?: User;
  created_by: User;
  created_at: ISO8601DateTime;
  updated_at: ISO8601DateTime;
}

// GET /api/amro/v1/work-orders/{id}
// Get detailed work order with related tasks and materials
interface GetWorkOrderDetailRequest {
  id: UUID;
  include?: 'tasks' | 'materials' | 'events' | 'all';
}

interface WorkOrderDetail extends WorkOrder {
  tasks?: MaintenanceTask[];
  materials?: WorkOrderMaterial[];
  events?: MaintenanceEvent[];
  audit_trail?: AuditRecord[];
}

// PATCH /api/amro/v1/work-orders/{id}
// Update work order
interface UpdateWorkOrderRequest {
  title?: string;
  status?: WorkOrderStatus;
  priority?: Priority;
  estimated_labor_hours?: number;
  estimated_downtime_minutes?: number;
  scheduled_start_date?: ISO8601DateTime;
  scheduled_end_date?: ISO8601DateTime;
}

// POST /api/amro/v1/work-orders/{id}/assign
// Assign work order to technician
interface AssignWorkOrderRequest {
  technician_id: UUID;
  supervisor_id?: UUID;
}

// POST /api/amro/v1/work-orders/{id}/schedule
// Schedule work order execution
interface ScheduleWorkOrderRequest {
  scheduled_start_date: ISO8601DateTime;
  scheduled_end_date: ISO8601DateTime;
  required_technician_rating?: string;
  hangar_availability?: {
    required_duration_minutes: number;
    preferred_date_range?: { start: ISO8601DateTime; end: ISO8601DateTime; };
  };
}

// POST /api/amro/v1/work-orders/{id}/close
// Close completed work order with compliance checks
interface CloseWorkOrderRequest {
  actual_completion_date: ISO8601DateTime;
  completion_notes?: string;
  quality_verified_by?: UUID;
  certification_signed_by?: UUID;
}

interface CloseWorkOrderResponse {
  success: boolean;
  work_order: WorkOrder;
  compliance_checks: {
    all_tasks_completed: boolean;
    required_signatures: { completed: number; total: number; };
    audit_trail_complete: boolean;
  };
  warnings?: string[];
  errors?: string[];
}
```

#### Maintenance Tasks API

```typescript
// POST /api/amro/v1/work-orders/{workOrderId}/tasks
// Create task within work order
interface CreateMaintenanceTaskRequest {
  task_sequence: number;
  task_name: string;
  description?: string;
  procedure_reference: string; // e.g., "ATA 27-30-01"
  estimated_duration_minutes: number;
  required_technician_rating?: string;
  required_certifications?: string[];
  tools_required?: string[];
  requires_inspection?: boolean;
}

// PATCH /api/amro/v1/maintenance-tasks/{id}
// Update task (assign, change status, record completion)
interface UpdateMaintenanceTaskRequest {
  status?: TaskStatus;
  assigned_technician_id?: UUID;
  started_at?: ISO8601DateTime;
  completed_at?: ISO8601DateTime;
  signed_by_technician?: UUID;
  signed_at?: ISO8601DateTime;
  notes?: string;
}

// POST /api/amro/v1/maintenance-tasks/{id}/submit-execution
// Submit task execution with evidence (mobile)
interface SubmitTaskExecutionRequest {
  completed_at: ISO8601DateTime;
  technician_id: UUID;
  execution_notes?: string;
  evidence: {
    photos?: string[]; // base64 encoded
    attachments?: string[];
    checklist_items?: { item: string; completed: boolean; }[];
  };
  signature?: {
    method: 'digital' | 'pin' | 'biometric';
    signature_data: string;
    signature_timestamp: ISO8601DateTime;
  };
}

// GET /api/amro/v1/maintenance-tasks/{id}/audit-trail
// Get immutable audit trail for task
interface TaskAuditTrail {
  records: AuditRecord[];
  is_cryptographically_verified: boolean;
  last_modified: ISO8601DateTime;
}
```

#### Inventory Management API

```typescript
// GET /api/amro/v1/inventory
// List inventory with stock levels
interface GetInventoryRequest {
  page?: number;
  pageSize?: number;
  warehouse_location?: string;
  status?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'obsolete';
  is_critical_part?: boolean;
}

// POST /api/amro/v1/inventory/{inventoryItemId}/allocate
// Reserve parts for work order
interface AllocatePartsRequest {
  work_order_id: UUID;
  quantity: number;
  allocation_date?: ISO8601DateTime;
}

interface AllocationResponse {
  allocation_id: UUID;
  inventory_item_id: UUID;
  quantity_allocated: number;
  quantity_available_after: number;
  status: 'allocated' | 'partially_allocated' | 'allocation_failed';
  shortage_quantity?: number;
  reorder_triggered?: boolean;
}

// POST /api/amro/v1/inventory/check-availability
// Check availability for multiple parts (planning)
interface CheckAvailabilityRequest {
  parts: { part_number: string; required_quantity: number; }[];
}

interface AvailabilityCheckResponse {
  available_parts: { part_number: string; available_quantity: number; }[];
  shortage_parts: { part_number: string; shortage_quantity: number; supplier_lead_time_days?: number; }[];
  estimated_fulfillment_date?: ISO8601DateTime;
}
```

#### Compliance Tracking API

```typescript
// GET /api/amro/v1/compliance/records
// List compliance requirements
interface GetComplianceRecordsRequest {
  aircraft_id?: UUID;
  status?: 'active' | 'deferred' | 'compliant' | 'waived' | 'superseded';
  record_type?: 'ad' | 'sb' | 'mel' | 'cdl' | 'inspection' | 'certification';
  deadline_date__lte?: ISO8601DateTime;
  is_overdue?: boolean;
}

// POST /api/amro/v1/compliance/records/{id}/mark-compliant
// Mark compliance record as compliant with proof
interface MarkCompliantRequest {
  completion_date: ISO8601DateTime;
  proof_document_url: string;
  verified_by: UUID;
  compliance_notes?: string;
}

// GET /api/amro/v1/compliance/scorecard
// Get compliance dashboard metrics
interface ComplianceScorecardResponse {
  overall_compliance_percentage: number;
  total_active_requirements: number;
  compliant_requirements: number;
  deferred_requirements: number;
  overdue_requirements: number;
  by_requirement_type: {
    record_type: string;
    compliance_percentage: number;
    overdue_count: number;
  }[];
  regulatory_authorities: {
    authority: string; // FAA, EASA, etc.
    compliance_percentage: number;
  }[];
}
```

### 3.2 GraphQL API Design

**GraphQL Endpoint:** `https://api.logic-nexus-ai.com/graphql`

```graphql
# AMRO GraphQL Schema

type Query {
  # Work Orders
  workOrder(id: UUID!): WorkOrder
  workOrders(
    filter: WorkOrderFilter
    pagination: PaginationInput
    sort: SortInput
  ): WorkOrderConnection!

  # Aircraft
  aircraft(id: UUID!): Aircraft
  aircrafts(
    filter: AircraftFilter
    pagination: PaginationInput
  ): AircraftConnection!

  # Compliance
  complianceRecords(
    filter: ComplianceFilter
    pagination: PaginationInput
  ): ComplianceRecordConnection!
  complianceScorecard: ComplianceScorecard!

  # Inventory
  inventory(
    filter: InventoryFilter
    pagination: PaginationInput
  ): InventoryConnection!

  # Analytics
  maintenanceMetrics(period: DateRange!): MaintenanceMetrics!
  predictiveAnalytics(aircraft_id: UUID!): PredictiveAnalytics!
}

type Mutation {
  # Work Order Operations
  createWorkOrder(input: CreateWorkOrderInput!): WorkOrder!
  updateWorkOrder(id: UUID!, input: UpdateWorkOrderInput!): WorkOrder!
  assignWorkOrder(id: UUID!, input: AssignWorkOrderInput!): WorkOrder!
  scheduleWorkOrder(id: UUID!, input: ScheduleWorkOrderInput!): WorkOrder!
  closeWorkOrder(id: UUID!, input: CloseWorkOrderInput!): CloseWorkOrderResult!

  # Task Operations
  createMaintenanceTask(workOrderId: UUID!, input: CreateMaintenanceTaskInput!): MaintenanceTask!
  submitTaskExecution(id: UUID!, input: SubmitTaskExecutionInput!): MaintenanceTask!

  # Inventory Operations
  allocateParts(input: AllocatePartsInput!): AllocationResult!
  updateInventory(id: UUID!, input: UpdateInventoryInput!): InventoryItem!
}

type Subscription {
  # Real-time updates
  workOrderUpdated(id: UUID!): WorkOrder!
  taskStatusChanged(workOrderId: UUID!): MaintenanceTask!
  inventoryLevelChanged: InventoryItem!
  complianceAlerts: ComplianceAlert!
}

# Type Definitions
type WorkOrder {
  id: UUID!
  workOrderNumber: String!
  title: String!
  aircraft: Aircraft!
  status: WorkOrderStatus!
  priority: Priority!
  workType: WorkOrderType!
  tasks(pagination: PaginationInput): [MaintenanceTask!]!
  materials(pagination: PaginationInput): [WorkOrderMaterial!]!
  assignedTo: User
  createdBy: User!
  createdAt: DateTime!
  updatedAt: DateTime!
  completionPercentage: Int!
}

type MaintenanceTask {
  id: UUID!
  taskSequence: Int!
  taskName: String!
  status: TaskStatus!
  procedureReference: String!
  estimatedDurationMinutes: Int!
  assignedTechnician: User
  completedAt: DateTime
}

type Aircraft {
  id: UUID!
  tailNumber: String!
  model: String!
  status: AircraftStatus!
  currentFlightHours: Decimal!
  currentCycles: Int!
  components(pagination: PaginationInput): [Component!]!
  workOrders(pagination: PaginationInput): [WorkOrder!]!
  complianceRecords(pagination: PaginationInput): [ComplianceRecord!]!
}

type ComplianceRecord {
  id: UUID!
  recordNumber: String!
  recordType: ComplianceRecordType!
  status: ComplianceStatus!
  deadlineDate: DateTime!
  isCompliant: Boolean!
}

# Enums
enum WorkOrderStatus {
  DRAFT
  APPROVED
  SCHEDULED
  IN_PROGRESS
  ON_HOLD
  COMPLETED
  CLOSED
  CANCELLED
}

enum Priority {
  CRITICAL
  HIGH
  MEDIUM
  LOW
}

enum WorkOrderType {
  PREVENTIVE
  CORRECTIVE
  REGULATORY
  INSPECTION
}

enum TaskStatus {
  PENDING
  ASSIGNED
  IN_PROGRESS
  ON_HOLD
  COMPLETED
  FAILED
  DEFERRED
}

enum AircraftStatus {
  ACTIVE
  MAINTENANCE
  GROUNDED
  RETIRED
}

enum ComplianceRecordType {
  AD
  SB
  MEL
  CDL
  INSPECTION
  CERTIFICATION
}

enum ComplianceStatus {
  ACTIVE
  DEFERRED
  COMPLIANT
  WAIVED
  SUPERSEDED
}

# Connections (Pagination)
type WorkOrderConnection {
  edges: [WorkOrderEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type WorkOrderEdge {
  node: WorkOrder!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

### 3.3 API Security & Rate Limiting

**Request/Response Pattern:**
```typescript
// All responses wrapped in standard envelope
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
    timestamp: ISO8601DateTime;
    request_id: string;
    trace_id: string;
  };
  meta?: {
    version: string;
    timestamp: ISO8601DateTime;
    request_id: string;
  };
}
```

**Rate Limiting:**
```
- Authenticated requests: 1000 req/min per user
- Bulk operations: 100 req/min per endpoint
- GraphQL queries: 500 req/min per user
- File uploads: 10 req/min per endpoint
- Write operations (POST/PATCH/DELETE): 200 req/min per user

Rate limit headers:
- X-RateLimit-Limit: 1000
- X-RateLimit-Remaining: 987
- X-RateLimit-Reset: 1645678234
- Retry-After: 12 (seconds, if rate limited)
```

---

## 4. Business Logic Implementation

### 4.1 Core Services Architecture

**Service Layer Structure:**
```typescript
// src/modules/amro/services/

// Work Order Service
class WorkOrderService {
  async createWorkOrder(input: CreateWorkOrderInput): Promise<WorkOrder>;
  async getWorkOrder(id: UUID): Promise<WorkOrder>;
  async listWorkOrders(filter: WorkOrderFilter): Promise<WorkOrder[]>;
  async updateWorkOrder(id: UUID, updates: Partial<WorkOrder>): Promise<WorkOrder>;
  async assignWorkOrder(id: UUID, technicianId: UUID): Promise<WorkOrder>;
  async closeWorkOrder(id: UUID, closeData: CloseWorkOrderInput): Promise<WorkOrder>;
  async validateComplianceGates(woId: UUID): Promise<ValidationResult>;

  // Domain logic
  private async checkAircraftAvailability(aircraftId: UUID): Promise<boolean>;
  private async validateMaintenanceType(woType: string): Promise<boolean>;
  private async checkRegulatoryRequirements(aircraftId: UUID): Promise<RegulatoryCheckResult>;
}

// Maintenance Scheduler Service
class MaintenanceSchedulerService {
  async scheduleMaintenanceTasks(woId: UUID, constraints: SchedulingConstraints): Promise<Schedule>;
  async findAvailableSlots(aircraftId: UUID, durationMinutes: number): Promise<TimeSlot[]>;
  async allocateTechnician(woId: UUID, requiredRating: string): Promise<TechnicianAllocation>;
  async optimizeSchedule(schedule: Schedule): Promise<OptimizedSchedule>;

  // Constraint checking
  private async checkHangarAvailability(aircraftId: UUID, timeSlot: TimeSlot): Promise<boolean>;
  private async checkTechnicianAvailability(techId: UUID, timeSlot: TimeSlot): Promise<boolean>;
  private async validateCertifications(techId: UUID, requiredRatings: string[]): Promise<boolean>;
}

// Inventory Management Service
class InventoryManagerService {
  async allocateParts(woId: UUID, partsList: PartAllocation[]): Promise<AllocationResult>;
  async checkPartAvailability(partNumbers: string[]): Promise<AvailabilityCheck>;
  async triggerPartReorder(partNumber: string, quantity: number): Promise<ReorderEvent>;
  async trackPartUsage(woId: UUID, partUsage: PartUsage[]): Promise<void>;

  // Inventory logic
  private async updatePartCounts(partId: UUID, quantityUsed: number): Promise<void>;
  private async checkCriticalPartsThreshold(): Promise<AlertList>;
  private async calculateReorderQuantity(partNumber: string): Promise<number>;
}

// Compliance Tracker Service
class ComplianceTrackerService {
  async trackRegulatoryRequirement(requirement: RegulatoryRequirement): Promise<ComplianceRecord>;
  async validateComplianceGates(woId: UUID): Promise<ComplianceValidation>;
  async markCompliant(recordId: UUID, proof: ComplianceProof): Promise<ComplianceRecord>;
  async generateComplianceReport(aircraftId: UUID, period: DateRange): Promise<ComplianceReport>;

  // Compliance logic
  private async checkADSBCompliance(aircraftId: UUID): Promise<ADSBStatus>;
  private async checkMELCDLCompliance(aircraftId: UUID): Promise<MELCDLStatus>;
  private async verifyFAEAASAACertification(aircraftId: UUID): Promise<CertificationStatus>;
}

// Repair Order Processor Service
class RepairOrderProcessorService {
  async createRepairOrder(defect: DefectReport): Promise<RepairOrder>;
  async analyzeRootCause(roId: UUID, analysis: RootCauseAnalysis): Promise<RepairOrder>;
  async approveRepair(roId: UUID, approvalData: RepairApproval): Promise<RepairOrder>;
  async executeRepair(roId: UUID, executionData: RepairExecution): Promise<RepairOrder>;
  async inspectRepair(roId: UUID, inspectionResult: InspectionResult): Promise<RepairOrder>;
  async closeRepairOrder(roId: UUID): Promise<RepairOrder>;
}

// Data Sync Service (for integration with analytics pipeline)
class DataSyncService {
  async syncWorkOrderToAnalytics(woId: UUID): Promise<void>;
  async syncMaintenanceEventToAudit(event: MaintenanceEvent): Promise<void>;
  async publishAMROEvent(event: AMROEvent): Promise<void>;
  async syncComplianceStatusToRegulatoryDashboard(aircraftId: UUID): Promise<void>;
}

// Event Publisher Service
class EventPublisherService {
  async publishWorkOrderEvent(event: WorkOrderEvent): Promise<void>;
  async publishTaskCompletionEvent(event: TaskCompletionEvent): Promise<void>;
  async publishComplianceAlertEvent(alert: ComplianceAlert): Promise<void>;
  async publishMaintenanceMetricsEvent(metrics: MaintenanceMetrics): Promise<void>;
}
```

### 4.2 Core Business Logic Workflows

**Work Order Creation Workflow:**
```typescript
async createWorkOrder(input: CreateWorkOrderInput): Promise<WorkOrder> {
  // 1. Validate input
  this.validateWorkOrderInput(input);

  // 2. Check aircraft availability
  const aircraft = await this.aircraftService.getAircraft(input.aircraft_id);
  if (aircraft.status === 'grounded') {
    throw new AircraftGroundedException();
  }

  // 3. Check inventory availability (early warning)
  if (input.required_parts) {
    const availability = await this.inventoryService.checkPartAvailability(
      input.required_parts.map(p => p.part_number)
    );
    if (availability.shortage_parts.length > 0) {
      this.logger.warn('Parts shortage for WO creation', availability);
      // Can still proceed with warning
    }
  }

  // 4. Verify regulatory compliance
  const regulatoryCheck = await this.checkRegulatoryRequirements(input.aircraft_id);
  if (!regulatoryCheck.can_perform_maintenance) {
    throw new RegulatoryComplianceException(regulatoryCheck.reason);
  }

  // 5. Create work order (transaction)
  const woNumber = await this.generateWorkOrderNumber();
  const workOrder = await this.db.transaction(async (trx) => {
    const wo = await trx('work_orders').insert({
      tenant_id: this.currentTenant,
      aircraft_id: input.aircraft_id,
      work_order_number: woNumber,
      title: input.title,
      status: 'draft',
      // ... other fields
    }).returning('*');

    return wo[0];
  });

  // 6. Publish event for analytics pipeline
  await this.eventPublisher.publishWorkOrderEvent({
    event_type: 'amro.work_order.created',
    work_order_id: workOrder.id,
    aircraft_id: input.aircraft_id,
    timestamp: new Date(),
    data: workOrder,
  });

  // 7. Record audit trail
  await this.auditService.logEvent({
    event_type: 'work_order_created',
    entity_id: workOrder.id,
    actor_id: this.currentUser.id,
    action: 'CREATE',
    context: {
      work_order_number: workOrder.work_order_number,
      aircraft_id: input.aircraft_id,
    },
  });

  return workOrder;
}
```

**Maintenance Schedule Optimization Workflow:**
```typescript
async scheduleMaintenanceTasks(
  woId: UUID,
  constraints: SchedulingConstraints
): Promise<Schedule> {
  // 1. Get work order and tasks
  const workOrder = await this.getWorkOrder(woId);
  const tasks = await this.getTasksForWorkOrder(woId);

  // 2. Get aircraft maintenance calendar
  const maintCalendar = await this.getMaintenance Calendar(workOrder.aircraft_id);

  // 3. Find available maintenance windows (hangar availability)
  const availableWindows = await this.findAvailableMaintenance Windows(
    workOrder.aircraft_id,
    constraints.required_duration_minutes,
    constraints.preferred_start_date,
    constraints.preferred_end_date
  );

  if (availableWindows.length === 0) {
    throw new NoAvailableMaintenanceWindowException();
  }

  // 4. Allocate technicians with required certifications
  const technicianAllocations: TechnicianAllocation[] = [];
  for (const task of tasks) {
    const availableTechs = await this.findAvailableTechnicians(
      task.required_technician_rating,
      availableWindows[0].start_date,
      availableWindows[0].end_date
    );

    if (availableTechs.length === 0) {
      throw new NoAvailableTechniciansException(task.required_technician_rating);
    }

    // Select best technician (highest experience, earliest available)
    const selectedTech = this.selectOptimalTechnician(availableTechs);
    technicianAllocations.push({
      task_id: task.id,
      technician_id: selectedTech.id,
      allocated_start: availableWindows[0].start_date,
      estimated_duration: task.estimated_duration_minutes,
    });
  }

  // 5. Check parts availability in maintenance window
  const partsAllocations = await this.allocateParts(woId, tasks);

  // 6. Create optimized schedule
  const schedule = this.optimizeTaskSequence(
    tasks,
    technicianAllocations,
    availableWindows[0]
  );

  // 7. Save schedule to database
  await this.db.transaction(async (trx) => {
    await trx('work_orders').update({
      scheduled_start_date: schedule.start_date,
      scheduled_end_date: schedule.end_date,
      status: 'scheduled',
    }).where({ id: woId });

    for (const allocation of technicianAllocations) {
      await trx('maintenance_tasks').update({
        assigned_technician_id: allocation.technician_id,
        status: 'assigned',
      }).where({ id: allocation.task_id });
    }
  });

  // 8. Publish scheduling event
  await this.eventPublisher.publishMaintenanceScheduledEvent({
    work_order_id: woId,
    scheduled_start_date: schedule.start_date,
    technician_count: technicianAllocations.length,
  });

  return schedule;
}
```

---

## 5. Real-Time Data Pipeline

### 5.1 Event Streaming Architecture

**Kafka Topics:**
```
amro.work_order.*           → Work order lifecycle events
  ├─ amro.work_order.created
  ├─ amro.work_order.updated
  ├─ amro.work_order.status_changed
  ├─ amro.work_order.assigned
  └─ amro.work_order.closed

amro.maintenance.*)         → Maintenance execution events
  ├─ amro.maintenance.scheduled
  ├─ amro.maintenance.started
  ├─ amro.maintenance.task_completed
  └─ amro.maintenance.completed

amro.inventory.*            → Parts & inventory events
  ├─ amro.inventory.allocated
  ├─ amro.inventory.shortage
  └─ amro.inventory.reorder_triggered

amro.compliance.*           → Compliance tracking events
  ├─ amro.compliance.requirement_created
  ├─ amro.compliance.deadline_approaching
  ├─ amro.compliance.marked_compliant
  └─ amro.compliance.overdue

amro.repair.*               → Repair order events
  ├─ amro.repair.order_created
  ├─ amro.repair.root_cause_found
  ├─ amro.repair.repair_approved
  ├─ amro.repair.repair_completed
  └─ amro.repair.inspection_passed

amro.audit.*                → Audit trail events
  └─ amro.audit.record_created (immutable)
```

### 5.2 Real-Time Analytics Pipeline

```
Kafka Event Stream
  │
  ├─→ Apache NiFi (ETL & Transformation)
  │   ├─ Parse event schema
  │   ├─ Enrich with historical data
  │   ├─ Calculate derived metrics
  │   └─ Quality checks
  │
  ├─→ Apache Spark (Stream Processing)
  │   ├─ Real-time aggregations
  │   ├─ Time-window analytics
  │   ├─ Pattern detection
  │   └─ Feature engineering for ML
  │
  ├─→ Data Lake (Parquet files)
  │   ├─ Raw events (append-only)
  │   ├─ Processed data
  │   └─ Time-series data
  │
  ├─→ ClickHouse (Time-series DB)
  │   ├─ Real-time metrics
  │   ├─ Fast aggregations
  │   └─ OLAP queries
  │
  └─→ ML Pipeline (Python/TensorFlow)
      ├─ Data preparation
      ├─ Feature scaling
      ├─ Model inference
      └─ Predictions
          ├─ Predictive maintenance
          ├─ Failure risk scoring
          ├─ Parts shortage prediction
          └─ Compliance risk alert
```

### 5.3 Kafka Producer Configuration

```typescript
// Example Kafka producer for AMRO events
class AMROEventPublisher {
  private kafka: Kafka;
  private producer: Producer;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'amro-service',
      brokers: process.env.KAFKA_BROKERS.split(','),
      ssl: true,
      sasl: {
        mechanism: 'scram-sha-256',
        username: process.env.KAFKA_USERNAME,
        password: process.env.KAFKA_PASSWORD,
      },
    });

    this.producer = this.kafka.producer({
      idempotent: true,
      maxInFlightRequests: 5,
      compression: CompressionTypes.SNAPPY,
    });
  }

  async publishWorkOrderEvent(event: WorkOrderEvent): Promise<void> {
    const topic = 'amro.work_order.created';

    const message = {
      key: `${event.tenant_id}-${event.work_order_id}`,
      value: JSON.stringify(event),
      headers: {
        'event-type': event.event_type,
        'tenant-id': event.tenant_id,
        'timestamp': new Date().toISOString(),
        'idempotency-key': event.idempotency_key || generateUUID(),
      },
      partition: this.selectPartition(event.tenant_id),
    };

    await this.producer.send({
      topic,
      messages: [message],
      timeout: 30000,
      compression: CompressionTypes.SNAPPY,
    });

    // Track metrics
    this.metrics.recordEventPublished(topic);
  }
}
```

---

## 6. Authentication & Authorization

### 6.1 Authentication Framework

**JWT Token Structure:**
```typescript
interface AMROToken {
  sub: string;           // User ID
  email: string;
  tenant_id: string;
  org_id: string;
  roles: string[];       // ['technician', 'supervisor', 'admin']
  permissions: string[]; // ['amro:work_orders:read', 'amro:work_orders:create', ...]
  aircraft_access?: UUID[]; // Can be null for unrestricted access

  // AMRO-specific claims
  amro: {
    certifications: string[]; // ['airframe', 'powerplant', 'avionics']
    technician_rating: string; // 'A&P', 'IA', 'DAR'
    certification_expires: ISO8601DateTime;
    approver_authority: 'technician' | 'supervisor' | 'engineering' | 'qa' | 'compliance';
    can_certify_work: boolean;
    can_defer_maintenance: boolean;
  };

  iat: number;
  exp: number;
  iss: 'https://auth.logic-nexus-ai.com';
  aud: 'amro-api';
}
```

**Auth Guards Implementation:**
```typescript
// Auth guard - verify JWT and tenant
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      request.user = payload;
      request.tenant_id = payload.tenant_id;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}

// RBAC guard - check role permissions
export class RBACGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler()
    );

    if (!requiredRoles) {
      return true; // No role requirement
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return requiredRoles.some(role => user.roles.includes(role));
  }
}

// RLS guard - enforce tenant isolation
export class RLSGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { tenant_id } = request.user;

    // Set Postgres session variable for RLS enforcement
    await this.db.raw('SET app.current_tenant_id = ?', [tenant_id]);

    return true;
  }
}
```

### 6.2 Permission Model

**AMRO Permission Hierarchy:**
```typescript
const AMRO_PERMISSIONS = {
  // Work Order Permissions
  'amro:work_orders:read': 'View work orders',
  'amro:work_orders:create': 'Create new work orders',
  'amro:work_orders:update': 'Update work order details',
  'amro:work_orders:assign': 'Assign technicians',
  'amro:work_orders:schedule': 'Schedule maintenance',
  'amro:work_orders:close': 'Close work orders',
  'amro:work_orders:approve': 'Approve work orders',

  // Task Permissions
  'amro:tasks:read': 'View maintenance tasks',
  'amro:tasks:start': 'Start task execution',
  'amro:tasks:complete': 'Complete and sign off tasks',
  'amro:tasks:defer': 'Defer maintenance tasks',

  // Compliance Permissions
  'amro:compliance:read': 'View compliance records',
  'amro:compliance:mark_compliant': 'Mark requirements as compliant',
  'amro:compliance:defer': 'Request deferral of requirements',
  'amro:compliance:approve_deferral': 'Approve maintenance deferrals',

  // Inventory Permissions
  'amro:inventory:read': 'View inventory',
  'amro:inventory:allocate': 'Allocate parts for work orders',
  'amro:inventory:manage': 'Manage inventory levels',
  'amro:inventory:reorder': 'Trigger reorders',

  // Reports & Analytics
  'amro:reports:read': 'View AMRO reports',
  'amro:reports:export': 'Export reports',
  'amro:audit:read': 'View audit trails',
};

const AMRO_ROLES = {
  technician: {
    permissions: [
      'amro:work_orders:read',
      'amro:tasks:read',
      'amro:tasks:start',
      'amro:tasks:complete',
      'amro:inventory:read',
      'amro:inventory:allocate',
    ],
    requires_certification: true,
    can_sign_off: false,
  },

  supervisor: {
    permissions: [
      'amro:work_orders:read',
      'amro:work_orders:create',
      'amro:work_orders:assign',
      'amro:work_orders:schedule',
      'amro:tasks:read',
      'amro:tasks:defer',
      'amro:inventory:read',
      'amro:inventory:manage',
      'amro:compliance:read',
    ],
    requires_certification: true,
    can_sign_off: true,
  },

  compliance_officer: {
    permissions: [
      'amro:work_orders:read',
      'amro:compliance:read',
      'amro:compliance:mark_compliant',
      'amro:compliance:approve_deferral',
      'amro:audit:read',
      'amro:reports:read',
      'amro:reports:export',
    ],
    requires_certification: false,
    can_sign_off: true,
  },

  admin: {
    permissions: ['amro:*'], // All permissions
    requires_certification: false,
    can_sign_off: true,
  },
};
```

---

## 7. Error Handling & Validation

### 7.1 Aviation Industry Standard Error Codes

**AMRO Error Categories:**
```typescript
// Certificate/Qualification Errors (3xx)
class CertificationExpiredException extends AMROException {
  code = 'AMRO_3001';
  httpStatus = 403;
  message = 'Technician certification has expired';
}

class InsufficientQualificationsException extends AMROException {
  code = 'AMRO_3002';
  httpStatus = 403;
  message = 'Technician lacks required certifications';
}

// Compliance Errors (4xx)
class RegulatoryComplianceException extends AMROException {
  code = 'AMRO_4001';
  httpStatus = 400;
  message = 'Operation violates regulatory requirement';
}

class ComplianceGateFailedException extends AMROException {
  code = 'AMRO_4002';
  httpStatus = 400;
  message = 'Work order fails compliance gate (missing requirements)';
}

class AircraftGroundedException extends AMROException {
  code = 'AMRO_4003';
  httpStatus = 400;
  message = 'Aircraft is grounded and cannot be maintained';
}

// Inventory/Parts Errors (5xx)
class PartShortageException extends AMROException {
  code = 'AMRO_5001';
  httpStatus = 400;
  message = 'Required parts not available';
  shortage_details: {
    part_number: string;
    shortage_quantity: number;
    lead_time_days: number;
  }[];
}

class LLPExceededException extends AMROException {
  code = 'AMRO_5002';
  httpStatus = 400;
  message = 'Component Life-Limited Part hours/cycles exceeded';
}

// Scheduling Errors (6xx)
class NoAvailableMaintenanceWindowException extends AMROException {
  code = 'AMRO_6001';
  httpStatus = 400;
  message = 'No available maintenance window for aircraft';
}

class TechnicianUnavailableException extends AMROException {
  code = 'AMRO_6002';
  httpStatus = 400;
  message = 'No technicians with required rating available';
}

// Data Integrity Errors (7xx)
class AuditTrailMissingException extends AMROException {
  code = 'AMRO_7001';
  httpStatus = 500;
  message = 'Audit trail is incomplete or corrupted';
}

class SignatureVerificationFailedException extends AMROException {
  code = 'AMRO_7002';
  httpStatus = 400;
  message = 'Digital signature verification failed';
}
```

### 7.2 Input Validation Rules

**Work Order Validation:**
```typescript
export class CreateWorkOrderValidator {
  static validate(input: CreateWorkOrderInput): ValidationResult {
    const errors: ValidationError[] = [];

    // Title validation
    if (!input.title || input.title.length < 5 || input.title.length > 255) {
      errors.push({
        field: 'title',
        code: 'INVALID_LENGTH',
        message: 'Title must be between 5 and 255 characters',
      });
    }

    // Work type validation
    const validWorkTypes = ['preventive', 'corrective', 'regulatory', 'inspection'];
    if (!validWorkTypes.includes(input.work_type)) {
      errors.push({
        field: 'work_type',
        code: 'INVALID_VALUE',
        message: `Work type must be one of: ${validWorkTypes.join(', ')}`,
      });
    }

    // Estimated hours validation
    if (input.estimated_labor_hours && input.estimated_labor_hours < 0.25) {
      errors.push({
        field: 'estimated_labor_hours',
        code: 'INVALID_RANGE',
        message: 'Estimated labor hours must be at least 0.25 (15 minutes)',
      });
    }

    if (input.estimated_labor_hours && input.estimated_labor_hours > 8000) {
      errors.push({
        field: 'estimated_labor_hours',
        code: 'INVALID_RANGE',
        message: 'Estimated labor hours exceeds maximum (8000)',
      });
    }

    // Aircraft reference validation
    if (!input.aircraft_id || !this.isValidUUID(input.aircraft_id)) {
      errors.push({
        field: 'aircraft_id',
        code: 'INVALID_UUID',
        message: 'Invalid aircraft ID',
      });
    }

    // Regulatory deadline validation (if applicable)
    if (input.work_type === 'regulatory' && !input.regulatory_deadline) {
      errors.push({
        field: 'regulatory_deadline',
        code: 'REQUIRED_FIELD',
        message: 'Regulatory deadline is required for regulatory work orders',
      });
    }

    if (input.regulatory_deadline) {
      const deadline = new Date(input.regulatory_deadline);
      const now = new Date();
      if (deadline <= now) {
        errors.push({
          field: 'regulatory_deadline',
          code: 'DEADLINE_PASSED',
          message: 'Deadline must be in the future',
        });
      }
    }

    return {
      is_valid: errors.length === 0,
      errors,
    };
  }
}
```

---

## 8. Performance Optimization

### 8.1 Database Performance Strategies

**Indexing Strategy:**
```sql
-- Composite indexes for common queries
CREATE INDEX idx_work_orders_lookup
  ON public.work_orders(tenant_id, aircraft_id, status, created_at DESC);

CREATE INDEX idx_maintenance_tasks_status_tech
  ON public.maintenance_tasks(work_order_id, status, assigned_technician_id);

CREATE INDEX idx_components_llp_alert
  ON public.components(aircraft_id, llp_hours, current_hours)
  WHERE status = 'serviceable';

-- Partial indexes for hot queries
CREATE INDEX idx_work_orders_active
  ON public.work_orders(created_at DESC)
  WHERE status IN ('scheduled', 'in_progress');

CREATE INDEX idx_compliance_overdue
  ON public.compliance_records(deadline_date)
  WHERE status = 'active' AND deadline_date < NOW();
```

**Query Optimization:**
```typescript
// Bad - N+1 query
const workOrders = await db.select('*').from('work_orders');
for (const wo of workOrders) {
  const tasks = await db.select('*').from('maintenance_tasks').where({ work_order_id: wo.id });
  wo.tasks = tasks;
}

// Good - JOIN
const workOrders = await db
  .select('work_orders.*',
    db.raw('json_agg(json_build_object(...)) as tasks'))
  .from('work_orders')
  .leftJoin('maintenance_tasks', 'work_orders.id', '=', 'maintenance_tasks.work_order_id')
  .groupBy('work_orders.id')
  .limit(25);
```

### 8.2 Caching Strategy

**Redis Cache Layers:**
```typescript
// Cache key structure
const CACHE_KEYS = {
  // Aircraft cache (1 hour TTL)
  AIRCRAFT: (aircraftId: UUID) => `amro:aircraft:${aircraftId}`,

  // Work order cache (30 min TTL)
  WORK_ORDER: (woId: UUID) => `amro:wo:${woId}`,
  WORK_ORDER_LIST: (filter: string) => `amro:wo:list:${filter}`,

  // Compliance cache (2 hour TTL)
  COMPLIANCE_SCORECARD: (aircraftId: UUID) => `amro:compliance:scorecard:${aircraftId}`,

  // Inventory cache (15 min TTL)
  INVENTORY_LEVELS: (partNumber: string) => `amro:inv:${partNumber}`,

  // Technician qualifications cache (1 day TTL)
  TECHNICIAN_QUALIFICATIONS: (techId: UUID) => `amro:tech:qualifications:${techId}`,
};

// Cache invalidation strategy
class CacheInvalidationService {
  async invalidateWorkOrderCache(woId: UUID): Promise<void> {
    const patterns = [
      CACHE_KEYS.WORK_ORDER(woId),
      'amro:wo:list:*', // Invalidate all list caches
    ];

    for (const pattern of patterns) {
      await this.redis.del(pattern);
    }
  }

  async invalidateAircraftCache(aircraftId: UUID): Promise<void> {
    const patterns = [
      CACHE_KEYS.AIRCRAFT(aircraftId),
      CACHE_KEYS.COMPLIANCE_SCORECARD(aircraftId),
      'amro:wo:list:*',
    ];

    for (const pattern of patterns) {
      await this.redis.del(pattern);
    }
  }
}
```

### 8.3 API Response Optimization

**Pagination & Lazy Loading:**
```typescript
// Cursor-based pagination for large datasets
interface PaginationOptions {
  limit: number; // max 100
  cursor?: string; // Base64 encoded last record ID
}

async listWorkOrders(filter: WorkOrderFilter, pagination: PaginationOptions) {
  let query = db.select('*').from('work_orders');

  // Apply filters
  if (filter.status) query = query.where('status', filter.status);
  if (filter.aircraft_id) query = query.where('aircraft_id', filter.aircraft_id);

  // Cursor pagination
  if (pagination.cursor) {
    const lastId = Buffer.from(pagination.cursor, 'base64').toString();
    query = query.where('id', '>', lastId);
  }

  // Always include one extra to determine if there are more pages
  const workOrders = await query
    .orderBy('id', 'asc')
    .limit(pagination.limit + 1);

  const hasMore = workOrders.length > pagination.limit;
  const items = hasMore ? workOrders.slice(0, -1) : workOrders;

  return {
    items,
    hasMore,
    nextCursor: hasMore
      ? Buffer.from(items[items.length - 1].id).toString('base64')
      : null,
  };
}
```

---

## 9. Testing Strategy

### 9.1 Unit Tests (Services)

**Example: Work Order Service Tests**
```typescript
describe('WorkOrderService', () => {
  let service: WorkOrderService;
  let mockDatabase: any;
  let mockEventPublisher: any;

  beforeEach(() => {
    mockDatabase = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      transaction: jest.fn(),
    };

    mockEventPublisher = {
      publishWorkOrderEvent: jest.fn(),
    };

    service = new WorkOrderService(mockDatabase, mockEventPublisher);
  });

  describe('createWorkOrder', () => {
    it('should create a work order with valid input', async () => {
      const input = {
        aircraft_id: 'aircraft-123',
        title: 'Engine Inspection',
        work_type: 'preventive',
      };

      mockDatabase.insert.mockReturnValue({ returning: () => [{ id: 'wo-123', ...input }] });

      const result = await service.createWorkOrder(input);

      expect(result.id).toBe('wo-123');
      expect(mockEventPublisher.publishWorkOrderEvent).toHaveBeenCalled();
    });

    it('should throw error if aircraft is grounded', async () => {
      mockDatabase.select.mockResolvedValue([{ status: 'grounded' }]);

      await expect(service.createWorkOrder({
        aircraft_id: 'aircraft-123',
        title: 'Engine Inspection',
        work_type: 'preventive',
      })).rejects.toThrow(AircraftGroundedException);
    });

    it('should validate regulatory deadline for regulatory work orders', async () => {
      const input = {
        aircraft_id: 'aircraft-123',
        title: 'AD Compliance',
        work_type: 'regulatory',
        regulatory_deadline: new Date(Date.now() - 1000), // Past date
      };

      await expect(service.createWorkOrder(input))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('scheduleWorkOrder', () => {
    it('should schedule work order with available technicians', async () => {
      // Setup mocks
      mockDatabase.select
        .mockResolvedValueOnce([{ /* aircraft data */ }])
        .mockResolvedValueOnce([{ /* available hangar slot */ }])
        .mockResolvedValueOnce([{ /* available technicians */ }]);

      const result = await service.scheduleWorkOrder('wo-123', {
        required_duration_minutes: 480,
      });

      expect(result.status).toBe('scheduled');
      expect(mockDatabase.update).toHaveBeenCalled();
    });
  });
});
```

### 9.2 Integration Tests (API)

**Example: Work Order API Integration Tests**
```typescript
describe('Work Order API Integration', () => {
  let app: INestApplication;
  let db: Database;

  beforeAll(async () => {
    // Setup test database
    db = await setupTestDatabase();
    app = await createTestApp(db);
  });

  describe('POST /api/amro/v1/work-orders', () => {
    it('should create work order and publish event', async () => {
      const aircraftId = await createTestAircraft(db);

      const response = await request(app.getHttpServer())
        .post('/api/amro/v1/work-orders')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          aircraft_id: aircraftId,
          title: 'Engine Inspection',
          work_type: 'preventive',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.id).toBeDefined();

      // Verify in database
      const wo = await db.select('*').from('work_orders').where({ id: response.body.data.id });
      expect(wo[0].status).toBe('draft');

      // Verify Kafka event published
      // (mock Kafka publisher or use testcontainers)
    });
  });

  describe('GET /api/amro/v1/work-orders', () => {
    it('should return work orders filtered by status', async () => {
      const aircraftId = await createTestAircraft(db);
      await db('work_orders').insert({
        aircraft_id: aircraftId,
        status: 'scheduled',
        // ...
      });

      const response = await request(app.getHttpServer())
        .get('/api/amro/v1/work-orders')
        .query({ status: 'scheduled' })
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data.every(wo => wo.status === 'scheduled')).toBe(true);
    });
  });
});
```

### 9.3 End-to-End Tests (Workflows)

**Example: Complete Maintenance Workflow**
```typescript
describe('Complete Maintenance Workflow E2E', () => {
  it('should execute full work order lifecycle', async () => {
    // 1. Create aircraft
    const aircraft = await api.post('/api/amro/v1/aircraft', {
      tail_number: 'N12345',
      model: 'Boeing 737-800',
    });

    // 2. Create work order
    const wo = await api.post('/api/amro/v1/work-orders', {
      aircraft_id: aircraft.id,
      title: 'Engine Inspection',
      work_type: 'preventive',
    });

    expect(wo.status).toBe('draft');

    // 3. Assign work order
    const assigned = await api.patch(`/api/amro/v1/work-orders/${wo.id}/assign`, {
      technician_id: technicianId,
    });

    expect(assigned.status).toBe('draft');

    // 4. Schedule maintenance
    const scheduled = await api.post(`/api/amro/v1/work-orders/${wo.id}/schedule`, {
      scheduled_start_date: futureDatetime,
      scheduled_end_date: futureEndDatetime,
    });

    expect(scheduled.status).toBe('scheduled');

    // 5. Start task execution
    const tasks = await api.get(`/api/amro/v1/work-orders/${wo.id}/tasks`);
    const task = tasks[0];

    // 6. Complete task (mobile API)
    const completed = await api.post(
      `/api/amro/v1/maintenance-tasks/${task.id}/submit-execution`,
      {
        completed_at: now,
        technician_id: technicianId,
        signature: {
          method: 'digital',
          signature_data: signatureData,
        },
      }
    );

    expect(completed.status).toBe('completed');

    // 7. Close work order
    const closed = await api.post(`/api/amro/v1/work-orders/${wo.id}/close`, {
      actual_completion_date: now,
      quality_verified_by: supervisorId,
    });

    expect(closed.status).toBe('closed');

    // 8. Verify audit trail
    const auditTrail = await api.get(`/api/amro/v1/work-orders/${wo.id}/audit-trail`);
    expect(auditTrail.records.length).toBeGreaterThan(0);
    expect(auditTrail.records.map(r => r.action))
      .toContain('CREATED', 'ASSIGNED', 'SCHEDULED', 'CLOSED');
  });
});
```

---

## 10. Deployment Architecture

### 10.1 Staging Environment

**Configuration:**
```yaml
# docker-compose-staging.yml
version: '3.8'

services:
  # PostgreSQL with replication
  postgres-primary:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: amro_staging
      POSTGRES_USER: amro_user
      POSTGRES_PASSWORD: ${DB_PASSWORD_STAGING}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"

  postgres-replica:
    image: postgres:15-alpine
    depends_on:
      - postgres-primary
    environment:
      POSTGRES_REPLICATION_MODE: slave
      POSTGRES_MASTER_SERVICE: postgres-primary

  # Redis cache
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes

  # Kafka broker
  kafka:
    image: confluentinc/cp-kafka:7.0.0
    depends_on:
      - zookeeper
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092

  # AMRO API service
  amro-api:
    build:
      context: .
      dockerfile: Dockerfile
    depends_on:
      - postgres-primary
      - redis
      - kafka
    environment:
      NODE_ENV: staging
      DATABASE_URL: postgresql://amro_user:${DB_PASSWORD_STAGING}@postgres-primary:5432/amro_staging
      REDIS_URL: redis://redis:6379
      KAFKA_BROKERS: kafka:29092
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
```

### 10.2 Production Deployment

**Kubernetes Configuration:**
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: amro-production

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: amro-api
  namespace: amro-production
  labels:
    app: amro-api
    version: v1.0.0

spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0

  selector:
    matchLabels:
      app: amro-api

  template:
    metadata:
      labels:
        app: amro-api
        version: v1.0.0

    spec:
      serviceAccountName: amro-sa

      initContainers:
        - name: wait-for-db
          image: busybox:1.35
          command: ['sh', '-c', 'until nc -z postgres-primary 5432; do echo waiting for db; sleep 2; done;']

        - name: db-migrations
          image: amro-api:v1.0.0
          command: ["npm", "run", "migrate"]
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: amro-secrets
                  key: database-url

      containers:
        - name: amro-api
          image: amro-api:v1.0.0
          imagePullPolicy: IfNotPresent

          ports:
            - containerPort: 3000
              name: http
              protocol: TCP

          env:
            - name: NODE_ENV
              value: "production"
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: amro-secrets
                  key: database-url
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: amro-secrets
                  key: redis-url
            - name: KAFKA_BROKERS
              value: "kafka-broker-0.kafka.kafka.svc.cluster.local:9092,kafka-broker-1.kafka.kafka.svc.cluster.local:9092,kafka-broker-2.kafka.kafka.svc.cluster.local:9092"
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: amro-secrets
                  key: jwt-secret

          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3

          readinessProbe:
            httpGet:
              path: /health/ready
              port: http
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 2

          resources:
            requests:
              memory: "512Mi"
              cpu: "500m"
            limits:
              memory: "1Gi"
              cpu: "1000m"

          securityContext:
            readOnlyRootFilesystem: true
            runAsNonRoot: true
            runAsUser: 1000
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL

---
apiVersion: v1
kind: Service
metadata:
  name: amro-api
  namespace: amro-production
  labels:
    app: amro-api

spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: http
      protocol: TCP
      name: http
  selector:
    app: amro-api

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: amro-api-hpa
  namespace: amro-production

spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: amro-api

  minReplicas: 3
  maxReplicas: 10

  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70

    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### 10.3 Regulatory Compliance Deployment

**Aviation Compliance Requirements:**
```
Deployment Checklist:

✓ CHANGE MANAGEMENT
  - Change Advisory Board (CAB) approval
  - Maintenance window scheduled outside operational hours
  - Rollback plan documented and tested
  - Communication to maintenance teams

✓ SECURITY COMPLIANCE
  - SOC 2 Type II controls verified
  - NIST Cybersecurity Framework alignment
  - Data encryption in transit and at rest
  - Access control and authentication validated

✓ DATA INTEGRITY
  - Backup & disaster recovery tested
  - Audit trail integrity verified
  - Data retention policies enforced
  - Immutability of compliance records confirmed

✓ OPERATIONAL READINESS
  - Support team trained on new system
  - Monitoring dashboards configured
  - Escalation procedures documented
  - Key contacts updated

✓ REGULATORY SIGNOFF
  - FAA/EASA compliance verified (if applicable)
  - Maintenance records retention confirmed
  - System health checks automated
  - Incident response procedures tested
```

---

## 11. Documentation & Runbooks

### 11.1 API Specification

[See complete OpenAPI 3.1 spec in separate file: `AMRO_API_SPECIFICATION.yaml`]

### 11.2 Data Flow Diagrams

[Diagrams included in separate document: `AMRO_DATA_FLOW_DIAGRAMS.md`]

### 11.3 Operational Runbooks

**Runbook 1: Handle Parts Shortage During Maintenance**

```markdown
## Scenario
Work order is in progress, but a required part becomes unavailable due to shortage.

## Detection
- Inventory system flags shortage
- AMRO API returns PartShortageException
- Alert: "AMRO_5001_PART_SHORTAGE"

## Response Steps

1. **Assess Impact** (5 min)
   - Check criticality of part (critical vs. normal)
   - Estimate repair delay if part unavailable
   - Check alternative parts compatibility

2. **Notify Stakeholders** (2 min)
   - Alert maintenance supervisor
   - Notify parts management team
   - Update work order status to "on_hold"

3. **Find Alternatives** (30 min)
   - Check approved substitute parts (if any)
   - Check other aircraft for loan-able parts
   - Check supplier lead times
   - Check emergency procurement options

4. **Make Decision**
   - **Option A: Defer maintenance** (if allowed by regulations)
     - Submit deferral request to compliance officer
     - Document reason and expected resolution
   - **Option B: Use substitute part** (if approved by engineering)
     - Get engineering authorization
     - Document part substitution in work order
   - **Option C: Emergency procurement**
     - Expedite supplier delivery (if available)
     - Update estimated completion date

5. **Resume Work**
   - Once parts available, resume task execution
   - Update audit trail with resolution
   - Notify scheduler for rescheduling if needed

6. **Document for Analytics**
   - Log shortage event to Kafka
   - Trigger analysis for future inventory planning
```

---

## Summary & Next Steps

This comprehensive integration architecture provides:

1. ✅ **Complete Database Schema** - Fully mapped AMRO entities to platform_domains
2. ✅ **Enterprise API Layer** - REST + GraphQL with versioning & rate limiting
3. ✅ **Business Logic Services** - AMRO-specific workflows implemented
4. ✅ **Real-Time Pipeline** - Kafka + Apache NiFi for analytics integration
5. ✅ **Security Framework** - Multi-layer authentication, RBAC, RLS, audit
6. ✅ **Aviation Compliance** - Error codes, validation, regulatory checks
7. ✅ **Performance Optimization** - Caching, indexing, pagination strategies
8. ✅ **Testing Framework** - Unit, integration, E2E test patterns
9. ✅ **Production Deployment** - K8s configurations, staging setup, compliance
10. ✅ **Documentation** - OpenAPI specs, data flows, operational runbooks

**Next Steps for Implementation:**
1. Create database migrations from schema definitions
2. Implement service layer following architectural patterns
3. Build API controllers and route handlers
4. Configure Kafka producers/consumers
5. Set up comprehensive test suites
6. Deploy to staging environment
7. Conduct security & regulatory audit
8. Prepare production rollout plan

---

**Document Status:** Complete Technical Design Ready for Implementation
**Last Updated:** 2026-03-19
**Approved By:** Architecture & Engineering Team
**Next Review:** After Phase 1 implementation completion
