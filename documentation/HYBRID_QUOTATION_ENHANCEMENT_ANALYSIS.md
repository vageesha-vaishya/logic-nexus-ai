# Hybrid Quotation Module Technical Specification & Analysis

**Date:** January 20, 2026
**Version:** 6.0
**Author:** Trae AI (Senior Systems Architect)
**Target System:** SOS Logistics Pro - Logic Nexus AI
**Status:** DRAFT - Pending Approval
**Related Specification:** [QUOTATION_MODULE_DESIGN_SPECIFICATION.md](./QUOTATION_MODULE_DESIGN_SPECIFICATION.md)

---

## Document Control

### Version History
| Version | Date | Author | Description of Changes |
|:---:|:---:|:---:|:---|
| 5.1 | 2026-01-20 | Trae AI | Initial analysis and landscape benchmarking. |
| 6.0 | 2026-01-20 | Trae AI | Comprehensive technical specification enhancement for Multi-Modal Hybrid Quotation support. |
| 6.1 | 2026-01-20 | Trae AI | Added Breakbulk & RORO specifications; Defined detailed charge types for all modes. |

### Approval Workflow
| Role | Name | Signature | Date |
|:---|:---|:---|:---|
| **Solution Architect** | *Pending* | | |
| **Product Owner** | *Pending* | | |
| **Lead Developer** | *Pending* | | |

---

## 1. Parameter Specifications

### 1.1 Mode-Specific Parameters
The system must support distinct parameter sets for each transportation mode, stored in a flexible JSONB structure within the `quotation_version_option_legs` table while exposing strongly-typed interfaces in the UI.

#### **Inland (Road/Feeder)**
*   **Distance Calculation:** Automated via Google Maps Distance Matrix API (Origin Lat/Long to Dest Lat/Long).
*   **Vehicle Type:** `Box Truck (16ft, 24ft, 26ft)`, `Flatbed`, `Refrigerated`, `Van`.
*   **Service Type:** `FTL` (Full Truckload), `LTL` (Less than Truckload), `Drayage` (Port-to-Door).
*   **Constraints:** `Max Weight`, `Max Axle Load`, `Bridge Height Clearance`.
*   **Charge Types:** `Freight Charge`, `Fuel Surcharge (FSC)`, `Tolls`, `Detention`, `Driver Assist`, `Lumper Fee`, `Stop-off Charge`.

#### **Trucking (Long-Haul)**
*   **Load Classification:** `General Cargo`, `Perishable`, `Hazardous (Class 1-9)`, `Oversized`.
*   **Hazmat Flags:** `UN Number`, `Packing Group (I, II, III)`, `Flash Point`, `Emergency Contact`.
*   **Equipment:** `Air Ride Suspension`, `Lift Gate`, `Pallet Jack`, `Lowboy` (for RORO connecting).
*   **Driver Requirements:** `Team Drivers` (Expedited), `TWIC Card` (Port Access).
*   **Charge Types:** `Linehaul Rate`, `Fuel Surcharge (FSC)`, `Accessorials` (Liftgate, Inside Delivery), `Layover`, `Redelivery Fee`.

#### **Courier (Parcel/Last Mile)**
*   **Package Tiers:** `Envelope`, `Pak`, `Small Box`, `Medium Box`, `Large Box`, `Tube`.
*   **Service Guarantees:** `Next Day 8:00 AM`, `Next Day 10:30 AM`, `2-Day`, `Ground`.
*   **Accessorials:** `Signature Required`, `Residential Delivery`, `Saturday Delivery`.
*   **Integration:** Carrier-specific service codes (e.g., FedEx `PRIORITY_OVERNIGHT`).
*   **Charge Types:** `Base Rate`, `Fuel Surcharge`, `Residential Surcharge`, `Delivery Area Surcharge (DAS)`, `Oversize/Overweight Fee`, `Declared Value Fee`.

#### **Rail (Intermodal)**
*   **Container Specs:** `20'`, `40'`, `40' HC`, `53' Domestic`.
*   **Transfer Points:** Ramp locations (Origin Ramp, Destination Ramp).
*   **Rail Carrier:** SCAC Code (e.g., `UP`, `BNSF`, `CSX`).
*   **Blocking & Bracing:** Certification requirements for load securement.
*   **Charge Types:** `Rail Freight`, `Fuel Surcharge`, `Chassis Split`, `Storage/Demurrage` (at Ramp), `Drayage` (Origin/Dest), `Flip Fee`.

