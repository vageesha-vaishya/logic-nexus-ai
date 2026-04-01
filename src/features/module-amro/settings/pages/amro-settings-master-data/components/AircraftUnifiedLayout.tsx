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
  children: ReactNode;
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
  children,
}: AircraftUnifiedLayoutProps) {
  return (
    <Card className="mdm-template-panel" data-testid="aircraft-unified-layout">
      <CardHeader className="mdm-template-panel-head space-y-3">
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
        <div className="flex flex-wrap gap-2 rounded-md border border-[hsl(var(--mdm-template-border))] bg-muted/20 p-2" data-testid="aircraft-unified-nav">
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
              >
                <Icon className="mr-1 h-3.5 w-3.5" />
                {item.label}
              </Button>
            );
          })}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search in active module"
                className="pl-8"
                aria-label="Unified module search"
              />
            </div>
          </div>
          <Select value={statusValue} onValueChange={onStatusChange}>
            <SelectTrigger aria-label="Unified module status filter">
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
          <Select value={localeValue} onValueChange={onLocaleChange}>
            <SelectTrigger aria-label="Unified module locale selector">
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
          <div className="sm:col-span-2 xl:col-span-1">
            <AircraftActionPalette
              actions={actions}
              hasPermission={hasPermission}
              compact
              buttonClassName="h-9"
              className={cn('justify-end', actions.length === 0 && 'hidden')}
              toolbarLabel="Aircraft unified actions"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="mdm-template-panel-body space-y-3">
        {loading ? (
          <p className="text-xs text-[hsl(var(--mdm-template-muted))]">Loading module data…</p>
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
