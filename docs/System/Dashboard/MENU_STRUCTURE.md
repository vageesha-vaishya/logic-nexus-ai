# Application Menu Structure

This document outlines the sidebar menu structure for the Logic Nexus AI application.

## CRM Section

The CRM section is a collapsible accordion group in the side navigation:

1. **Leads**: Prospects to qualify
2. **Tasks/Activities**: Activity management
3. **Opportunities**: Deals and pipeline
4. **Accounts**: Organizations and customers
5. **Contacts**: People tied to accounts

## Sales Section

The Sales section is a separate collapsible accordion group:

1. **Quotes**: Sales quotes and proposals
2. **Quote Templates**: Manage quote templates
3. **Home**: Overview homepage
4. **Files**: Documents and attachments
5. **Campaigns**: Marketing campaigns
6. **Migration Baseline**: Compatibility KPIs
7. **CRM Workspace**: Integrated CRM workspace
8. **Chatter**: Collaboration feed
9. **Groups**: Team groups
10. **Calendar**: Events and schedules
11. **More**: Additional tools

### Behavior
- CRM and Sales are keyboard-accessible accordion groups.
- Toggle state is persisted in browser local storage.
- Deep links keep active menu highlighting when a section is reopened.

## Logistics Module

1. Shipments
2. Warehouses
3. Vehicles
4. Carriers
5. Consignees
6. Ports & Locations
7. Package Categories
8. Package Sizes
9. Cargo Types
10. Cargo Details
11. Incoterms
12. Service Types (Admin)
13. Service Type Mappings (Admin)
14. Services (Admin)

## Billing Module

1. My Subscription
2. Tenant Plans

## Administration

1. Lead Assignment
2. Lead Routing
3. Tenants
4. Franchises
5. Users
6. Settings

## Configuration

The menu configuration is defined in `src/config/navigation.ts`.
The rendering logic is located in `src/components/navigation/CommandCenterNav.tsx`.
