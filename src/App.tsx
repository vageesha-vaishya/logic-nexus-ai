import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { StickyActionsProvider } from "@/components/layout/StickyActionsContext";
import { logger } from "@/lib/logger";
import { initializePlugins } from "./plugins/init";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import { queryPersister, shouldPersistQuery } from "@/lib/queryPersistence";
import { lazy, Suspense, type ComponentType } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { CRMProvider } from "./hooks/useCRM";
import { DomainContextProvider } from "./contexts/DomainContext";
import { TenantBrandingProvider } from "./contexts/TenantBrandingContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { LeadsViewStateProvider } from "./hooks/useLeadsViewState";
import { ThemeProvider } from "./hooks/useTheme";
import { PipelineProvider } from "@/components/debug/pipeline/PipelineContext";
import { PLATFORM_ADMIN_ROLE } from "@/config/permissions";

// Eager: shell pages (needed immediately)
import Landing from "./pages/Landing";
import RootRedirect from "./pages/RootRedirect";
import Welcome from "./pages/Welcome";
import SignupDomainPicker from "./pages/signup/SignupDomainPicker";
import SignupForm from "./pages/signup/SignupForm";
import InviteAccept from "./pages/invite/InviteAccept";
const TeamSettings     = lazy(() => import("./pages/dashboard/TeamSettings"));
const BillingSettings  = lazy(() => import("./pages/dashboard/BillingSettings"));
const BrandingSettings = lazy(() => import("./pages/dashboard/BrandingSettings"));
import Auth from "./pages/Auth";
import OAuthCallback from "./pages/OAuthCallback";
import AuthOAuthCallback from "./pages/AuthOAuthCallback";
import AuthChooseAccount from "./pages/AuthChooseAccount";
import { useOAuthDeepLink } from "./lib/auth/useOAuthDeepLink";

/**
 * OAuthDeepLinkMount — invisible mount point for the Capacitor
 * appUrlOpen listener that catches com.sos.sthira://auth-callback and
 * establishes the Supabase session. Mounted inside BrowserRouter so
 * the hook's useNavigate() resolves; rendered as a sibling to Routes
 * so it's never unmounted by route changes mid-OAuth-flow.
 */
function OAuthDeepLinkMount() {
  useOAuthDeepLink();
  return null;
}
import SetupAdmin from "./pages/SetupAdmin";
import Unauthorized from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";
import SelfServiceOnboarding from "./pages/SelfServiceOnboarding";

// Lazy: all dashboard pages (loaded on navigation)
const lazyWithRetry = <T extends { default: ComponentType<unknown> }>(
  importer: () => Promise<T>
) =>
  lazy(() =>
    importer().catch(() =>
      new Promise((resolve) => setTimeout(resolve, 800)).then(importer)
    )
  );

// Sthira mobile shell routes (PR 2 — onboarding flow, PR 3 — home guard)
const SthiraSplashRoute = lazy(() => import("./features/markets/sthira/SthiraSplashRoute"));
const SthiraOnboardingRoute = lazy(() => import("./features/markets/sthira/SthiraOnboardingRoute"));
const SthiraBrokerRoute = lazy(() => import("./features/markets/sthira/SthiraBrokerRoute"));
import { SthiraMobileGuard } from "./features/markets/sthira/SthiraMobileGuard";
import { RetailAudienceGuard } from "./components/auth/RetailAudienceGuard";
import { WebOnlyRoute } from "./components/auth/WebOnlyRoute";

// Path A Phase 2.2 — manifest-driven route builder. Gated by
// VITE_USE_DOMAIN_MANIFESTS so the unified web build can opt into the
// manifest-driven Markets routes without forcing them on yet. The
// single-domain build (VITE_DOMAIN_ONLY=markets) uses MarketsApp.tsx,
// not this file, so the IS_DOMAIN_ONLY_BUILD branch that used to live
// here is gone — kept only the flag-gated manifest splice.
import { marketsManifest } from "./features/markets/manifest";
import { buildDomainRoutes, USE_DOMAIN_MANIFESTS } from "./platform/domains/buildDomainRoutes";
// Phase 2 — single-domain tenants land on their domain's defaultRoute
// instead of the generic dashboard. See DomainShellRouter doc-comment.
import { DomainShellRouter } from "./platform/domains/DomainShellRouter";

