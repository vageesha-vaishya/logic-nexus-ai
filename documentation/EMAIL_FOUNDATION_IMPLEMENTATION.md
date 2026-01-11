# Email Infrastructure Foundation Implementation Plan

## 1. Overview
This document outlines the implementation status, gaps, and roadmap for the Email Infrastructure in the multi-tenant CRM system. It serves as the primary reference for Phase 1 (Foundation) and Phase 2 (Core Features) execution.

## 2. Current State Assessment

### 2.1 Database Schema
The following tables are implemented and verified in `supabase/migrations/`:
- **`email_accounts`**: Stores provider credentials (OAuth/SMTP/IMAP) per user.
- **`emails`**: Core table for stored messages, linked to CRM entities (leads, contacts, etc.).
- **`scheduled_emails`**: Queue for outbound emails with status tracking.
- **`email_audit_log`**: Compliance logging for all email events.
- **`email_filters`**: User-defined rules for incoming mail.
- **`email_templates`**: Reusable templates with sharing scopes.
- **`email_account_delegations`**: (New) Supports shared inbox access via delegation.

### 2.2 Security & Access Control (RLS)
Hierarchical RLS is implemented using a "Strict Admin Override" model:
- **Helper Functions**:
  - `is_super_admin` (aliased/implemented via `is_platform_admin` logic).
  - `is_tenant_admin` & `is_franchise_admin`.
  - `get_user_tenant_id` & `get_user_franchise_id` (respects Admin Override).
  - `get_franchise_user_ids`: Returns users within a franchise scope.
- **Policies**:
  - `emails` and `scheduled_emails` enforce strict hierarchical visibility (Super Admin -> Tenant -> Franchise -> User).
  - **Delegation Support**: `emails` and `email_accounts` policies now allow access to delegated resources.
  - `email_audit_log` provides read-only hierarchical access.

### 2.3 Frontend Integration
- **Context Management**: `useCRM` hook correctly identifies roles and provides `scopedDb` for tenant/franchise isolation.
- **Activity Feed**: `LeadActivitiesTimeline.tsx` and `ActivityDetail.tsx` are updated to handle email activities using `custom_fields` (to/from/body) and strip non-schema fields.
- **Email Client**: `EmailInbox` and `EmailAccounts` components are verified to support RLS-based filtering, enabling seamless display of delegated emails and accounts without frontend code changes.

## 3. Gap Analysis

### 3.1 Missing Database Functions
- **Status**: **Resolved**.
- **Resolution**: `get_franchise_user_ids` was added in `20260116_email_phase3_completion.sql`.

### 3.2 Communication Continuity (Delegation)
- **Status**: **Implemented**.
- **Resolution**: `email_account_delegations` table, RLS policies, and `EmailDelegationDialog` UI are fully implemented. Users can now share inboxes with colleagues in the same franchise/tenant.

### 3.3 Infrastructure Configuration
- **DNS/MTA**: Domain verification and DKIM/SPF setup UI/logic is missing.
- **Edge Functions**: Email sending logic (referenced as TODO in `ActivityNew.tsx`) is not implemented.

## 4. Implementation Roadmap

### Phase 1: Foundation (Completed)
- [x] Schema Design & Migration (`emails`, `accounts`, `audit_log`).
- [x] RLS Policy Implementation (Hierarchical + Override).
- [x] CRM Activity Integration (`custom_fields` support).
- [x] **Task**: Add `get_franchise_user_ids` function to database.
- [x] **Task**: Create `email_account_delegations` table for shared access.

### Phase 2: Core Execution (Next Steps)
- [ ] **Edge Function**: Implement `send-email` function using `scheduled_emails` queue.
- [ ] **Edge Function**: Implement `sync-email` function for IMAP/Gmail fetch.
- [ ] **UI**: Build `EmailAccountSettings` page for connecting providers (OAuth flow).
- [ ] **UI**: Complete `EmailComposeDialog` with attachment handling and template selection.
- [x] **UI**: Create `EmailDelegationDialog` for managing inbox sharing.

### Phase 3: Advanced Features
- [ ] **Templates**: UI for creating/editing variable-rich templates.
- [ ] **AI Integration**: Sentiment analysis and category tagging (columns exist, logic pending).
- [ ] **Analytics**: Dashboard for open rates and team performance.

## 5. Technical Specifications

### 5.1 Delegation Implementation
Implemented in `20260116_email_phase3_completion.sql`:
- Table: `email_account_delegations` with permissions JSONB.
- RLS: Policies added to `emails` and `email_accounts` to allow delegates to view and access shared resources.
- Note: `get_franchise_user_ids` returns `TABLE (user_id UUID)` for better SQL join compatibility.

## 6. Risk Assessment
- **RLS Complexity**: The interplay between "Admin Override" and "Delegation" could create loopholes. Extensive testing of the `has_role` and delegation policies is required.
- **Performance**: `scheduled_emails` queue may grow rapidly. Implement partitioning or archiving strategy (e.g., move sent emails to cold storage after 30 days) if volume exceeds 10k/day.