#### **Air (Freight)**
*   **Regulatory:** `IATA` compliant documentation, `Known Shipper` verification.
*   **Volumetric Weight:** Formula `(L x W x H cm) / 6000` (or carrier specific factor like 5000).
*   **ULD Types:** `LD3`, `LD7`, `M1`, `PMC Pallet`.
*   **Service Level:** `NFO` (Next Flight Out), `Consolidated`, `Deferred`.
*   **Charge Types:** `Air Freight (per kg)`, `Fuel Surcharge (FSC)`, `Security Surcharge (SSC)`, `Screening Fee`, `Pickup/Delivery`, `Dangerous Goods Fee`, `AWB Fee`.

#### **Ocean (FCL/LCL)**
*   **Incoterms:** `EXW`, `FOB`, `CIF`, `DDP`, `DAP`.
*   **Container Types:** `Standard`, `High Cube`, `Open Top`, `Flat Rack`, `Reefer`.
*   **Container Sizes:** `20'`, `40'`, `45'`.
*   **LCL Parameters:** `CBM` (Cubic Meter), `Revenue Ton` (w/m).
*   **Port Charges:** `THC` (Terminal Handling), `Wharfage`, `Documentation Fee`.
*   **Charge Types:** `Ocean Freight`, `BAF` (Bunker Adjustment), `CAF` (Currency Adjustment), `LSS` (Low Sulphur), `ISPS` (Security), `Seal Fee`, `Chassis Usage`, `AMS/ISF`.

#### **Ocean (Breakbulk / Project Cargo)**
*   **Cargo Type:** `Out of Gauge (OOG)`, `Heavy Lift`, `Unboxed Machinery`, `Steel Coils`.
*   **Handling:** `Direct Delivery` (Shipside), `Storage`, `Crating/Lashing`.
*   **Equipment:** `Mafi Trailer`, `Floating Crane`, `Shore Crane`.
*   **Measurements:** `Revenue Ton` (Weight/Measure), `Long Length` surcharges.
*   **Charge Types:** `Freight (Lump Sum or w/m)`, `Heavy Lift Surcharge`, `Long Length Surcharge`, `Stevedoring`, `Lashing/Securing`, `Tally Fee`, `Wharfage` (Project Rate).

#### **Ocean (RORO - Roll-on/Roll-off)**
*   **Vehicle Type:** `Passenger Car`, `SUV`, `Truck`, `High & Heavy` (Construction/Agri), `Static Cargo` (on Mafi).
*   **Dimensions:** `Length`, `Width`, `Height`, `Weight` (Crucial for deck placement).
*   **Condition:** `Run & Drive`, `Towable`, `Forkliftable`.
*   **Charge Types:** `Ocean Freight (per unit or CBM)`, `BAF`, `LSS`, `Terminal Handling (THC)`, `Port Dues`, `Bill of Lading Fee`, `Forwarding Agent Commission (FAC)`.

### 1.2 Common Parameters
*   **Currency:** ISO 4217 Code (USD, EUR, CNY) with exchange rate at quote time.
*   **Validity:** `Valid From`, `Valid Until` (Default: 30 days, Mode-dependent override).
*   **Payment Terms:** `Prepaid`, `Collect`, `Net 30`, `Net 60`.
*   **References:** `Customer Reference`, `Project Code`.

### 1.3 Weight & Dimension Logic
*   **Dimensional Weight (Dim Weight):** System auto-calculates `Max(Actual Weight, (Volume / DimFactor))`.
    *   *Air Factor:* 167 kg/cbm (standard) or 1:6000.
    *   *Courier Factor:* 139 (Imperial) or 5000 (Metric).
    *   *Trucking Factor:* Density-based freight class (NMFC).

### 1.4 Special Handling & Compliance
*   **Temperature Control:** `Set Point` (°C/°F), `Range` (+/-), `Active/Passive`.
*   **Fragile/High Value:** Insurance value declaration, shockwatch requirement.
*   **Customs:** `HS Codes`, `Country of Origin`, `Commercial Invoice` requirement.

---

## 2. System Integration Requirements

### 2.1 Quotation Composer Enhancements
*   **Unified Multi-Modal Interface:**
    *   Single-page application (SPA) view allowing linear addition of "Legs".
    *   Drag-and-drop reordering of legs (e.g., Truck -> Air -> Truck).
    *   **Dynamic Form Loading:** Selecting "Air" for Leg 2 instantly loads IATA/ULD fields; Selecting "Ocean" loads Container/Port fields.
*   **Visual Route Map:**
    *   Integration with Mapbox/Google Maps to visualize the multi-leg journey.

### 2.2 Existing Module Improvements
*   **Quick Quotation:**
    *   Allow "Template" selection for common hybrid routes (e.g., "China to US Door-to-Door" pre-fills Ocean + Truck legs).
