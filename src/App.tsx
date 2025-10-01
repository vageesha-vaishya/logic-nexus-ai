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
import Activities from "./pages/dashboard/Activities";
import ActivityNew from "./pages/dashboard/ActivityNew";
import ActivityDetail from "./pages/dashboard/ActivityDetail";
import Settings from "./pages/dashboard/Settings";
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
import LeadRouting from "./pages/dashboard/LeadRouting";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
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
                <ProtectedRoute>
                  <Accounts />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/accounts/new" 
              element={
                <ProtectedRoute>
                  <AccountNew />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/accounts/:id" 
              element={
                <ProtectedRoute>
                  <AccountDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/contacts" 
              element={
                <ProtectedRoute>
                  <Contacts />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/contacts/new" 
              element={
                <ProtectedRoute>
                  <ContactNew />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/contacts/:id" 
              element={
                <ProtectedRoute>
                  <ContactDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/leads" 
              element={
                <ProtectedRoute>
                  <Leads />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/leads/new" 
              element={
                <ProtectedRoute>
                  <LeadNew />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/leads/:id" 
              element={
                <ProtectedRoute>
                  <LeadDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/leads/import-export" 
              element={
                <ProtectedRoute>
                  <LeadsImportExport />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/activities"
              element={
                <ProtectedRoute>
                  <Activities />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/activities/new" 
              element={
                <ProtectedRoute>
                  <ActivityNew />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/activities/:id" 
              element={
                <ProtectedRoute>
                  <ActivityDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/settings" 
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/tenants" 
              element={
                <ProtectedRoute requiredRole="platform_admin">
                  <Tenants />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/tenants/new" 
              element={
                <ProtectedRoute requiredRole="platform_admin">
                  <TenantNew />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/tenants/:id" 
              element={
                <ProtectedRoute requiredRole="platform_admin">
                  <TenantDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/franchises" 
              element={
                <ProtectedRoute>
                  <Franchises />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/franchises/new" 
              element={
                <ProtectedRoute>
                  <FranchiseNew />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/franchises/:id" 
              element={
                <ProtectedRoute>
                  <FranchiseDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/users" 
              element={
                <ProtectedRoute>
                  <Users />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/users/new" 
              element={
                <ProtectedRoute>
                  <UserNew />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/users/:id" 
              element={
                <ProtectedRoute>
                  <UserDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/opportunities" 
              element={
                <ProtectedRoute>
                  <Opportunities />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/opportunities/new" 
              element={
                <ProtectedRoute>
                  <OpportunityNew />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/opportunities/:id" 
              element={
                <ProtectedRoute>
                  <OpportunityDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/lead-routing" 
              element={
                <ProtectedRoute>
                  <LeadRouting />
                </ProtectedRoute>
              } 
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
