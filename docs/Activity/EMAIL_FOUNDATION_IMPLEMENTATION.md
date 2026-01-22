# Email Infrastructure Foundation Implementation Plan

## 1. Overview
This document outlines the implementation status, gaps, and roadmap for the Email Infrastructure in the multi-tenant CRM system. It serves as the primary reference for Phase 1 (Foundation), Phase 2 (Core Features), and Phase 3 (Scope Matrix) execution.

## 2. Current State Assessment

### 2.1 Database Schema
The following tables are implemented and verified in `supabase/migrations/`:
- **`email_accounts`**: Stores provider credentials (OAuth/SMTP/IMAP) per user.
- **`emails`**: Core table for stored messages, linked to CRM entities (leads, contacts, etc.).
- **`scheduled_emails`**: Queue for outbound emails with status tracking.
- **`email_audit_log`**: Compliance logging for all email events.
- **`email_filters`**: User-defined rules for incoming mail.
- **`email_templates`**: Reusable templates with sharing scopes.
- **`email_account_delegations`**: ✅ Supports shared inbox access via delegation.

### 2.2 Security & Access Control (RLS)

#### 2.2.1 Email Scope Matrix by Role Level (IMPLEMENTED)

| Role Level | Own Emails | Team Emails | Franchisee Emails | Tenant Emails | Platform Emails |
|------------|------------|-------------|-------------------|---------------|-----------------|
| **Super Admin / Platform Admin** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Tenant Admin** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Franchise Admin** | ✅ | ✅ | ✅ (Own Franchise) | ❌ | ❌ |
| **Sales Manager** | ✅ | ✅ (Direct Reports) | ❌ | ❌ | ❌ |
| **Sales Rep / User** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Viewer** | ✅ (Read-Only) | ❌ | ❌ | ❌ | ❌ |

#### 2.2.2 Helper Functions (SECURITY DEFINER)
All functions are implemented with `SECURITY DEFINER` and `SET search_path = public`:

| Function | Purpose | Status |
|----------|---------|--------|
| `is_platform_admin(uuid)` | Check platform admin role | ✅ |
| `is_super_admin(uuid)` | Alias for platform admin | ✅ |
| `is_tenant_admin(uuid)` | Check tenant admin role | ✅ |
| `is_franchise_admin(uuid)` | Check franchise admin role | ✅ |
| `is_sales_manager(uuid)` | Check sales manager role | ✅ |
| `is_viewer(uuid)` | Check viewer role (read-only) | ✅ |
| `get_user_tenant_id(uuid)` | Get user's tenant scope | ✅ |
| `get_user_franchise_id(uuid)` | Get user's franchise scope | ✅ |
| `get_franchise_user_ids(uuid)` | Get all users in a franchise | ✅ |
| `get_sales_manager_team_user_ids(uuid)` | Get direct reports for sales manager | ✅ |

#### 2.2.3 RLS Policies (IMPLEMENTED)

**Emails Table:**
- `Email scope matrix - SELECT`: Full hierarchical visibility per role matrix
- `Email scope matrix - INSERT`: Viewers blocked; delegation with 'send' permission allowed
- `Email scope matrix - UPDATE`: Viewers blocked; hierarchical admin override
- `Email scope matrix - DELETE`: Viewers blocked; tenant admin and above can delete

**Email Accounts Table:**
- `Email accounts scope matrix - SELECT/INSERT/UPDATE/DELETE`: Owner and admin hierarchy

**Email Account Delegations Table:**
- `Delegation owners can manage`: Account owners can grant/revoke
- `Delegates can view their delegations`: Delegates see their access
- `Platform admins can manage all delegations`: Full control
- `Tenant admins can view delegations`: Tenant-scoped visibility
- `Franchise admins can view franchise delegations`: Franchise-scoped visibility

**Scheduled Emails Table:**
- `Scheduled emails scope matrix`: Hierarchical with sales manager team visibility; viewers blocked from INSERT/UPDATE/DELETE

### 2.3 Role Types (app_role Enum)
The following roles are defined in `public.app_role`:
1. `platform_admin` - Super Admin with full platform access
2. `tenant_admin` - Tenant-level administration
3. `franchise_admin` - Franchise-level administration
4. `sales_manager` - Team lead with direct reports visibility
5. `user` - Standard sales rep / user
6. `viewer` - Read-only access to own emails