*   **Smart Quote (AI):**
    *   **Recommendation Engine:** Suggests optimal mode based on `Urgency` vs. `Budget`.
    *   *Example:* User inputs "Need in 5 days". AI suggests "Air Freight". User inputs "Budget $1000". AI suggests "Ocean LCL".

### 2.3 Pricing Engine & Data Mapping
*   **Consolidated Pricing API:**
    *   Endpoint: `POST /api/v1/pricing/calculate`
    *   Input: `Array<Leg>`, `CargoDetails`.
    *   Output: `TotalCost`, `Breakdown` (per leg), `TransitTime`.
*   **Adapters:**
    *   `OceanAdapter`: Connects to CargoWise/Maersk API.
    *   `AirAdapter`: Connects to OAG/WebCargo.
    *   `RoadAdapter`: Internal rate sheets + DAT/Truckstop integration.

---

## 3. Business Logic Specifications

### 3.1 Routing Algorithms
*   **Intermodal Optimization:**
    *   Identify valid transfer points (e.g., Seaports, Airports, Rail Ramps).
    *   Validate connections (e.g., Cannot route "Ocean" directly to "Inland" without a "Port" node).
*   **Multi-Leg Calculation:**
    *   `Total Transit Time = Sum(Leg Transit) + Sum(Transfer/Dwell Time)`.
    *   `Transfer Time` defaults: Port (3 days), Airport (1 day), Rail Ramp (2 days).

### 3.2 Cost Calculations
*   **Formula:**
    ```
    Final Price = Σ (Base Cost_leg + Surcharges_leg) * (1 + Margin_leg) + TopUp_global
    ```
*   **Top-Up Methodologies:**
    *   *Fixed Fee:* Flat $ amount added to total.
    *   *Percentage:* % markup on specific cost components (e.g., Freight only, not Duties).
    *   *Tiered:* different margins for Buy < $1000 vs Buy > $5000.

### 3.3 Service Combination Rules
*   **Validation Matrix:**
    *   `Ocean` -> `Truck`: **Valid**.
    *   `Air` -> `Ocean`: **Invalid** (Uncommon, requires warning).
    *   `Truck` -> `Truck`: **Valid** (Cross-dock).
    *   `Ocean (RORO)` -> `Truck`: **Restricted** (Requires `Car Hauler` or `Lowboy`).
    *   `Ocean (Breakbulk)` -> `Rail`: **Restricted** (Requires `Heavy Duty` or `Depressed Center` flatcar).
*   **Sequencing:** Ensure geographical continuity (Destination of Leg A = Origin of Leg B).

### 3.4 Fallback & Priority
*   **Capacity Checks:** If Primary Carrier (e.g., Maersk) returns "No Capacity", system auto-selects Secondary (e.g., MSC).
*   **Optimization Goals:**
    *   *Cheapest:* Sort options by `Total Cost`.
    *   *Fastest:* Sort options by `Total Transit Time`.
    *   *Greenest:* Sort by `CO2 Emissions` (calculated via distance/mode).

---

## 4. UI/UX Enhancements

### 4.1 Mode Selection Workflow
*   **Guided Wizard:**
    1.  **Step 1:** Cargo Details (What are we moving?).
    2.  **Step 2:** Origin/Destination (Where?).
    3.  **Step 3:** Mode Selection (How?). Display "Recommended Routes" cards.
    4.  **Step 4:** Review & Refine.

### 4.2 Comparative Presentation
*   **Side-by-Side View:**
    *   Column A: **Economy** (Ocean + Rail). $2,500 / 35 Days.
    *   Column B: **Standard** (Ocean + Truck). $3,200 / 25 Days.
    *   Column C: **Express** (Air + Truck). $8,500 / 5 Days.
*   **Visualizations:** Stacked Bar Chart showing Cost Components (Freight, Fuel, Duties, Margin).

### 4.3 Input Validation & Help
*   **Context-Sensitive Help:** Hovering over "Incoterms" shows a tooltip explaining liabilities (e.g., "FOB: Buyer pays freight").
*   **Real-Time Validation:**
    *   If `Weight > 45,000 lbs` for a 20' container -> Error: "Overweight".
    *   If `Height > 100 inches` for Air Cargo -> Warning: "Requires Freighter Aircraft".

---

## 5. Technical Implementation

### 5.1 Database Changes
We will extend the existing `quotation_version_option_legs` and related tables rather than creating deprecated `quote_legs`.

**New/Extended Tables:**

1.  **`quotation_version_option_legs` (Extension):**
    *   `mode_params`: `JSONB` - Stores mode-specific fields (e.g., `{"flight_number": "CX888", "imo_class": "3"}`).
    *   `transfer_location_id`: `UUID` - FK to `ports_locations`.
    *   `service_level_code`: `TEXT` - Normalized service code.