const DashboardRouter = lazy(() =>
  import("./components/dashboard/DashboardRouter").then((module) => ({ default: module.DashboardRouter }))
);
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
const LeadNew = lazyWithRetry(() => import("./pages/dashboard/LeadNew"));
const LeadDetail = lazy(() => import("./pages/dashboard/LeadDetail"));
const LeadsImportExport = lazy(() => import("./pages/dashboard/LeadsImportExport"));
const LeadsPipeline = lazy(() => import("./pages/dashboard/LeadsPipeline"));
const Activities = lazy(() => import("./pages/dashboard/Activities"));
const ActivitiesImportExport = lazy(() => import("./pages/dashboard/ActivitiesImportExport"));
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
const OpportunitiesImportExport = lazy(() => import("./pages/dashboard/OpportunitiesImportExport"));
const OpportunityNew = lazy(() => import("./pages/dashboard/OpportunityNew"));
const OpportunityDetail = lazy(() => import("./pages/dashboard/OpportunityDetail"));
const OpportunitiesPipeline = lazy(() => import("./pages/dashboard/OpportunitiesPipeline"));
const LeadRouting = lazy(() => import("./pages/dashboard/LeadRouting"));
const QueueManagement = lazy(() => import("./pages/dashboard/QueueManagement"));
const OnboardingOperations = lazy(() => import("./pages/dashboard/OnboardingOperations"));
const LeadAssignment = lazy(() => import("./pages/dashboard/LeadAssignment"));
const EmailManagement = lazy(() => import("./pages/dashboard/EmailManagement"));
const CommunicationsHub = lazy(() => import("./features/module-communications").then((module) => ({ default: module.CommunicationsHubVerticalPage })));
const ChannelIntegrations = lazy(() => import("./pages/dashboard/ChannelIntegrations"));
const ThemeManagement = lazy(() => import("./pages/dashboard/ThemeManagement"));
const Files = lazy(() => import("./pages/dashboard/Files"));
const Campaigns = lazy(() => import("./pages/dashboard/Campaigns"));
const CommissionRules = lazy(() => import("./pages/dashboard/CommissionRules"));
const Commissions = lazy(() => import("./pages/dashboard/Commissions"));
const DraftInvoices = lazy(() => import("./pages/dashboard/DraftInvoices"));
const OutboxRetries = lazy(() => import("./pages/dashboard/OutboxRetries"));
const Reports = lazy(() => import("./pages/dashboard/Reports"));
const Chatter = lazy(() => import("./pages/dashboard/Chatter"));
const Groups = lazy(() => import("./pages/dashboard/Groups"));
const Calendar = lazy(() => import("./pages/dashboard/Calendar"));
const CRMWorkspace = lazy(() => import("./features/module-crm").then((module) => ({ default: module.CRMWorkspaceVerticalPage })));
const More = lazy(() => import("./pages/dashboard/More"));
const PermissionsMatrix = lazy(() => import("./pages/dashboard/PermissionsMatrix"));
const AuditLogs = lazy(() => import("./pages/dashboard/AuditLogs"));
const SecurityIncidents = lazy(() => import("./pages/dashboard/SecurityIncidents"));
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
const ShipmentsPipeline = lazy(() => import("./features/module-logistics").then((module) => ({ default: module.ShipmentsPipelineVerticalPage })));
const Warehouses = lazy(() => import("./pages/dashboard/Warehouses"));
const WarehouseNew = lazy(() => import("./pages/dashboard/WarehouseNew"));
const Vehicles = lazy(() => import("./pages/dashboard/Vehicles"));
const VehicleNew = lazy(() => import("./pages/dashboard/VehicleNew"));
const SubscriptionManagement = lazy(() => import("./pages/dashboard/SubscriptionManagement"));
const TenantSubscription = lazy(() => import("./pages/dashboard/TenantSubscription"));
const BillingInvoiceDetail = lazy(() => import("./pages/dashboard/billing/BillingInvoiceDetail"));
const Quotes = lazy(() => import("./pages/dashboard/Quotes"));
const QuoteTemplates = lazy(() => import("./pages/dashboard/QuoteTemplates"));
const QuoteNew = lazy(() => import("./pages/dashboard/QuoteNew"));
const QuoteDetail = lazy(() => import("./pages/dashboard/QuoteDetail"));
const QuotesImportExport = lazy(() => import("./pages/dashboard/QuotesImportExport"));
const QuotesPipeline = lazy(() => 
  import("./features/module-quotation").then((module) => ({ default: module.QuotesPipelineVerticalPage })).catch(() => {
    // Retry once after 1s in case of network glitch
    return new Promise(resolve => setTimeout(resolve, 1000))
      .then(() => import("./features/module-quotation").then((module) => ({ default: module.QuotesPipelineVerticalPage })));
  })
);

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
const QuotationSettings = lazy(() => import("./pages/dashboard/QuotationSettings"));
const DataManagement = lazy(() => import("./pages/dashboard/DataManagement"));
const LlmGatewayAdminPage = lazy(() => import("./pages/dashboard/admin/LlmGatewayAdminPage"));
const WhatsappPhonesPage = lazy(() => import("./pages/dashboard/admin/WhatsappPhonesPage"));
const ServiceTypeMappings = lazy(() => import("./pages/dashboard/ServiceTypeMappings"));
const ServiceTypes = lazy(() => import("./pages/dashboard/ServiceTypes"));
const RestrictedPartyScreening = lazy(() => import("./features/module-compliance").then((module) => ({ default: module.RestrictedPartyScreeningVerticalPage })));
const ComplianceOfficerInbox = lazy(() => import("./pages/dashboard/ComplianceOfficerInbox"));
const ComplianceScreeningDetail = lazy(() => import("./pages/dashboard/ComplianceScreeningDetail"));
const TransportModes = lazy(() => import("./pages/dashboard/TransportModes"));
const Services = lazy(() => import("./pages/dashboard/Services"));
const Currencies = lazy(() => import("./pages/dashboard/Currencies"));
const ContainerTypes = lazy(() => import("./pages/dashboard/ContainerTypes"));
const ContainerSizes = lazy(() => import("./pages/dashboard/ContainerSizes"));
const ContainerAnalytics = lazy(() => import("./pages/dashboard/ContainerAnalytics"));
const ContainerTracking = lazy(() => import("./pages/dashboard/ContainerTracking"));
const PlatformDomains = lazy(() => import("./pages/dashboard/PlatformDomains"));
const PlatformDomainDetail = lazy(() => import("./pages/dashboard/PlatformDomainDetail"));
const Invoices = lazy(() => import("./features/module-finance").then((module) => ({ default: module.InvoicesVerticalPage })));
const MarginRules = lazy(() => import("./pages/dashboard/finance/MarginRules"));
const InvoiceDetail = lazy(() => import("./pages/dashboard/finance/InvoiceDetail"));
const TaxJurisdictions = lazy(() => import("./pages/dashboard/finance/TaxJurisdictions"));
const TaxJurisdictionDetail = lazy(() => import("./pages/dashboard/finance/TaxJurisdictionDetail"));
const FinanceAccountingSetup = lazy(() => import("./features/module-finance/pages/FinanceAccountingSetupPage"));
const AogAlertsList = lazy(() => import("./features/module-amro/pages/AogAlertsListPage"));
const AogAlertDetail = lazy(() => import("./features/module-amro/pages/AogAlertDetailPage"));
const DirectiveApplicabilityQueue = lazy(() => import("./features/module-amro/pages/DirectiveApplicabilityQueuePage"));
const AmroDirectiveDetail = lazy(() => import("./features/module-amro/pages/AmroDirectiveDetailPage"));
const AmroAircraftApplicability = lazy(() => import("./features/module-amro/pages/AmroAircraftApplicabilityPage"));
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
const VolatilityMethodology = lazy(() => import("./pages/methodology/VolatilityMethodology"));
const SystemLogs = lazy(() => import("./pages/dashboard/SystemLogs"));
const RolesPermissions = lazy(() => import("./pages/dashboard/RolesPermissions"));
const TransferCenter = lazy(() => import("./pages/dashboard/TransferCenter"));
const DocumentManager = lazy(() => import("./pages/dashboard/DocumentManager"));
const LogTestPage = lazy(() => import("./pages/dashboard/LogTest"));
const DebugConsole = lazy(() => import("./pages/dashboard/DebugConsole"));
const Commodities = lazy(() => import("./pages/dashboard/Commodities"));
const SalesPlaceholder = lazy(() => import("./pages/dashboard/SalesPlaceholder"));
const SalesCommandCenter = lazy(() => import("./pages/dashboard/SalesCommandCenter"));
const UimShell = lazy(() => import("./pages/dashboard/UimShell"));
const AmroOverview = lazy(() => import("./features/module-amro").then((module) => ({ default: module.AmroOverviewPage })));
const AmroPlanDirectivesBulletin = lazy(() => import("./features/module-amro").then((module) => ({ default: module.AmroPlanDirectivesBulletinPage })));
const AmroMpdManagement = lazy(() => import("./features/module-amro").then((module) => ({ default: module.AmroMpdManagementPage })));
const AmroConfigureMpdManagement = lazy(() => import("./features/module-amro").then((module) => ({ default: module.AmroConfigureMpdPage })));
const AmroConfigureDirectivesManagement = lazy(() => import("./features/module-amro").then((module) => ({ default: module.AmroConfigureDirectivesPage })));
const AmroDirectivesManagement = lazy(() => import("./features/module-amro").then((module) => ({ default: module.AmroDirectivesManagementPage })));
const AmroWorkOrders = lazy(() => import("./features/module-amro").then((module) => ({ default: module.AmroWorkOrdersPage })));
const AmroWorkOrderDetail = lazy(() => import("./features/module-amro/components/work-orders").then((module) => ({ default: module.AmroWorkOrderDetailPage })));
const AmroTaskExecution = lazy(() => import("./features/module-amro").then((module) => ({ default: module.AmroTaskExecutionPage })));
const AmroScheduling = lazy(() => import("./features/module-amro").then((module) => ({ default: module.AmroSchedulingPage })));
const AmroParts = lazy(() => import("./features/module-amro").then((module) => ({ default: module.AmroPartsPage })));
const AmroCompliance = lazy(() => import("./features/module-amro").then((module) => ({ default: module.AmroCompliancePage })));
const AmroCertification = lazy(() => import("./features/module-amro").then((module) => ({ default: module.AmroCertificationPage })));
const AmroAudit = lazy(() => import("./features/module-amro").then((module) => ({ default: module.AmroAuditPage })));
const AmroIntegration = lazy(() => import("./features/module-amro").then((module) => ({ default: module.AmroIntegrationPage })));
const AmroIntelligence = lazy(() => import("./features/module-amro").then((module) => ({ default: module.AmroIntelligencePage })));
const AmroSettings = lazy(() => import("./features/module-amro").then((module) => ({ default: module.AmroSettingsPage })));
const AmroMasterData = lazy(() => import("./features/module-amro").then((module) => ({ default: module.AmroMasterDataPage })));
const AmroAircraftMasterData = lazy(() => import("./features/module-amro/settings/pages/AmroMasterDataEntityPages").then((module) => ({ default: module.AircraftMasterDataPage })));
const AmroAircraftSubModule = lazy(() => import("./features/module-amro/settings/pages/AmroMasterDataEntityPages").then((module) => ({ default: module.AircraftSubModulePage })));
const AmroAtaCodesMasterData = lazy(() => import("./features/module-amro/settings/pages/AmroMasterDataEntityPages").then((module) => ({ default: module.AtaCodesMasterDataPage })));
const AmroPartsInventoryMasterData = lazy(() => import("./features/module-amro/settings/pages/AmroMasterDataEntityPages").then((module) => ({ default: module.PartsInventoryMasterDataPage })));
const AmroSuppliersMasterData = lazy(() => import("./features/module-amro/settings/pages/AmroMasterDataEntityPages").then((module) => ({ default: module.SuppliersMasterDataPage })));
const AmroMaintenanceFacilitiesMasterData = lazy(() => import("./features/module-amro/settings/pages/AmroMasterDataEntityPages").then((module) => ({ default: module.MaintenanceFacilitiesMasterDataPage })));

