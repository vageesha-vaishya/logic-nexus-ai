# Lead Workspace Change Control Specification

## Document Control

| Field | Value |
| --- | --- |
| Document ID | LW-CRUD-SCROLL-RELOCATE-2026-03-16 |
| Version | 1.1.0 |
| Status | Ready for Review |
| Owner | CRM Engineering |
| Scope | Lead Page Main and Bottom sections |
| Related Feature Flags | `lead_workspace_enhancements_v1`, `lead_workspace_scrolling_v1` |

## Version History

| Version | Date | Author | Change |
| --- | --- | --- | --- |
| 1.0.0 | 2026-03-16 | CRM Engineering | Initial consolidated specification for CRUD placement, scrolling, tab structure, and narrative field relocation |
| 1.1.0 | 2026-03-16 | CRM Engineering | Added persisted scroll position control, clarified Description/Notes tab mapping, and added scale test coverage for 1000-record datasets |

## Approval Workflow

| Stage | Role | Responsibility | Exit Criteria |
| --- | --- | --- | --- |
| 1. Technical Review | Frontend Lead | Validate component architecture and accessibility | No blocking code quality issues |
| 2. Data Integrity Review | Backend Lead | Validate lead/account/contact mapping and persistence | Mapping integrity confirmed |
| 3. UX Review | Product Designer | Validate CRUD discoverability and responsive behavior | Interaction and hierarchy approved |
| 4. QA Signoff | QA Lead | Validate regression suite and edge cases | Tests pass and acceptance criteria met |

## Request-to-Change Matrix

| Request | Required Modification | Technical Specification | Expected Behavior |
| --- | --- | --- | --- |
| 1. CRUD research and design | Place CRUD controls in persistent top action row in Account and Contacts tabs | Sticky control row, search-first layout, primary/secondary/destructive action tiers, responsive wrapping, accessible button targets | Users always see create/update/delete while scrolling records |
| 2. Dynamic vertical scrolling | Enable independent section scrolling with fixed headers | `overflow-y-auto`, `overscroll-contain`, `scroll-smooth`, sticky section headers, keyboard scrolling handlers | Main and Bottom content remains fully reachable without losing context |
| 3. Simplify Main section layout | Remove complex layout messaging and keep essential fields only | Main form keeps required schema fields, section description normalized, narrative fields hidden in Main when enhancements are enabled | Main section remains concise while preserving required data capture |
| 4. Relocate Description/Notes | Move narrative fields into Bottom internal notes tab | Rich text editors for description and notes render under Internal Notes and Extra Info tab with validation and autosave integration | Description and notes persist and autosave from Bottom section |
| 5. Account/Contact tab sequence and CRUD | Account first, Contacts second, then existing tabs; full CRUD + search/filter | Tab order and content panels with create/update/delete handlers, validation, relation sync (`account_id`, `contact_id`), empty and loading states | Lead relations update correctly after account/contact operations |
| 6. Read mode visual state | Add explicit CRUD mode badge in selected record details header | Badge state machine (`create`, `read`, `update`) with `aria-live`, semantic label, theme-consistent variants | Users see current CRUD mode immediately and consistently |

## Affected Components and Hierarchy

### Primary Component

1. `LeadWorkspaceSections`
2. Main section container (`Card > CardHeader > CardContent`)
3. Bottom section tabs (`Tabs > TabsList > TabsContent`)
4. Account and Contacts tab panels (search/actions/list/detail)
5. Internal Notes and Extra Info tab panel (description and notes editors)

### File and Module Impact

| File | Module | Impact Type |
| --- | --- | --- |
| `src/components/crm/LeadWorkspaceSections.tsx` | CRM Lead Workspace | CRUD controls, scrolling behavior, tab sequence, narrative relocation, CRUD mode badge |
| `src/components/crm/LeadWorkspaceSections.test.tsx` | CRM Lead Workspace tests | CRUD badge state tests, search/filter regression tests, legacy fallback expectation updates |
| `supabase/migrations/reversible/20260316113000_lead_schema_canonical_alignment.down.sql` | DB rollback migration | Rollback reference for lead schema and relation compatibility |

## Technical Delta Specification

### 1) CRUD Action Bar Placement and Styling

- Account and Contacts tabs use sticky top control bars with:
  - Search input aligned before action buttons
  - Action grouping: Create (primary), Update (outline), Delete (destructive)
  - Consistent sizing: `h-9`, minimum width `88px`, responsive wrapping
- Action bars remain visible as list/detail panes scroll

### 2) Dynamic Scrolling and Sticky Headers

- Main, Bottom, and Communication sections use independent scroll containers
- Sticky headers preserve section context during vertical movement
- Keyboard handling supports Arrow, PageUp/PageDown, Home/End smooth scrolling
- Mobile behavior keeps touch-friendly pan support

### 3) Main Section Simplification and Removed Elements

- Removed from Main section behavior:
  - Narrative data-entry controls for Description
  - Narrative data-entry controls for Notes
  - Legacy complex-layout description label
