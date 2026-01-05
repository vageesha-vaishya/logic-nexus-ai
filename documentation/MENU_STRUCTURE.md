# Application Menu Structure

This document outlines the sidebar menu structure for the Logic Nexus AI application.

## Sales Module

The Sales module menu is ordered to follow the typical sales workflow:

1. **Home**: Overview homepage
2. **Leads**: Prospects to qualify
3. **Tasks/Activities**: Activity management
4. **Opportunities**: Deals and pipeline
5. **Accounts**: Organizations and customers
6. **Contacts**: People tied to accounts
7. **Quotes**: Sales quotes and proposals

### Additional Items
- Files
- Campaigns
- Dashboards
- Reports
- Chatter
- Groups
- Calendar
- More

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
The rendering logic is located in `src/components/layout/AppSidebar.tsx`.
