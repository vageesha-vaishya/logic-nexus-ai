# Quotation Engine Technical Specification
## "Nexus Dynamic Quotation System (V2)"

**Version:** 2.1.0 (Audit Compliant)
**Date:** 2026-02-11
**Status:** Phase 3 In Progress
**Reference:** Supersedes v2.0.0

---

## 1. Executive Summary
The Quotation Engine V2 is a robust, secure, and scalable PDF generation system designed to replace the legacy "hard-coded" logic. It adopts a **JSON-Schema Driven** architecture, decoupling data retrieval, validation, and rendering. This ensures consistency, security, and ease of maintenance for enterprise-grade quotation documents.

## 2. Core Architecture

### 2.1 Design Principles
-   **Separation of Concerns**: Data fetching, context building, and rendering are distinct phases.
-   **Schema-First**: All templates and data inputs are validated against strict Zod schemas.
-   **Safety by Design**: A "Safe Context" layer sanitizes all data before it reaches the renderer, preventing data leaks.
-   **Internationalization (i18n)**: Native support for multi-language templates and locale-aware formatting.

### 2.2 System Components

#### A. Data Layer (Supabase Edge Function)
-   **Entry Point**: `generate-quote-pdf/index.ts`
-   **Responsibility**: Fetches raw data from the database (Quotes, Items, Charges, Customer).
-   **Data Mapping**: Maps DB records to a raw intermediate format, handling asset resolution (Base64 logos).

#### B. Safe Context Builder (`context.ts`)
-   **Input**: Raw, potentially unsafe data.
-   **Process**:
    -   Validates input against `RawQuoteDataSchema`.
    -   Sanitizes sensitive fields (strips internal IDs).
    -   Normalizes data (formatting dates, currency, numbers).
    -   Maps data to `SafeContext` interface.
-   **Output**: Read-only, type-safe JSON object for the renderer.

#### C. Template Engine (`schema.ts`, `default_template.ts`)
-   **Format**: JSON-based configuration.
-   **Validation**: Zod schema ensures templates adhere to the defined structure.
-   **Features**:
    -   Dynamic Tables (auto-pagination, column configuration).
    -   Static Blocks (headers, footers, terms).
    -   Conditional Rendering (via `show_if` logic - planned).

#### D. Rendering Engine (`renderer.ts`)
-   **Library**: `pdf-lib`
-   **Responsibility**: Draws the PDF based on the Template and Safe Context.
-   **Capabilities**:
    -   Dynamic pagination for long tables.
    -   MGL-specific layout support (headers, logos).
    -   Font embedding and text wrapping.
    -   **Asset Rendering**: Optimized Base64 logo embedding.
    -   **I18n**: Locale-aware Currency and date formatting.

#### E. Internationalization (`i18n.ts`)
-   **Function**: Translates static labels and template text.
-   **Fallback**: Defaults to `en-US` if translation is missing.
-   **Formatters**: `formatCurrency`, `formatDate`.

## 3. Data Flow

1.  **Request**: Client (UI) calls `generate-quote-pdf` with `quoteId` and `engine_v2: true`.
2.  **Fetch**: Function queries Supabase for Quote, Items, Charges, and Customer data.
3.  **Resolve Assets**: Base64 logos are resolved from `tenant_branding`.
4.  **Sanitize**: `buildSafeContext(rawData)` transforms DB data into `SafeContext`.
5.  **Load Template**: Fetches `templateId` or uses `DefaultTemplate`.
6.  **Render**: `PdfRenderer(template, context).render()` generates the PDF binary.
7.  **Response**: Returns PDF blob to client.

## 4. Security Model
-   **No Direct DB Access in Renderer**: Renderer only sees `SafeContext`.
-   **Input Validation**: Strict Zod schemas prevent injection attacks via malformed data.
-   **Access Control**: Function execution is protected by Supabase Auth (or Service Role for internal calls).

## 5. Implementation Status

### Phase 1: Core Implementation (Completed)
-   [x] JSON Schema & Zod Validation
-   [x] Safe Context Builder
-   [x] Basic PDF Rendering (pdf-lib)
-   [x] MGL Granular Template Support (MGL Header, Dynamic Tables, Freight Charges Matrix)
-   [x] E2E Testing Framework (`scripts/e2e_v2_engine_test.ts`)
-   [x] Frontend Integration (Preview Modal & Email Dialog)

### Phase 2: Advanced Features (Completed)
- [x] Template Versioning & Snapshotting (Schema & Logic Implemented)
- [x] Tenant Branding (Logo/Color injection - Schema & Engine Support)
- [x] Visual Template Editor (Frontend Components & Integration)
- [x] **I18n Engine**: Locale handling and Formatters.
- [x] **Asset Optimization**: Base64 logo support in Renderer.

### Phase 3: Performance & Scale (Completed)
- [x] Caching Layer for Templates (In-Memory implementation)
- [x] PDF Metadata (Standard PDF fields populated)
- [x] Storage Integration (Bucket 'quotations' & Logic)
- [x] Webhook Integration (Async Generation Logic Implemented)

## 6. Audit Compliance Verification (2026-02-11)
The following critical gaps identified in the `quotation_engine_audit_review.md` have been addressed:

1.  **Internationalization (Gap 2.1)**: 
    -   `I18nEngine` class implemented with dictionary support.
    -   `SafeContext` includes `meta.locale`.
    -   Renderer now uses `i18n.formatCurrency` for amounts and `i18n.formatDate` for dates (e.g., Expiry).

2.  **Security: Context Safety (Gap 2.2)**:
    -   `SafeContext` DTO pattern strictly enforced.
    -   Renderer is decoupled from raw DB types.

3.  **Scalability: Asset Management (Gap 2.4)**:
    -   Added support for Base64 logo embedding in `tenant_branding`.
    -   Renderer `renderLogo` method supports Base64 injection to avoid runtime HTTP fetches.

4.  **Compliance & Metadata (Gap 2.3)**:
    -   Standard PDF Metadata (Title, Author, Creator) is now populated.
    -   **Language Tagging**: PDF Metadata `Language` field is set to the quote's locale (e.g., `en-US`).

5.  **Error Handling & Resilience (Gap 3.2)**:
    -   **Section Isolation**: The renderer now wraps each section in a `try-catch` block.
    -   **Graceful Degradation**: If a section fails to render, an error placeholder is drawn instead of crashing the entire PDF generation process.

## 7. Phase 4: Enterprise Designer Suite (Planned)

### 7.1 Visual Template Designer
-   **Drag-and-Drop Interface**: Users can reorder sections visually.
-   **Real-time Preview**: HTML-based approximation of the final PDF, updated instantly as the JSON config changes.
-   **Validation Engine**: Real-time feedback on configuration errors (e.g., missing required fields, invalid logic).

### 7.2 Template Marketplace & Migration
-   **Marketplace**: A library of pre-built, industry-standard templates (e.g., "Freight Forwarding Standard", "Custom Brokerage", "Warehousing").
-   **Migration Utility**: Tools to convert legacy JSON formats or hardcoded logic representations into the V2 Schema.

### 7.3 Governance & Control
-   **RBAC**: Role-based permissions for creating, editing, and publishing templates.
-   **Version Control**: Full history tracking with rollback capabilities.
-   **Analytics**: Usage metrics (most used templates, average generation time).
