import { type ReactNode } from 'react';
import { type LucideIcon, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AircraftActionPalette, type AircraftPaletteAction } from './AircraftActionPalette';

export type AircraftUnifiedLayoutModuleKey = 'list' | 'templates' | 'engine' | 'components' | 'documents' | 'ad-sb' | 'work-packages';

export type AircraftUnifiedNavItem = {
  key: AircraftUnifiedLayoutModuleKey;
  label: string;
  path: string;
  icon: LucideIcon;
};

export type AircraftUnifiedFilterOption = {
  value: string;
  label: string;
};

export type AircraftUnifiedLayoutLabels = {
  searchPlaceholder: string;
  searchAriaLabel: string;
  statusAriaLabel: string;
  localeAriaLabel: string;
  navAriaLabel: string;
  clearFilters: string;
  loadingMessage: string;
  resultLabel: string;
};

export type AircraftUnifiedResultSummary = {
  visible: number;
  total: number;
};

export type AircraftUnifiedDynamicFilter =
  | {
      id: string;
      type: 'text' | 'date';
      value: string;
      onValueChange: (value: string) => void;
      placeholder?: string;
      ariaLabel: string;
      className?: string;
    }
  | {
      id: string;
      type: 'select';
      value: string;
      onValueChange: (value: string) => void;
      options: AircraftUnifiedFilterOption[];
      ariaLabel: string;
      className?: string;
    };

type AircraftUnifiedLayoutProps = {
  title: string;
  subtitle: string;
  activeModuleKey: AircraftUnifiedLayoutModuleKey;
  navItems: AircraftUnifiedNavItem[];
  onNavigate: (path: string) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusValue: string;
  onStatusChange: (value: string) => void;
  statusOptions: AircraftUnifiedFilterOption[];
  localeValue: string;
  onLocaleChange: (value: string) => void;
  localeOptions: AircraftUnifiedFilterOption[];
  actions?: AircraftPaletteAction[];
  hasPermission?: (permission: string) => boolean;
  loading?: boolean;
  error?: string;
  resultSummary?: AircraftUnifiedResultSummary;
  onClearFilters?: () => void;
  labels?: Partial<AircraftUnifiedLayoutLabels>;
  dynamicFilters?: AircraftUnifiedDynamicFilter[];
  showHeaderSummary?: boolean;
  showNavRail?: boolean;
  showLocaleSelector?: boolean;
  showDynamicFilters?: boolean;
  showActions?: boolean;
  showClearFilters?: boolean;
  children: ReactNode;
};

const DEFAULT_UNIFIED_LAYOUT_LABELS: AircraftUnifiedLayoutLabels = {
  searchPlaceholder: 'Search in active module',
  searchAriaLabel: 'Unified module search',
  statusAriaLabel: 'Unified module status filter',
  localeAriaLabel: 'Unified module locale selector',
  navAriaLabel: 'Unified module navigation',
  clearFilters: 'Clear filters',
  loadingMessage: 'Loading module data…',
  resultLabel: 'records',
};

export function filterUnifiedModuleRows<T>(
  rows: T[],
  query: string,
  status: string,
  tokenizeRow: (row: T) => string[],
  readStatus: (row: T) => string,
): T[] {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedStatus = status.trim().toLowerCase();
  return rows.filter((row) => {
    const queryMatch = normalizedQuery.length === 0
      || tokenizeRow(row).some((token) => token.toLowerCase().includes(normalizedQuery));
    const rowStatus = readStatus(row).trim().toLowerCase();
    const statusMatch = normalizedStatus === 'all' || rowStatus === normalizedStatus;
    return queryMatch && statusMatch;
  });
}

