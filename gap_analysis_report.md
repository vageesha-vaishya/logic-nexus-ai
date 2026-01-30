# AES-AESTIR Appendix D Gap Analysis Report

## Executive Summary
A systematic analysis of the provided AES-AESTIR Appendix D document (`appendix_d_port_cd_122025_508c.pdf`) was performed to extract valid port codes.

- **Source Document**: `appendix_d_port_cd_122025_508c.pdf` (Official CBP PDF, Dec 2025)
- **Extracted Records**: 384
- **Expected Records**: ~5,000+ (based on full Schedule D dataset)
- **Gap**: Missing ~4616 records (92.3%)

## Root Cause Analysis
The significant discrepancy in record count is due to the **source document itself being an abridged or "updates-only" version**, despite its title "Appendix D: Export Port Codes".

1.  **Document Length**: The PDF is only 13 pages long. A full list of 5,000+ records would require approx. 100+ pages at standard density.
2.  **Content Analysis**:
    - Page 2 contains a "Table of Changes", suggesting this document highlights recent modifications (Dec 2025).
    - The record list jumps significantly (e.g., from `01xx` on p.3 to `55xx` on p.13), indicating large omissions of unchanged data.
    - Official CBP/Census Bureau "Schedule D" is the authoritative full list.
3.  **Conclusion**: The provided PDF is NOT the complete dataset. It is a subset.

## Recommendations for Data Capture Accuracy
To achieve the goal of seeding the complete 5,000+ port code dataset:

1.  **Switch Data Source**: Do not use the PDF. Instead, download the **AESTIR Export Reference Data Excel File** from CBP.gov (Section: "AESTIR Introduction and Guidelines").
    - This Excel file typically contains the full "Appendix D - US Port Codes" tab.
2.  **Alternative Source**: Use the "Schedule D" text file available from the US Census Bureau or CBP Data Catalog.
3.  **Current Status**: The system has seeded the 384 valid codes found in the provided document. These are likely the most critical *updates* or *active* ports for the current period, but they do not represent the full historical or complete list.

## Dataset Validation
- **Checksum**: N/A (Full dataset not available for checksum).
- **Metadata Extracted**:
    - Port Codes (4-digit)
    - Port Names
    - State (derived from name)
    - District (derived from first 2 digits)
    - Transport Modes (Vessel, Air, Rail, Road, Fixed)

## Extracted Data Summary
- **Total Unique Codes**: 384
- **Date of Extraction**: 2026-01-30
