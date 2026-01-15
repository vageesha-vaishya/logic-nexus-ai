# Queue Filtering & Permission System

## Overview
This document outlines the architecture and workflow of the strict queue filtering and permission system implemented for SOS Logistics Pro. The system ensures that emails are automatically categorized into queues and that access to these queues is strictly controlled based on user assignments.

## Architecture

### Database Schema
The system relies on three core tables:
1.  **`public.queues`**: Defines the queues available within a tenant.
    *   `name`: Unique identifier for the queue (e.g., 'support_priority').
    *   `type`: Queue behavior (e.g., 'round_robin', 'holding').
2.  **`public.queue_members`**: Maps users to queues.
    *   Users listed here are granted explicit read/write access to emails in the assigned queue.
3.  **`public.queue_rules`**: Defines criteria for auto-categorizing incoming emails.
    *   `criteria`: JSONB object defining matching rules (e.g., `{"subject_contains": "Urgent"}`).
    *   `target_queue_name`: The queue to assign if criteria are met.
    *   `priority`: Order of evaluation (higher numbers first).

### Categorization Methodology
Incoming emails are categorized automatically via a database trigger (`trg_assign_email_queue`) that executes BEFORE INSERT on the `public.emails` table.

**Workflow:**
1.  **Ingestion**: An email is inserted into the `emails` table.
2.  **Trigger Execution**: The `process_email_queue_assignment` function is called.
3.  **Rule Evaluation**:
    *   The system fetches all active `queue_rules` for the tenant, ordered by priority (descending).
    *   It evaluates the email against the `criteria` JSON.
    *   Supported criteria:
        *   `subject_contains`: Case-insensitive substring match on Subject.
        *   `from_email`: Case-insensitive match on Sender Address.
        *   `body_contains`: Case-insensitive substring match on Body.
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
The policy `"Users can view emails in their queues"` enforces this logic:
```sql
queue IS NOT NULL AND (
  -- Check if user is a member
  EXISTS (SELECT 1 FROM queue_members WHERE user_id = auth.uid() AND queue_id = ...)
  OR
  -- Check if user is admin
  has_role(auth.uid(), 'tenant_admin')
)
```

## Email Assignment Process

### Auto-Assignment
(See Categorization Methodology above)

### Manual Assignment
Users with access to an email can manually update the `queue` column. This is typically done via the UI "Move to Queue" feature.
*   **Constraint**: The application should ensure users can only move emails to queues they have knowledge of, though RLS protects data integrity if they attempt to move it to a restricted queue (they would lose access to it).

## Auditing
*   **Email Actions**: All changes to the `emails` table (including queue assignment) are logged via the existing `log_email_action` trigger.
*   **Rule Changes**: Creation and modification of `queue_rules` are restricted to Tenant Admins.

## Testing & Verification

### Verification Steps
1.  **Create Rule**: Add a rule for "Urgent" -> `support_priority`.
2.  **Ingest Email**: Send/Insert an email with "Urgent Help" in the subject.
3.  **Check Assignment**: Verify the `queue` column is `support_priority`.
4.  **Check Visibility**:
    *   Login as `User A` (Member of `support_priority`): Should see email.
    *   Login as `User B` (Not member): Should **NOT** see email.

### Edge Cases
*   **Deleted Queues**: If a queue is deleted, the foreign key constraint on `queue_rules` (if linked) or manual cleanup must handle orphaned emails. Currently, `queue` is a text column, so emails remain but "float" without a valid queue definition.
*   **Multiple Matches**: Only the highest priority rule applies.

## Scalability
*   **Performance**: The categorization logic runs inside the database (PL/pgSQL), avoiding network round-trips.
*   **Indexing**: `queue_rules` is indexed by `tenant_id` and `priority` for fast retrieval during ingestion.