2.  **`hybrid_quote_routes` (New):**
    *   *Purpose:* Store reusable templates for hybrid routes.
    *   Columns: `id`, `name`, `legs_config` (JSON), `tenant_id`.

3.  **`regulatory_requirements` (New):**
    *   *Purpose:* Store rules for compliance checks.
    *   Columns: `mode`, `country_code`, `required_documents` (Array).

### 5.2 API Specifications

**1. Calculate Hybrid Quote**
*   `POST /api/v1/quotes/hybrid/calculate`
*   **Request:**
    ```json
    {
      "cargo": { "weight": 500, "volume": 2.5, "units": "metric" },
      "route": [
        { "mode": "truck", "from": "USNYC", "to": "USJFK" },
        { "mode": "air", "from": "USJFK", "to": "GBLHR" },
        { "mode": "truck", "from": "GBLHR", "to": "GBLON" }
      ]
    }
    ```
*   **Response:** Calculated costs, valid carriers, and transit times.

**2. Mode Recommendations**
*   `POST /api/v1/quotes/recommendations`
*   **Request:** Origin, Dest, Urgency.
*   **Response:** Ranked list of Mode Combinations.

### 5.3 Performance & Security
*   **Caching:** Redis cache for `DistanceMatrix` results and `CarrierRates` (TTL: 1 hour).
*   **Encryption:** `mode_params` containing PII or sensitive values (like declared value) encrypted at rest.
*   **RBAC:** Only `FreightManagers` can override calculated margins.

### 5.4 Audit Logging
*   Log every modification to `quotation_version_option_legs`.
*   Capture "Snapshot" of external rate API responses to justify costs.

---

## 6. Testing Requirements

### 6.1 Test Scenarios
*   **Permutations:**
    *   Ocean (FCL) + Truck.
    *   Ocean (LCL) + Rail + Truck.
    *   Air + Courier (Last Mile).
    *   Ocean (Breakbulk) + Truck (Lowboy) for "Oversized Machinery".
    *   Ocean (RORO) for "High & Heavy" Construction Equipment.
*   **Negative Testing:**
    *   Attempt to route "Ocean" between two landlocked cities (should fail or require pre-carriage).
    *   Attempt to ship Hazmat via Air without declaration (should block).
    *   Attempt to route "RORO" to a container-only terminal (should flag invalid transfer point).

### 6.2 Performance Testing
*   **Load Test:** Simulate 1,000 concurrent quote calculations. Target: < 500ms response time.
*   **Stress Test:** Calculate a 10-leg complex route. Ensure no memory leaks or timeouts.

### 6.3 Recovery & Consistency
*   **Transaction Safety:** Use Database Transactions (`BEGIN...COMMIT`) when saving a multi-leg quote. If Leg 3 fails to save, Leg 1 & 2 must roll back.
*   **Rate Expiry:** Automated job to flag quotes with expired carrier rates.

---

## 7. Implementation Roadmap & Risks

### 7.1 Timeline
*   **Phase 1: Core Schema & UI (Weeks 1-4)**
    *   DB Migrations (`quotation_version_option_legs`).
    *   UI "Wizard" for multi-mode selection.
*   **Phase 2: Pricing Engine & Integration (Weeks 5-8)**
    *   Connect 3rd party Rate APIs.
    *   Implement "Cost + Margin" logic.
*   **Phase 3: Hybrid Logic & AI (Weeks 9-12)**
    *   Intermodal optimization algorithms.
    *   Route recommendations.

### 7.2 Risk Assessment
| Risk | Impact | Mitigation |
|:---|:---|:---|
| **Data Quality:** Carrier APIs return incomplete data. | High | Implement "Fallback Rates" (manual rate sheets). |
| **Complexity:** UI becomes too cluttered for simple quotes. | Medium | "Simple Mode" toggle for single-leg quotes. |
| **Latency:** Multi-leg calculations take too long. | Medium | Parallelize API calls to carriers; Cache results. |

### 7.3 Rollback Procedures
*   **Database:** Down-migrations prepared for every schema change.
*   **Code:** Feature flags (`ENABLE_HYBRID_QUOTES`) to disable UI access instantly if issues arise.

---

## Appendix A: Landscape Analysis (Reference)

### Comparative Benchmarking
| Feature Domain | Logic Nexus AI (Target) | Salesforce Revenue Cloud | CargoWise One |
| :--- | :--- | :--- | :--- |
| **Visual Workflow** | **Kanban (Drag-and-Drop)** | Kanban (Opportunity Board) | Legacy Lists |
| **Hybrid Routing** | **Native Multi-Modal Support** | Custom Implementation | Native (Strong) |
| **AI Pricing** | **RAG-based Recommendation** | Einstein GPT | Limited |
