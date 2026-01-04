# Data Retention Policy

**Effective Date:** 2026-01-04
**Version:** 1.0
**Status:** Active

## 1. Purpose
The purpose of this Data Retention Policy is to ensure that SOS Logistics Pro (Logic Nexus AI) manages data throughout its lifecycle in a manner that aligns with business needs, legal requirements, and industry best practices. This policy establishes guidelines for retaining, archiving, and destroying data.

## 2. Scope
This policy applies to all data generated, processed, or stored by the Logic Nexus AI application, including but not limited to:
- User personal information (PII)
- Customer operational data (Shipments, Quotes, Leads)
- System logs and audit trails
- Communication records (Emails, Notifications)
- Backup archives

## 3. Data Classification
Data is classified into the following categories to determine appropriate retention periods:

| Classification | Description | Examples |
| :--- | :--- | :--- |
| **Critical** | Data essential for business operations and legal compliance. | Financial records, Contracts, User Accounts, Active Shipments. |
| **Operational** | Data required for day-to-day activities but with limited long-term value. | Completed Quotes, Closed Leads, General Correspondence. |
| **Audit & Security** | Data used for security monitoring, debugging, and compliance auditing. | Access Logs, System Events, Audit Trails. |
| **Temporary** | Transient data used for processing or caching. | Session tokens, Temporary export files, Cache data. |

## 4. Retention Periods

### 4.1. User & Account Data
| Data Type | Retention Period | Action After Expiry |
| :--- | :--- | :--- |
| Active User Accounts | Indefinite (while active) | N/A |
| Inactive/Deleted Accounts | 30 days post-deletion request | Soft delete -> Hard delete |
| User Authentication Logs | 1 year | Anonymize or Delete |

### 4.2. Operational Data (CRM & Logistics)
| Data Type | Retention Period | Action After Expiry |
| :--- | :--- | :--- |
| Shipment Records | 7 years (Tax/Legal requirement) | Archive to cold storage |
| Quotes & Estimates | 3 years | Archive |
| Leads & Opportunities | 2 years after closure | Anonymize for analytics |
| Invoices & Payments | 7 years | Archive |

### 4.3. System & Security Data
| Data Type | Retention Period | Action After Expiry |
| :--- | :--- | :--- |
| Application Logs | 90 days | Rotate/Delete |
| Security/Audit Logs | 1 year | Archive to secure storage |
| Database Backups | Daily (30 days retention) | Overwrite oldest |

### 4.4. Communications
| Data Type | Retention Period | Action After Expiry |
| :--- | :--- | :--- |
| Synced Emails | Mirror source provider policy | Delete if removed from source |
| System Notifications | 6 months | Delete |

## 5. Data Deletion & Destruction
*   **Soft Deletion:** Records are marked as deleted (`deleted_at` timestamp) but remain in the database for a grace period (e.g., 30 days) to allow for recovery from accidental deletion.
*   **Hard Deletion:** After the grace period or retention limit, data is permanently removed from the active database.
*   **Secure Destruction:** Physical media (if any) is destroyed in accordance with NIST 800-88 guidelines.

## 6. Roles and Responsibilities
*   **Data Owner:** Responsible for defining data classification and retention requirements for their specific domain.
*   **System Administrator:** Responsible for implementing automated retention schedules and executing deletion procedures.
*   **Compliance Officer:** Responsible for reviewing this policy annually and ensuring adherence to legal regulations (GDPR, CCPA, etc.).

## 7. Review and Updates
This policy will be reviewed annually or upon significant system changes to ensure continued relevance and compliance.
