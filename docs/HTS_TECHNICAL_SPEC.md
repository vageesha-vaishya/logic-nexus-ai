# HTS Discovery and Validation Framework - Technical Specification
**Version:** 1.0.0  
**Date:** 2026-01-30  
**Status:** Approved  

---

## 1. Introduction

### 1.1 Purpose
The purpose of this document is to define the technical requirements and architecture for the **HTS Code Discovery and Validation Framework**. This system provides a multi-source, automated pipeline to identify, verify, and maintain the universe of Harmonized Tariff Schedule (HTS) codes for AES filing compliance.

### 1.2 Scope
This system covers:
- **Data Acquisition**: Fetching from Census Bureau, Federal Register, and USITC.
- **Data Validation**: Enforcing 99.5% completeness and 100% uniqueness.
- **Discrepancy Management**: Logging and alerting on source mismatches.
- **Reporting**: Auditable verification reports in PDF/XBRL formats.

### 1.3 Definitions, Acronyms, and Abbreviations
- **AES**: Automated Export System
- **HTS**: Harmonized Tariff Schedule
- **USITC**: United States International Trade Commission
- **CBP**: Customs and Border Protection
- **ETL**: Extract, Transform, Load

---

## 2. Overall Description

### 2.1 Product Perspective
The framework operates as a backend service integrated with the existing PostgreSQL database (`aes_hts_codes` table). It interacts with external APIs (Federal Register) and static file servers (Census Bureau).

### 2.2 Product Functions
1.  **Daily ETL**: Pulls data, updates `aes_hts_codes`.
2.  **Validation**: Checks code formatting (regex).
3.  **Search**: Full-text search via `search_hts_codes` RPC.

---

## 3. Specific Requirements

### 3.1 Data Model (Active)
The system uses `aes_hts_codes` as the single source of truth.
- `id` (UUID)
- `hts_code` (Unique)
- `description` (Text)
- `search_vector` (TSVector for search)
- `chapter`, `heading`, `subheading` (Hierarchy)

*Note: The previous `master_hts` table and associated "Discovery Framework" tables have been deprecated and removed as of 2026-02-06.*
    - `report_id` (PK)
    - `master_checksum` (Hash of DB state)

---

## 4. API Endpoints (Internal)

While mostly script-driven, the system exposes these logical operations:

- `POST /pipeline/run`: Triggers `HTSPipeline.run()`.
- `GET /reports/latest`: Returns the path to the latest generated report.

---

## 5. Appendices

### 5.1 Checksum Algorithm
SHA-256 hash of the JSON-serialized, key-sorted dictionary of significant fields (`hts_code`, `description`, `uom`).
