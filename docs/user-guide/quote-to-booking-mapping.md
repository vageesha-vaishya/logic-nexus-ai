# Quote to Booking Mapping: User Guide

## Overview
The Quote-to-Booking Mapping System allows you to seamlessly convert approved quotations into active bookings with a single click. This guide covers the end-to-end workflow, validation rules, and troubleshooting steps.

## Workflow

### 1. Accessing the Mapper
1. Navigate to **Bookings** in the main dashboard.
2. Click **New Booking**.
3. Select **"Map from Quote"** or click the **"Open Quote Mapper"** button.

### 2. Selecting a Quote
The **Quote Selection Grid** displays all eligible quotes.
- **Filters**: Use the top bar to filter by Status (Approved/Accepted), Date Range, or Amount.
- **Search**: Enter a Quote Number or Customer Name to find specific records.
- **Selection**: Click the "Select" button on the desired quote to proceed to the preview.

### 3. Mapping Preview & Validation
The system automatically populates a booking draft based on the quote data.
- **Left Panel**: Source Quote Data (Read-only).
- **Right Panel**: Target Booking Data (Editable).
- **Validation**: The system runs real-time checks:
    - **Status Check**: Quote must be 'Approved' or 'Accepted'.
    - **Expiry Check**: Quote must be within its validity period.
    - **Credit Check**: Customer account must have sufficient credit (mock check).
    - **Data Integrity**: Required fields (Origin, Destination) must be present.

### 4. Confirming the Booking
1. Review any **Warnings** (yellow alerts) or **Errors** (red alerts).
2. Edit fields in the Right Panel if necessary (e.g., add a Vessel Name).
3. Click **"Create Booking"**.
4. You will be redirected to the new Booking Detail page.

## Troubleshooting

### Common Errors

| Error Message | Cause | Resolution |
|---------------|-------|------------|
| "Quote status is Draft" | You attempted to map a draft quote. | Approve the quote first in the Quotes module. |
| "Origin is missing" | The quote lacks a defined origin port. | Edit the quote to add an origin or manually enter it in the preview. |
| "Quote expired" | The `valid_until` date has passed. | Clone the quote and create a new version with a future expiry date. |

### Support
For system issues or bug reports, please contact the IT Support Desk with the **Correlation ID** found in the Audit Logs.
