# Quotation System Audit & Roadmap

**Date:** February 05, 2026
**Version:** 1.0
**Scope:** Quick Quote, Smart Quote, Detailed Quote (QuoteFormRefactored)

## 1. Executive Summary
This document outlines the findings from a functional audit of the SOS-Nexues Quotation System, detailing the resolution of "Split Brain" issues between quotation workflows and the restoration of the Quotation Composer visibility. It also establishes the roadmap for Enterprise-grade features (3D Load Planning, AI Rates).

## 2. Functional Audit Findings

### 2.1 "Split Brain" Architecture
**Issue:** The "Quick Quote" module and "Detailed Quote" module operated on disparate data models and input components.
- **Quick Quote:** Used ad-hoc state management for cargo, with separate fields for Ocean/Air/Rail.
- **Detailed Quote:** Used legacy `SmartCargoInput` for commodities but required manual entry for dimensions/weight.
- **Impact:** Data inconsistency when converting Quick Quotes to Detailed Quotes; poor user experience due to different input methods.

**Resolution:**
- **Unified Component:** Created `SharedCargoInput` as the single source of truth for cargo entry.
- **Integration:** 
    - Replaced legacy inputs in `QuickQuoteModal.tsx`.
    - Replaced `SmartCargoInput` in `QuoteLineItems.tsx` with `SharedCargoInput`.
- **Digital Twin Model:** Implemented `CargoItem` Zod schema (`src/types/cargo.ts`) enforcing strict typing for dimensions (L/W/H), volume, and weight.

### 2.2 Duplicate & Redundant Fields
**Issue:** 
- `QuoteLineItems` contained manual "HS Code" and "Description" fields that duplicated functionality available in the commodity search.
- `QuickQuoteModal` contained redundant mode-specific logic (e.g., manually toggling fields for Air vs Ocean) that `SharedCargoInput` now handles abstractly.

**Resolution:**
- **Auto-Population:** `SharedCargoInput` now auto-populates Description, HTS Code, and calculates Volume (m³) from dimensions automatically.
- **Code Reduction:** Removed redundant state logic in `QuickQuoteModal` and `QuoteLineItems`.

### 2.3 Quotation Composer Visibility
**Issue:** The "Switch to Composer" button in the Detailed Quote module was effectively invisible to users on smaller screens or specific viewports due to restrictive CSS classes (`hidden md:flex`).
**Resolution:** Removed the visibility restriction. The Composer is now accessible in all "Edit Quote" contexts.

## 3. Enterprise Roadmap Enhancements

### 3.1 3D Load Planning Readiness
**Status:** **Ready for Implementation**
- **Foundation:** The new `CargoItem` schema captures all necessary physical attributes:
    - `dimensions` (l, w, h, unit)
    - `weight` (value, unit)
    - `stackable` (boolean flag)
    - `type` (loose vs container vs unit)
- **Next Steps:** Integrate a 3D visualization library (e.g., `three.js` or `react-three-fiber`) consuming the `items` array from `QuoteLineItems`.

### 3.2 Predictive Rate AI
**Status:** **Data Structure Aligned**
- **Foundation:** Standardized `commodity_id` and `aes_hts_id` collection ensures that the Rate Engine receives precise classification data, enabling more accurate historical rate lookups and predictive pricing.

### 3.3 Automated Compliance
**Status:** **Integrated**
- **Foundation:** The `SharedCargoInput` links directly to the `global_hs_roots` and `aes_hts_codes` tables (via `SmartCargoInput`), ensuring every line item is validated against current export controls.

## 4. Technical Recommendations

1.  **Strict Mode Separation:** 
    - Ensure `QuoteCargoConfigurations` (Equipment) and `QuoteLineItems` (Goods) remain distinct concepts in the UI to prevent user confusion, while sharing the underlying `CargoItem` data structure where appropriate.
    
2.  **Performance:** 
    - The new `QuoteLineItemRow` component uses `useWatch` for granular re-renders. Continue this pattern for the `QuoteFinancials` section to improve "Time to Interactive" on large quotes.

3.  **Validation:**
    - Add strict cross-validation: If "Container" is selected in Line Items, warn if no corresponding Equipment is defined in Cargo Configurations.
