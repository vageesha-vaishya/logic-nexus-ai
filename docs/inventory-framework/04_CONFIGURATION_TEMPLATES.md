# Parameterized Configuration Templates

## 1. Placeholder Registry
```yaml
placeholders:
  domain_prefix: "<required>"
  catalog_item_table: "<required>"
  inventory_item_table: "<required>"
  inventory_ledger_table: "<required>"
  inventory_reservation_table: "<required>"
  inventory_projection_table: "<required>"
  item_profile_table: "<optional>"
  integration_job_table: "<required>"
  integration_audit_table: "<required>"
```

## 2. Domain Binding Template
```yaml
domain:
  name: "<domain name>"
  domain_prefix: "<domain prefix>"
schema_bindings:
  catalog_item_table: "public.<table>"
  inventory_item_table: "public.<table>"
  inventory_ledger_table: "public.<table>"
  inventory_reservation_table: "public.<table>"
  inventory_projection_table: "public.<table>"
  item_profile_table: "public.<table>"
  integration_job_table: "public.<table>"
  integration_audit_table: "public.<table>"
api_bindings:
  command_endpoint: "/api/v2/inventory/commands"
  reservation_endpoint: "/api/v2/inventory/reservations/soft"
  availability_endpoint: "/api/v2/inventory/availability"
  movement_endpoint: "/api/v2/inventory/movements"
  integration_adapter_endpoint: "/api/v2/inventory/integrations/{domain}/actions"
controls:
  idempotency_required: true
  correlation_id_required: true
  reconciliation_interval_minutes: 5
  dlq_enabled: true
```

## 3. Generic SQL Template Snippets
```sql
-- core item table
create table if not exists ${catalog_item_table} (
  id uuid primary key,
  tenant_id uuid not null,
  item_code text not null,
  item_name text not null,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, item_code)
);

-- core inventory table
create table if not exists ${inventory_item_table} (
  id uuid primary key,
  tenant_id uuid not null,
  catalog_item_id uuid not null references ${catalog_item_table}(id),
  quantity numeric(12,4) not null default 0,
  status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 4. API Payload Templates
### 4.1 Command Request
```json
{
  "command_type": "RECEIVE|MOVE|RESERVE|CONSUME|ADJUST|RETURN|SCRAP",
  "idempotency_key": "tenant:context:item:action:nonce",
  "command_payload": {
    "inventory_item_id": "uuid",
    "catalog_item_id": "uuid",
    "quantity": 1.0,
    "status": "available",
    "location_ref": "LOC-001",
    "reference_module": "DOMAIN_ADAPTER",
    "reference_record_id": "uuid",
    "metadata": {}
  }
}
```

### 4.2 Command Response
```json
{
  "version": "v2",
  "interface": "inventory-command-handler",
  "output": {
    "command_id": "uuid",
    "command_status": "applied",
    "applied_output": {}
  },
  "correlation_id": "cid-123"
}
```

## 5. Mapping Rule Template
```yaml
mapping_rules:
  - source_field: "<legacy_table.column>"
    target_field: "<placeholder_table.column>"
    transform: "<function/expression>"
    required: true
    default: null
    validation:
      - "<rule 1>"
      - "<rule 2>"
```

## 6. Reconciliation Config Template
```yaml
reconciliation:
  cadence_minutes: 5
  thresholds:
    quantity_mismatch_pct: 0.1
    reservation_mismatch_pct: 0.1
    orphan_fk_pct: 0.0
  alerts:
    warning_after_consecutive_failures: 2
    critical_after_consecutive_failures: 4
  actions:
    auto_requeue_failed_jobs: true
    auto_open_incident: true
```

## 7. Domain Profile Template
```yaml
item_profile_extension:
  profile_type_values:
    - "<domain-specific type>"
  required_domain_attributes:
    - "<attribute key>"
  optional_domain_attributes:
    - "<attribute key>"
  compliance_rules:
    - "<rule>"
```

## 8. AMRO Binding Example (Extension Only)
```yaml
domain:
  name: "AMRO"
  domain_prefix: "amro"
schema_bindings:
  catalog_item_table: "public.uim_catalog_items"
  inventory_item_table: "public.uim_inventory_items"
  inventory_ledger_table: "public.uim_inventory_ledger"
  inventory_reservation_table: "public.uim_inventory_reservations"
  inventory_projection_table: "public.uim_inventory_projection_snapshots"
  item_profile_table: "public.uim_mro_item_profiles"
  integration_job_table: "public.uim_amro_sync_jobs"
  integration_audit_table: "public.uim_amro_sync_audit"
```
