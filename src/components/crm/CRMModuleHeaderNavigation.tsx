import { KeyboardEvent, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Download, Palette, Plus, RefreshCcw } from 'lucide-react';
import { CRMModuleViewMode } from '@/hooks/useCRMModuleNavigationState';
import { THEME_PRESETS } from '@/theme/themes';

const VIEW_MODE_SEQUENCE: CRMModuleViewMode[] = ['pipeline', 'card', 'grid', 'list'];

function toLabel(mode: CRMModuleViewMode): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
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
  createLabel?: string;
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
  createLabel = 'New',
  className,
}: CRMModuleHeaderNavigationProps) {
  const viewButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const themeOptions = useMemo(() => THEME_PRESETS.map((preset) => preset.name), []);

  const handleViewKeyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const maxIndex = VIEW_MODE_SEQUENCE.length - 1;
    const nextIndex =
      event.key === 'ArrowRight'
        ? (index + 1) % VIEW_MODE_SEQUENCE.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + VIEW_MODE_SEQUENCE.length) % VIEW_MODE_SEQUENCE.length
          : event.key === 'Home'
            ? 0
            : maxIndex;
    const nextMode = VIEW_MODE_SEQUENCE[nextIndex];
    onViewModeChange(nextMode);
    viewButtonRefs.current[nextIndex]?.focus();
  };

  return (
    <nav
      className={cn('w-full', className)}
      aria-label={`${moduleLabel} header navigation`}
    >
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex min-w-max items-center gap-2 md:justify-end">
        {VIEW_MODE_SEQUENCE.map((mode, index) => (
          <Button
            key={mode}
            type="button"
            variant={viewMode === mode ? 'secondary' : 'outline'}
            className="h-11 min-w-20 px-4"
            aria-label={`${moduleLabel} ${toLabel(mode)} view`}
            aria-pressed={viewMode === mode}
            onClick={() => onViewModeChange(mode)}
            onKeyDown={(event) => handleViewKeyboard(event, index)}
            ref={(node) => {
              viewButtonRefs.current[index] = node;
            }}
          >
            {toLabel(mode)}
          </Button>
        ))}
        <Button
          type="button"
          className="h-11 px-4"
          aria-label={`${moduleLabel} ${createLabel}`}
          onClick={onCreate}
        >
          <Plus className="mr-2 h-4 w-4" />
          {createLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 px-4"
          aria-label={`${moduleLabel} refresh`}
          onClick={onRefresh}
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 px-4"
          aria-label={`${moduleLabel} import export`}
          onClick={onImportExport}
        >
          <Download className="mr-2 h-4 w-4" />
          Import/Export
        </Button>
        <Select value={theme} onValueChange={onThemeChange}>
          <SelectTrigger
            className="h-11 min-w-44"
            aria-label={`${moduleLabel} theme`}
          >
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              <SelectValue placeholder="Azure Sky" />
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
        </div>
      </div>
    </nav>
  );
}
