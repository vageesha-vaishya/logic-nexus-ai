import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCRM } from "@/hooks/useCRM";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { QuotesKanbanBoard } from "@/components/sales/kanban/QuotesKanbanBoard";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CalendarDays, CheckSquare, ChevronLeft, ChevronRight, Download, RefreshCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Quote, QuoteStatus, stages, statusConfig } from "./quotes-data";
import { logger } from "@/lib/logger";
import { QuotationDeleteService } from "@/services/quotation/QuotationDeleteService";
import { useDomain } from "@/contexts/DomainContext";
import { DomainQuotationIsolationService } from "@/services/quotation/DomainQuotationIsolationService";
import { KanbanFilters } from "@/components/kanban/KanbanFilters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCRMModuleNavigationState } from "@/hooks/useCRMModuleNavigationState";
import { themeStyleFromPreset } from "@/lib/theme-utils";
import { CRM_HEADER_PRIMARY_CONTROL_SEQUENCE, CRMModuleHeaderNavigation } from "@/components/crm/CRMModuleHeaderNavigation";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exportCsv, exportExcel } from "@/lib/import-export";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, CartesianGrid, LineChart, Line } from "recharts";
import { format } from "date-fns";
import { FeatureErrorBoundary } from "@/components/FeatureErrorBoundary";
import { useTranslation } from "react-i18next";
import { CrmFallbackReason, resolveCrmFallbackBannerCopy } from "./leadsListUtils";

type PipelineView = "board" | "analytics";

type AnalyticsSnapshot = {
  averageValue: number;
  acceptanceRate: number;
  statusDistribution: Array<{ name: string; value: number; color: string }>;
  monthlyTrend: Array<{ month: string; quotes: number; value: number }>;
  statusValue: Array<{ stage: string; value: number }>;
};

const ANALYTICS_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#14b8a6", "#f97316", "#6366f1"];

