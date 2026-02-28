import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, LayoutList, Columns, Sparkles, AlertTriangle, HelpCircle, Plus, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { QuoteResultsList } from '@/components/sales/shared/QuoteResultsList';
import { QuoteComparisonView } from '@/components/sales/shared/QuoteComparisonView';
import { RateOption } from '@/types/quote-breakdown';
import { AiMarketAnalysis } from '@/components/sales/shared/AiMarketAnalysis';

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
  onAddManualOption?: () => void;
  onRemoveOption?: (optionId: string) => void;
  availableOptions?: RateOption[];
  onAddRateOption?: (optionId: string) => void;
  onRenameOption?: (optionId: string, newName: string) => void;
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
  onAddManualOption,
  onRemoveOption,
  availableOptions = [],
  onAddRateOption,
  onRenameOption,
}: ResultsZoneProps) {
  const [viewMode, setViewMode] = useState<'list' | 'compare'>('list');

  // Empty state logic:
  // If loading, show loader.
  // If not loading and no data (results, marketAnalysis, availableOptions), show empty state.
  // In Smart Mode, we might have no results but have marketAnalysis/availableOptions, so we should render.
  
  const hasResults = results && results.length > 0;
  const hasAvailable = availableOptions && availableOptions.length > 0;
  const hasAnalysis = !!marketAnalysis;
  const hasContent = hasResults || hasAvailable || hasAnalysis;

  // Initial State (No search performed yet)
  if (!loading && results === null) {
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

  // Empty Search State (Search performed but nothing found)
  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Package className="w-12 h-12 mb-4 opacity-20" />
        <p>No rate options available. Try adjusting your search criteria.</p>
        <div className="mt-4 p-4 bg-muted/50 rounded-lg text-xs max-w-md text-center space-y-2">
          <div className="flex items-center justify-center gap-1 font-medium text-foreground">
            <HelpCircle className="w-3.5 h-3.5" /> How to configure new rates and charges
          </div>
          <p>
            To add carrier rate sheets, go to{' '}
            <a href="/dashboard/rates" className="text-primary underline hover:no-underline">Rate Management</a>.
            Upload rate sheets, configure carrier contracts, and set up pricing rules.
            The system will use these rates when generating quotes.
          </p>
        </div>
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

      {/* AI Analysis Section */}
      <AiMarketAnalysis 
        analysis={marketAnalysis || ''} 
        confidenceScore={confidenceScore} 
        anomalies={anomalies} 
      />

      {/* Options Section - Only visible if there are results */}
      {hasResults && (
        <>
          {/* Header */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">Rate Options</h3>
              <Badge variant="outline" className="text-xs">{results?.length || 0} Options</Badge>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-3.5 h-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Compare multiple carrier options side-by-side.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-2">
              {onAddManualOption && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="outline" onClick={onAddManualOption} className="h-8 text-xs">
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Option
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Manually create a new rate option to compare.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'list' | 'compare')} className="w-auto">
                <TabsList className="h-8">
                  <TabsTrigger value="list" className="text-xs h-7 px-2"><LayoutList className="w-3 h-3 mr-1" /> Browse</TabsTrigger>
                  <TabsTrigger value="compare" className="text-xs h-7 px-2"><Columns className="w-3 h-3 mr-1" /> Compare</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {/* Results */}
          {viewMode === 'list' ? (
            <QuoteResultsList
              results={results || []}
              onSelect={handleSelect}
              selectedIds={selectedOptionId ? [selectedOptionId] : []}
              onToggleSelection={selectedOptionId ? undefined : undefined}
              onGenerateSmartOptions={onRerunRates}
              marketAnalysis={null} // Analysis is now handled by AiMarketAnalysis component
              confidenceScore={confidenceScore}
              anomalies={anomalies}
              onRemoveOption={onRemoveOption}
              onRenameOption={onRenameOption}
            />
          ) : (
            <QuoteComparisonView
              options={results || []}
              onSelect={handleSelect}
              selectedIds={selectedOptionId ? [selectedOptionId] : []}
              onGenerateSmartOptions={onRerunRates}
            />
          )}
        </>
      )}

      {/* Available Market Rates - REMOVED PER USER REQUEST */}
      {/* 
      {availableOptions && availableOptions.length > 0 && (
        <div className="mt-8 pt-4 border-t">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Package className="w-4 h-4 text-muted-foreground" />
            Available Market Rates
          </h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {availableOptions.map((option) => (
              <div
                key={option.id}
                className="flex items-center justify-between p-3 border rounded-md bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="flex flex-col min-w-0 mr-3">
                  <span className="font-medium text-sm truncate" title={option.carrier}>
                    {option.carrier}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{option.transitTime}</span>
                    <span>•</span>
                    <span className="font-mono">
                      {option.currency} {(option.price || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onAddRateOption?.(option.id)}
                  className="h-8 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
      */}
    </div>
  );
}