// Markets domain (per design doc 2026-05-14 §6.2, ADR-025)
const MarketsTerminal   = lazy(() => import("./features/markets/pages/TerminalPage"));
const MarketsHome       = lazy(() => import("./features/markets/pages/MarketsHomePage"));
const MarketsPortfolios = lazy(() => import("./features/markets/pages/PortfoliosPage"));
const MarketsPortfolioDetail = lazy(() => import("./features/markets/pages/PortfolioDetailPage"));
const MarketsLlmSettings        = lazy(() => import("./features/markets/pages/LlmSettingsPage"));
const MarketsBrokerConnections  = lazy(() => import("./features/markets/pages/BrokerConnectionsPage"));
const MarketsBrokerPortfolio    = lazy(() => import("./features/markets/pages/BrokerPortfolioPage"));
const MarketsWatchlists = lazy(() => import("./features/markets/pages/WatchlistsPage"));
const MarketsWatchlistDetail = lazy(() => import("./features/markets/pages/WatchlistDetailPage"));
const MarketsInstrumentDetail = lazy(() => import("./features/markets/pages/InstrumentDetailPage"));
const MarketsResearch = lazy(() => import("./features/markets/pages/ResearchThreadsPage"));
const MarketsStrategies = lazy(() => import("./features/markets/pages/StrategiesPage"));
const MarketsBacktests = lazy(() => import("./features/markets/pages/BacktestsPage"));
const MarketsSignals = lazy(() => import("./features/markets/pages/SignalsPage"));
const MarketsRetail  = lazy(() => import("./features/markets/pages/RetailModePage"));
const RetailHomeTab      = lazy(() => import("./features/markets/retail/pages/RetailHomePage"));
const RetailPortfolioTab = lazy(() => import("./features/markets/retail/pages/RetailPortfolioPage"));
const RetailPortfolioDetail = lazy(() => import("./features/markets/retail/pages/RetailPortfolioDetailPage"));
const RetailSignalsTab   = lazy(() => import("./features/markets/retail/pages/RetailSignalsPage"));
const RetailGoalsTab     = lazy(() => import("./features/markets/retail/pages/RetailGoalsPage"));
const RetailMoreTab      = lazy(() => import("./features/markets/retail/pages/RetailMorePage"));
const RetailWithdrawTab  = lazy(() => import("./features/markets/retail/pages/RetailWithdrawPage"));
const MarketsFno             = lazy(() => import("./features/markets/pages/FnoPage"));
const MarketsStrategyBuilder = lazy(() => import("./features/markets/pages/StrategyBuilderPage"));
const MarketsMf      = lazy(() => import("./features/markets/pages/MfPage"));
const MarketsAlerts       = lazy(() => import("./features/markets/pages/PriceAlertsPage"));
const MarketsRisk         = lazy(() => import("./features/markets/pages/RiskControlsPage"));
const MarketsCalendar     = lazy(() => import("./features/markets/pages/EconomicCalendarPage"));
const MarketsFiiDii       = lazy(() => import("./features/markets/pages/FiiDiiPage"));
const MarketsScanner        = lazy(() => import("./features/markets/pages/ScannerPage"));
const MarketsSpan           = lazy(() => import("./features/markets/pages/SpanCalculatorPage"));
const MarketsTradeJournal   = lazy(() => import("./features/markets/pages/TradeJournalPage"));
const MarketsIdeas          = lazy(() => import("./features/markets/pages/IdeasPage"));
const MarketsIdeaDetail     = lazy(() => import("./features/markets/pages/IdeaDetailPage"));
const MarketsAIChat         = lazy(() => import("./features/markets/pages/AIChatPage"));
const MarketsCopyTrading    = lazy(() => import("./features/markets/pages/CopyTradingPage"));
const MarketsTaxPnL         = lazy(() => import("./features/markets/pages/TaxPnLPage"));
const MarketsRebalancing    = lazy(() => import("./features/markets/pages/RebalancingPage"));
const MarketsOptionsPayoff  = lazy(() => import("./features/markets/pages/OptionsStrategyPage"));
const MarketsMarketBreadth  = lazy(() => import("./features/markets/pages/MarketBreadthPage"));
// Platform-wide LLM provider settings — same component, reachable from main settings hub.
const PlatformLlmSettings = MarketsLlmSettings;
const FeatureFlagsAdmin = lazy(() => import("./pages/dashboard/settings/FeatureFlagsPage"));
const AmroWorkCentersMasterData = lazy(() => import("./features/module-amro/settings/pages/AmroMasterDataEntityPages").then((module) => ({ default: module.WorkCentersMasterDataPage })));
const AmroSkillCodesMasterData = lazy(() => import("./features/module-amro/settings/pages/AmroMasterDataEntityPages").then((module) => ({ default: module.SkillCodesMasterDataPage })));
const AmroManufacturersMasterData = lazy(() => import("./features/module-amro/settings/pages/AmroMasterDataEntityPages").then((module) => ({ default: module.ManufacturersMasterDataPage })));
const AmroModelMasterData = lazy(() => import("./features/module-amro/settings/pages/AmroMasterDataEntityPages").then((module) => ({ default: module.ModelMasterDataPage })));
const AmroRegulatorProfilesMasterData = lazy(() => import("./features/module-amro/settings/pages/AmroMasterDataEntityPages").then((module) => ({ default: module.RegulatorProfilesMasterDataPage })));
const AmroShiftCalendarsMasterData = lazy(() => import("./features/module-amro/settings/pages/AmroMasterDataEntityPages").then((module) => ({ default: module.ShiftCalendarsMasterDataPage })));
const AmroWorkOrdersMasterData = lazy(() => import("./features/module-amro/settings/pages/AmroMasterDataEntityPages").then((module) => ({ default: module.WorkOrdersMasterDataPage })));
const AmroWorkOrderTemplatesMasterData = lazy(() => import("./features/module-amro/settings/pages/AmroMasterDataEntityPages").then((module) => ({ default: module.WorkOrderTemplatesMasterDataPage })));
const AmroTemplateCatalog = lazy(() => import("./features/module-amro/components/templates/AmroTemplateCatalogPage").then((module) => ({ default: module.AmroTemplateCatalogPage })));
const AmroWorkOrderTemplates = lazy(() => import("./features/module-amro/templates/AmroWorkOrderTemplatesPage").then((module) => ({ default: module.AmroWorkOrderTemplatesPage })));
const AmroWorkspaceDocumentation = lazy(() => import("./features/module-amro").then((module) => ({ default: module.AmroWorkspaceDocumentationPage })));
const AmroDesignSystemShowcase = lazy(() => import("./features/module-amro/components/AmroDesignSystemShowcase").then((module) => ({ default: module.AmroDesignSystemShowcase })));
const MigrationBaselineDashboard = lazy(() => import("./pages/dashboard/MigrationBaselineDashboard"));

// Initialize plugins at startup
try {
  initializePlugins();
} catch (e) {
  logger.error("Failed to initialize plugins:", e);
}

// QueryClient + retail-only persistence layer (T24d).
//
// Defaults: TanStack Query gcTime is 5min, so the persister would evict
// our offline cache faster than we'd want. Bump to 24h so a user who
// opens the app offline after a day still sees their last portfolio
// snapshot. Per-hook staleTime overrides still control freshness.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 24 * 60 * 60 * 1000, // 24h
    },
  },
});

