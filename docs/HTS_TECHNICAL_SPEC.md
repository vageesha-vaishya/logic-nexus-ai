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
The framework operates as a backend service integrated with the existing PostgreSQL database (`master_hts` table). It interacts with external APIs (Federal Register) and static file servers (Census Bureau).

### 2.2 Product Functions
1.  **Daily ETL**: Pulls data, calculates SHA-256 checksums, updates DB.
2.  **Validation**: Checks code formatting (regex) and source alignment.
3.  **Alerting**: Simulates JIRA ticket creation for discrepancies.
4.  **Reporting**: Generates compliance artifacts.

---

## 3. Specific Requirements

### 3.1 External Interface Requirements
#### 3.1.1 User Interfaces
- **CLI Tools**: `scripts/hts_etl_pipeline.py`, `scripts/generate_hts_report.py`.
- **Database Views**: `master_hts` for active codes.

#### 3.1.2 Hardware Interfaces
- Standard server environment (Linux/macOS) with network access to `.gov` domains.

#### 3.1.3 Software Interfaces
- **PostgreSQL 14+**: Main storage.
- **Python 3.9+**: ETL logic.
- **Federal Register API**: v1 REST API.

### 3.2 System Features

#### 3.2.1 Multi-Source Data Acquisition
**Description**: The system must ingest data from multiple authoritative sources.
**Inputs**: 
- Census `expaes.txt`
- Federal Register API JSON
- USITC Data (simulated/CSV)
**Processing**:
- Class-based fetchers (`CensusSource`, `FederalRegisterSource`, `USITCSource`).
- Normalization to `XXXX.XX.XX.XX` format.
**Outputs**: 
- Normalized record objects in memory.

#### 3.2.2 Data Validation & Integrity
**Description**: Enforce strict quality gates.
**Constraints**:
- **Uniqueness**: `UNIQUE(hts_code)` constraint in DB.
- **Completeness**: `NOT NULL` on `description`.
- **Format**: `CHECK (hts_code ~ '^[0-9]{4}(\.[0-9]{2}){0,3}$')`.
**KPIs**:
- 99.5% field completeness (enforced by schema).
- < 24h lag (enforced by daily cron schedule).

#### 3.2.3 Discrepancy Management
**Description**: Track conflicts between sources.
**Logic**:
- Compare `description` and `unit_of_measure` between Census (Primary) and others.
- Log to `discrepancy_logs` table.
- Auto-create JIRA ticket if `severity` >= WARNING.

### 3.3 Database Schema

#### 3.3.1 Entity Relationship Diagram (ERD) Overview
- **master_hts**: Core table.
    - `id` (PK, UUID)
    - `hts_code` (Unique, Char)
    - `checksum_sha256` (Hash)
    - `verified_flag` (Boolean)
- **discrepancy_logs**:
    - `log_id` (PK)
    - `hts_code` (FK)
    - `root_cause` (Enum)
- **hts_verification_reports**:
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
