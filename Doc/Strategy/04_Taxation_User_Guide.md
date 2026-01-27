# SOS Logistics Pro - Taxation Module User Guide

## 1. Overview
This guide provides instructions for Platform Administrators and End-Users on how to configure and use the SOS Logistics Pro Taxation Module. The module ensures global tax compliance, automated calculation, and seamless financial integration.

---

## 2. Administrator Guide (Tax Configuration)

### 2.1 Accessing the Tax Configuration Console
1.  Log in to the **SOS Admin Portal**.
2.  Navigate to **Settings > Financials > Tax Configuration**.

### 2.2 Managing Tax Nexus (Jurisdictions)
Before tax can be calculated, you must define where your organization has a tax obligation (Nexus).
1.  Go to the **Nexus Settings** tab.
2.  Click **"Add Jurisdiction"**.
3.  Select the **Country** and **Region/State**.
4.  Enter your **Tax Registration Number** (e.g., VAT ID, GSTIN).
5.  Set the **Nexus Start Date**.
6.  Click **Save**.

### 2.3 Configuring Tax Rules & Rates
While the system pulls standard rates automatically, you may need to define custom rules for specific products.
1.  Go to the **Tax Rules** tab.
2.  Click **"Create New Rule"**.
3.  **Rule Name:** Enter a descriptive name (e.g., "Reduced Rate for eBooks").
4.  **Product Category:** Select the relevant product category or HS Code.
5.  **Rate Type:** Choose "Standard", "Reduced", "Zero", or "Exempt".
6.  **Effective Dates:** Set the "Valid From" and "Valid To" dates.
7.  **Approval:** Submit for review. (Status changes to *Pending Compliance Review*).

### 2.4 Managing Exemption Certificates
1.  Go to **Customer Management > [Select Customer] > Tax Exemptions**.
2.  Click **"Upload Certificate"**.
3.  Upload the PDF/Image of the certificate.
4.  Enter the **Certificate Number**, **Issuing Authority**, and **Expiration Date**.
5.  The system will now automatically exempt this customer from applicable taxes until the expiration date.

---

## 3. End-User Guide (Invoicing & Reporting)

### 3.1 Viewing Tax on Quotes
When generating a quote:
1.  Enter the **Origin** and **Destination** addresses.
2.  Add **Line Items** with correct Product Codes.
3.  Click **"Calculate"**.
4.  The **"Tax Breakdown"** section will appear, showing:
    *   Total Tax Amount.
    *   Detailed split (e.g., "State Tax: $50", "City Tax: $12").
    *   Any applied exemptions (marked with a shield icon).

### 3.2 Understanding Tax on Invoices
On the final invoice:
1.  Tax is summarized in the footer.
2.  Click the **"Tax Details"** link (if available) to see the audit trail ID.
3.  **Warning:** If a "Tax Calculation Error" banner appears, do not issue the invoice. Contact the Administrator immediately.

### 3.3 Generating Tax Reports
1.  Navigate to **Reports > Financial > Tax Liability**.
2.  Select the **Date Range** and **Jurisdiction**.
3.  Choose the Report Type:
    *   **Summary:** Total tax collected per region.
    *   **Detailed:** Transaction-level list.
    *   **SAF-T Export:** Download the XML file for government filing.
4.  Click **"Export"**.

---

## 4. Troubleshooting

| Issue | Probable Cause | Solution |
| :--- | :--- | :--- |
| **Tax Amount is 0.00** | No Nexus defined for the destination. | Check Nexus Settings in Admin Console. |
| **Wrong Tax Rate** | Incorrect Product Code or expired rule. | Verify Line Item details and Rule Effective Dates. |
| **Address Validation Error** | Incomplete address data. | Ensure Street, City, ZIP, and Country are correct. |
