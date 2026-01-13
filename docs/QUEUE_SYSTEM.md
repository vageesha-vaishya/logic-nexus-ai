# Queue Filtering & Permission System

## Overview
This document outlines the architecture and workflow of the strict queue filtering and permission system implemented for SOS Logistics Pro. The system ensures that emails are automatically categorized into queues and that access to these queues is strictly controlled based on user assignments.

## Architecture

### Database Schema
The system relies on four core tables:

1.  **`public.queues`**: Defines the queues available within a tenant.
    *   `id`: UUID primary key
    *   `tenant_id`: Reference to the tenant
    *   `name`: Unique identifier for the queue (e.g., 'support_priority')
    *   `type`: Queue behavior (e.g., 'round_robin', 'holding')
    *   `description`: Optional description
    *   `is_active`: Whether the queue is active

2.  **`public.queue_members`**: Maps users to queues.
    *   `id`: UUID primary key
    *   `queue_id`: Reference to the queue
    *   `user_id`: Reference to the user
    *   `tenant_id`: Reference to the tenant
    *   Users listed here are granted explicit read/write access to emails in the assigned queue.

3.  **`public.queue_rules`**: Defines criteria for auto-categorizing incoming emails.
    *   `id`: UUID primary key
    *   `tenant_id`: Reference to the tenant
    *   `queue_id`: Target queue reference
    *   `name`: Rule name (unique per tenant)
    *   `criteria`: JSONB object defining matching rules
    *   `priority`: Order of evaluation (higher numbers first)
    *   `is_active`: Whether the rule is active

4.  **`public.emails`**: Contains the `queue` column for assignment.
    *   `queue`: TEXT column storing the queue name

### Criteria Fields
The `criteria` JSONB object supports the following fields:
- `subject_contains`: Case-insensitive substring match on Subject
- `from_email`: Case-insensitive exact match on Sender Address
- `from_domain`: Case-insensitive domain match (e.g., "vip.example.com")
- `body_contains`: Case-insensitive substring match on Body (text or HTML)
- `priority`: Match on email priority field
- `ai_category`: Match on AI-assigned category
- `ai_sentiment`: Match on AI-detected sentiment

### Categorization Methodology
Incoming emails are categorized automatically via a database trigger (`trg_assign_email_queue`) that executes BEFORE INSERT on the `public.emails` table.

**Workflow:**
1.  **Ingestion**: An email is inserted into the `emails` table.
2.  **Trigger Execution**: The `process_email_queue_assignment` function is called.
3.  **Rule Evaluation**:
    *   The system fetches all active `queue_rules` for the tenant, ordered by priority (descending).
    *   It evaluates the email against each rule's `criteria` JSON.
    *   ALL criteria in a rule must match for the rule to apply.
4.  **Assignment**:
    *   The first matching rule determines the target queue.
    *   The `queue` column on the email record is updated.
    *   Processing stops after the first match.
5.  **Fallback**: If no rules match, the `queue` column remains NULL (treated as a general/personal email).

## Permission Hierarchy & Access Control

Access is enforced strictly at the database level using Row Level Security (RLS) policies.

### Visibility Rules
*   **Queue Members**: Users can view emails in a queue **ONLY IF** they are explicitly present in the `queue_members` table for that queue.
*   **Tenant Admins**: Users with the `tenant_admin` role have global access to all queues within their tenant.
*   **Unassigned Emails**: Emails with `queue IS NULL` fall back to standard ownership rules (visible to the `user_id` owner or delegated accounts).

### RLS Policy Implementation

#### Queues Table
```sql
-- Users can view queues in their tenant
CREATE POLICY "Users can view queues in their tenant"
ON public.queues FOR SELECT TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()));

-- Tenant admins can manage queues
CREATE POLICY "Tenant admins can manage queues"
ON public.queues FOR ALL TO authenticated
USING (/* tenant check */ AND /* admin role check */);
```

#### Queue Members Table
```sql
-- Users can view their own memberships, admins can see all
CREATE POLICY "Users can view their queue memberships"
ON public.queue_members FOR SELECT TO authenticated
USING (user_id = auth.uid() OR /* admin check */);
```

#### Queue Rules Table
```sql
-- Only tenant admins can manage rules
CREATE POLICY "Tenant admins can manage queue rules"
ON public.queue_rules FOR ALL TO authenticated
USING (/* tenant check */ AND /* admin role check */);
```

