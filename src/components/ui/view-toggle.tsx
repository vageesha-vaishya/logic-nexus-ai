import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export type ViewMode = 'pipeline' | 'card' | 'grid' | 'list' | 'board';

interface ViewToggleProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  className?: string;
  modes?: ViewMode[];
}

export function ViewToggle({ value, onChange, className, modes }: ViewToggleProps) {
  const { t } = useTranslation();
  const available: ViewMode[] = modes ?? ['card', 'grid', 'list'];

  const labelFor = (mode: ViewMode): string => {
    switch (mode) {
      case 'board':
        return t('views.board', 'Board');
      case 'pipeline':
        return t('views.pipeline', 'Pipeline');
      case 'card':
        return t('views.card', 'Card');
      case 'grid':
        return t('views.grid', 'Grid');
      case 'list':
        return t('views.list', 'List');
      default:
        return String(mode);
    }
  };

  return (
    <div className={cn('inline-flex items-center gap-px rounded-md border', className)}>
      {available.map((key) => (
        <Button
          key={key}
          type="button"
          variant={value === key ? 'default' : 'ghost'}
          size="sm"
          className={cn('rounded-none')}
          onClick={() => {
            if (key === value) return;
            onChange(key);
          }}
          aria-pressed={value === key}
          aria-label={t('views.switchTo', 'Switch to {{view}} view', { view: labelFor(key) })}
        >
          {labelFor(key)}
        </Button>
      ))}
    </div>
  );
}
