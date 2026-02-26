# Account Management System API Documentation

## Overview

The Account Management System provides a comprehensive persistence layer for managing:
1.  **Account Information**: Core company details, tax IDs, addresses.
2.  **Contact Details**: Primary contacts linked to accounts.
3.  **External References**: Customer POs, Vendor IDs, etc.
4.  **Notes**: Internal remarks and instructions.

The system ensures data integrity via:
-   **Mandatory Field Validation**: Enforced at the database level via RPC.
-   **Duplicate Detection**: Checks Tax ID (exact) and Name (fuzzy/exact) before creation.
-   **Audit Trails**: Automatically logs all changes to `audit_logs`.

## Database Schema

### Accounts Table Extensions
| Column | Type | Description |
| :--- | :--- | :--- |
| `tax_id` | TEXT | Unique Tax Identification Number (indexed) |
| `shipping_street` | TEXT | Shipping address street |
| `shipping_city` | TEXT | Shipping address city |
| `shipping_state` | TEXT | Shipping address state |
| `shipping_postal_code` | TEXT | Shipping address zip |
| `shipping_country` | TEXT | Shipping address country |

### Account References Table (`account_references`)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `account_id` | UUID | FK to Accounts |
| `reference_type` | TEXT | e.g., 'customer_po', 'vendor_ref' |
| `reference_value` | TEXT | The actual value |
| `description` | TEXT | Optional context |

### Account Notes Table (`account_notes`)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `account_id` | UUID | FK to Accounts |
| `content` | TEXT | The note content |
| `note_type` | TEXT | 'general', 'internal', 'instruction' |
| `is_pinned` | BOOLEAN | Important notes pinned to top |

---

## RPC Methods

### `manage_account`

Upserts an account with all related data in a transactional manner.

**Signature:**
```sql
manage_account(
    p_account_id UUID,
    p_tenant_id UUID,
    p_name TEXT,
    p_tax_id TEXT,
    p_billing_address JSONB,
    p_shipping_address JSONB,
    p_contact_data JSONB,
    p_references JSONB,
    p_notes JSONB
) RETURNS JSONB
```

**Parameters:**
-   `p_account_id`: (Optional) ID for update. If NULL, creates new.
-   `p_name`: (Required) Company Name.
-   `p_tax_id`: (Optional) Tax ID. Checked for duplicates.
-   `p_billing_address`: JSON object `{ street, city, state, zip, country }`.
-   `p_shipping_address`: JSON object `{ street, city, state, zip, country }`.
-   `p_contact_data`: JSON object `{ first_name, last_name, email, phone, title }`.
    -   *Validation*: `email` must be valid format.
-   `p_references`: JSON array of `{ type, value, description }`.
-   `p_notes`: JSON array of `{ content, type, is_pinned }`.

**Response:**
```json
{
  "account_id": "uuid...",
  "contact_id": "uuid...",
  "status": "success"
}
```

**Error Handling:**
-   Throws "Company Name is required" if name missing.
-   Throws "Valid Primary Contact Email is required" if invalid email.
-   Throws "Duplicate Account detected with Tax ID: ..." if conflict.
-   Throws "Duplicate Account detected with Name: ..." if conflict.

## Usage Example (TypeScript)

```typescript
const { data, error } = await supabase.rpc('manage_account', {
  p_tenant_id: 'tenant-uuid',
  p_name: 'Acme Corp',
  p_tax_id: 'US-123456789',
  p_billing_address: {
    street: '123 Main St',
    city: 'New York',
    state: 'NY',
    zip: '10001',
    country: 'USA'
  },
  p_shipping_address: { ... },
  p_contact_data: {
    first_name: 'Jane',
    last_name: 'Doe',
    email: 'jane@acme.com',
    phone: '+1-555-0100',
    title: 'Procurement Manager'
  },
  p_references: [
    { type: 'vendor_ref', value: 'V-9988', description: 'Our ID in their system' }
  ],
  p_notes: [
    { content: 'Always requires liftgate', type: 'instruction', is_pinned: true }
  ]
});

if (error) console.error(error.message);
```

## Audit Trail

All changes to `accounts`, `account_references`, and `account_notes` are automatically logged to `audit_logs` table via triggers.

Querying Audit Logs:
```sql
SELECT * FROM audit_logs WHERE resource_type = 'accounts' AND resource_id = 'account-uuid';
```
