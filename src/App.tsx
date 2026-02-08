import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { logger } from "@/lib/logger";
import { initializePlugins } from "./plugins/init";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { CRMProvider } from "./hooks/useCRM";
import { DomainContextProvider } from "./contexts/DomainContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { LeadsViewStateProvider } from "./hooks/useLeadsViewState";
import { ThemeProvider } from "./hooks/useTheme";

// Eager: shell pages (needed immediately)
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import SetupAdmin from "./pages/SetupAdmin";
import Unauthorized from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";

// Lazy: all dashboard pages (loaded on navigation)
const Dashboards = lazy(() => import("./pages/dashboard/Dashboards"));
const Accounts = lazy(() => import("./pages/dashboard/Accounts"));
const AccountsImportExport = lazy(() => import("./pages/dashboard/AccountsImportExport"));
const AccountNew = lazy(() => import("./pages/dashboard/AccountNew"));
const AccountDetail = lazy(() => import("./pages/dashboard/AccountDetail"));
const AccountsPipeline = lazy(() => import("./pages/dashboard/AccountsPipeline"));
const Contacts = lazy(() => import("./pages/dashboard/Contacts"));
const ContactsImportExport = lazy(() => import("./pages/dashboard/ContactsImportExport"));
const ContactNew = lazy(() => import("./pages/dashboard/ContactNew"));
const ContactDetail = lazy(() => import("./pages/dashboard/ContactDetail"));
const ContactsPipeline = lazy(() => import("./pages/dashboard/ContactsPipeline"));
const Leads = lazy(() => import("./pages/dashboard/Leads"));
const LeadNew = lazy(() => import("./pages/dashboard/LeadNew"));
const LeadDetail = lazy(() => import("./pages/dashboard/LeadDetail"));
const LeadsImportExport = lazy(() => import("./pages/dashboard/LeadsImportExport"));
const LeadsPipeline = lazy(() => import("./pages/dashboard/LeadsPipeline"));
const Activities = lazy(() => import("./pages/dashboard/Activities"));
const ActivityNew = lazy(() => import("./pages/dashboard/ActivityNew"));
const ActivityDetail = lazy(() => import("./pages/dashboard/ActivityDetail"));
const Settings = lazy(() => import("./pages/dashboard/Settings"));
const SecurityOverview = lazy(() => import("./pages/dashboard/SecurityOverview"));
const Tenants = lazy(() => import("./pages/dashboard/Tenants"));
const TenantNew = lazy(() => import("./pages/dashboard/TenantNew"));
const TenantDetail = lazy(() => import("./pages/dashboard/TenantDetail"));
const Franchises = lazy(() => import("./pages/dashboard/Franchises"));
const FranchiseNew = lazy(() => import("./pages/dashboard/FranchiseNew"));
const FranchiseDetail = lazy(() => import("./pages/dashboard/FranchiseDetail"));
const Users = lazy(() => import("./pages/dashboard/Users"));
const UserNew = lazy(() => import("./pages/dashboard/UserNew"));
const UserDetail = lazy(() => import("./pages/dashboard/UserDetail"));
const Opportunities = lazy(() => import("./pages/dashboard/Opportunities"));
const OpportunityNew = lazy(() => import("./pages/dashboard/OpportunityNew"));
const OpportunityDetail = lazy(() => import("./pages/dashboard/OpportunityDetail"));
const OpportunitiesPipeline = lazy(() => import("./pages/dashboard/OpportunitiesPipeline"));
const LeadRouting = lazy(() => import("./pages/dashboard/LeadRouting"));
const QueueManagement = lazy(() => import("./pages/dashboard/QueueManagement"));
const LeadAssignment = lazy(() => import("./pages/dashboard/LeadAssignment"));
const EmailManagement = lazy(() => import("./pages/dashboard/EmailManagement"));
const ThemeManagement = lazy(() => import("./pages/dashboard/ThemeManagement"));
const Files = lazy(() => import("./pages/dashboard/Files"));
const Campaigns = lazy(() => import("./pages/dashboard/Campaigns"));
const Reports = lazy(() => import("./pages/dashboard/Reports"));
const Chatter = lazy(() => import("./pages/dashboard/Chatter"));
const Groups = lazy(() => import("./pages/dashboard/Groups"));
const Calendar = lazy(() => import("./pages/dashboard/Calendar"));
const CRMWorkspace = lazy(() => import("./pages/dashboard/CRMWorkspace"));
const More = lazy(() => import("./pages/dashboard/More"));
const PermissionsMatrix = lazy(() => import("./pages/dashboard/PermissionsMatrix"));
const AuditLogs = lazy(() => import("./pages/dashboard/AuditLogs"));
const CustomRoles = lazy(() => import("./pages/dashboard/CustomRoles"));
const Bookings = lazy(() => import("./pages/dashboard/Bookings"));
const BookingNew = lazy(() => import("./pages/dashboard/BookingNew"));
const QuoteBookingMapper = lazy(() => import("./pages/dashboard/QuoteBookingMapper"));
const BookingDetail = lazy(() => import("./pages/dashboard/BookingDetail"));
const BookingEdit = lazy(() => import("./pages/dashboard/BookingEdit"));
const Shipments = lazy(() => import("./pages/dashboard/Shipments"));
const ShipmentNew = lazy(() => import("./pages/dashboard/ShipmentNew"));
const ShipmentDetail = lazy(() => import("./pages/dashboard/ShipmentDetail"));
const ShipmentDocumentViewer = lazy(() => import("./pages/dashboard/ShipmentDocumentViewer"));
const ShipmentsPipeline = lazy(() => import("./pages/dashboard/ShipmentsPipeline"));
const Warehouses = lazy(() => import("./pages/dashboard/Warehouses"));
const WarehouseNew = lazy(() => import("./pages/dashboard/WarehouseNew"));
const Vehicles = lazy(() => import("./pages/dashboard/Vehicles"));
const VehicleNew = lazy(() => import("./pages/dashboard/VehicleNew"));
const SubscriptionManagement = lazy(() => import("./pages/dashboard/SubscriptionManagement"));
const TenantSubscription = lazy(() => import("./pages/dashboard/TenantSubscription"));
const Quotes = lazy(() => import("./pages/dashboard/Quotes"));
const QuoteTemplates = lazy(() => import("./pages/dashboard/QuoteTemplates"));
const QuoteNew = lazy(() => import("./pages/dashboard/QuoteNew"));
const QuoteDetail = lazy(() => import("./pages/dashboard/QuoteDetail"));
const QuotesPipeline = lazy(() => import("./pages/dashboard/QuotesPipeline"));
const MultiModalQuote = lazy(() => import("./pages/dashboard/MultiModalQuote"));
const Carriers = lazy(() => import("./pages/dashboard/Carriers"));
const Vendors = lazy(() => import("./pages/dashboard/Vendors"));
const VendorDetail = lazy(() => import("./pages/dashboard/vendors/VendorDetail"));
const Consignees = lazy(() => import("./pages/dashboard/Consignees"));
const PortsLocations = lazy(() => import("./pages/dashboard/PortsLocations"));
const PackageCategories = lazy(() => import("./pages/dashboard/PackageCategories"));
const PackageSizes = lazy(() => import("./pages/dashboard/PackageSizes"));
const CargoTypes = lazy(() => import("./pages/dashboard/CargoTypes"));
const CargoDetails = lazy(() => import("./pages/dashboard/CargoDetails"));
const LogisticsManager = lazy(() => import("./pages/LogisticsManager"));
const Incoterms = lazy(() => import("./pages/dashboard/Incoterms"));
const UIDemoForms = lazy(() => import("./pages/dashboard/UIDemoForms"));
const UIDemoAdvanced = lazy(() => import("./pages/dashboard/UIDemoAdvanced"));
const QuoteNumberSettings = lazy(() => import("./pages/dashboard/QuoteNumberSettings"));
const DataManagement = lazy(() => import("./pages/dashboard/DataManagement"));
const ServiceTypeMappings = lazy(() => import("./pages/dashboard/ServiceTypeMappings"));
const ServiceTypes = lazy(() => import("./pages/dashboard/ServiceTypes"));
const RestrictedPartyScreening = lazy(() => import("./pages/dashboard/RestrictedPartyScreening"));
const TransportModes = lazy(() => import("./pages/dashboard/TransportModes"));
const Services = lazy(() => import("./pages/dashboard/Services"));
const Currencies = lazy(() => import("./pages/dashboard/Currencies"));
const ContainerTypes = lazy(() => import("./pages/dashboard/ContainerTypes"));
const ContainerSizes = lazy(() => import("./pages/dashboard/ContainerSizes"));
const ContainerAnalytics = lazy(() => import("./pages/dashboard/ContainerAnalytics"));
const ContainerTracking = lazy(() => import("./pages/dashboard/ContainerTracking"));
const PlatformDomains = lazy(() => import("./pages/dashboard/PlatformDomains"));
const PlatformDomainDetail = lazy(() => import("./pages/dashboard/PlatformDomainDetail"));
const Invoices = lazy(() => import("./pages/dashboard/finance/Invoices"));
const MarginRules = lazy(() => import("./pages/dashboard/finance/MarginRules"));
const InvoiceDetail = lazy(() => import("./pages/dashboard/finance/InvoiceDetail"));
const TaxJurisdictions = lazy(() => import("./pages/dashboard/finance/TaxJurisdictions"));
const TaxJurisdictionDetail = lazy(() => import("./pages/dashboard/finance/TaxJurisdictionDetail"));
const RateManagement = lazy(() => import("./pages/dashboard/RateManagement"));
const VesselTypes = lazy(() => import("./pages/dashboard/VesselTypes"));
const VesselClasses = lazy(() => import("./pages/dashboard/VesselClasses"));
const Vessels = lazy(() => import("./pages/dashboard/Vessels"));
const ChargeSides = lazy(() => import("./pages/dashboard/ChargeSides"));
const ChargeCategories = lazy(() => import("./pages/dashboard/ChargeCategories"));
const ChargeBases = lazy(() => import("./pages/dashboard/ChargeBases"));
const MasterDataHTS = lazy(() => import("./pages/dashboard/MasterDataHTS"));
const MasterDataGeography = lazy(() => import("./pages/dashboard/MasterDataGeography"));
const CustomsClearancePipeline = lazy(() => import("./pages/dashboard/CustomsClearancePipeline"));
const DatabaseExport = lazy(() => import("./pages/dashboard/data-management/DatabaseExport"));
const MasterDataSubscriptionPlans = lazy(() => import("./pages/dashboard/MasterDataSubscriptionPlans"));
const QuotationTests = lazy(() => import("./pages/testing/QuotationTests"));
const QuotePortal = lazy(() => import("./pages/portal/QuotePortal"));
const SystemLogs = lazy(() => import("./pages/dashboard/SystemLogs"));
const RolesPermissions = lazy(() => import("./pages/dashboard/RolesPermissions"));
const TransferCenter = lazy(() => import("./pages/dashboard/TransferCenter"));
const DocumentManager = lazy(() => import("./pages/dashboard/DocumentManager"));
const LogTestPage = lazy(() => import("./pages/dashboard/LogTest"));
const DebugConsole = lazy(() => import("./pages/dashboard/DebugConsole"));
const Commodities = lazy(() => import("./pages/dashboard/Commodities"));

