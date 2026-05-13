# Module ERD Template

```mermaid
erDiagram
  module_moduleName_entityA {
    uuid id PK
    uuid tenant_id
    text name
    timestamptz created_at
    timestamptz updated_at
  }

  module_moduleName_entityB {
    uuid id PK
    uuid tenant_id
    uuid entityA_id FK
    text status
    timestamptz created_at
  }

  module_moduleName_entityA ||--o{ module_moduleName_entityB : references
```

## ERD Documentation Checklist

- Cardinality and optionality clearly indicated.
- Primary key and foreign key columns highlighted.
- Tenant/franchise boundary columns visible.
- Ownership annotation for each entity.