export function AircraftUnifiedLayout({
  title,
  subtitle,
  activeModuleKey,
  navItems,
  onNavigate,
  searchValue,
  onSearchChange,
  statusValue,
  onStatusChange,
  statusOptions,
  localeValue,
  onLocaleChange,
  localeOptions,
  actions = [],
  hasPermission = () => true,
  loading = false,
  error = '',
  resultSummary,
  onClearFilters,
  labels,
  dynamicFilters = [],
  showHeaderSummary = true,
  showNavRail = true,
  showLocaleSelector = true,
  showDynamicFilters = true,
  showActions = true,
  showClearFilters = true,
  children,
}: AircraftUnifiedLayoutProps) {
  const uiLabels = { ...DEFAULT_UNIFIED_LAYOUT_LABELS, ...labels };

  return (
    <Card className="mdm-template-panel" data-testid="aircraft-unified-layout">
      <CardHeader className="mdm-template-panel-head space-y-3">
        {showHeaderSummary ? (
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="mdm-template-panel-title">{title}</CardTitle>
              <p className="pt-1 text-xs text-[hsl(var(--mdm-template-muted))]">{subtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Locale: {localeValue.toUpperCase()}</Badge>
              <Badge variant="secondary">Module: {activeModuleKey}</Badge>
            </div>
          </div>
        ) : null}
        {showNavRail ? (
          <div
            className="flex flex-wrap gap-2 rounded-md border border-[hsl(var(--mdm-template-border))] bg-muted/20 p-2"
            data-testid="aircraft-unified-nav"
            role="toolbar"
            aria-label={uiLabels.navAriaLabel}
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.path}
                  type="button"
                  variant={activeModuleKey === item.key ? 'default' : 'outline'}
                  size="sm"
                  className="h-8"
                  onClick={() => onNavigate(item.path)}
                  aria-pressed={activeModuleKey === item.key}
                >
                  <Icon className="mr-1 h-3.5 w-3.5" />
                  {item.label}
                </Button>
              );
            })}
          </div>
        ) : null}
        <div className="flex items-center gap-2 overflow-x-auto rounded-md border border-[hsl(var(--mdm-template-border))] bg-background/70 p-2 xl:flex-nowrap xl:overflow-visible">
          <div className="min-w-[260px] flex-1 shrink-0 xl:min-w-[200px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={uiLabels.searchPlaceholder}
                className="pl-8"
                aria-label={uiLabels.searchAriaLabel}
              />
            </div>
          </div>
          <div className="w-[160px] shrink-0 xl:w-[140px]">
            <Select value={statusValue} onValueChange={onStatusChange}>
              <SelectTrigger aria-label={uiLabels.statusAriaLabel}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={`status-option-${option.value}`} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {showLocaleSelector ? (
            <div className="w-[140px] shrink-0 xl:w-[120px]">
              <Select value={localeValue} onValueChange={onLocaleChange}>
                <SelectTrigger aria-label={uiLabels.localeAriaLabel}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {localeOptions.map((option) => (
                    <SelectItem key={`locale-option-${option.value}`} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {showDynamicFilters ? dynamicFilters.map((filterField) => {
            if (filterField.type === 'select') {
              return (
                <div key={filterField.id} className={cn('w-[160px] shrink-0 xl:w-[140px]', filterField.className)}>
                  <Select value={filterField.value} onValueChange={filterField.onValueChange}>
                    <SelectTrigger aria-label={filterField.ariaLabel}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {filterField.options.map((option) => (
                        <SelectItem key={`${filterField.id}-${option.value}`} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            }
            return (
              <div key={filterField.id} className={cn('w-[180px] shrink-0 xl:w-[160px]', filterField.className)}>
                <Input
                  type={filterField.type}
                  value={filterField.value}
                  onChange={(event) => filterField.onValueChange(event.target.value)}
                  placeholder={filterField.placeholder}
                  aria-label={filterField.ariaLabel}
                />
              </div>
            );
          }) : null}
          {showActions && actions.length > 0 ? (
            <AircraftActionPalette
              actions={actions}
              hasPermission={hasPermission}
              compact
              buttonClassName="h-9 px-2 xl:h-8 xl:px-2 xl:text-xs"
              className={cn('shrink-0 justify-end xl:gap-1')}
              toolbarLabel="Aircraft unified actions"
            />
          ) : null}
          {showClearFilters ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onClearFilters}
              className="h-9 shrink-0 px-3 xl:h-8 xl:px-2 xl:text-xs"
            >
              {uiLabels.clearFilters}
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[hsl(var(--mdm-template-muted))]">
          <span>
            {resultSummary ? `${resultSummary.visible}/${resultSummary.total} ${uiLabels.resultLabel}` : `0/0 ${uiLabels.resultLabel}`}
          </span>
        </div>
      </CardHeader>
      <CardContent className="mdm-template-panel-body space-y-3">
        {loading ? (
          <p className="text-xs text-[hsl(var(--mdm-template-muted))]">{uiLabels.loadingMessage}</p>
        ) : null}
        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </div>
        ) : null}
        {children}
      </CardContent>
    </Card>
  );
}

export default AircraftUnifiedLayout;