try {
  logger.info('App initialization started', { component: 'App' });
} catch (e) {
  logger.error("Failed to log app initialization:", e);
}

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister: queryPersister,
      // Match the QueryClient gcTime so the persister and the in-memory
      // cache evict on the same timeline.
      maxAge: 24 * 60 * 60 * 1000,
      // Bump when the cache shape changes — old payloads are dropped.
      buster: "v1",
      dehydrateOptions: {
        // Only retail read-paths survive a reload. Trading / order data
        // never persists — stale broker info presented as fresh would be
        // actively misleading.
        shouldDehydrateQuery: (query) => shouldPersistQuery(query.queryKey),
      },
    }}
  >
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <CRMProvider>
          <DomainContextProvider>
            <TenantBrandingProvider>
              <ThemeProvider>
                <TooltipProvider>
                  <SidebarProvider defaultOpen={false}>
                    <StickyActionsProvider>
                      <LeadsViewStateProvider>
                        <PipelineProvider>
                        <Sonner />
                        <OAuthDeepLinkMount />
                        <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
                        <RetailAudienceGuard>
                        <Routes>
            {/* `/` routes by auth state: signed-out → /welcome, signed-in
                → /dashboard. The old Landing page stays available at
                /landing for the future marketing-site graduation path
                (see docs/plans/2026-05-22-unified-platform-onboarding-design.md). */}
            <Route path="/"        element={<RootRedirect />} />
            <Route path="/welcome" element={<WebOnlyRoute><Welcome /></WebOnlyRoute>} />
            <Route path="/landing" element={<WebOnlyRoute><Landing /></WebOnlyRoute>} />
            <Route path="/auth" element={<Auth />} />

            {/* Unified B2B signup (U-A4). /signup picks a domain (logistics
                / markets-advisor); /signup/:domain is the single-form
                wizard that submits to Supabase Auth + dispatcher (see
                supabase/functions/provision-retail-user/index.ts).
                Both wrapped in WebOnlyRoute — the Sthira native shell uses
                /auth?intent=retail (signup toggle) instead. */}
            <Route path="/signup"          element={<WebOnlyRoute><SignupDomainPicker /></WebOnlyRoute>} />
            <Route path="/signup/:domain"  element={<WebOnlyRoute><SignupForm /></WebOnlyRoute>} />

            {/* Legacy /register-organization (the 5-step duplicate-Starter
                page from the 2026-05-22 screenshot). Kept as a redirect so
                any bookmarks / email links still land somewhere useful. */}
            <Route path="/register-organization" element={<Navigate to="/signup" replace />} />
            <Route path="/register-organization-legacy" element={<SelfServiceOnboarding />} />

            {/* Magic-link invite landing (U-B2). Handles signed-in /
                signed-out / wrong-email / expired all in one component. */}
            <Route path="/invite/:token" element={<WebOnlyRoute><InviteAccept /></WebOnlyRoute>} />
            <Route path="/invite"        element={<WebOnlyRoute><Navigate to="/welcome" replace /></WebOnlyRoute>} />
            <Route path="/oauth/callback" element={<OAuthCallback />} />
            {/* Sign-in OAuth callback (Google / Microsoft via Supabase Auth).
                Distinct from /oauth/callback which is the email-account
                connection flow. See
                docs/plans/2026-05-27-google-microsoft-auth-design.md */}
            <Route path="/auth/callback" element={<AuthOAuthCallback />} />
            {/* Login-time membership chooser. Reached automatically from
                RootRedirect when a signed-in user has >=2 memberships and
                no explicit row in public.user_active_membership. See
                docs/plans/2026-05-27-google-microsoft-auth-design.md §4. */}
            <Route path="/auth/choose-account" element={<AuthChooseAccount />} />
            <Route path="/setup-admin" element={<WebOnlyRoute><SetupAdmin /></WebOnlyRoute>} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* Path A Phase 2.2 — manifest-driven routes for the Markets
                domain. Flag-gated for safe rollout; when the flag is ON
                these routes mount BEFORE the hand-declared Markets routes
                below, so they win for matching paths. When the flag is OFF
                (default), nothing renders here and the hand-declared
                section continues to serve everything. Once the manifest
                covers every Markets route, the hand-declared section can
                be deleted and the flag retired. */}
            {USE_DOMAIN_MANIFESTS && buildDomainRoutes(marketsManifest)}

            {/* Sthira mobile onboarding flow (PR 2). Currently opt-in by URL —
                PR 3 will add a router guard that redirects mobile users from
                /dashboard/markets/retail/home to /sthira/splash if onboarding
                steps remain. */}
            <Route path="/sthira/splash"     element={<SthiraSplashRoute />} />
            <Route
              path="/sthira/onboarding"
              element={
                <ProtectedRoute>
                  <SthiraOnboardingRoute />
                </ProtectedRoute>
              }
            />
            {/* /onboarding alias — desktop-browser entry point for the
                self-onboarding wizard. Both URLs render the same shell;
                /sthira/onboarding is the mobile-shell-branded path that
                ships in the APK, /onboarding is the friendlier URL we can
                hand out in email/welcome copy and that the route guard
                redirects to. */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <SthiraOnboardingRoute />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sthira/broker"
              element={
                <ProtectedRoute>
                  <SthiraBrokerRoute />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DomainShellRouter>
                    <DashboardRouter />
                  </DomainShellRouter>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/accounts"
              element={
                <ProtectedRoute
                  requiredPermissions={["accounts.view"]}
                  moduleCode="logistics.accounts"
                  moduleLabel="Accounts"
                >
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
                <ProtectedRoute
                  requiredPermissions={["contacts.view"]}
                  moduleCode="logistics.contacts"
                  moduleLabel="Contacts"
                >
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
                <ProtectedRoute
                  requiredPermissions={["leads.view"]}
                  moduleCode="logistics.leads"
                  moduleLabel="Leads"
                >
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
              path="/dashboard/activities/import-export" 
              element={
                <ProtectedRoute requiredPermissions={["activities.create"]}>
                  <ActivitiesImportExport />
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
                <ProtectedRoute requiredRole={PLATFORM_ADMIN_ROLE} accessDeniedMessage="Access denied - Platform admin privileges required">
                  <Settings />
                </ProtectedRoute>
              }
            />
            {/* Team management — any signed-in member can visit, but writes
                (create / revoke invite) are RLS-gated to tenant_admin /
                platform_admin. See U-B2. */}
            <Route
              path="/dashboard/settings/team"
              element={
                <ProtectedRoute>
                  <TeamSettings />
                </ProtectedRoute>
              }
            />

            {/* Billing & plan — per-tenant plan picker for the active domain.
                Trial start, plan listing, and (post-D2) Razorpay card capture
                all live here. See U-D1. */}
            <Route
              path="/dashboard/settings/billing"
              element={
                <ProtectedRoute>
                  <BillingSettings />
                </ProtectedRoute>
              }
            />

            {/* Branding — per-tenant logo + accent + display name override
                (BR-4). Pre-auth surfaces always show SOS chrome regardless;
                only /dashboard/* surfaces honor the override. Writes are
                RLS-gated to tenant_admin / platform_admin. */}
            <Route
              path="/dashboard/settings/branding"
              element={
                <ProtectedRoute>
                  <BrandingSettings />
                </ProtectedRoute>
              }
            />
            {/* Platform-wide LLM/AI provider configuration (per-tenant). Edge function enforces admin role. */}
            <Route
              path="/dashboard/settings/llm-providers"
              element={
                <ProtectedRoute>
                  <PlatformLlmSettings />
                </ProtectedRoute>
              }
            />
            <Route 
              path="/dashboard/settings/permissions" 
              element={
                <ProtectedRoute requiredRole={PLATFORM_ADMIN_ROLE} accessDeniedMessage="Access denied - Platform admin privileges required">
                  <RolesPermissions />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/security-overview" 
              element={
                <ProtectedRoute requiredRole={PLATFORM_ADMIN_ROLE} accessDeniedMessage="Access denied - Platform admin privileges required">
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
                <ProtectedRoute requiredRole={PLATFORM_ADMIN_ROLE} accessDeniedMessage="Access denied - Platform admin privileges required">
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
              path="/dashboard/tenant-branding"
              element={
                <ProtectedRoute>
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
                <ProtectedRoute
                  requiredPermissions={["opportunities.view"]}
                  moduleCode="logistics.opportunities"
                  moduleLabel="Opportunities"
                >
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
              path="/dashboard/opportunities/import-export" 
              element={
                <ProtectedRoute requiredPermissions={["opportunities.create"]}>
                  <OpportunitiesImportExport />
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
                <ProtectedRoute requiredPermissions={["quotes.view"]}>
                  <Quotes />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/quotes/import-export" 
              element={
                <ProtectedRoute requiredPermissions={["quotes.import_export"]}>
                  <QuotesImportExport />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/quotes/pipeline" 
              element={
                <ProtectedRoute requiredPermissions={["quotes.view"]}>
                  <QuotesPipeline />
                </ProtectedRoute>
              } 
            />
            <Route
              path="/dashboard/quotes/analytics"
              element={
                <ProtectedRoute requiredPermissions={["quotes.analytics"]}>
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
                <ProtectedRoute requiredPermissions={["quotes.create"]}>
                  <QuoteNew />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/quotes/:id" 
              element={
                <ProtectedRoute requiredPermissions={["quotes.view"]}>
                  <QuoteDetail />
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
              path="/dashboard/onboarding-operations" 
              element={
                <ProtectedRoute requiredRole="platform_admin" requiredPermissions={["admin.settings.manage"]}>
                  <OnboardingOperations />
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
                <ProtectedRoute requiredPermissions={["email.manage"]}>
                  <EmailManagement />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/communications-hub" 
              element={
                <ProtectedRoute requiredPermissions={["email.manage"]}>
                  <CommunicationsHub />
                </ProtectedRoute>
              } 
            />
            <Route
              path="/dashboard/settings/channel-integrations"
              element={
                <ProtectedRoute requiredRole={PLATFORM_ADMIN_ROLE} accessDeniedMessage="Access denied - Platform admin privileges required">
                  <ChannelIntegrations />
                </ProtectedRoute>
              }
            />
            <Route 
              path="/dashboard/themes" 
              element={
                <ProtectedRoute requiredRole={PLATFORM_ADMIN_ROLE} accessDeniedMessage="Access denied - Platform admin privileges required">
                  <ThemeManagement />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/dashboard/ui-forms-demo" 
              element={
                <ProtectedRoute requiredRole={PLATFORM_ADMIN_ROLE} accessDeniedMessage="Access denied - Platform admin privileges required">
                  <UIDemoForms />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/dashboard/ui-advanced-demo" 
              element={
                <ProtectedRoute requiredRole={PLATFORM_ADMIN_ROLE} accessDeniedMessage="Access denied - Platform admin privileges required">
                  <UIDemoAdvanced />
                </ProtectedRoute>
              } 
            />

            {/* Settings-scoped Subscription route */}
            <Route 
              path="/dashboard/settings/subscription" 
              element={
                <ProtectedRoute requiredRole={PLATFORM_ADMIN_ROLE} accessDeniedMessage="Access denied - Platform admin privileges required">
                  <SubscriptionManagement />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/settings/quote-numbers" 
              element={<ProtectedRoute requiredRole={PLATFORM_ADMIN_ROLE} accessDeniedMessage="Access denied - Platform admin privileges required"><QuoteNumberSettings /></ProtectedRoute>} 
            />
            <Route 
              path="/dashboard/settings/quotations" 
              element={<ProtectedRoute requiredRole={PLATFORM_ADMIN_ROLE} accessDeniedMessage="Access denied - Platform admin privileges required"><QuotationSettings /></ProtectedRoute>} 
            />
            {/* Settings → Data Management */}
            <Route
              path="/dashboard/settings/data-management"
              element={<ProtectedRoute requiredRole={PLATFORM_ADMIN_ROLE} accessDeniedMessage="Access denied - Platform admin privileges required"><DataManagement /></ProtectedRoute>}
            />
            <Route
              path="/dashboard/admin/llm-gateway"
              element={<ProtectedRoute requiredRole={PLATFORM_ADMIN_ROLE} accessDeniedMessage="Access denied - Platform admin privileges required"><LlmGatewayAdminPage /></ProtectedRoute>}
            />
            <Route
              path="/dashboard/admin/whatsapp-phones"
              element={<ProtectedRoute requiredRole={PLATFORM_ADMIN_ROLE} accessDeniedMessage="Access denied - Platform admin privileges required"><WhatsappPhonesPage /></ProtectedRoute>}
            />
            <Route 
              path="/dashboard/settings/domains" 
              element={<ProtectedRoute requiredRole={PLATFORM_ADMIN_ROLE} accessDeniedMessage="Access denied - Platform admin privileges required"><PlatformDomains /></ProtectedRoute>} 
            />
            <Route 
              path="/dashboard/settings/domains/:id" 
              element={<ProtectedRoute requiredRole={PLATFORM_ADMIN_ROLE} accessDeniedMessage="Access denied - Platform admin privileges required"><PlatformDomainDetail /></ProtectedRoute>} 
            />
            <Route
              path="/dashboard/platform-domains"
              element={
                <ProtectedRoute requiredRole={PLATFORM_ADMIN_ROLE} accessDeniedMessage="Access denied - Platform admin privileges required">
                  <PlatformDomains />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/platform-domains/:id"
              element={
                <ProtectedRoute requiredRole={PLATFORM_ADMIN_ROLE} accessDeniedMessage="Access denied - Platform admin privileges required">
                  <PlatformDomainDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/business-domain-assignments"
              element={
                <ProtectedRoute requiredRole={PLATFORM_ADMIN_ROLE} accessDeniedMessage="Access denied - Platform admin privileges required">
                  <PlatformDomains />
                </ProtectedRoute>
              }
            />
            <Route 
              path="/dashboard/settings/database-export" 
              element={<ProtectedRoute requiredRole={PLATFORM_ADMIN_ROLE} accessDeniedMessage="Access denied - Platform admin privileges required"><DatabaseExport /></ProtectedRoute>} 
            />
            <Route 
              path="/dashboard/settings/master-data" 
              element={<ProtectedRoute requiredRole={PLATFORM_ADMIN_ROLE} accessDeniedMessage="Access denied - Platform admin privileges required"><MasterDataGeography /></ProtectedRoute>} 
            />
            <Route path="/dashboard/settings/master-data-hts" 
              element={<ProtectedRoute requiredRole={PLATFORM_ADMIN_ROLE} accessDeniedMessage="Access denied - Platform admin privileges required"><MasterDataHTS /></ProtectedRoute>} 
            />
            <Route 
              path="/dashboard/settings/master-data-subscription-plans" 
              element={<ProtectedRoute requiredRole={PLATFORM_ADMIN_ROLE} accessDeniedMessage="Access denied - Platform admin privileges required"><MasterDataSubscriptionPlans /></ProtectedRoute>} 
            />
            {/* Public customer portal */}
            <Route path="/portal/quote/:token" element={<QuotePortal />} />
            {/* Public methodology pages — SEBI-defensible, no auth gate */}
            <Route path="/methodology/volatility" element={<VolatilityMethodology />} />
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
            <Route path="/dashboard/finance/commission-rules" element={<ProtectedRoute requiredPermissions={["finance.commission_rules.manage"]}><CommissionRules /></ProtectedRoute>} />
            <Route path="/dashboard/finance/commissions" element={<ProtectedRoute requiredPermissions={["finance.commissions.view"]}><Commissions /></ProtectedRoute>} />
            <Route path="/dashboard/finance/draft-invoices" element={<ProtectedRoute requiredPermissions={["finance.draft_invoices.view"]}><DraftInvoices /></ProtectedRoute>} />
            <Route path="/dashboard/finance/retry-queue" element={<ProtectedRoute requiredPermissions={["finance.outbox_retries.view"]}><OutboxRetries /></ProtectedRoute>} />
            <Route path="/dashboard/reports" element={<ProtectedRoute requiredPermissions={["reports.view"]}><Reports /></ProtectedRoute>} />
            <Route path="/dashboard/chatter" element={<ProtectedRoute requiredPermissions={["chatter.view"]}><Chatter /></ProtectedRoute>} />
            <Route path="/dashboard/groups" element={<ProtectedRoute requiredPermissions={["groups.view"]}><Groups /></ProtectedRoute>} />
            <Route path="/dashboard/calendar" element={<ProtectedRoute requiredPermissions={["calendar.view"]}><Calendar /></ProtectedRoute>} />
            <Route path="/dashboard/dashboards" element={<ProtectedRoute requiredPermissions={["dashboards.view"]}><Dashboards /></ProtectedRoute>} />
            <Route path="/dashboard/migration-baseline" element={<ProtectedRoute requiredPermissions={["dashboards.view"]}><MigrationBaselineDashboard /></ProtectedRoute>} />
            <Route path="/dashboard/crm-workspace" element={<ProtectedRoute requiredPermissions={["dashboards.view", "leads.view"]}><CRMWorkspace /></ProtectedRoute>} />
            <Route path="/dashboard/leads-workspace" element={<Navigate to="/dashboard/leads/pipeline" replace />} />
            <Route path="/dashboard/more" element={<ProtectedRoute><More /></ProtectedRoute>} />
            <Route path="/dashboard/settings/permissions" element={<ProtectedRoute requiredRole={PLATFORM_ADMIN_ROLE} accessDeniedMessage="Access denied - Platform admin privileges required"><PermissionsMatrix /></ProtectedRoute>} />
            <Route path="/dashboard/audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
            <Route path="/dashboard/security-incidents" element={<ProtectedRoute><SecurityIncidents /></ProtectedRoute>} />
            <Route path="/dashboard/settings/custom-roles" element={<ProtectedRoute requiredRole={PLATFORM_ADMIN_ROLE} accessDeniedMessage="Access denied - Platform admin privileges required"><CustomRoles /></ProtectedRoute>} />
            <Route path="/dashboard/charge-categories" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><ChargeCategories /></ProtectedRoute>} />
            <Route path="/dashboard/charge-bases" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><ChargeBases /></ProtectedRoute>} />
            <Route path="/dashboard/currencies" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><Currencies /></ProtectedRoute>} />
            <Route path="/dashboard/finance/invoices" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><Invoices /></ProtectedRoute>} />
            <Route path="/dashboard/finance/margin-rules" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><MarginRules /></ProtectedRoute>} />
            <Route path="/dashboard/finance/invoices/:id" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><InvoiceDetail /></ProtectedRoute>} />
            <Route path="/dashboard/finance/tax-jurisdictions" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><TaxJurisdictions /></ProtectedRoute>} />
            <Route path="/dashboard/finance/tax-jurisdictions/:id" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><TaxJurisdictionDetail /></ProtectedRoute>} />
            <Route path="/dashboard/finance/accounting-setup" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><FinanceAccountingSetup /></ProtectedRoute>} />
            <Route path="/dashboard/amro/aog" element={<ProtectedRoute requiredPermissions={["amro.read"]}><AogAlertsList /></ProtectedRoute>} />
            <Route path="/dashboard/amro/aog/:id" element={<ProtectedRoute requiredPermissions={["amro.read"]}><AogAlertDetail /></ProtectedRoute>} />
            <Route path="/dashboard/amro/directives/applicability/queue" element={<ProtectedRoute requiredPermissions={["amro.read"]}><DirectiveApplicabilityQueue /></ProtectedRoute>} />
            <Route path="/dashboard/amro/directives/:id" element={<ProtectedRoute requiredPermissions={["amro.read"]}><AmroDirectiveDetail /></ProtectedRoute>} />
            <Route path="/dashboard/amro/aircraft/:id/applicability" element={<ProtectedRoute requiredPermissions={["amro.read"]}><AmroAircraftApplicability /></ProtectedRoute>} />
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
            <Route path="/dashboard/shipments" element={<ProtectedRoute moduleCode="logistics.shipments" moduleLabel="Shipments"><Shipments /></ProtectedRoute>} />
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
            <Route path="/dashboard/carriers" element={<ProtectedRoute moduleCode="logistics.carriers" moduleLabel="Carriers"><Carriers /></ProtectedRoute>} />
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
             <Route path="/dashboard/compliance/officer" element={<ProtectedRoute requiredPermissions={["compliance.officer.view"]}><ComplianceOfficerInbox /></ProtectedRoute>} />
             <Route path="/dashboard/compliance/screenings/:id" element={<ProtectedRoute requiredPermissions={["compliance.officer.view"]}><ComplianceScreeningDetail /></ProtectedRoute>} />
             <Route path="/dashboard/services" element={<ProtectedRoute><Services /></ProtectedRoute>} />
             <Route path="/dashboard/service-type-mappings" element={<ProtectedRoute><ServiceTypeMappings /></ProtectedRoute>} />
            {/* Subscription & Billing Routes */}
            <Route path="/dashboard/subscriptions" element={<ProtectedRoute><SubscriptionManagement /></ProtectedRoute>} />
            <Route path="/dashboard/tenant-subscriptions" element={<ProtectedRoute requiredPermissions={["admin.settings.manage"]}><TenantSubscription /></ProtectedRoute>} />
            <Route path="/dashboard/billing/invoices/:id" element={<ProtectedRoute><BillingInvoiceDetail /></ProtectedRoute>} />
            <Route path="/dashboard/log-test" element={<ProtectedRoute><LogTestPage /></ProtectedRoute>} />
            <Route path="/dashboard/debug-console" element={<ProtectedRoute><DebugConsole /></ProtectedRoute>} />
            <Route path="/dashboard/amro" element={<Navigate to="/dashboard/amro/overview" replace />} />
            <Route path="/dashboard/amro/overview" element={<ProtectedRoute requiredModule="amro"><AmroOverview /></ProtectedRoute>} />
            <Route path="/dashboard/amro/aircraft" element={<ProtectedRoute requiredModule="amro" requiredPermissions={["edit_aircraft_records"]}><AmroAircraftSubModule /></ProtectedRoute>} />
            <Route path="/dashboard/amro/aircraft/:view" element={<ProtectedRoute requiredModule="amro" requiredPermissions={["edit_aircraft_records"]}><AmroAircraftSubModule /></ProtectedRoute>} />
            <Route path="/dashboard/amro/plan-directives-bulletin" element={<ProtectedRoute requiredModule="amro" requiredPermissions={["edit_aircraft_records"]}><AmroPlanDirectivesBulletin /></ProtectedRoute>} />
            <Route path="/dashboard/amro/plan-directives-bulletin/mpd" element={<ProtectedRoute requiredModule="amro" requiredPermissions={["edit_aircraft_records"]}><AmroMpdManagement /></ProtectedRoute>} />
            <Route path="/dashboard/amro/plan-directives-bulletin/configure_mpd" element={<ProtectedRoute requiredModule="amro" requiredPermissions={["edit_aircraft_records"]}><AmroConfigureMpdManagement /></ProtectedRoute>} />
            <Route path="/dashboard/amro/plan-directives-bulletin/configure_directives" element={<ProtectedRoute requiredModule="amro" requiredPermissions={["edit_aircraft_records"]}><AmroConfigureDirectivesManagement /></ProtectedRoute>} />
            <Route path="/dashboard/amro/plan-directives-bulletin/directives" element={<ProtectedRoute requiredModule="amro" requiredPermissions={["edit_aircraft_records"]}><AmroDirectivesManagement /></ProtectedRoute>} />
            <Route path="/dashboard/amro/aircraft/work-orders" element={<ProtectedRoute requiredModule="amro"><AmroWorkOrders /></ProtectedRoute>} />
            <Route path="/dashboard/amro/work-orders" element={<ProtectedRoute requiredModule="amro"><AmroWorkOrders /></ProtectedRoute>} />
            <Route path="/dashboard/amro/work-orders/:id" element={<ProtectedRoute requiredModule="amro"><AmroWorkOrderDetail /></ProtectedRoute>} />
            <Route path="/dashboard/amro/work-orders" element={<Navigate to="/dashboard/amro/work-orders" replace />} />
            <Route path="/dashboard/amro/work-orders/:id" element={<Navigate to="/dashboard/amro/work-orders" replace />} />
            <Route path="/dashboard/amro/task-execution" element={<ProtectedRoute requiredModule="amro"><AmroTaskExecution /></ProtectedRoute>} />
            <Route path="/dashboard/amro/scheduling" element={<ProtectedRoute requiredModule="amro"><AmroScheduling /></ProtectedRoute>} />
            <Route path="/dashboard/amro/parts" element={<ProtectedRoute requiredModule="amro"><AmroParts /></ProtectedRoute>} />
            <Route path="/dashboard/amro/compliance" element={<ProtectedRoute requiredModule="amro"><AmroCompliance /></ProtectedRoute>} />
            <Route path="/dashboard/amro/certification" element={<ProtectedRoute requiredModule="amro"><AmroCertification /></ProtectedRoute>} />
            <Route path="/dashboard/amro/audit" element={<ProtectedRoute requiredModule="amro"><AmroAudit /></ProtectedRoute>} />
            <Route path="/dashboard/amro/integration" element={<ProtectedRoute requiredModule="amro"><AmroIntegration /></ProtectedRoute>} />
            <Route path="/dashboard/amro/intelligence" element={<ProtectedRoute requiredModule="amro"><AmroIntelligence /></ProtectedRoute>} />
            <Route path="/dashboard/amro/settings" element={<ProtectedRoute requiredModule="amro" requiredPermissions={["edit_aircraft_records"]}><AmroSettings /></ProtectedRoute>} />
            <Route path="/dashboard/amro/settings/master-data" element={<ProtectedRoute requiredModule="amro" requiredPermissions={["edit_aircraft_records"]}><Navigate to="/dashboard/amro/settings/master-data/aircraft" replace /></ProtectedRoute>} />
            <Route path="/dashboard/amro/settings/master-data/aircraft" element={<ProtectedRoute requiredModule="amro" requiredPermissions={["edit_aircraft_records"]}><AmroAircraftMasterData /></ProtectedRoute>} />
            <Route path="/dashboard/amro/settings/master-data/ata-codes" element={<ProtectedRoute requiredModule="amro" requiredPermissions={["edit_aircraft_records"]}><AmroAtaCodesMasterData /></ProtectedRoute>} />
            <Route path="/dashboard/amro/settings/master-data/parts-inventory" element={<ProtectedRoute requiredModule="amro" requiredPermissions={["edit_aircraft_records"]}><AmroPartsInventoryMasterData /></ProtectedRoute>} />
            <Route path="/dashboard/amro/settings/master-data/suppliers" element={<ProtectedRoute requiredModule="amro" requiredPermissions={["edit_aircraft_records"]}><AmroSuppliersMasterData /></ProtectedRoute>} />
            <Route path="/dashboard/amro/settings/master-data/maintenance-facilities" element={<ProtectedRoute requiredModule="amro" requiredPermissions={["edit_aircraft_records"]}><AmroMaintenanceFacilitiesMasterData /></ProtectedRoute>} />
            <Route path="/dashboard/amro/settings/master-data/work-centers" element={<ProtectedRoute requiredModule="amro" requiredPermissions={["edit_aircraft_records"]}><AmroWorkCentersMasterData /></ProtectedRoute>} />
            <Route path="/dashboard/amro/settings/master-data/skill-codes" element={<ProtectedRoute requiredModule="amro" requiredPermissions={["edit_aircraft_records"]}><AmroSkillCodesMasterData /></ProtectedRoute>} />
            <Route path="/dashboard/amro/settings/master-data/manufacturers" element={<ProtectedRoute requiredModule="amro" requiredPermissions={["edit_aircraft_records"]}><AmroManufacturersMasterData /></ProtectedRoute>} />
            <Route path="/dashboard/amro/settings/master-data/model" element={<ProtectedRoute requiredModule="amro" requiredPermissions={["edit_aircraft_records"]}><AmroModelMasterData /></ProtectedRoute>} />
            <Route path="/dashboard/amro/settings/master-data/regulator-profiles" element={<ProtectedRoute requiredModule="amro" requiredPermissions={["edit_aircraft_records"]}><AmroRegulatorProfilesMasterData /></ProtectedRoute>} />
            <Route path="/dashboard/amro/settings/master-data/shift-calendars" element={<ProtectedRoute requiredModule="amro" requiredPermissions={["edit_aircraft_records"]}><AmroShiftCalendarsMasterData /></ProtectedRoute>} />
            <Route path="/dashboard/amro/settings/master-data/work-orders" element={<ProtectedRoute requiredModule="amro" requiredPermissions={["edit_aircraft_records"]}><AmroWorkOrdersMasterData /></ProtectedRoute>} />
            <Route path="/dashboard/amro/settings/master-data/work-order-templates" element={<ProtectedRoute requiredModule="amro" requiredPermissions={["edit_aircraft_records"]}><AmroWorkOrderTemplatesMasterData /></ProtectedRoute>} />
            <Route path="/dashboard/amro/settings/work-order-templates" element={<ProtectedRoute requiredModule="amro" requiredPermissions={["edit_aircraft_records"]}><AmroTemplateCatalog /></ProtectedRoute>} />
            <Route path="/dashboard/amro/settings/work-order-templates/new" element={<ProtectedRoute requiredModule="amro" requiredPermissions={["edit_aircraft_records"]}><AmroWorkOrderTemplatesMasterData /></ProtectedRoute>} />
            <Route path="/dashboard/amro/settings/work-order-templates/:id" element={<ProtectedRoute requiredModule="amro" requiredPermissions={["edit_aircraft_records"]}><AmroWorkOrderTemplatesMasterData /></ProtectedRoute>} />
            {/* Enterprise Work Package Templates Module */}
            <Route path="/dashboard/amro/templates" element={<ProtectedRoute requiredModule="amro" requiredPermissions={["edit_aircraft_records"]}><AmroWorkOrderTemplates /></ProtectedRoute>} />
            <Route path="/dashboard/amro/settings/master-data/:entity" element={<ProtectedRoute requiredModule="amro" requiredPermissions={["edit_aircraft_records"]}><AmroMasterData /></ProtectedRoute>} />
            <Route path="/dashboard/amro/master-data" element={<ProtectedRoute requiredModule="amro"><Navigate to="/dashboard/amro/settings/master-data/aircraft" replace /></ProtectedRoute>} />
            <Route path="/dashboard/amro/workspace-documentation" element={<ProtectedRoute requiredModule="amro"><AmroWorkspaceDocumentation /></ProtectedRoute>} />
            <Route path="/dashboard/amro/design-system-showcase" element={<ProtectedRoute requiredModule="amro"><AmroDesignSystemShowcase /></ProtectedRoute>} />
            <Route path="/dashboard/amro/changes" element={<Navigate to="/dashboard/amro/work-orders" replace />} />

            {/* Markets domain (Multi-Asset Trading Platform) — per design doc 2026-05-14 */}
            <Route path="/dashboard/markets/terminal" element={<ProtectedRoute requiredModule="markets"><MarketsTerminal /></ProtectedRoute>} />
            <Route path="/dashboard/markets" element={<ProtectedRoute requiredModule="markets"><MarketsHome /></ProtectedRoute>} />
            <Route path="/dashboard/markets/portfolios" element={<ProtectedRoute requiredModule="markets"><MarketsPortfolios /></ProtectedRoute>} />
            <Route path="/dashboard/markets/portfolios/:id" element={<ProtectedRoute requiredModule="markets"><MarketsPortfolioDetail /></ProtectedRoute>} />
            <Route path="/dashboard/markets/watchlists" element={<ProtectedRoute requiredModule="markets"><MarketsWatchlists /></ProtectedRoute>} />
            <Route path="/dashboard/markets/watchlists/:id" element={<ProtectedRoute requiredModule="markets"><MarketsWatchlistDetail /></ProtectedRoute>} />
            <Route path="/dashboard/markets/instruments/:id" element={<ProtectedRoute requiredModule="markets"><MarketsInstrumentDetail /></ProtectedRoute>} />
            <Route path="/dashboard/markets/research" element={<ProtectedRoute requiredModule="markets"><MarketsResearch /></ProtectedRoute>} />
            <Route path="/dashboard/markets/strategies" element={<ProtectedRoute requiredModule="markets"><MarketsStrategies /></ProtectedRoute>} />
            <Route path="/dashboard/markets/backtests" element={<ProtectedRoute requiredModule="markets"><MarketsBacktests /></ProtectedRoute>} />
            <Route path="/dashboard/markets/signals" element={<ProtectedRoute requiredModule="markets"><MarketsSignals /></ProtectedRoute>} />
            <Route path="/dashboard/markets/retail" element={<ProtectedRoute requiredModule="markets"><MarketsRetail /></ProtectedRoute>}>
              <Route index             element={<Navigate to="home" replace />} />
              <Route path="home"       element={<SthiraMobileGuard fallback={<RetailHomeTab />} />} />
              <Route path="portfolio"               element={<RetailPortfolioTab />} />
              <Route path="portfolio/:portfolioId"  element={<RetailPortfolioDetail />} />
              <Route path="signals"    element={<RetailSignalsTab />} />
              <Route path="goals"      element={<RetailGoalsTab />} />
              <Route path="more"       element={<RetailMoreTab />} />
              <Route path="withdraw"   element={<RetailWithdrawTab />} />
            </Route>
            <Route path="/dashboard/markets/settings/llm" element={<ProtectedRoute requiredModule="markets"><MarketsLlmSettings /></ProtectedRoute>} />
            <Route path="/dashboard/markets/settings/brokers" element={<ProtectedRoute requiredModule="markets"><MarketsBrokerConnections /></ProtectedRoute>} />
            <Route path="/dashboard/markets/settings/brokers/:connectionId" element={<ProtectedRoute requiredModule="markets"><MarketsBrokerPortfolio /></ProtectedRoute>} />
            <Route path="/dashboard/markets/fno" element={<ProtectedRoute requiredModule="markets"><MarketsFno /></ProtectedRoute>} />
            <Route path="/dashboard/markets/strategy-builder" element={<ProtectedRoute requiredModule="markets"><MarketsStrategyBuilder /></ProtectedRoute>} />
            <Route path="/dashboard/markets/mf" element={<ProtectedRoute requiredModule="markets"><MarketsMf /></ProtectedRoute>} />
            <Route path="/dashboard/markets/alerts" element={<ProtectedRoute requiredModule="markets"><MarketsAlerts /></ProtectedRoute>} />
            <Route path="/dashboard/markets/risk" element={<ProtectedRoute requiredModule="markets"><MarketsRisk /></ProtectedRoute>} />
            <Route path="/dashboard/markets/calendar" element={<ProtectedRoute requiredModule="markets"><MarketsCalendar /></ProtectedRoute>} />
            <Route path="/dashboard/markets/fii-dii" element={<ProtectedRoute requiredModule="markets"><MarketsFiiDii /></ProtectedRoute>} />
            <Route path="/dashboard/markets/scanner" element={<ProtectedRoute requiredModule="markets"><MarketsScanner /></ProtectedRoute>} />
            <Route path="/dashboard/markets/span" element={<ProtectedRoute requiredModule="markets"><MarketsSpan /></ProtectedRoute>} />
            <Route path="/dashboard/markets/journal" element={<ProtectedRoute requiredModule="markets"><MarketsTradeJournal /></ProtectedRoute>} />
            <Route path="/dashboard/markets/ideas" element={<ProtectedRoute requiredModule="markets"><MarketsIdeas /></ProtectedRoute>} />
            <Route path="/dashboard/markets/ideas/:id" element={<ProtectedRoute requiredModule="markets"><MarketsIdeaDetail /></ProtectedRoute>} />
            <Route path="/dashboard/markets/ai-chat" element={<ProtectedRoute requiredModule="markets"><MarketsAIChat /></ProtectedRoute>} />
            <Route path="/dashboard/markets/copy-trading" element={<ProtectedRoute requiredModule="markets"><MarketsCopyTrading /></ProtectedRoute>} />
            <Route path="/dashboard/markets/portfolios/:id/tax" element={<ProtectedRoute requiredModule="markets"><MarketsTaxPnL /></ProtectedRoute>} />
            <Route path="/dashboard/markets/portfolios/:id/rebalancing" element={<ProtectedRoute requiredModule="markets"><MarketsRebalancing /></ProtectedRoute>} />
            <Route path="/dashboard/markets/options-payoff" element={<ProtectedRoute requiredModule="markets"><MarketsOptionsPayoff /></ProtectedRoute>} />
            <Route path="/dashboard/markets/breadth" element={<ProtectedRoute requiredModule="markets"><MarketsMarketBreadth /></ProtectedRoute>} />
            <Route path="/dashboard/settings/feature-flags" element={<ProtectedRoute requiredRole={PLATFORM_ADMIN_ROLE} accessDeniedMessage="Access denied - Platform admin privileges required"><FeatureFlagsAdmin /></ProtectedRoute>} />

            {/* Sales Dashboard Routes */}
            <Route path="/dashboard/sales/command-center" element={<ProtectedRoute><SalesCommandCenter /></ProtectedRoute>} />
            <Route path="/dashboard/sales" element={<ProtectedRoute><SalesPlaceholder /></ProtectedRoute>} />
            <Route path="/dashboard/sales/performance" element={<ProtectedRoute><SalesPlaceholder /></ProtectedRoute>} />
            <Route path="/dashboard/orders" element={<ProtectedRoute><SalesPlaceholder /></ProtectedRoute>} />
            <Route path="/dashboard/team" element={<ProtectedRoute><SalesPlaceholder /></ProtectedRoute>} />
            <Route path="/dashboard/invoicing/orders" element={<ProtectedRoute><SalesPlaceholder /></ProtectedRoute>} />
            <Route path="/dashboard/reports/sales" element={<ProtectedRoute><SalesPlaceholder /></ProtectedRoute>} />
            <Route path="/dashboard/reports/reps" element={<ProtectedRoute><SalesPlaceholder /></ProtectedRoute>} />
            <Route path="/dashboard/settings/teams" element={<ProtectedRoute requiredRole={PLATFORM_ADMIN_ROLE} accessDeniedMessage="Access denied - Platform admin privileges required"><SalesPlaceholder /></ProtectedRoute>} />
            <Route path="/dashboard/settings/activities" element={<ProtectedRoute requiredRole={PLATFORM_ADMIN_ROLE} accessDeniedMessage="Access denied - Platform admin privileges required"><SalesPlaceholder /></ProtectedRoute>} />
            <Route path="/dashboard/uim" element={<ProtectedRoute requiredPermissions={["uim.read"]}><UimShell /></ProtectedRoute>} />
            <Route path="/dashboard/uim/item-master" element={<ProtectedRoute requiredPermissions={["uim.read"]}><UimShell /></ProtectedRoute>} />
            <Route path="/dashboard/uim/stock-ledger" element={<ProtectedRoute requiredPermissions={["uim.read"]}><UimShell /></ProtectedRoute>} />
            <Route path="/dashboard/uim/reservations" element={<ProtectedRoute requiredPermissions={["uim.read"]}><UimShell /></ProtectedRoute>} />
            <Route path="/dashboard/uim/issue-consume" element={<ProtectedRoute requiredPermissions={["uim.read"]}><UimShell /></ProtectedRoute>} />
            <Route path="/dashboard/uim/restock" element={<ProtectedRoute requiredPermissions={["uim.read"]}><UimShell /></ProtectedRoute>} />
            <Route path="/dashboard/uim/locations" element={<ProtectedRoute requiredPermissions={["uim.read"]}><UimShell /></ProtectedRoute>} />
            <Route path="/dashboard/uim/analytics" element={<ProtectedRoute requiredPermissions={["uim.read"]}><UimShell /></ProtectedRoute>} />
            
            <Route path="*" element={<NotFound />} />
                        </Routes>
                        </RetailAudienceGuard>
                      </Suspense>
                      </PipelineProvider>
                    </LeadsViewStateProvider>
                  </StickyActionsProvider>
                </SidebarProvider>
              </TooltipProvider>
              </ThemeProvider>
            </TenantBrandingProvider>
          </DomainContextProvider>
        </CRMProvider>
      </AuthProvider>
    </BrowserRouter>
  </PersistQueryClientProvider>
);

export default App;
