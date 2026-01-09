# CRM Enhancement Test Plan

This document outlines the test strategy for the enhanced Account and Contact management system.

## Test Scope
- **Modules**: Accounts, Contacts, Activities, Relationships, Segments
- **Features**: CRUD operations, Custom Fields, Segmentation, Relationship Mapping, Activity Tracking
- **Roles**: Platform Admin, Tenant Admin, Standard User

## Test Environment
- **URL**: `/dashboard/accounts`, `/dashboard/contacts`
- **Database**: Supabase (Public Schema)

## Test Cases

### 1. Account Management

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| ACC-001 | Create Account | 1. Navigate to Accounts > New<br>2. Fill required fields (Name)<br>3. Save | Account created, redirected to detail view |
| ACC-002 | Update Account | 1. Open existing account<br>2. Click Edit<br>3. Modify fields (inc. custom fields)<br>4. Save | Changes persisted, UI updates |
| ACC-003 | Delete Account | 1. Open account<br>2. Click Delete<br>3. Confirm | Account deleted, redirected to list |
| ACC-004 | Custom Fields | 1. Edit account<br>2. Add JSON data to custom fields<br>3. Save | Custom fields displayed correctly in "Custom Fields" card |
| ACC-005 | Parent Account | 1. Create Child Account<br>2. Select Parent Account<br>3. Save | Hierarchy established, displayed in "Child Accounts" on Parent |

### 2. Contact Management

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| CON-001 | Create Contact | 1. Navigate to Contacts > New<br>2. Fill required fields (First/Last Name)<br>3. Select Account<br>4. Save | Contact created, linked to Account |
| CON-002 | Update Contact | 1. Open existing contact<br>2. Click Edit<br>3. Update Department, Reports To<br>4. Save | Changes saved, Reports To link works |
| CON-003 | Lifecycle Stage | 1. Edit contact<br>2. Change Lifecycle Stage<br>3. Save | Badge updates with correct color/text |
| CON-004 | Social Profiles | 1. Edit contact<br>2. Add Social Profile URLs<br>3. Save | Social links displayed and clickable |

### 3. Relationships & Segmentation

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| REL-001 | View Relationships | 1. Open Account with relationships<br>2. Check "Relationships" card | Relationships listed with type and notes |
| SEG-001 | View Segments | 1. Open Account/Contact in segment<br>2. Check "Segments" card | Active segments displayed as badges |

### 4. Activities

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| ACT-001 | Create Activity | 1. Open Account/Contact<br>2. Click "New Activity"<br>3. Fill details<br>4. Save | Activity appears in list, ordered by date |
| ACT-002 | View Activities | 1. Check Activities tab/card | Activities listed with correct type icons and status |

## Database Verification Queries

```sql
-- Verify Account Hierarchy
SELECT p.name as parent, c.name as child 
FROM accounts c 
JOIN accounts p ON c.parent_account_id = p.id;

-- Verify Contact Relationships
SELECT c.first_name, c.last_name, a.name as account, m.first_name as reports_to
FROM contacts c
LEFT JOIN accounts a ON c.account_id = a.id
LEFT JOIN contacts m ON c.reports_to = m.id;

-- Verify Activities
SELECT a.subject, a.activity_type, acc.name as account_name
FROM activities a
JOIN accounts acc ON a.account_id = acc.id;
```
