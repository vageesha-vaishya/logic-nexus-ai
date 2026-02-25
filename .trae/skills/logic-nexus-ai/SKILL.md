---
name: "logic-nexus-ai"
description: "Expert logistics platform architect. Invoke when working on Logic Nexus-AI features, database changes, or architectural decisions involving multi-tenancy, freight management, or CRM integration."
---

# Logic Nexus-AI Platform Architect

This skill provides enterprise-grade expertise for the Logic Nexus-AI SaaS platform, a multi-tenant logistics and CRM solution.

## Platform Architecture

### Multi-Tenancy Model
- **Structure**: Platform -> Tenant -> Franchise -> User
- **Isolation**: Row Level Security (RLS) via `tenant_id` and `franchise_id`
- **Data Access**: Use `ScopedDataAccess` wrapper for all database operations to ensure isolation
- **Authentication**: Supabase Auth with custom claims for roles and permissions

### Core Domains
1.  **Logistics Core**:
    -   **Shipments**: Multi-leg, multi-mode (Ocean, Air, Trucking, Rail)
    -   **Quotes**: Versioned quotations with multi-carrier options
    -   **Master Data**: Ports, Vessels, Containers, Commodities (HTS/AES)
2.  **CRM & Sales**:
    -   Leads, Accounts, Contacts, Opportunities
    -   Pipeline management with Kanban views
3.  **Finance**:
    -   Invoicing, Margins, Tax Jurisdictions, Currencies
    -   Charge management (Buying/Selling rates)

## Development Standards

### Database Access
**ALWAYS** use `ScopedDataAccess` instead of raw Supabase client:

```typescript
// ✅ CORRECT
const { scopedDb } = useCRM();
const { data } = await scopedDb.from('shipments').select('*');

// ❌ INCORRECT
const { data } = await supabase.from('shipments').select('*');
```

### Prompting Patterns for AI Assistance

When asking for code generation, specify the context:
- **"Logistics Context"**: Focus on shipment lifecycles, tracking, and carrier integrations.
- **"CRM Context"**: Focus on customer relationships, sales pipelines, and activity tracking.
- **"Platform Context"**: Focus on tenant management, security, and global settings.

### Token Optimization Strategy
- **Context Loading**: Only load relevant schema definitions. Use `SearchCodebase` with targeted directories.
- **Code Generation**: Request modular, functional components. Avoid monolithic files.
- **Error Handling**: Implement robust error boundaries and toast notifications (`sonner`).

## Reusable Contexts

### Freight Management
- **Entities**: Shipments, Bookings, Containers
- **Key Services**: `LogisticsRateMapper`, `ShipmentService`
- **Common Tasks**: Tracking updates, document generation (BOL, Packing List)

### Route Optimization & Multi-leg
- **Structure**: `TransportLeg` array within Quotes/Shipments
- **Logic**: Origin -> Port of Loading -> Port of Discharge -> Destination
- **Modes**: Pre-carriage, Main Carriage, On-carriage

## Security & Compliance
- **RLS Policies**: Ensure every table has `tenant_id` and RLS enabled.
- **Permissions**: Check `ROLE_PERMISSIONS` in `src/config/permissions.ts`.
- **Data Privacy**: PII protection for Contacts and Users.

## Testing Guidelines
- **Unit Tests**: Vitest for utility functions and hooks.
- **Integration Tests**: Test data flow between CRM and Logistics modules.
- **Mocking**: Mock Supabase calls and `ScopedDataAccess`.

## Monitoring & Analytics
- **Logging**: Use `logger.ts` for structured logging.
- **Performance**: Monitor `ScopedDataAccess` query times.
- **Business KPIs**: Track Quote-to-Shipment conversion, Margin/Profit per shipment.

# Adaptive Skill Management

This system allows the Logic Nexus-AI agent to autonomously detect, define, and integrate new capabilities based on user interactions.

## 1. Discovery & Analysis Protocol
**Trigger**: When a user request cannot be fulfilled by existing contexts or requires complex, novel logic.
**Action**:
1.  **Pattern Recognition**: Identify the missing capability (e.g., "Advanced Route Optimization", "Custom Report Generation").
2.  **Feasibility Study**: Analyze codebase to ensure underlying support exists.
3.  **Definition**: Draft the skill requirements (Inputs, Outputs, Constraints).