export default function QuotationManager() {
  const { t } = useTranslation();
  const { scopedDb } = useCRM();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const { currentDomain } = useDomain();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme, setViewMode } = useCRMModuleNavigationState("quotes", {
    viewMode: "pipeline",
    theme: "Azure Sky",
  });
  const [currentView, setCurrentView] = useState<PipelineView>(() =>
    location.pathname.endsWith("/analytics") ? "analytics" : "board"
  );
  const [allQuotes, setAllQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDbFallbackActive, setIsDbFallbackActive] = useState(false);
  const [dbFallbackReason, setDbFallbackReason] = useState<CrmFallbackReason | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<QuoteStatus[]>([...stages]);
  const [pagination, setPagination] = useState({
    current: 1,
    total: 0,
    pageSize: 20,
  });
  const [selectedQuotes, setSelectedQuotes] = useState<Set<string>>(new Set());
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [analyticsFromDate, setAnalyticsFromDate] = useState("");
  const [analyticsToDate, setAnalyticsToDate] = useState("");
  const [analyticsStatuses, setAnalyticsStatuses] = useState<QuoteStatus[]>([...stages]);
  const quotationDeleteService = useMemo(() => new QuotationDeleteService(scopedDb), [scopedDb]);
  const domainIsolationService = useMemo(() => new DomainQuotationIsolationService(), []);
  const analyticsCacheRef = useRef<Map<string, AnalyticsSnapshot>>(new Map());
  const canDeleteQuotes = hasPermission("quotes.delete");
  const canViewAnalytics = hasPermission("quotes.analytics") || hasPermission("reports.view") || hasPermission("dashboards.view");
  const fallbackBannerText = useMemo(() => {
    const copy = resolveCrmFallbackBannerCopy("quotes", dbFallbackReason);
    return t(copy.key);
  }, [dbFallbackReason, t]);

  const filteredQuotes = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return allQuotes.filter((quote) => {
      const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(quote.status);
      if (!matchesStatus) return false;
      if (!normalizedQuery) return true;
      const searchable = [
        quote.quote_number,
        quote.title,
        quote.status,
        statusConfig[quote.status]?.label,
        quote.accounts?.name,
        quote.opportunities?.name,
        quote.contacts ? `${quote.contacts.first_name} ${quote.contacts.last_name}` : "",
        quote.valid_until,
        String(quote.sell_price ?? ""),
        String(quote.cost_price ?? ""),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [allQuotes, searchQuery, selectedStatuses]);

  const paginatedQuotes = useMemo(() => {
    const from = (pagination.current - 1) * pagination.pageSize;
    const to = from + pagination.pageSize;
    return filteredQuotes.slice(from, to);
  }, [filteredQuotes, pagination.current, pagination.pageSize]);

  const quotes = paginatedQuotes;

  const fetchQuotes = useCallback(async () => {
    let pluginHooksEnabled = false;
    try {
      setLoading(true);
      setError(null);
      setIsDbFallbackActive(false);
      setDbFallbackReason(null);
      if (currentDomain?.code) {
        try {
          domainIsolationService.ensurePluginIsolation(currentDomain.code);
          pluginHooksEnabled = true;
          domainIsolationService.runPluginHook(currentDomain.code, "beforeFetch", {
            domainId: currentDomain.id,
            searchQuery: "",
            filterCount: 0,
          });
        } catch (hookError) {
          logger.warn("Skipping quotation plugin hooks for domain fetch", hookError);
        }
      }

      let scopedQuoteIds: string[] | null = null;
      let query = scopedDb
        .from("quotes")
        .select(
          `
          *,
          account:accounts (id, name),
          opportunity:opportunities!quotes_opportunity_id_fkey (id, name),
          contact:contacts!quotes_contact_id_fkey (first_name, last_name)
        `,
          { count: "exact" }
        );

      if (currentDomain?.id) {
        scopedQuoteIds = await domainIsolationService.resolveQuoteIdsForDomain(scopedDb as any, currentDomain.id);
        if (!scopedQuoteIds.length) {
          setAllQuotes([]);
          if (currentDomain.code && pluginHooksEnabled) {
            domainIsolationService.runPluginHook(currentDomain.code, "afterFetch", {
              domainId: currentDomain.id,
              quoteCount: 0,
            });
          }
          return;
        }
        query = query.in("id", scopedQuoteIds);
      }

      query = query.order("created_at", { ascending: false });

      const { data: relationData, error: relationError } = await query;
      let data = relationData;
      if (relationError) {
        logger.warn("Primary quotations query with relations failed; using fallback query", relationError);
        let fallbackQuery = scopedDb.from("quotes").select("*", { count: "exact" });
        if (scopedQuoteIds && scopedQuoteIds.length > 0) {
          fallbackQuery = fallbackQuery.in("id", scopedQuoteIds);
        }
        fallbackQuery = fallbackQuery.order("created_at", { ascending: false });
        const { data: fallbackData, error: fallbackError } = await fallbackQuery;
        if (fallbackError) throw fallbackError;
        data = fallbackData;
        setIsDbFallbackActive(true);
        setDbFallbackReason("relations_query_failed");
      }

      const transformedData: Quote[] = (data || []).map((item: any) => ({
        ...item,
        accounts: item.account ? { name: item.account.name } : null,
        opportunities: item.opportunity ? { name: item.opportunity.name } : null,
        contacts: item.contact ? { first_name: item.contact.first_name, last_name: item.contact.last_name } : null,
      }));

      setAllQuotes(transformedData);
      if (currentDomain?.code && pluginHooksEnabled) {
        domainIsolationService.runPluginHook(currentDomain.code, "afterFetch", {
          domainId: currentDomain.id,
          quoteCount: transformedData.length,
        });
      }
    } catch (fetchError: any) {
      if (currentDomain?.code && pluginHooksEnabled) {
        domainIsolationService.runPluginHook(currentDomain.code, "fetchError", {
          domainId: currentDomain?.id || null,
          message: fetchError?.message || "unknown",
        });
      }
      logger.error("Failed to fetch quotes", fetchError);
      setIsDbFallbackActive(false);
      setDbFallbackReason(null);
      setError(fetchError.message || "Failed to load quotations. Please check your connection and try again.");
      toast({
        title: "Error fetching quotations",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [currentDomain?.code, currentDomain?.id, domainIsolationService, scopedDb, toast]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  useEffect(() => {
    setCurrentView(location.pathname.endsWith("/analytics") ? "analytics" : "board");
  }, [location.pathname]);

  useEffect(() => {
    setPagination((prev) => {
      const total = filteredQuotes.length;
      const maxPage = Math.max(1, Math.ceil(total / prev.pageSize));
      const nextCurrent = Math.min(prev.current, maxPage);
      if (prev.total === total && prev.current === nextCurrent) return prev;
      return { ...prev, total, current: nextCurrent };
    });
  }, [filteredQuotes.length]);

  useEffect(() => {
    setSelectedQuoteId((prev) => {
      if (prev && filteredQuotes.some((quote) => quote.id === prev)) return prev;
      return filteredQuotes[0]?.id || null;
    });
  }, [filteredQuotes]);

  const handleStatusChange = async (quoteId: string, newStatus: QuoteStatus) => {
    try {
      const { error: updateError } = await scopedDb.from("quotes").update({ status: newStatus }).eq("id", quoteId);
      if (updateError) throw updateError;
      setAllQuotes((prev) => prev.map((quote) => (quote.id === quoteId ? { ...quote, status: newStatus } : quote)));
      toast({
        title: "Status updated",
        description: `Quote moved to ${newStatus.replace("_", " ")}`,
      });
    } catch (statusError) {
      logger.error("Failed to update status", statusError);
      toast({
        title: "Update failed",
        description: "Could not update quote status.",
        variant: "destructive",
      });
      fetchQuotes();
    }
  };

  const handleToggleSelection = (id: string) => {
    setSelectedQuotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDeleteQuotes = async (quoteIds: string[], reason: string) => {
    if (quoteIds.length === 0) return;
    if (!canDeleteQuotes) {
      toast({
        title: "Permission denied",
        description: "You do not have permission to delete quotations.",
        variant: "destructive",
      });
      return;
    }
    const confirmationMessage = quoteIds.length === 1 ? "Delete this quotation?" : `Delete ${quoteIds.length} selected quotations?`;
    if (!window.confirm(confirmationMessage)) return;
    try {
      setDeleteInProgress(true);
      const report = await quotationDeleteService.deleteQuotes(quoteIds, reason, {
        forceHardDelete: false,
        atomic: true,
      });
      if (report.ok) {
        const { hard_deleted, soft_deleted } = report.summary;
        const processed = hard_deleted + soft_deleted;
        toast({
          title: "Quotations processed",
          description: `Processed ${processed} quotations (${hard_deleted} hard, ${soft_deleted} soft).`,
        });
      } else {
        const firstFailure = report.results.find((item) => !item.success);
        toast({
          title: "Delete failed",
          description: firstFailure?.error || report.message || "Some quotations failed to delete.",
          variant: "destructive",
        });
      }
      setSelectedQuotes(new Set());
      setBulkMode(false);
      await fetchQuotes();
    } catch (deleteError: any) {
      logger.error("Failed to delete quotes", deleteError);
      toast({
        title: "Delete failed",
        description: deleteError?.message || "Could not delete quotations.",
        variant: "destructive",
      });
    } finally {
      setDeleteInProgress(false);
    }
  };

  const handleBulkDelete = async () => {
    await handleDeleteQuotes(Array.from(selectedQuotes), "Bulk delete from quotation manager");
  };

  const quoteStats = useMemo(() => {
    const total = filteredQuotes.length;
    const accepted = filteredQuotes.filter((quote) => quote.status === "accepted").length;
    const inProgress = filteredQuotes.filter((quote) =>
      ["draft", "pricing_review", "approved", "sent", "customer_reviewing", "revision_requested"].includes(quote.status)
    ).length;
    const rejected = filteredQuotes.filter((quote) => ["rejected", "expired"].includes(quote.status)).length;
    return { total, accepted, inProgress, rejected };
  }, [filteredQuotes]);

  const selectedQuote = useMemo(() => filteredQuotes.find((quote) => quote.id === selectedQuoteId) || null, [filteredQuotes, selectedQuoteId]);

  const analyticsScope = useMemo(() => {
    return allQuotes.filter((quote) => {
      if (analyticsStatuses.length > 0 && !analyticsStatuses.includes(quote.status)) return false;
      if (analyticsFromDate) {
        const fromDate = new Date(`${analyticsFromDate}T00:00:00`);
        if (new Date(quote.created_at) < fromDate) return false;
      }
      if (analyticsToDate) {
        const toDate = new Date(`${analyticsToDate}T23:59:59`);
        if (new Date(quote.created_at) > toDate) return false;
      }
      return true;
    });
  }, [allQuotes, analyticsFromDate, analyticsStatuses, analyticsToDate]);

  const analyticsCacheKey = useMemo(() => {
    const entityToken = analyticsScope.map((quote) => `${quote.id}:${quote.updated_at || quote.created_at}`).join("|");
    return `${analyticsFromDate}|${analyticsToDate}|${analyticsStatuses.join(",")}|${entityToken}`;
  }, [analyticsFromDate, analyticsScope, analyticsStatuses, analyticsToDate]);

  const analyticsSnapshot = useMemo<AnalyticsSnapshot>(() => {
    const cached = analyticsCacheRef.current.get(analyticsCacheKey);
    if (cached) return cached;
    const statusMap = new Map<string, { count: number; value: number }>();
    const monthMap = new Map<string, { quotes: number; value: number }>();
    let totalValue = 0;
    let accepted = 0;
    analyticsScope.forEach((quote) => {
      const normalizedStatus = statusConfig[quote.status]?.label.replace(/^[^\s]+\s/, "") || quote.status;
      const quoteValue = Number(quote.sell_price || 0);
      totalValue += quoteValue;
      if (quote.status === "accepted") accepted += 1;
      const statusAgg = statusMap.get(normalizedStatus) || { count: 0, value: 0 };
      statusAgg.count += 1;
      statusAgg.value += quoteValue;
      statusMap.set(normalizedStatus, statusAgg);
      const monthKey = format(new Date(quote.created_at), "MMM yyyy");
      const monthAgg = monthMap.get(monthKey) || { quotes: 0, value: 0 };
      monthAgg.quotes += 1;
      monthAgg.value += quoteValue;
      monthMap.set(monthKey, monthAgg);
    });
    const statusDistribution = Array.from(statusMap.entries()).map(([name, values], index) => ({
      name,
      value: values.count,
      color: ANALYTICS_COLORS[index % ANALYTICS_COLORS.length],
    }));
    const monthlyTrend = Array.from(monthMap.entries()).map(([month, values]) => ({
      month,
      quotes: values.quotes,
      value: values.value,
    }));
    const statusValue = Array.from(statusMap.entries()).map(([stage, values]) => ({
      stage,
      value: values.value,
    }));
    const snapshot: AnalyticsSnapshot = {
      averageValue: analyticsScope.length > 0 ? totalValue / analyticsScope.length : 0,
      acceptanceRate: analyticsScope.length > 0 ? (accepted / analyticsScope.length) * 100 : 0,
      statusDistribution,
      monthlyTrend,
      statusValue,
    };
    if (analyticsCacheRef.current.size >= 8) {
      const oldest = analyticsCacheRef.current.keys().next().value;
      if (oldest) analyticsCacheRef.current.delete(oldest);
    }
    analyticsCacheRef.current.set(analyticsCacheKey, snapshot);
    return snapshot;
  }, [analyticsCacheKey, analyticsScope]);

  const handleExportAnalytics = (formatType: "csv" | "xlsx") => {
    const rows = analyticsScope.map((quote) => ({
      quote_number: quote.quote_number,
      title: quote.title,
      status: quote.status,
      sell_price: quote.sell_price ?? 0,
      account: quote.accounts?.name || "",
      opportunity: quote.opportunities?.name || "",
      created_at: quote.created_at,
      valid_until: quote.valid_until || "",
    }));
    const headers = ["quote_number", "title", "status", "sell_price", "account", "opportunity", "created_at", "valid_until"];
    const filename = `quotes_analytics_${new Date().toISOString().slice(0, 10)}.${formatType === "csv" ? "csv" : "xlsx"}`;
    if (formatType === "csv") {
      exportCsv(filename, headers, rows);
      return;
    }
    exportExcel(filename, headers, rows);
  };

  const startRecord = (pagination.current - 1) * pagination.pageSize + 1;
  const endRecord = Math.min(pagination.current * pagination.pageSize, pagination.total);

  return (
    <DashboardLayout>
      <div style={themeStyleFromPreset(theme)} className="flex flex-col h-[calc(100vh-140px)] gap-6 transition-colors duration-300">
        <div className="flex-none">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Quotations Workspace</h1>
            </div>
            <CRMModuleHeaderNavigation
              moduleLabel="Quotes"
              viewMode="pipeline"
              theme={theme}
              onViewModeChange={(mode) => {
                if (mode === "pipeline") {
                  setViewMode("pipeline");
                  navigate("/dashboard/quotes/pipeline");
                  return;
                }
                if (mode === "list") {
                  setViewMode("list");
                  navigate("/dashboard/quotes");
                  return;
                }
                setViewMode(mode);
                navigate(`/dashboard/quotes?view=${mode}`);
              }}
              analyticsLabel="Analytics"
              analyticsActive={currentView === "analytics"}
              onAnalyticsClick={() => {
                if (!canViewAnalytics) {
                  toast({
                    title: "Access denied",
                    description: "You do not have permission to view analytics.",
                    variant: "destructive",
                  });
                  return;
                }
                navigate("/dashboard/quotes/analytics");
              }}
              controlSequence={CRM_HEADER_PRIMARY_CONTROL_SEQUENCE}
              onThemeChange={setTheme}
              onCreate={() => navigate("/dashboard/quotes/new")}
              createLabel="New Quote"
              iconOnly
              layout="compact"
              onRefresh={fetchQuotes}
              onImportExport={() => navigate("/dashboard/quotes/import-export")}
            />
          </div>
        </div>

        {error && (
          <div className="flex-none">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span>{error}</span>
                <Button variant="outline" size="sm" onClick={fetchQuotes} className="h-7 bg-background text-destructive border-destructive hover:bg-destructive/10">
                  <RefreshCcw className="mr-2 h-3 w-3" />
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}
        {isDbFallbackActive && (
          <div className="flex-none">
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {fallbackBannerText}
            </div>
          </div>
        )}

        <div className="flex-1 px-1 min-h-0">
          <Tabs
            value={currentView}
            onValueChange={(value) => {
              const nextView = value as PipelineView;
              if (nextView === "analytics") {
                navigate("/dashboard/quotes/analytics");
                return;
              }
              navigate("/dashboard/quotes/pipeline");
            }}
            className="w-full h-full"
          >
            <TabsContent value="board" className="mt-0 flex flex-col gap-6 h-full">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
                <div className="lg:col-span-3 flex flex-col gap-4 h-full min-h-0">
                  <Card className="rounded-md border-muted">
                    <CardContent className="p-2">
                      <KanbanFilters
                        searchQuery={searchQuery}
                        onSearchChange={(value) => {
                          setSearchQuery(value);
                          setPagination((prev) => ({ ...prev, current: 1 }));
                        }}
                        filters={{ status: selectedStatuses }}
                        onFilterChange={(_, values) => {
                          const safeValues = values.filter((value): value is QuoteStatus => stages.includes(value as QuoteStatus));
                          setSelectedStatuses(safeValues.length > 0 ? safeValues : [...stages]);
                          setPagination((prev) => ({ ...prev, current: 1 }));
                        }}
                        onReset={() => {
                          setSearchQuery("");
                          setSelectedStatuses([...stages]);
                          setPagination((prev) => ({ ...prev, current: 1 }));
                        }}
                        availableFilters={[
                          {
                            id: "status",
                            label: "Status",
                            options: stages.map((stage) => ({
                              label: statusConfig[stage].label.replace(/^[^\s]+\s/, ""),
                              value: stage,
                            })),
                          },
                        ]}
                      />
                    </CardContent>
                  </Card>

                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Button
                        variant={bulkMode ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setBulkMode(!bulkMode);
                          setSelectedQuotes(new Set());
                        }}
                      >
                        <CheckSquare className="h-4 w-4 mr-2" />
                        {bulkMode ? "Cancel Selection" : "Bulk Select"}
                      </Button>
                      {bulkMode && selectedQuotes.size > 0 && (
                        <>
                          <Badge variant="secondary">{selectedQuotes.size} selected</Badge>
                          <Button variant="outline" size="sm" disabled={!canDeleteQuotes || deleteInProgress} onClick={handleBulkDelete}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <span className="font-medium">{pagination.total > 0 ? startRecord : 0}-{endRecord}</span>
                      <span>/</span>
                      <span>{pagination.total}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={pagination.current <= 1}
                        onClick={() => setPagination((prev) => ({ ...prev, current: prev.current - 1 }))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={endRecord >= pagination.total}
                        onClick={() => setPagination((prev) => ({ ...prev, current: prev.current + 1 }))}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 min-h-[420px] max-h-[calc(100vh-330px)] overflow-hidden bg-white rounded-lg border border-[#e5eaf2] p-2">
                    {loading ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#714B67]" />
                      </div>
                    ) : (
                      <FeatureErrorBoundary featureName="Quotes Pipeline Board">
                        <QuotesKanbanBoard
                          quotes={quotes}
                          onStatusChange={handleStatusChange}
                          bulkMode={bulkMode}
                          selectedQuotes={selectedQuotes}
                          onToggleSelection={handleToggleSelection}
                          onQuoteClick={(id) => setSelectedQuoteId(id)}
                          visibleStages={selectedStatuses}
                          className="h-full"
                        />
                      </FeatureErrorBoundary>
                    )}
                  </div>
                </div>

                <div className="space-y-4 overflow-y-auto pr-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Quotation Detail</CardTitle>
                      <CardDescription>Selected quote information and quick actions</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {selectedQuote ? (
                        <>
                          <div className="space-y-1">
                            <p className="text-muted-foreground">Quote Number</p>
                            <p className="font-semibold">{selectedQuote.quote_number}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground">Title</p>
                            <p className="font-medium">{selectedQuote.title || "-"}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground">Account</p>
                            <p>{selectedQuote.accounts?.name || "-"}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground">Opportunity</p>
                            <p>{selectedQuote.opportunities?.name || "-"}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground">Status</p>
                            <Badge variant="secondary">{statusConfig[selectedQuote.status]?.label.replace(/^[^\s]+\s/, "")}</Badge>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground">Sell Price</p>
                            <p className="font-semibold">${Number(selectedQuote.sell_price || 0).toLocaleString()}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground">Valid Until</p>
                            <p>{selectedQuote.valid_until ? format(new Date(selectedQuote.valid_until), "PP") : "-"}</p>
                          </div>
                          <div className="flex items-center gap-2 pt-2">
                            <Button size="sm" onClick={() => navigate(`/dashboard/quotes/${selectedQuote.id}`)}>
                              Open Quote
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/quotes/${selectedQuote.id}?action=edit`)}>
                              Edit
                            </Button>
                          </div>
                        </>
                      ) : (
                        <p className="text-muted-foreground">Select a quote card to view details.</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Pipeline Distribution</CardTitle>
                      <CardDescription>Status breakdown for current board dataset</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {stages.map((stage) => {
                        const count = quotes.filter((quote) => quote.status === stage).length;
                        return (
                          <div key={stage} className="flex items-center justify-between text-sm">
                            <span>{statusConfig[stage].label.replace(/^[^\s]+\s/, "")}</span>
                            <Badge variant="outline">{count}</Badge>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="flex-none relative z-[2]">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs">Total Quotes</CardDescription>
                      <CardTitle className="text-2xl">{quoteStats.total}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs">Accepted</CardDescription>
                      <CardTitle className="text-2xl">{quoteStats.accepted}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs">In Progress</CardDescription>
                      <CardTitle className="text-2xl">{quoteStats.inProgress}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs">Not Closed</CardDescription>
                      <CardTitle className="text-2xl">{quoteStats.rejected}</CardTitle>
                    </CardHeader>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="mt-0 h-full overflow-auto">
              {!canViewAnalytics ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Analytics Access Restricted</CardTitle>
                    <CardDescription>You need reports or dashboards permission to open quote analytics.</CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                <div className="space-y-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                        <div className="space-y-1">
                          <Label htmlFor="quotes-analytics-from">From</Label>
                          <Input id="quotes-analytics-from" type="date" value={analyticsFromDate} onChange={(event) => setAnalyticsFromDate(event.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="quotes-analytics-to">To</Label>
                          <Input id="quotes-analytics-to" type="date" value={analyticsToDate} onChange={(event) => setAnalyticsToDate(event.target.value)} />
                        </div>
                        <div className="md:col-span-2">
                          <KanbanFilters
                            searchQuery=""
                            onSearchChange={() => void 0}
                            filters={{ status: analyticsStatuses }}
                            onFilterChange={(_, values) => {
                              const safeValues = values.filter((value): value is QuoteStatus => stages.includes(value as QuoteStatus));
                              setAnalyticsStatuses(safeValues.length > 0 ? safeValues : [...stages]);
                            }}
                            onReset={() => {
                              setAnalyticsStatuses([...stages]);
                              setAnalyticsFromDate("");
                              setAnalyticsToDate("");
                            }}
                            availableFilters={[
                              {
                                id: "status",
                                label: "Status",
                                options: stages.map((stage) => ({
                                  label: statusConfig[stage].label.replace(/^[^\s]+\s/, ""),
                                  value: stage,
                                })),
                              },
                            ]}
                            className="p-0"
                            leadingContent={
                              <div className="inline-flex items-center gap-2 px-2 text-sm text-muted-foreground">
                                <CalendarDays className="h-4 w-4" />
                                <span>Filters</span>
                              </div>
                            }
                          />
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleExportAnalytics("csv")}>
                            <Download className="h-4 w-4 mr-2" />
                            CSV
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleExportAnalytics("xlsx")}>
                            <Download className="h-4 w-4 mr-2" />
                            Excel
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  {loading ? (
                    <Card>
                      <CardContent className="py-20">
                        <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#714B67]" />
                          Loading analytics...
                        </div>
                      </CardContent>
                    </Card>
                  ) : analyticsScope.length === 0 ? (
                    <Card>
                      <CardHeader>
                        <CardTitle>No analytics data</CardTitle>
                        <CardDescription>Adjust date or status filters to view quote analytics.</CardDescription>
                      </CardHeader>
                    </Card>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardDescription>Total Quotes</CardDescription>
                            <CardTitle>{analyticsScope.length}</CardTitle>
                          </CardHeader>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardDescription>Total Value</CardDescription>
                            <CardTitle>${analyticsScope.reduce((sum, quote) => sum + Number(quote.sell_price || 0), 0).toLocaleString()}</CardTitle>
                          </CardHeader>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardDescription>Acceptance Rate</CardDescription>
                            <CardTitle>{analyticsSnapshot.acceptanceRate.toFixed(1)}%</CardTitle>
                          </CardHeader>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardDescription>Average Quote Value</CardDescription>
                            <CardTitle>${Math.round(analyticsSnapshot.averageValue).toLocaleString()}</CardTitle>
                          </CardHeader>
                        </Card>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                        <Card className="col-span-4">
                          <CardHeader>
                            <CardTitle>Status Value Analysis</CardTitle>
                            <CardDescription>Total quoted value by stage</CardDescription>
                          </CardHeader>
                          <CardContent className="h-[320px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={analyticsSnapshot.statusValue}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="stage" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>

                        <Card className="col-span-3">
                          <CardHeader>
                            <CardTitle>Status Distribution</CardTitle>
                            <CardDescription>Count by quotation stage</CardDescription>
                          </CardHeader>
                          <CardContent className="h-[320px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={analyticsSnapshot.statusDistribution} dataKey="value" cx="50%" cy="50%" innerRadius={58} outerRadius={84} label>
                                  {analyticsSnapshot.statusDistribution.map((entry, index) => (
                                    <Cell key={`${entry.name}-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" />
                              </PieChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>

                        <Card className="col-span-7">
                          <CardHeader>
                            <CardTitle>Trend</CardTitle>
                            <CardDescription>Quotes and value over time</CardDescription>
                          </CardHeader>
                          <CardContent className="h-[320px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={analyticsSnapshot.monthlyTrend}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" />
                                <YAxis yAxisId="left" />
                                <YAxis yAxisId="right" orientation="right" />
                                <Tooltip />
                                <Legend />
                                <Line yAxisId="left" type="monotone" dataKey="quotes" stroke="#3b82f6" strokeWidth={2} name="Quotes" />
                                <Line yAxisId="right" type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} name="Value" />
                              </LineChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>
                      </div>
                    </>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
