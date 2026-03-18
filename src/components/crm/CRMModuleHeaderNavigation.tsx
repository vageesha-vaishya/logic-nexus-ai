import { KeyboardEvent, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { BarChart3, CreditCard, Download, GitBranch, LayoutGrid, List, Palette, Plus, RefreshCcw } from 'lucide-react';
import { CRMModuleViewMode } from '@/hooks/useCRMModuleNavigationState';
import { THEME_PRESETS } from '@/theme/themes';

type CRMHeaderControl = CRMModuleViewMode | 'analytics' | 'create' | 'refresh' | 'importExport' | 'theme';

const VIEW_MODE_SEQUENCE: CRMModuleViewMode[] = ['pipeline', 'card', 'grid', 'list'];
export const CRM_HEADER_PRIMARY_CONTROL_SEQUENCE: CRMHeaderControl[] = [
  'pipeline',
  'card',
  'grid',
  'list',
  'create',
  'refresh',
  'importExport',
  'theme',
];

function toLabel(mode: CRMModuleViewMode): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

function modeIcon(mode: CRMModuleViewMode) {
  if (mode === 'pipeline') return GitBranch;
  if (mode === 'card') return CreditCard;
  if (mode === 'grid') return LayoutGrid;
  return List;
}

interface CRMModuleHeaderNavigationProps {
  moduleLabel: string;
  viewMode: CRMModuleViewMode;
  theme: string;
  onViewModeChange: (mode: CRMModuleViewMode) => void;
  onThemeChange: (theme: string) => void;
  onCreate: () => void;
  onRefresh: () => void;
  onImportExport: () => void;
  analyticsLabel?: string;
  analyticsActive?: boolean;
  onAnalyticsClick?: () => void;
  viewModeSequence?: CRMModuleViewMode[];
  controlSequence?: CRMHeaderControl[];
  iconOnly?: boolean;
  showSecondaryLabels?: boolean;
  createLabel?: string;
  layout?: 'full' | 'compact';
  className?: string;
}

export function CRMModuleHeaderNavigation({
  moduleLabel,
  viewMode,
  theme,
  onViewModeChange,
  onThemeChange,
  onCreate,
  onRefresh,
  onImportExport,
  analyticsLabel = 'Analytics',
  analyticsActive = false,
  onAnalyticsClick,
  viewModeSequence = VIEW_MODE_SEQUENCE,
  controlSequence,
  iconOnly = false,
  showSecondaryLabels = false,
  createLabel = 'New',
  layout = 'full',
  className,
}: CRMModuleHeaderNavigationProps) {
  const viewButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const themeOptions = useMemo(() => THEME_PRESETS.map((preset) => preset.name), []);

  const viewItems = useMemo(() => {
    const items: Array<{ kind: 'mode'; mode: CRMModuleViewMode } | { kind: 'analytics' }> = [];
    const pushMode = (mode: CRMModuleViewMode) => items.push({ kind: 'mode', mode });
    const pushAnalytics = () => items.push({ kind: 'analytics' });

    if (controlSequence) {
      controlSequence.forEach((control) => {
        if (control === 'analytics') {
          if (onAnalyticsClick) pushAnalytics();
          return;
        }
        if (control === 'create' || control === 'refresh' || control === 'importExport' || control === 'theme') {
          return;
        }
        pushMode(control);
      });
      return items;
    }

    viewModeSequence.forEach((mode) => {
      pushMode(mode);
    });
    return items;
  }, [controlSequence, onAnalyticsClick, viewModeSequence]);

  const effectiveControlSequence = useMemo(() => {
    if (controlSequence) return controlSequence;
    const sequence: CRMHeaderControl[] = [...viewModeSequence];
    sequence.push('create', 'refresh', 'importExport', 'theme');
    return sequence;
  }, [controlSequence, viewModeSequence]);

  const shouldRenderSecondaryAnalytics =
    Boolean(onAnalyticsClick) && !effectiveControlSequence.includes('analytics');

  const handleViewKeyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const maxIndex = viewItems.length - 1;
    const nextIndex =
      event.key === 'ArrowRight'
        ? (index + 1) % viewItems.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + viewItems.length) % viewItems.length
          : event.key === 'Home'
            ? 0
            : maxIndex;
    const nextItem = viewItems[nextIndex];
    if (nextItem.kind === 'analytics') {
      onAnalyticsClick?.();
    } else {
      onViewModeChange(nextItem.mode);
    }
    viewButtonRefs.current[nextIndex]?.focus();
  };

  return (
    <nav
      className={cn('ml-auto flex-1 min-w-0 max-w-full', className)}
      aria-label={`${moduleLabel} header navigation`}
    >
      <div
        className={cn(
          'flex flex-wrap items-center justify-end gap-2 pb-1 w-full max-w-full',
        )}
      >
        {effectiveControlSequence.map((control) => {
          if (control === 'analytics') {
            const navIndex = viewItems.findIndex((item) => item.kind === 'analytics');
            if (!onAnalyticsClick || navIndex < 0) return null;
            return (
              <Button
                key="analytics"
                type="button"
                variant={analyticsActive ? 'secondary' : 'outline'}
                className={cn('h-11', iconOnly ? 'w-11 px-0' : 'min-w-20 px-4')}
                aria-label={`${moduleLabel} ${analyticsLabel} view`}
                aria-pressed={analyticsActive}
                onClick={() => onAnalyticsClick?.()}
                onKeyDown={(event) => handleViewKeyboard(event, navIndex)}
                title={analyticsLabel}
                ref={(node) => {
                  viewButtonRefs.current[navIndex] = node;
                }}
              >
                {iconOnly ? (
                  <>
                    <BarChart3 className="h-4 w-4" />
                    <span className="sr-only">{analyticsLabel}</span>
                  </>
                ) : (
                  analyticsLabel
                )}
              </Button>
            );
          }

          if (control === 'create') {
            return (
              <Button
                key="create"
                type="button"
                className={cn('h-11', iconOnly ? 'w-11 px-0' : 'px-4')}
                aria-label={`${moduleLabel} ${createLabel}`}
                onClick={onCreate}
                title={createLabel}
              >
                <Plus className={cn('h-4 w-4', !iconOnly && 'mr-2')} />
                {iconOnly ? (showSecondaryLabels ? createLabel : <span className="sr-only">{createLabel}</span>) : createLabel}
              </Button>
            );
          }

          if (control === 'refresh') {
            return (
              <Button
                key="refresh"
                type="button"
                variant="outline"
                className={cn('h-11', iconOnly ? 'w-11 px-0' : 'px-4')}
                aria-label={`${moduleLabel} refresh`}
                onClick={onRefresh}
                title="Refresh"
              >
                <RefreshCcw className={cn('h-4 w-4', !iconOnly && 'mr-2')} />
                {iconOnly ? (showSecondaryLabels ? 'Refresh' : <span className="sr-only">Refresh</span>) : 'Refresh'}
              </Button>
            );
          }

          if (control === 'importExport') {
            return (
              <Button
                key="importExport"
                type="button"
                variant="outline"
                className={cn('h-11', iconOnly ? (showSecondaryLabels ? 'px-3' : 'w-11 px-0') : 'px-4')}
                aria-label={`${moduleLabel} import export`}
                onClick={onImportExport}
                title="Import/Export"
              >
                <Download className={cn('h-4 w-4', !iconOnly && 'mr-2')} />
                {iconOnly ? (showSecondaryLabels ? 'Import/Export' : <span className="sr-only">Import/Export</span>) : 'Import/Export'}
              </Button>
            );
          }

          if (control === 'theme') {
            return (
              <Select key="theme" value={theme} onValueChange={onThemeChange}>
                <SelectTrigger
                  className={cn('h-11', iconOnly ? (showSecondaryLabels ? 'min-w-44' : 'w-11 px-0') : 'min-w-44')}
                  aria-label={`${moduleLabel} theme ${theme}`}
                  title={theme}
                >
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    {iconOnly ? (showSecondaryLabels ? <SelectValue placeholder="Azure Sky" /> : <span className="sr-only">{theme}</span>) : <SelectValue placeholder="Azure Sky" />}
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {themeOptions.map((themeName) => (
                    <SelectItem key={themeName} value={themeName}>
                      {themeName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          }

          const navIndex = viewItems.findIndex((item) => item.kind === 'mode' && item.mode === control);
          if (navIndex < 0) return null;
          const isActive = viewMode === control && !(analyticsActive && control === 'pipeline');
          const label = toLabel(control);
          const Icon = modeIcon(control);
          return (
            <Button
              key={control}
              type="button"
              variant={isActive ? 'secondary' : 'outline'}
              className={cn('h-11', iconOnly ? 'w-11 px-0' : 'min-w-20 px-4')}
              aria-label={`${moduleLabel} ${label} view`}
              aria-pressed={isActive}
              onClick={() => onViewModeChange(control)}
              onKeyDown={(event) => handleViewKeyboard(event, navIndex)}
              title={label}
              ref={(node) => {
                viewButtonRefs.current[navIndex] = node;
              }}
            >
              {iconOnly ? (
                <>
                  <Icon className="h-4 w-4" />
                  <span className="sr-only">{label}</span>
                </>
              ) : (
                label
              )}
            </Button>
          );
        })}
        {shouldRenderSecondaryAnalytics && onAnalyticsClick ? (
          <Button
            key="analytics-secondary"
            type="button"
            variant={analyticsActive ? 'secondary' : 'outline'}
            className={cn('h-11', iconOnly ? 'w-11 px-0' : 'min-w-20 px-4')}
            aria-label={`${moduleLabel} ${analyticsLabel} view`}
            aria-pressed={analyticsActive}
            onClick={onAnalyticsClick}
            title={analyticsLabel}
          >
            {iconOnly ? (
              <>
                <BarChart3 className="h-4 w-4" />
                <span className="sr-only">{analyticsLabel}</span>
              </>
            ) : (
              analyticsLabel
            )}
          </Button>
        ) : null}
      </div>
    </nav>
  );
}