## 2. Integration Workflow
To register a new skill:
1.  **Backup**: Copy `CONTEXT_CONFIG.json` to `CONTEXT_CONFIG.json.bak`.
2.  **Update Configuration**: Add the new skill definition to `CONTEXT_CONFIG.json` under `emergent_skills`.
3.  **Documentation**: Append the skill details to this `SKILL.md` file.
4.  **Logging**: Record the event in `SKILL_LOG.md`.

## 3. Skill Definition Schema
New skills must follow this structure in `CONTEXT_CONFIG.json`:
```json
{
  "id": "skill_id",
  "name": "Skill Name",
  "description": "What it does",
  "trigger_patterns": ["keywords", "phrases"],
  "related_files": ["src/..."],
  "performance_metrics": { "success_rate": 0, "usage_count": 0 }
}
```

## 4. Optimization Hooks
- **Context-Aware Selection**: Prioritize skills where `trigger_patterns` match the user's prompt.
- **Dynamic Composition**: Combine multiple skills if the request spans domains (e.g., Logistics + Finance).

## 5. Security & Governance
- **No Hardcoded Secrets**: Never store API keys in skill definitions.
- **Validation**: Ensure new skills comply with `src/config/permissions.ts`.
- **Review**: New skills start in "beta" status.

## 6. Testing Framework
Before finalizing a skill:
1.  **Dry Run**: Execute the skill logic purely as a thought process.
2.  **Validation**: Verify the output against expected success criteria.
3.  **Adoption**: If successful, mark as "active".

# UI/UX Standardization Framework

This framework ensures consistency across the Logic Nexus-AI platform, aligning with enterprise-grade standards (referencing Odoo CRM/Logistics).

## Kanban Board & Card Standards

### 1. Card Specifications
- **Dimensions**: 
  - Width: Responsive (100% of column width).
  - Min-Height: 100px.
  - Padding: `p-3` (0.75rem) or `p-4` (1rem) for density control.
- **Visual Attributes**:
  - **Background**: White (`bg-card`) or subtle off-white in light mode; dark gray (`bg-card`) in dark mode.
  - **Border**: 1px solid `border-border`.
  - **Shadow**: `shadow-sm` by default, `shadow-md` on hover.
  - **Radius**: `rounded-lg` (0.5rem).
  - **Left Border Accent**: 4px colored border indicating Priority or Status (e.g., High = Amber, Critical = Red).

### 2. Information Hierarchy
Cards must follow this structure:
1.  **Header**: 
    -   **Title**: Primary identifier (e.g., Lead Name, Shipment ID). Font: `font-medium text-sm`. Truncate after 1 line.
    -   **Action**: "Three-dot" menu or "View" button (top-right, hidden until hover).
2.  **Body**:
    -   **Subtitle**: Secondary info (e.g., Company Name, Route). Font: `text-xs text-muted-foreground`.
    -   **Key Metrics**: Value (Currency), Weight, Volume. Displayed as a row of badges or text with icons.
3.  **Footer**:
    -   **Left**: Tags (Pills, max 3 visible).
    -   **Right**: Assignee Avatar (24x24px), Activity Status Indicator (Green/Yellow/Red dot).

### 3. Interactive States
- **Hover**: Scale up slightly (`scale-[1.02]`), increase shadow, show hidden actions.
- **Dragging**: Opacity 50%, dashed border, rotate slightly (2-3deg).
- **Selected**: Blue ring (`ring-2 ring-primary`).

### 4. Accessibility (WCAG 2.1)
- **Contrast**: Text must meet AA standards against card background.
- **Focus**: Visible focus ring for keyboard navigation.
- **Screen Readers**: Aria-labels for all interactive elements and drag handles.

### 5. Implementation Guidelines
- Use `KanbanCard` component as the base.
- Do NOT inline complex styles; use Tailwind utility classes defined in the theme.
- Ensure all text is localized via `t()`.