// Initialize plugins at startup
try {
  initializePlugins();
} catch (e) {
  logger.error("Failed to initialize plugins:", e);
}

const queryClient = new QueryClient();

try {
  logger.info('App initialization started', { component: 'App' });
} catch (e) {
  logger.error("Failed to log app initialization:", e);
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <CRMProvider>
          <DomainContextProvider>
            <ThemeProvider>
              <TooltipProvider>
                <LeadsViewStateProvider>
                <Toaster />
                <Sonner />
                <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
                <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/setup-admin" element={<SetupAdmin />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboards />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/accounts" 
              element={
                <ProtectedRoute requiredPermissions={["accounts.view"]}>
                  <Accounts />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/accounts/new" 
              element={
                <ProtectedRoute requiredPermissions={["accounts.create"]}>
                  <AccountNew />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/accounts/import-export" 
              element={
                <ProtectedRoute requiredPermissions={["accounts.create"]}>
                  <AccountsImportExport />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/accounts/:id" 
              element={
                <ProtectedRoute requiredPermissions={["accounts.view"]}>
                  <AccountDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/accounts/pipeline" 
              element={
                <ProtectedRoute requiredPermissions={["accounts.view"]}>
                  <AccountsPipeline />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/contacts" 
              element={
                <ProtectedRoute requiredPermissions={["contacts.view"]}>
                  <Contacts />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/contacts/new" 
              element={
                <ProtectedRoute requiredPermissions={["contacts.create"]}>
                  <ContactNew />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/contacts/import-export" 
              element={
                <ProtectedRoute requiredPermissions={["contacts.create"]}>
                  <ContactsImportExport />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/contacts/:id" 
              element={
                <ProtectedRoute requiredPermissions={["contacts.view"]}>
                  <ContactDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/contacts/pipeline" 
              element={
                <ProtectedRoute requiredPermissions={["contacts.view"]}>
                  <ContactsPipeline />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/leads" 
              element={
                <ProtectedRoute requiredPermissions={["leads.view"]}>
                  <LeadsViewStateProvider>
                    <Leads />
                  </LeadsViewStateProvider>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/leads/new" 
              element={
                <ProtectedRoute requiredPermissions={["leads.create"]}>
                  <LeadNew />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/leads/import-export" 
              element={
                <ProtectedRoute requiredPermissions={["leads.import_export"]}>
                  <LeadsImportExport />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/leads/pipeline" 
              element={
                <ProtectedRoute requiredPermissions={["leads.view"]}>
                  <LeadsViewStateProvider>
                    <LeadsPipeline />
                  </LeadsViewStateProvider>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/leads/:id" 
              element={
                <ProtectedRoute requiredPermissions={["leads.view"]}>
                  <LeadDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/activities"
              element={
                <ProtectedRoute requiredPermissions={["activities.view"]}>
                  <Activities />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/activities/new" 
              element={
                <ProtectedRoute requiredPermissions={["activities.create"]}>
                  <ActivityNew />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/activities/:id" 
              element={
                <ProtectedRoute requiredPermissions={["activities.view"]}>
                  <ActivityDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/settings" 
              element={
                <ProtectedRoute requiredPermissions={["admin.settings.manage"]}>
                  <Settings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/settings/permissions" 
              element={
                <ProtectedRoute requiredPermissions={["admin.settings.manage"]}>
                  <RolesPermissions />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/security-overview" 
              element={
                <ProtectedRoute requiredPermissions={["admin.settings.manage"]}>
                  <SecurityOverview />
                </ProtectedRoute>
              }
            />
            <Route 
              path="/dashboard/system-logs" 
              element={
                <ProtectedRoute requiredRole="platform_admin">
                  <SystemLogs />
                </ProtectedRoute>
              }
            />
            <Route 
              path="/dashboard/permissions" 
              element={
                <ProtectedRoute requiredPermissions={["admin.settings.manage"]}>
                  <Navigate to="/dashboard/settings/permissions" replace />
                </ProtectedRoute>
              }
            />
            <Route 
              path="/dashboard/tenants" 
              element={
                <ProtectedRoute requiredRole="platform_admin" requiredPermissions={["admin.tenants.manage"]}>
                  <Tenants />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/tenants/new" 
              element={
                <ProtectedRoute requiredRole="platform_admin" requiredPermissions={["admin.tenants.manage"]}>
                  <TenantNew />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/tenants/:id" 
              element={
                <ProtectedRoute requiredRole="platform_admin" requiredPermissions={["admin.tenants.manage"]}>
                  <TenantDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/franchises" 
              element={
                <ProtectedRoute requiredPermissions={["admin.franchises.manage"]}>
                  <Franchises />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/franchises/new" 
              element={
                <ProtectedRoute requiredPermissions={["admin.franchises.manage"]}>
                  <FranchiseNew />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/franchises/:id" 
              element={
                <ProtectedRoute requiredPermissions={["admin.franchises.manage"]}>
                  <FranchiseDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/users" 
              element={
                <ProtectedRoute requiredPermissions={["admin.users.manage"]}>
                  <Users />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/users/new" 
              element={
                <ProtectedRoute requiredPermissions={["admin.users.manage"]}>
                  <UserNew />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/users/:id" 
              element={
                <ProtectedRoute requiredPermissions={["admin.users.manage"]}>
                  <UserDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/opportunities" 
              element={
                <ProtectedRoute requiredPermissions={["opportunities.view"]}>
                  <Opportunities />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/opportunities/pipeline" 
              element={
                <ProtectedRoute requiredPermissions={["opportunities.view"]}>
                  <OpportunitiesPipeline />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/opportunities/new" 
              element={
                <ProtectedRoute requiredPermissions={["opportunities.create"]}>
                  <OpportunityNew />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/opportunities/:id" 
              element={
                <ProtectedRoute requiredPermissions={["opportunities.view"]}>
                  <OpportunityDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/quotes" 
              element={
                <ProtectedRoute>
                  <Quotes />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/quotes/pipeline" 
              element={
                <ProtectedRoute>
                  <QuotesPipeline />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/quotes/templates" 
              element={
                <ProtectedRoute requiredPermissions={["quotes.templates.manage"]}>
                  <QuoteTemplates />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/quotes/new" 
              element={
                <ProtectedRoute>
                  <QuoteNew />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/quotes/:id" 
              element={
                <ProtectedRoute>
                  <QuoteDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/quotes/multi-modal" 
              element={
                <ProtectedRoute>
                  <MultiModalQuote />
                </ProtectedRoute>
              } 
            />
            <Route
              path="/testing/quotations" 
              element={
                <ProtectedRoute>
                  <QuotationTests />
                </ProtectedRoute>
              } 
            />
            <Route
              path="/dashboard/lead-routing"
              element={
                <ProtectedRoute requiredPermissions={["admin.lead_routing.manage"]}>
                  <LeadRouting />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/queues" 
              element={
                <ProtectedRoute requiredPermissions={["admin.lead_routing.manage"]}>
                  <QueueManagement />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/lead-assignment" 
              element={
                <ProtectedRoute requiredPermissions={["admin.lead_assignment.manage"]}>
                  <LeadAssignment />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/email-management" 
              element={
                <ProtectedRoute requiredPermissions={["admin.settings.manage"]}>
                  <EmailManagement />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/themes" 
              element={
                <ProtectedRoute requiredPermissions={["admin.settings.manage"]}>
                  <ThemeManagement />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/dashboard/ui-forms-demo" 
              element={
                <ProtectedRoute requiredPermissions={["admin.settings.manage"]}>
                  <UIDemoForms />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/dashboard/ui-advanced-demo" 
              element={
                <ProtectedRoute requiredPermissions={["admin.settings.manage"]}>
                  <UIDemoAdvanced />
                </ProtectedRoute>
              } 
            />

            {/* Settings-scoped Subscription route */}
            <Route 
              path="/dashboard/settings/subscription" 
              element={
                <ProtectedRoute requiredPermissions={["admin.settings.manage"]}>
                  <SubscriptionManagement />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/settings/quote-numbers" 
              element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><QuoteNumberSettings /></ProtectedRoute>} 
            />
            {/* Settings → Data Management */}
            <Route 
              path="/dashboard/settings/data-management" 
              element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><DataManagement /></ProtectedRoute>} 
            />
            <Route 
              path="/dashboard/settings/domains" 
              element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><PlatformDomains /></ProtectedRoute>} 
            />
            <Route 
              path="/dashboard/settings/domains/:id" 
              element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><PlatformDomainDetail /></ProtectedRoute>} 
            />
            <Route 
              path="/dashboard/settings/database-export" 
              element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><DatabaseExport /></ProtectedRoute>} 
            />
            <Route 
              path="/dashboard/settings/master-data" 
              element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><MasterDataGeography /></ProtectedRoute>} 
            />
            <Route path="/dashboard/settings/master-data-hts" 
              element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><MasterDataHTS /></ProtectedRoute>} 
            />
            <Route 
              path="/dashboard/settings/master-data-subscription-plans" 
              element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><MasterDataSubscriptionPlans /></ProtectedRoute>} 
            />
            {/* Public customer portal */}
            <Route path="/portal/quote/:token" element={<QuotePortal />} />
            <Route 
              path="/dashboard/transfers" 
              element={
                <ProtectedRoute requiredPermissions={["transfers.view"]}>
                  <TransferCenter />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/documents/roadmap" 
              element={
                <ProtectedRoute>
                  <DocumentManager />
                </ProtectedRoute>
              } 
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            {/* Salesforce-style navigation placeholder routes */}
            <Route path="/dashboard/files" element={<ProtectedRoute requiredPermissions={["files.view"]}><Files /></ProtectedRoute>} />
            <Route path="/dashboard/campaigns" element={<ProtectedRoute requiredPermissions={["campaigns.view"]}><Campaigns /></ProtectedRoute>} />
            <Route path="/dashboard/reports" element={<ProtectedRoute requiredPermissions={["reports.view"]}><Reports /></ProtectedRoute>} />
            <Route path="/dashboard/chatter" element={<ProtectedRoute requiredPermissions={["chatter.view"]}><Chatter /></ProtectedRoute>} />
            <Route path="/dashboard/groups" element={<ProtectedRoute requiredPermissions={["groups.view"]}><Groups /></ProtectedRoute>} />
            <Route path="/dashboard/calendar" element={<ProtectedRoute requiredPermissions={["calendar.view"]}><Calendar /></ProtectedRoute>} />
            <Route path="/dashboard/dashboards" element={<ProtectedRoute requiredPermissions={["dashboards.view"]}><Dashboards /></ProtectedRoute>} />
            <Route path="/dashboard/crm-workspace" element={<ProtectedRoute requiredPermissions={["dashboards.view"]}><CRMWorkspace /></ProtectedRoute>} />
            <Route path="/dashboard/leads-workspace" element={<Navigate to="/dashboard/leads/pipeline" replace />} />
            <Route path="/dashboard/more" element={<ProtectedRoute><More /></ProtectedRoute>} />
            <Route path="/dashboard/settings/permissions" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><PermissionsMatrix /></ProtectedRoute>} />
            <Route path="/dashboard/audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
            <Route path="/dashboard/settings/custom-roles" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><CustomRoles /></ProtectedRoute>} />
            <Route path="/dashboard/charge-categories" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><ChargeCategories /></ProtectedRoute>} />
            <Route path="/dashboard/charge-bases" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><ChargeBases /></ProtectedRoute>} />
            <Route path="/dashboard/currencies" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><Currencies /></ProtectedRoute>} />
            <Route path="/dashboard/finance/invoices" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><Invoices /></ProtectedRoute>} />
            <Route path="/dashboard/finance/margin-rules" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><MarginRules /></ProtectedRoute>} />
            <Route path="/dashboard/finance/invoices/:id" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><InvoiceDetail /></ProtectedRoute>} />
            <Route path="/dashboard/finance/tax-jurisdictions" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><TaxJurisdictions /></ProtectedRoute>} />
            <Route path="/dashboard/finance/tax-jurisdictions/:id" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><TaxJurisdictionDetail /></ProtectedRoute>} />
            <Route path="/dashboard/container-types" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><ContainerTypes /></ProtectedRoute>} />
            <Route path="/dashboard/container-sizes" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><ContainerSizes /></ProtectedRoute>} />
            <Route path="/dashboard/container-tracking" element={<ProtectedRoute><ContainerTracking /></ProtectedRoute>} />
            <Route path="/dashboard/container-analytics" element={<ProtectedRoute><ContainerAnalytics /></ProtectedRoute>} />
            <Route path="/dashboard/vessel-types" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><VesselTypes /></ProtectedRoute>} />
            <Route path="/dashboard/vessel-classes" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><VesselClasses /></ProtectedRoute>} />
            <Route path="/dashboard/vessels" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><Vessels /></ProtectedRoute>} />
            <Route path="/dashboard/charge-sides" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><ChargeSides /></ProtectedRoute>} />
            <Route path="/dashboard/charge-categories" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><ChargeCategories /></ProtectedRoute>} />
            <Route path="/dashboard/charge-bases" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><ChargeBases /></ProtectedRoute>} />
            {/* Logistics Routes */}
            <Route path="/dashboard/bookings" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
            <Route path="/dashboard/commodities" element={<ProtectedRoute><Commodities /></ProtectedRoute>} />
            <Route path="/dashboard/bookings/new" element={<ProtectedRoute><BookingNew /></ProtectedRoute>} />
            <Route path="/dashboard/bookings/map" element={<ProtectedRoute><QuoteBookingMapper /></ProtectedRoute>} />
            <Route path="/dashboard/bookings/:id" element={<ProtectedRoute><BookingDetail /></ProtectedRoute>} />
            <Route path="/dashboard/bookings/:id/edit" element={<ProtectedRoute><BookingEdit /></ProtectedRoute>} />
            <Route path="/dashboard/shipments" element={<ProtectedRoute><Shipments /></ProtectedRoute>} />
            <Route path="/dashboard/shipments/new" element={<ProtectedRoute><ShipmentNew /></ProtectedRoute>} />
            <Route path="/dashboard/shipments/pipeline" element={<ProtectedRoute><ShipmentsPipeline /></ProtectedRoute>} />
            <Route path="/dashboard/customs-clearance/pipeline" element={<ProtectedRoute><CustomsClearancePipeline /></ProtectedRoute>} />
            <Route path="/dashboard/shipments/:id" element={<ProtectedRoute><ShipmentDetail /></ProtectedRoute>} />
            <Route path="/dashboard/shipments/:id/documents/:type" element={<ProtectedRoute><ShipmentDocumentViewer /></ProtectedRoute>} />
            <Route path="/dashboard/warehouses" element={<ProtectedRoute><Warehouses /></ProtectedRoute>} />
            <Route path="/dashboard/warehouses/new" element={<ProtectedRoute><WarehouseNew /></ProtectedRoute>} />
            <Route path="/dashboard/vehicles" element={<ProtectedRoute><Vehicles /></ProtectedRoute>} />
            <Route path="/dashboard/vehicles/new" element={<ProtectedRoute><VehicleNew /></ProtectedRoute>} />
            <Route path="/dashboard/rate-management" element={<ProtectedRoute><RateManagement /></ProtectedRoute>} />
            <Route path="/dashboard/carriers" element={<ProtectedRoute><Carriers /></ProtectedRoute>} />
            <Route path="/dashboard/vendors" element={<ProtectedRoute><Vendors /></ProtectedRoute>} />
            <Route path="/dashboard/vendors/:id" element={<ProtectedRoute><VendorDetail /></ProtectedRoute>} />
            <Route path="/dashboard/consignees" element={<ProtectedRoute><Consignees /></ProtectedRoute>} />
            <Route path="/dashboard/ports-locations" element={<ProtectedRoute><PortsLocations /></ProtectedRoute>} />
            <Route path="/dashboard/package-categories" element={<ProtectedRoute><PackageCategories /></ProtectedRoute>} />
             <Route path="/dashboard/package-sizes" element={<ProtectedRoute><PackageSizes /></ProtectedRoute>} />
             <Route path="/dashboard/cargo-types" element={<ProtectedRoute><CargoTypes /></ProtectedRoute>} />
             <Route path="/dashboard/cargo-details" element={<ProtectedRoute><CargoDetails /></ProtectedRoute>} />
             <Route path="/dashboard/logistics-manager" element={<ProtectedRoute requiredRole="tenant_admin"><LogisticsManager /></ProtectedRoute>} />
              <Route path="/dashboard/incoterms" element={<ProtectedRoute><Incoterms /></ProtectedRoute>} />
             <Route path="/dashboard/service-types" element={<ProtectedRoute><ServiceTypes /></ProtectedRoute>} />
             <Route path="/dashboard/transport-modes" element={<ProtectedRoute><TransportModes /></ProtectedRoute>} />
             <Route path="/dashboard/restricted-party-screening" element={<ProtectedRoute><RestrictedPartyScreening /></ProtectedRoute>} />
             <Route path="/dashboard/services" element={<ProtectedRoute><Services /></ProtectedRoute>} />
             <Route path="/dashboard/service-type-mappings" element={<ProtectedRoute><ServiceTypeMappings /></ProtectedRoute>} />
            {/* Subscription & Billing Routes */}
            <Route path="/dashboard/subscriptions" element={<ProtectedRoute><SubscriptionManagement /></ProtectedRoute>} />
            <Route path="/dashboard/tenant-subscriptions" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><TenantSubscription /></ProtectedRoute>} />
            <Route path="/dashboard/log-test" element={<ProtectedRoute><LogTestPage /></ProtectedRoute>} />
            <Route path="/dashboard/debug-console" element={<ProtectedRoute><DebugConsole /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
                </Suspense>
                </LeadsViewStateProvider>
              </TooltipProvider>
            </ThemeProvider>
          </DomainContextProvider>
        </CRMProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
