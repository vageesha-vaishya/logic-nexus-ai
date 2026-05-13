# Module Data Dictionary Template

## Module Metadata

- Module Name:
- Schema Name (`module_<module_name>`):
- Technical Owner:
- Data Steward:
- Last Updated:

## Entity Catalog

| Entity | Table | Source of Truth | Owner | Notes |
| --- | --- | --- | --- | --- |
| <entity> | module_<module_name>_<entity> | yes/no | <owner> | <notes> |

## Field Dictionary

| Table | Field | Type | Nullable | Default | Constraints | Sensitivity | Description |
| --- | --- | --- | --- | --- | --- | --- | --- |
| module_<module_name>_<entity> | <field_name> | <data_type> | yes/no | <default> | pk/fk/check/unique | public/internal/pii/restricted | <description> |

## Index and Constraint Inventory

| Object Type | Name | Table | Definition |
| --- | --- | --- | --- |
| Index | idx_<module_name>_<table>_<columns> | module_<module_name>_<entity> | <ddl> |
| Primary Key | pk_<module_name>_<table> | module_<module_name>_<entity> | <ddl> |
| Foreign Key | fk_<module_name>_<table>_<referenced_table> | module_<module_name>_<entity> | <ddl> |

## RLS Policy Inventory

| Policy Name | Table | Role | Condition | Command |
| --- | --- | --- | --- | --- |
| rls_<module_name>_<table>_<purpose> | module_<module_name>_<entity> | module_<module_name>_rw | tenant_id = current_setting('app.current_tenant_id')::uuid | SELECT/INSERT/UPDATE/DELETE |
