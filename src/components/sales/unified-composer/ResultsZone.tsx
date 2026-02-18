import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, LayoutList, Columns, Sparkles, AlertTriangle } from 'lucide-react';
import { QuoteResultsList } from '@/components/sales/shared/QuoteResultsList';
import { QuoteComparisonView } from '@/components/sales/shared/QuoteComparisonView';
import { RateOption } from '@/types/quote-breakdown';

interface ResultsZoneProps {
  results: RateOption[] | null;
  loading?: boolean;
  smartMode?: boolean;
  marketAnalysis?: string | null;
  confidenceScore?: number | null;
  anomalies?: string[];
  complianceCheck?: { compliant: boolean; issues: any[] } | null;
  onSelect: (option: RateOption) => void;
  selectedOptionId?: string | null;
  onRerunRates?: () => void;
}

export function ResultsZone({
  results,
  loading = false,
  smartMode = false,
  marketAnalysis,
  confidenceScore,
  anomalies = [],
  complianceCheck,
  onSelect,
  selectedOptionId,
  onRerunRates,
}: ResultsZoneProps) {
  const [viewMode, setViewMode] = useState<'list' | 'compare'>('list');

  // Empty state
  if (!results && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Package className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-base">Fill out the form above and click "Get Rates" to generate quotes</p>
        {smartMode && (
          <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 rounded-md text-xs max-w-sm text-center border border-purple-100 dark:border-purple-900">
            <Sparkles className="w-4 h-4 mx-auto mb-1" />
            AI Enhanced mode is active. System will generate multi-modal options and market analysis.
          </div>
        )}
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
        <p>Calculating rates...</p>
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Package className="w-12 h-12 mb-4 opacity-20" />
        <p>No rate options available. Try adjusting your search criteria.</p>
      </div>
    );
  }

  // Wrap onSelect to handle "select" semantics (highlight, not navigate)
  const handleSelect = (option: RateOption) => {
    onSelect(option);
  };

  return (
    <div className="space-y-4">
      {/* Compliance Alert */}
      {complianceCheck && !complianceCheck.compliant && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-md">
          <h5 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Compliance Checks
          </h5>
          <ul className="mt-2 space-y-1">
            {complianceCheck.issues.map((issue: any, i: number) => (
              <li key={i} className="text-xs text-yellow-700 dark:text-yellow-400 flex items-start gap-2">
                <span>•</span> {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-lg">Rate Options</h3>
          <Badge variant="outline" className="text-xs">{results.length} Options</Badge>
        </div>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'list' | 'compare')} className="w-auto">
          <TabsList className="h-8">
            <TabsTrigger value="list" className="text-xs h-7 px-2"><LayoutList className="w-3 h-3 mr-1" /> Browse</TabsTrigger>
            <TabsTrigger value="compare" className="text-xs h-7 px-2"><Columns className="w-3 h-3 mr-1" /> Compare</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Results */}
      {viewMode === 'list' ? (
        <QuoteResultsList
          results={results}
          onSelect={handleSelect}
          selectedIds={selectedOptionId ? [selectedOptionId] : []}
          onToggleSelection={selectedOptionId ? undefined : undefined}
          onGenerateSmartOptions={onRerunRates}
          marketAnalysis={marketAnalysis}
          confidenceScore={confidenceScore}
          anomalies={anomalies}
        />
      ) : (
        <QuoteComparisonView
          options={results}
          onSelect={handleSelect}
          selectedIds={selectedOptionId ? [selectedOptionId] : []}
          onGenerateSmartOptions={onRerunRates}
        />
      )}
    </div>
  );
}