- Retained in data model:
  - All required lead profile and qualification fields
  - Description/Notes persistence through Bottom section and submission merge

### 4) Account/Contact Tabs Functional Scope

- Account tab:
  - List, search filter, create/update/delete actions
  - Validation for required name, website format, phone format
  - Relation synchronization to active lead
- Contacts tab:
  - List, search filter, create/update/delete actions
  - Validation for required first/last name, email, phone
  - Relation synchronization to active lead and optional account

### 5) Read Mode Badge State Model

- CRUD state derivation:
  - `create`: no selected record
  - `read`: selected record and no unsaved field deltas
  - `update`: selected record with in-form field deltas
- Badge requirements:
  - Semantic role: `status`
  - Live updates: `aria-live="polite"`
  - Explicit labels: `Account read mode`, `Contact update mode`
  - Variant mapping: create=default, read=secondary, update=warning

## Visual Checklist

- [x] Account tab is first in Bottom section
- [x] Contacts tab is second in Bottom section
- [x] CRUD control rows remain sticky during scroll
- [x] Search/filter works for Account and Contact lists
- [x] Main section narrative controls are hidden
- [x] Description is rendered under Internal Notes and Extra Info tab
- [x] Notes is rendered under Extra Info tab
- [x] Read mode badge updates between create/read/update states
- [x] Keyboard scrolling works in focusable section containers
- [x] Empty and loading states are visible in account/contact list panels
- [x] Scroll positions persist per lead workspace during navigation/remount

## Diff View (Targeted)

### LeadWorkspaceSections.tsx

```diff
+ import { Badge } from '@/components/ui/badge';
+ type CrudMode = 'create' | 'read' | 'update';
+ const accountCrudMode = useMemo<CrudMode>(...)
+ const contactCrudMode = useMemo<CrudMode>(...)
- sectionDescription={enhancementsEnabled ? 'Lead profile details and qualification fields' : 'Complex entity form layout for lead profile and qualification'}
+ sectionDescription="Lead profile details and qualification fields"
+ <Badge role="status" aria-live="polite" aria-label="Account read mode">Read mode</Badge>
+ <Badge role="status" aria-live="polite" aria-label="Contact read mode">Read mode</Badge>
+ const scrollStorageKey = useMemo(() => `lead.workspace.scroll.${leadId || 'new'}`, [leadId])
+ const scheduleScrollPersist = useCallback((section, scrollTop) => ..., [flushScrollPositions])
+ <CardContent ref={mainSectionRef} onScroll={(event) => scheduleScrollPersist('main', event.currentTarget.scrollTop)} ... />
+ <CardContent ref={bottomSectionRef} onScroll={(event) => scheduleScrollPersist('bottom', event.currentTarget.scrollTop)} ... />
+ <CardContent ref={communicationSectionRef} onScroll={(event) => scheduleScrollPersist('communication', event.currentTarget.scrollTop)} ... />
- <div className="mb-2 text-sm font-medium">Notes</div>  // inside Internal Notes tab
+ <div className="mb-2 text-sm font-medium">Notes</div>  // moved to Extra Info tab
```

### LeadWorkspaceSections.test.tsx

```diff
+ it('updates CRUD state badges across account and contact read and update states', ...)
+ it('filters account and contact lists from search inputs', ...)
+ it('restores persisted scroll positions for all workspace sections', ...)
+ it('renders description in internal notes and notes in extra info tab', ...)
+ it('handles account and contact list rendering with 1000 records', ...)
- expect(screen.getByText('Complex entity form layout for lead profile and qualification')).toBeInTheDocument();
+ expect(screen.getByText('Lead profile details and qualification fields')).toBeInTheDocument();
```

## API and Schema Impact

| Area | Change Type | Notes |
| --- | --- | --- |
| Lead Workspace UI payload composition | Existing behavior retained | `description`, `notes`, and `custom_fields` mappings are preserved in submit/update flow |
| Accounts/Contacts retrieval | Existing API usage retained | No endpoint shape changes; existing scoped queries remain in place |
| Database schema | No changes | No table/column additions or removals |
| Migrations | Not required | No migration scripts required for this release |

## Validation and Change Tracking

| Validation Item | Command | Expected Result |
| --- | --- | --- |
| Component regression tests | `npm run test -- src/components/crm/LeadWorkspaceSections.test.tsx` | All tests pass |
| Lint | `npm run lint` | No errors |
| Type safety | `npm run typecheck` | No type errors |

## Rollback Notes

- UI rollback path:
  - Remove CRUD state badge blocks in account/contact detail panes
  - Revert section description assignment and tab-specific relocation wiring
- Data rollback path:
  - Preserve migration rollback script in `supabase/migrations/reversible/20260316113000_lead_schema_canonical_alignment.down.sql`
  - Keep `custom_fields.account_id` and `custom_fields.contact_id` mapping untouched during UI rollback