### 2.4 Frontend Integration
- **Context Management**: `useCRM` hook correctly identifies roles and provides `scopedDb` for tenant/franchise isolation.
- **Activity Feed**: `LeadActivitiesTimeline.tsx` and `ActivityDetail.tsx` are updated to handle email activities.
- **Email Client**: `EmailInbox` and `EmailAccounts` components support RLS-based filtering.
- **Delegation UI**: `EmailDelegationDialog` component allows inbox sharing.

## 3. Communication Continuity & Team Collaboration

### 3.1 Delegation Implementation (COMPLETE)
- **Table**: `email_account_delegations` with:
  - `account_id`, `delegate_user_id`, `permissions` (JSONB)
  - `granted_by`, `granted_at`, `expires_at`, `is_active`
- **Permissions**: `["read"]` (default), `["read", "send"]`
- **RLS**: Policies allow account owners to manage, delegates to view their access
- **UI**: `EmailDelegationDialog` component for managing inbox sharing

### 3.2 Team Email Visibility
- **Sales Managers**: Can view emails from users in same franchise with roles: `user`, `sales_manager`, `viewer`
- **Franchise Admins**: Can view all emails within their franchise
- **Tenant Admins**: Can view all emails within their tenant (all franchises)
- **Platform Admins**: Can view all emails across the platform

## 4. Implementation Roadmap

### Phase 1: Foundation (COMPLETE)
- [x] Schema Design & Migration (`emails`, `accounts`, `audit_log`)
- [x] RLS Policy Implementation (Hierarchical + Override)
- [x] CRM Activity Integration (`custom_fields` support)
- [x] Add `get_franchise_user_ids` function to database
- [x] Create `email_account_delegations` table for shared access

### Phase 2: Core Execution (COMPLETE)
- [x] `scheduled_emails` table with queue status tracking
- [x] `email_audit_log` table with compliance logging
- [x] Helper functions for role checks
- [x] Hierarchical RLS policies for all email tables
- [x] Auto audit trigger on emails table

### Phase 3: Email Scope Matrix (COMPLETE)
- [x] Add `sales_manager` and `viewer` roles to `app_role` enum
- [x] Create `is_sales_manager()` and `is_viewer()` helper functions
- [x] Create `get_sales_manager_team_user_ids()` function for team visibility
- [x] Implement full scope matrix in RLS policies
- [x] Viewer read-only enforcement (blocked on INSERT/UPDATE/DELETE)
- [x] Delegation with expiration support

### Phase 4: Advanced Features (PENDING)
- [ ] **Edge Function**: Implement `send-email` function using `scheduled_emails` queue
- [ ] **Edge Function**: Implement `sync-email` function for IMAP/Gmail fetch
- [ ] **UI**: Build `EmailAccountSettings` page for connecting providers (OAuth flow)
- [ ] **UI**: Complete `EmailComposeDialog` with attachment handling and template selection
- [ ] **Templates**: UI for creating/editing variable-rich templates
- [ ] **AI Integration**: Sentiment analysis and category tagging
- [ ] **Analytics**: Dashboard for open rates and team performance

## 5. Security Considerations

### 5.1 Privilege Escalation Prevention
- All role checks use `SECURITY DEFINER` functions to prevent RLS bypass
- Roles are stored in separate `user_roles` table, not in profiles
- Admin override logic is centralized in helper functions

### 5.2 Read-Only Enforcement for Viewers
- Viewers can SELECT their own emails only
- INSERT, UPDATE, DELETE policies explicitly block viewers with `NOT is_viewer(auth.uid())`

### 5.3 Delegation Security
- Delegations include `expires_at` for time-limited access
- `is_active` flag for instant revocation
- Permissions are granular (`read`, `send`)

## 6. Testing Checklist

### 6.1 Role-Based Access Testing
- [ ] Super Admin can view all platform emails
- [ ] Tenant Admin can view all tenant emails but not other tenants
- [ ] Franchise Admin can view all franchise emails but not other franchises
- [ ] Sales Manager can view own + team emails (same franchise)
- [ ] User can view only own emails
- [ ] Viewer can read own emails but cannot send/update/delete

### 6.2 Delegation Testing
- [ ] Account owner can add delegate
- [ ] Delegate with 'read' can view emails
- [ ] Delegate with 'send' can compose on behalf
- [ ] Expired delegation is automatically blocked
- [ ] Revoked delegation (is_active=false) is blocked

### 6.3 Cross-Scope Testing
- [ ] User in Franchise A cannot see Franchise B emails
- [ ] Tenant A admin cannot see Tenant B emails
- [ ] Sales manager cannot see emails outside their franchise
