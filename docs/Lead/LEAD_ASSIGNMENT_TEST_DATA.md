# Lead Assignment Test Data Documentation

This document describes the comprehensive seed data generated for testing the Lead Assignment module. The data is designed to cover standard workflows, edge cases, and performance scenarios.

## 1. Test Scenarios Covered

### A. Standard Assignment Scenarios
| Scenario | Description | Expected Outcome |
| :--- | :--- | :--- |
| **High Priority Lead** | A new lead created with `priority: 'high'`. | Should match the "High Priority Express" rule and be assigned via Round Robin to available agents. |
| **Territory-Based Lead** | A lead located in "United States" (matches geography). | Should match "US Territory Assignment" rule and be assigned to the agent responsible for the "North America Sales" territory. |
| **Standard Weighted Lead** | A lead with no special attributes. | Should fall through to "General Weighted Distribution" rule. |

### B. User Capacity & Availability
| User | Role | Capacity Settings | Test Purpose |
| :--- | :--- | :--- | :--- |
| **Agent 1** | Primary Agent | Max: 100, Current: 5, Available: Yes | High capacity target, also Primary for NA Territory. |
| **Agent 2** | Secondary Agent | Max: 20, Current: 15, Available: Yes | Low remaining capacity (5 left). Tests load balancing. |
| **Agent 3** | Unavailable Agent | Max: 50, Current: 0, Available: No | Tests availability check (should be skipped). |

### C. Edge Cases
| Case | Description | Expected Outcome |
| :--- | :--- | :--- |
| **Expired Lead** | Created 30 days ago, still 'new'. | Should be flagged for cleanup or re-engagement. |
| **Assigned Lead** | Status 'assigned' with history. | Should NOT be picked up by assignment queue. |
| **Incomplete Lead** | Missing email/phone. | Should still be processed but might fail specific notification steps. |

## 2. Data Structure & Relationships

### Hierarchy
-   **Tenant**: Root entity for isolation.
-   **Territories**: Linked to Tenant.
-   **Geographies**: Linked to Territories (e.g., NA -> North America).
-   **Users**: Linked to Territories (Assignments) and Tenant (Capacity).
-   **Rules**: Linked to Tenant, defining logic.

### Assignment Flow Data
1.  **Lead Created** -> Inserted into `leads`.
2.  **Queue Entry** -> Inserted into `lead_assignment_queue` (pending).
3.  **Processing** -> System evaluates `assignment_rules`.
4.  **Assignment** -> Updates `leads.status`, inserts `lead_assignment_history`, updates `user_capacity.current_leads`.

## 3. Usage

To apply this seed data:
1.  Ensure the database migrations are up to date.
2.  Run the SQL script `supabase/seeds/lead_assignment_seed.sql` in your Supabase SQL Editor.
3.  Check the "Lead Assignment" dashboard to see the populated data.

## 4. Schema Notes
-   Leads table may be defined with either a single `name` column or split `first_name` and `last_name` columns depending on environment. The seed script detects the available columns and inserts accordingly.
-   A migration is provided to add a `name` column if missing: `supabase/migrations/20260105114500_leads_name_column.sql`.
