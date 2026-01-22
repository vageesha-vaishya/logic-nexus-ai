# Quotation Module Technical Documentation

## Executive Summary
This document details the technical implementation of the Quotation Module enhancements, specifically the "Hybrid Entry, Unified Pipeline" architecture. This implementation introduces a rapid "Quick Quote" workflow and a robust Kanban-based pipeline for managing quote lifecycles.

## Architecture: Hybrid Entry, Unified Pipeline

The module is designed around two core concepts:
1.  **Hybrid Entry:** Supporting both rapid estimation (Quick Quote) and detailed composition (Full Quote).
2.  **Unified Pipeline:** A single, visual source of truth for all quotes, managed via a Kanban board or List view, with WIP limits and bulk operations.

## Key Components

### 1. QuotesPipeline (`src/pages/dashboard/QuotesPipeline.tsx`)
The central orchestrator for the quotation lifecycle.
-   **Responsibilities:**
    -   Data fetching and state management (quotes, accounts, filters).
    -   **View Management:** Toggles between `QuotesKanbanBoard` (Board) and `QuotesList` (List).
    -   Grouping logic (Swimlanes by Account, Value, Margin) - *Board View only*.
    -   Bulk operation coordination (Delete, Status Change).
    -   WIP Limit enforcement logic.

### 2. QuotesKanbanBoard (`src/components/sales/kanban/QuotesKanbanBoard.tsx`)
A reusable Kanban board component built with `@dnd-kit/core`.
-   **Features:**
    -   **Drag and Drop:** Uses `PointerSensor` and `closestCorners` collision detection for smooth interactions.
    -   **Status Grouping:** Automatically groups quotes into columns based on `QuoteStatus`.
    -   **Portal-based Drag Overlay:** Ensures dragged items appear correctly above other elements (`createPortal`).
    -   **Bulk Mode Support:** Propagates selection state to columns and cards.

### 3. KanbanColumn (`src/components/sales/kanban/KanbanColumn.tsx`)
Represents a single stage in the pipeline (e.g., "Draft", "Sent").
-   **Features:**
    -   **WIP Limit Visualization:** Displays a progress bar indicating capacity usage. Shows warning colors when nearing or exceeding limits.
    -   **Droppable Area:** Acts as a drop target for `dnd-kit`.
    -   **Scrollable Content:** Handles vertical scrolling for columns with many quotes.

### 4. KanbanCard (`src/components/sales/kanban/KanbanCard.tsx`)
The visual representation of a quote.
-   **Features:**
    -   **Draggable:** Can be dragged between columns.
    -   **Stale Detection:** visually flags quotes that haven't been updated in 48 hours.
    -   **Bulk Selection:** Supports checkbox selection in bulk mode.
    -   **Rich Metadata:** Displays value, margin, account, and opportunity tags.

### 5. QuickQuoteModal (`src/components/sales/quick-quote/QuickQuoteModal.tsx`)
A modal for generating rapid estimates without creating a full database record immediately.
-   **Workflow:**
    -   Accepts Origin, Destination, Weight, Mode, Commodity.
    -   Simulates rate calculation (mock engine).
    -   Displays tiered options (Economy, Standard, Express).
    -   Converts selected option to a Draft Quote (mocked navigation).

## Data Flow

1.  **Fetching:** `QuotesPipeline` fetches quotes via `scopedDb` (Supabase).
2.  **Rendering:** Quotes are filtered and grouped into swimlanes.
3.  **Interaction:**
    -   **Status Change:** Dragging a card triggers `onDragEnd` in `QuotesKanbanBoard`, which calls `onStatusChange` in `QuotesPipeline`.
    -   **Update:** `QuotesPipeline` validates WIP limits, updates Supabase, and optimistically updates local state.
    -   **Bulk Actions:** Selection state is managed in `QuotesPipeline` and passed down. Actions (Delete, Update) are executed in batch via `scopedDb`.

## Technical Decisions

-   **@dnd-kit vs. react-beautiful-dnd:** Chosen `@dnd-kit` for its modularity, accessibility, and modern hook-based API.
-   **Centralized Types:** All quote-related types and status configurations are centralized in `src/pages/dashboard/quotes-data.ts` to ensure consistency.
-   **Swimlane Architecture:** The board supports horizontal swimlanes (e.g., grouping by Account) by instantiating multiple `QuotesKanbanBoard` instances (one per lane), providing isolation and clarity.

## Future Enhancements (Phase 2)
-   **Smart Quote (RAG):** Integration with vector database for historical pricing intelligence.
-   **Real-time Updates:** Supabase Realtime subscription for collaborative pipeline management.
-   **Advanced Analytics:** Pipeline velocity and conversion rate metrics.
