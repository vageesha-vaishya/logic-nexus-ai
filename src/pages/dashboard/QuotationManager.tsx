import { useEffect, useState } from "react";
import { useCRM } from "@/hooks/useCRM";
import { QuotationManagerLayout } from "@/components/sales/QuotationManagerLayout";
import { QuotesKanbanBoard } from "@/components/sales/kanban/QuotesKanbanBoard";
import { QuotesList } from "@/components/sales/QuotesList";
import { FilterCriterion } from "@/components/sales/AdvancedSearchFilter";
import { ViewMode } from "@/components/ui/view-toggle";
import { useToast } from "@/hooks/use-toast";
import { Quote, QuoteStatus } from "./quotes-data";
import { logger } from "@/lib/logger";

import { SalesDashboardProvider } from "@/contexts/SalesDashboardContext";

export default function QuotationManager() {
  return (
    <SalesDashboardProvider>
      <QuotationManagerContent />
    </SalesDashboardProvider>
  );
}

function QuotationManagerContent() {
  const { scopedDb } = useCRM();
  const { toast } = useToast();
  
  // View State
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('quotesViewMode') as ViewMode) || 'board';
  });

  // Data State
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<FilterCriterion[]>([]);
  
  // Pagination State
  const [pagination, setPagination] = useState({
    current: 1,
    total: 0,
    pageSize: 20,
  });

  // Selection State (for List View)
  const [selectedQuotes, setSelectedQuotes] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  useEffect(() => {
    localStorage.setItem('quotesViewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    fetchQuotes();
  }, [searchQuery, activeFilters, pagination.current, pagination.pageSize]);

  const fetchQuotes = async () => {
    try {
      setLoading(true);
      
      let query = scopedDb
        .from("quotes")
        .select(`
          *,
          account:accounts (id, name),
          opportunity:opportunities!quotes_opportunity_id_fkey (id, name)
        `, { count: 'exact' });

      // Apply Search
      if (searchQuery) {
        query = query.or(`quote_number.ilike.%${searchQuery}%,status.ilike.%${searchQuery}%`);
      }

      // Apply Advanced Filters
      activeFilters.forEach(filter => {
        switch (filter.operator) {
          case 'equals':
            query = query.eq(filter.field, filter.value);
            break;
          case 'contains':
            query = query.ilike(filter.field, `%${filter.value}%`);
            break;
          case 'gt':
            query = query.gt(filter.field, filter.value);
            break;
          case 'lt':
            query = query.lt(filter.field, filter.value);
            break;
          case 'starts_with':
            query = query.ilike(filter.field, `${filter.value}%`);
            break;
        }
      });

      // Pagination
      const from = (pagination.current - 1) * pagination.pageSize;
      const to = from + pagination.pageSize - 1;
      
      query = query.range(from, to).order('created_at', { ascending: false });

      const { data, count, error } = await query;

      if (error) throw error;

      // Transform data to match Quote interface if necessary
      // Supabase returns 'account' object but interface expects 'accounts'
      const transformedData: Quote[] = (data || []).map((item: any) => ({
        ...item,
        accounts: item.account ? { name: item.account.name } : null,
        opportunities: item.opportunity ? { name: item.opportunity.name } : null,
      }));

      setQuotes(transformedData);
      setPagination(prev => ({ ...prev, total: count || 0 }));

    } catch (error) {
      logger.error('Failed to fetch quotes', error);
      toast({
        title: "Error fetching quotations",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (quoteId: string, newStatus: QuoteStatus) => {
    try {
      const { error } = await scopedDb
        .from('quotes')
        .update({ status: newStatus })
        .eq('id', quoteId);

      if (error) throw error;

      // Optimistic update
      setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, status: newStatus } : q));
      
      toast({
        title: "Status updated",
        description: `Quote moved to ${newStatus.replace('_', ' ')}`,
      });
    } catch (error) {
      console.error('Failed to update status:', error);
      toast({
        title: "Update failed",
        description: "Could not update quote status.",
        variant: "destructive",
      });
      fetchQuotes(); // Revert on error
    }
  };

  const handleToggleSelection = (id: string) => {
    const newSelection = new Set(selectedQuotes);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedQuotes(newSelection);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedQuotes(new Set(quotes.map(q => q.id)));
    } else {
      setSelectedQuotes(new Set());
    }
  };

  // Filter Handlers
  const handleFilterApply = (filters: FilterCriterion[], matchMode: 'all' | 'any') => {
    setActiveFilters([...activeFilters, ...filters]);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleRemoveFilter = (id: string) => {
    setActiveFilters(prev => prev.filter(f => f.id !== id));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  return (
    <QuotationManagerLayout
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      activeFilters={activeFilters}
      onFilterApply={handleFilterApply}
      onRemoveFilter={handleRemoveFilter}
      pagination={{
        ...pagination,
        onPageChange: (page) => setPagination(prev => ({ ...prev, current: page }))
      }}
    >
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#714B67]" />
        </div>
      ) : (
        <>
          {viewMode === 'board' ? (
            <QuotesKanbanBoard 
              quotes={quotes} 
              onStatusChange={handleStatusChange}
            />
          ) : (
            <QuotesList 
              quotes={quotes} 
              selectedQuotes={selectedQuotes}
              onToggleSelection={handleToggleSelection}
              onSelectAll={handleSelectAll}
              bulkMode={bulkMode}
            />
          )}
        </>
      )}
    </QuotationManagerLayout>
  );
}