#### Emails Table
```sql
-- Queue-based visibility
CREATE POLICY "Users can view emails in their queues"
ON public.emails FOR SELECT TO authenticated
USING (
  queue IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM queues q
    JOIN queue_members qm ON q.id = qm.queue_id
    WHERE q.name = emails.queue
    AND q.tenant_id = emails.tenant_id
    AND qm.user_id = auth.uid()
  )
);
```

## Email Assignment Process

### Auto-Assignment
The trigger `trg_assign_email_queue` fires on every INSERT to the emails table and:
1. Checks if `queue` is already set (skip if yes)
2. Loads all active rules for the tenant ordered by priority DESC
3. Evaluates each rule's criteria against the email
4. Assigns the first matching rule's queue
5. Returns the modified NEW record

### Manual Assignment
Users can manually reassign emails using the `assign_email_to_queue` function:
```sql
SELECT assign_email_to_queue('email-uuid', 'queue-name');
```

**Access Control:**
- User must be a member of the target queue OR be a tenant admin
- The function logs the assignment to `email_audit_log`
- Returns TRUE on success, throws exception on access denied

## Database Functions

### get_user_queues()
Returns all queues accessible to the current user with email counts:
```sql
SELECT * FROM get_user_queues();
-- Returns: queue_id, queue_name, queue_type, description, email_count, unread_count
```

### assign_email_to_queue(email_id, queue_name)
Manually assigns an email to a queue with permission checking and audit logging.

### get_queue_counts()
Returns JSON object with email counts per queue for the current tenant.

## Auditing
*   **Email Actions**: All queue assignments are logged via `email_audit_log` table with:
    - `event_type`: 'queue_assignment'
    - `event_data`: Contains queue name and assigning user
    - `user_id`: Who made the assignment
    - `tenant_id`: Tenant context
*   **Rule Changes**: Creation and modification of `queue_rules` are restricted to Tenant Admins via RLS.

## UI Components

### QueueRulesManager
Admin component for creating, editing, and managing queue rules with:
- Rule CRUD operations
- Priority management
- Criteria builder with dropdown selectors
- Active/inactive toggle

### QueueEmailAssigner
Dropdown component for manually assigning emails to queues:
- Shows available queues based on user permissions
- Displays current queue assignment
- Triggers assignment with audit logging

### EmailSidebar Integration
- Displays queue navigation items with email counts
- Queue selection triggers filtered email list
- Real-time count updates via `get_user_queues()`

## Testing & Verification

### Verification Steps
1.  **Create Rule**: Add a rule for "Urgent" -> `support_priority`.
2.  **Ingest Email**: Send/Insert an email with "Urgent Help" in the subject.
3.  **Check Assignment**: Verify the `queue` column is `support_priority`.
4.  **Check Visibility**:
    *   Login as `User A` (Member of `support_priority`): Should see email.
    *   Login as `User B` (Not member): Should **NOT** see email.

### Test Queries
```sql
-- Verify rule was created
SELECT * FROM queue_rules WHERE tenant_id = 'your-tenant-id';

-- Check email was assigned
SELECT id, subject, queue FROM emails WHERE subject ILIKE '%urgent%';

-- Verify user can see queue
SELECT * FROM get_user_queues();

-- Test permission enforcement
SELECT * FROM emails WHERE queue = 'support_priority'; -- Should only return if user has access
```

### Edge Cases
*   **Deleted Queues**: Emails remain with orphaned queue values but become invisible
*   **Multiple Matches**: Only the highest priority rule applies
*   **Empty Criteria**: A rule with `{}` criteria matches all emails (use with caution)
*   **Case Sensitivity**: All string matches are case-insensitive

## Scalability

### Performance Optimizations
*   **Trigger Execution**: The categorization logic runs inside the database (PL/pgSQL), avoiding network round-trips
*   **Indexing**: 
    - `idx_queue_rules_tenant_priority`: Partial index for active rules
    - `idx_queue_rules_queue_id`: Quick rule-to-queue lookups
    - `idx_emails_queue`: Fast queue filtering
    - `idx_emails_queue_tenant`: Compound index for tenant-scoped queries

### Recommendations
*   Keep rule count reasonable (< 100 per tenant)
*   Use specific criteria to avoid scanning all rules
*   Monitor trigger execution time in postgres logs
*   Consider archiving old emails to maintain query performance
