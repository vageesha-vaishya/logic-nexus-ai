# Email Infrastructure Phase 1 Implementation Specification: Foundation & Zero-Trust Security

**Date:** 2026-02-08
**Parent Plan:** [Email Infrastructure Enhancement Plan](file:///Users/user/Downloads/Vimal/Development%20Projects/Trae/SOS-Nexues/logic-nexus-ai/docs/plans/2026-02-08-email-infrastructure-enhancement-plan.md)
**Status:** Draft
**Phase:** 1 (Weeks 1-4)

## 1. Technical Architecture Design

Phase 1 focuses on hardening the existing email infrastructure. The architecture shifts from a "trust-by-default" internal model to a "zero-trust" model where access is explicitly verified and data is encrypted at rest.

### 1.1 Core Components
1.  **Identity Enforcement Layer**: Intercepts delegation access requests to enforce Multi-Factor Authentication (MFA) via Supabase Auth Assurance Levels (AAL2).
2.  **Domain Verification Service**: A background service (Edge Function) that interfaces with DNS providers (AWS SES/SendGrid) to verify SPF/DKIM/DMARC records for tenant domains.
3.  **Encryption Engine**: Utilization of PostgreSQL `pgcrypto` extension for transparent encryption/decryption of sensitive email bodies and attachments within the database.

### 1.2 High-Level Data Flow
1.  **Delegation Access**: User attempts to access shared inbox -> RLS Policy checks `auth.jwt()` -> If `requires_mfa` is true, check `aal` claim -> Allow/Deny.
2.  **Email Storage**: Application receives email -> Edge Function encrypts body -> Inserts into `public.emails` (encrypted column).
3.  **Email Retrieval**: User requests email -> RPC function decrypts using tenant-specific key -> Returns cleartext to authorized client.

## 2. Database Schema Modifications

### 2.1 Tenant Domains Table (New)
To support "Automated configuration and verification of SPF, DKIM, and DMARC", we need to track domains at the tenant level.

```sql
CREATE TABLE public.tenant_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) NOT NULL,
    domain_name TEXT NOT NULL,
    
    -- Verification Status
    is_verified BOOLEAN DEFAULT false,
    spf_record TEXT,
    spf_verified BOOLEAN DEFAULT false,
    dkim_record TEXT,
    dkim_verified BOOLEAN DEFAULT false,
    dmarc_record TEXT,
    dmarc_verified BOOLEAN DEFAULT false,
    
    -- Provider Info (e.g., AWS SES identity ARN)
    provider_metadata JSONB,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(tenant_id, domain_name)
);

-- RLS: Tenant Admins can view/manage their domains
```

### 2.2 Email Account Delegations (Update)
Add MFA enforcement flag.

```sql
ALTER TABLE public.email_account_delegations 
ADD COLUMN requires_mfa BOOLEAN DEFAULT false;

-- RLS Policy update required to check for AAL2 if this flag is true.
```

### 2.3 Emails Table (Update)
Migrate body storage to encrypted format.

```sql
ALTER TABLE public.emails
ADD COLUMN body_encrypted BYTEA,
ADD COLUMN encryption_key_id UUID; -- Reference to a key management system if needed, or simplified for Phase 1

-- Deprecation Plan:
-- 1. Add body_encrypted
-- 2. Dual-write to body_html and body_encrypted
-- 3. Backfill body_encrypted
-- 4. Drop body_html
```

## 3. API Endpoint Specifications

### 3.1 Domain Management
*   `POST /functions/v1/domains/verify`
    *   **Input**: `{ domain_id: UUID }`
    *   **Logic**: Queries AWS SES/DNS to check verification status. Updates `tenant_domains` table.
    *   **Output**: `{ status: "pending" | "verified", records: { ... } }`

*   `POST /functions/v1/domains/register`
    *   **Input**: `{ domain: string }`
    *   **Logic**: Registers domain with email provider (AWS SES) to generate DKIM tokens.
    *   **Output**: `{ id: UUID, dkim_tokens: string[] }`

### 3.2 Secure Email Access (RPC)
Since we are using DB-level encryption, standard REST/GraphQL select might return raw bytes. We need an RPC to handle decryption safely.

*   `get_decrypted_email_body(email_id UUID)`
    *   **Type**: Database Function (RPC)
    *   **Security**: SECURITY DEFINER (controlled) or invoker with access to keys.
    *   **Logic**: 
        1. Check RLS permissions for `email_id`.
        2. Decrypt `body_encrypted` using `pgp_sym_decrypt` (or similar) with the internal server key.
        3. Return text.

## 4. Integration Points

### 4.1 Supabase Auth (MFA)
*   **Integration**: Use `supabase.auth.mfa` API.
*   **Workflow**: 
    *   When a user clicks "Access Shared Inbox", frontend checks `email_account_delegations.requires_mfa`.
    *   If true, check `supabase.auth.getSession().user.app_metadata.aal`.
    *   If `aal` == 'aal1', prompt user to complete MFA challenge.
    *   Retry access with upgraded session.

### 4.2 AWS SES (Simple Email Service)
*   **Integration**: Use AWS SDK v3 in Edge Functions.
*   **Purpose**: 
    *   Identity Management (Domain verification).
    *   DKIM generation.
    *   Sending (using verified domains).

## 5. Security & Compliance Requirements

### 5.1 RLS Hardening
*   **Policy**: `Email account delegations` must strictly enforce `requires_mfa`.
    *   *Implementation Note*: Postgres RLS has limited visibility into JWT `amr` (Authentication Methods References) claims depending on Supabase configuration. We may need a wrapper function `auth.jwt()` to extract `aal` claim for use in policies.
    *   **Fallback**: If DB-level MFA check is complex, enforce strict logic in the `get_decrypted_email_body` RPC.

### 5.2 Encryption Standards
*   **Algorithm**: AES-256 (via `pgcrypto` `pgp_sym_encrypt`).
*   **Key Management**: 
    *   **Master Key**: Stored in Supabase Vault (if available) or strict Environment Variable (`EMAIL_ENCRYPTION_KEY`).
    *   **Rotation**: Phase 1 will use a single master key. Phase 2 will introduce tenant-specific keys.

## 6. Performance Benchmarks & Scalability

### 6.1 Performance Targets
*   **Decryption Latency**: < 50ms per email body.
*   **MFA Challenge**: < 500ms overhead.
*   **Domain Verification**: Background job, < 30s to reflect DNS changes.

### 6.2 Scalability Considerations
*   **Database Size**: `BYTEA` storage for encrypted bodies is slightly larger than `TEXT`. Monitor `public.emails` table size.
*   **Indexing**: Ensure `tenant_domains` and `delegations` are properly indexed for frequent permission checks.

## 7. Deviations & Enhancements
*   **Deviation**: The original plan mentions "Edge Function `track-email`". This is moved to Phase 3 (Engagement Tracking) to focus Phase 1 purely on Security/Foundation.
*   **Enhancement**: Added `tenant_domains` table which was implicit but not explicitly defined in the strategic plan schema section. This is critical for the "Email Authentication Standards" requirement.

## 8. Approval Required
*   [ ] Database Schema changes (Encryption columns, Tenant Domains).
*   [ ] use of `pgcrypto` extension (needs to be enabled in Supabase).
