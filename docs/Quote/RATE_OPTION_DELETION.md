# Rate Option Deletion Business Rules & Logic

This document outlines the business rules, constraints, and technical implementation details for deleting Rate Options within the Unified Quote Composer.

## 1. High-Level Overview

Rate Option deletion is a critical feature that allows users to remove unwanted or erroneous options from a quote. The process differs depending on whether the option has been persisted to the database (has a UUID) or is a temporary draft (optimistic UI).

## 2. Business Rules & Constraints

### 2.1. Minimum Option Requirement
- **Rule**: A quote version MUST have at least one option.
- **Enforcement**: The UI (`UnifiedQuoteComposer`) prevents deletion if only one option remains.
- **User Feedback**: A toast notification informs the user: "At least one option is required."

### 2.2. Deletion of Persisted Options (UUID)
- **Condition**: The option has been saved to the database (has a valid UUID).
- **Action**: A backend RPC call (`delete_quote_option_safe`) is triggered.
- **Constraints**:
  - **Booked Quotes**: Cannot delete an option if the quote is already associated with a Booking.
  - **Customer Selection**: Cannot delete an option if it has been explicitly selected by the customer.
  - **Permissions**: User must have write access to the quote (owner or tenant admin).

### 2.3. Deletion of Draft & AI/Market Options (Non-Persisted)
- **Condition**: The option is a temporary draft (optimistic UI) OR an AI/Market option fetched from external sources (not yet saved to DB).
- **Action**:
  - **Manual Drafts**: Removed from local `manualOptions` state.
  - **AI/Market Options**: Added to a `deletedOptionIds` exclusion list to filter them out of the view, as the source data (hook results) is read-only.
- **Persistence**: These deletions are temporary until the quote is saved. If the quote is saved, only the *remaining* options are persisted.
- **Reset**: The `deletedOptionIds` list is cleared automatically when a new rate search is initiated.

### 2.4. Selected Option Handling
- **Scenario**: The user deletes the currently *selected* option.
- **Behavior**:
  - **Frontend**: The UI automatically selects another available option to ensure a valid state.
  - **Backend**: The `delete_quote_option_safe` RPC handles re-selection logic if the deleted option was the active one. It selects the next best option based on:
    1.  Rank Score (descending)
    2.  Total Amount (ascending)

## 3. Technical Implementation

### 3.1. Frontend Service (`QuotationOptionCrudService`)
- **Method**: `deleteOption(optionId: string, reason?: string)`
- **Logic**:
  - Calls `delete_quote_option_safe` RPC.
  - Returns `{ reselectedOptionId }` if the backend performed a re-selection.
  - Throws errors for constraint violations (e.g., "Cannot delete options for a booked quote").

### 3.2. Backend RPC (`delete_quote_option_safe`)
- **File**: `supabase/migrations/20260227120000_delete_quote_option_safe.sql`
- **Steps**:
  1.  Validates user permissions and tenant access.
  2.  Checks for Booking and Customer Selection constraints.
  3.  Deletes related records in order:
      - `quote_charges`
      - `quotation_version_option_legs`
      - `quotation_version_options`
  4.  Logs the action to `quotation_audit_log`.
  5.  Performs re-selection if necessary and returns the new selected option ID.

### 3.3. UI Component (`UnifiedQuoteComposer`)
- **Handler**: `handleRemoveOption`
- **Logic**:
  - Checks if `displayResults.length <= 1`.
  - Determines if `optionId` is a persisted UUID.
  - **If UUID (Persisted)**: Calls `QuotationOptionCrudService.deleteOption`.
    - Updates local state on success.
    - Handles re-selection based on service response.
    - Shows error toast on failure.
  - **If Non-UUID (Draft/AI)**:
    - **Manual Drafts**: Removes from `manualOptions` state.
    - **AI/Market Options**: Adds ID to `deletedOptionIds` state to hide from view.
    - **Re-selection**: Automatically selects the first available remaining option if the deleted one was selected.
  - **State Management**: `combinedResults` memoizes the list by filtering out `deletedOptionIds`.

