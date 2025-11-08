import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import SetupAdmin from "./pages/SetupAdmin";
import Unauthorized from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";
import Accounts from "./pages/dashboard/Accounts";
import AccountNew from "./pages/dashboard/AccountNew";
import AccountDetail from "./pages/dashboard/AccountDetail";
import Contacts from "./pages/dashboard/Contacts";
import ContactNew from "./pages/dashboard/ContactNew";
import ContactDetail from "./pages/dashboard/ContactDetail";
import Leads from "./pages/dashboard/Leads";
import LeadNew from "./pages/dashboard/LeadNew";
import LeadDetail from "./pages/dashboard/LeadDetail";
import LeadsImportExport from "./pages/dashboard/LeadsImportExport";
import LeadsPipeline from "./pages/dashboard/LeadsPipeline";
import Activities from "./pages/dashboard/Activities";
import ActivityNew from "./pages/dashboard/ActivityNew";
import ActivityDetail from "./pages/dashboard/ActivityDetail";
import Settings from "./pages/dashboard/Settings";
import SecurityOverview from "./pages/dashboard/SecurityOverview";
import Tenants from "./pages/dashboard/Tenants";
import TenantNew from "./pages/dashboard/TenantNew";
import TenantDetail from "./pages/dashboard/TenantDetail";
import Franchises from "./pages/dashboard/Franchises";
import FranchiseNew from "./pages/dashboard/FranchiseNew";
import FranchiseDetail from "./pages/dashboard/FranchiseDetail";
import Users from "./pages/dashboard/Users";
import UserNew from "./pages/dashboard/UserNew";
import UserDetail from "./pages/dashboard/UserDetail";
import Opportunities from "./pages/dashboard/Opportunities";
import OpportunityNew from "./pages/dashboard/OpportunityNew";
import OpportunityDetail from "./pages/dashboard/OpportunityDetail";
import OpportunitiesPipeline from "./pages/dashboard/OpportunitiesPipeline";
import LeadRouting from "./pages/dashboard/LeadRouting";
import LeadAssignment from "./pages/dashboard/LeadAssignment";
import EmailManagement from "./pages/dashboard/EmailManagement";
import ThemeManagement from "./pages/dashboard/ThemeManagement";
import { ThemeProvider } from "./hooks/useTheme";
import Files from "./pages/dashboard/Files";
import Campaigns from "./pages/dashboard/Campaigns";
import Reports from "./pages/dashboard/Reports";
import Chatter from "./pages/dashboard/Chatter";
import Groups from "./pages/dashboard/Groups";
import Calendar from "./pages/dashboard/Calendar";
import Dashboards from "./pages/dashboard/Dashboards";
import More from "./pages/dashboard/More";
import PermissionsMatrix from "./pages/dashboard/PermissionsMatrix";
import CustomRoles from "./pages/dashboard/CustomRoles";
import Shipments from "./pages/dashboard/Shipments";
import ShipmentNew from "./pages/dashboard/ShipmentNew";
import ShipmentDetail from "./pages/dashboard/ShipmentDetail";
import ShipmentsPipeline from "./pages/dashboard/ShipmentsPipeline";
import Warehouses from "./pages/dashboard/Warehouses";
import WarehouseNew from "./pages/dashboard/WarehouseNew";
import Vehicles from "./pages/dashboard/Vehicles";
import VehicleNew from "./pages/dashboard/VehicleNew";
import SubscriptionManagement from "./pages/dashboard/SubscriptionManagement";
import TenantSubscription from "./pages/dashboard/TenantSubscription";
import Quotes from "./pages/dashboard/Quotes";
import QuoteNew from "./pages/dashboard/QuoteNew";
import QuoteDetail from "./pages/dashboard/QuoteDetail";
import Carriers from "./pages/dashboard/Carriers";
import Consignees from "./pages/dashboard/Consignees";
import PortsLocations from "./pages/dashboard/PortsLocations";
import PackageCategories from "./pages/dashboard/PackageCategories";
import PackageSizes from "./pages/dashboard/PackageSizes";
import CargoTypes from "./pages/dashboard/CargoTypes";
import CargoDetails from "./pages/dashboard/CargoDetails";
import Incoterms from "./pages/dashboard/Incoterms";
import UIDemoForms from "./pages/dashboard/UIDemoForms";
import UIDemoAdvanced from "./pages/dashboard/UIDemoAdvanced";
import QuoteNumberSettings from "./pages/dashboard/QuoteNumberSettings";
import DataManagement from "./pages/dashboard/DataManagement";
import ServiceTypeMappings from "./pages/dashboard/ServiceTypeMappings";
import ServiceTypes from "./pages/dashboard/ServiceTypes";
import Services from "./pages/dashboard/Services";
import ChargeCategories from "./pages/dashboard/ChargeCategories";
import ChargeBases from "./pages/dashboard/ChargeBases";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/setup-admin" element={<SetupAdmin />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
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
              path="/dashboard/accounts/:id" 
              element={
                <ProtectedRoute requiredPermissions={["accounts.view"]}>
                  <AccountDetail />
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
              path="/dashboard/contacts/:id" 
              element={
                <ProtectedRoute requiredPermissions={["contacts.view"]}>
                  <ContactDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/leads" 
              element={
                <ProtectedRoute requiredPermissions={["leads.view"]}>
                  <Leads />
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
                  <LeadsPipeline />
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
              path="/dashboard/security-overview" 
              element={
                <ProtectedRoute requiredPermissions={["admin.settings.manage"]}>
                  <SecurityOverview />
                </ProtectedRoute>
              }
            />
            <Route 
              path="/dashboard/permissions" 
              element={
                <ProtectedRoute requiredPermissions={["admin.users.manage"]}>
                  <PermissionsMatrix />
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
              path="/dashboard/lead-routing" 
              element={
                <ProtectedRoute requiredPermissions={["admin.lead_routing.manage"]}>
                  <LeadRouting />
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            {/* Salesforce-style navigation placeholder routes */}
            <Route path="/dashboard/files" element={<ProtectedRoute requiredPermissions={["files.view"]}><Files /></ProtectedRoute>} />
            <Route path="/dashboard/campaigns" element={<ProtectedRoute requiredPermissions={["campaigns.view"]}><Campaigns /></ProtectedRoute>} />
            <Route path="/dashboard/reports" element={<ProtectedRoute requiredPermissions={["reports.view"]}><Reports /></ProtectedRoute>} />
            <Route path="/dashboard/chatter" element={<ProtectedRoute requiredPermissions={["chatter.view"]}><Chatter /></ProtectedRoute>} />
            <Route path="/dashboard/groups" element={<ProtectedRoute requiredPermissions={["groups.view"]}><Groups /></ProtectedRoute>} />
            <Route path="/dashboard/calendar" element={<ProtectedRoute requiredPermissions={["calendar.view"]}><Calendar /></ProtectedRoute>} />
            <Route path="/dashboard/dashboards" element={<ProtectedRoute requiredPermissions={["dashboards.view"]}><Dashboards /></ProtectedRoute>} />
            <Route path="/dashboard/more" element={<ProtectedRoute><More /></ProtectedRoute>} />
            <Route path="/dashboard/custom-roles" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><CustomRoles /></ProtectedRoute>} />
            <Route path="/dashboard/charge-categories" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><ChargeCategories /></ProtectedRoute>} />
            <Route path="/dashboard/charge-bases" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><ChargeBases /></ProtectedRoute>} />
            {/* Logistics Routes */}
            <Route path="/dashboard/shipments" element={<ProtectedRoute><Shipments /></ProtectedRoute>} />
            <Route path="/dashboard/shipments/new" element={<ProtectedRoute><ShipmentNew /></ProtectedRoute>} />
            <Route path="/dashboard/shipments/pipeline" element={<ProtectedRoute><ShipmentsPipeline /></ProtectedRoute>} />
            <Route path="/dashboard/shipments/:id" element={<ProtectedRoute><ShipmentDetail /></ProtectedRoute>} />
            <Route path="/dashboard/warehouses" element={<ProtectedRoute><Warehouses /></ProtectedRoute>} />
            <Route path="/dashboard/warehouses/new" element={<ProtectedRoute><WarehouseNew /></ProtectedRoute>} />
            <Route path="/dashboard/vehicles" element={<ProtectedRoute><Vehicles /></ProtectedRoute>} />
            <Route path="/dashboard/vehicles/new" element={<ProtectedRoute><VehicleNew /></ProtectedRoute>} />
            <Route path="/dashboard/carriers" element={<ProtectedRoute><Carriers /></ProtectedRoute>} />
            <Route path="/dashboard/consignees" element={<ProtectedRoute><Consignees /></ProtectedRoute>} />
            <Route path="/dashboard/ports-locations" element={<ProtectedRoute><PortsLocations /></ProtectedRoute>} />
            <Route path="/dashboard/package-categories" element={<ProtectedRoute><PackageCategories /></ProtectedRoute>} />
             <Route path="/dashboard/package-sizes" element={<ProtectedRoute><PackageSizes /></ProtectedRoute>} />
             <Route path="/dashboard/cargo-types" element={<ProtectedRoute><CargoTypes /></ProtectedRoute>} />
             <Route path="/dashboard/cargo-details" element={<ProtectedRoute><CargoDetails /></ProtectedRoute>} />
              <Route path="/dashboard/incoterms" element={<ProtectedRoute><Incoterms /></ProtectedRoute>} />
             <Route path="/dashboard/service-types" element={<ProtectedRoute><ServiceTypes /></ProtectedRoute>} />
             <Route path="/dashboard/services" element={<ProtectedRoute><Services /></ProtectedRoute>} />
             <Route path="/dashboard/service-type-mappings" element={<ProtectedRoute><ServiceTypeMappings /></ProtectedRoute>} />
            {/* Subscription & Billing Routes */}
            <Route path="/dashboard/subscriptions" element={<ProtectedRoute><SubscriptionManagement /></ProtectedRoute>} />
            <Route path="/dashboard/tenant-subscriptions" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><TenantSubscription /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
