import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type ViewMode = 'pipeline' | 'card' | 'grid' | 'list' | 'board' | 'analytics';

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
      case 'analytics':
        return t('views.analytics', 'Analytics');
      default:
        return String(mode);
    }
  };

  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as ViewMode)}
    >
      <SelectTrigger
        className={cn('h-9 min-w-[140px]', className)}
        aria-label={t('views.selector', 'View mode selector')}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {available.map((key) => (
          <SelectItem
            key={key}
            value={key}
            aria-label={t('views.switchTo', 'Switch to {{view}} view', { view: labelFor(key) })}
          >
            {labelFor(key)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
