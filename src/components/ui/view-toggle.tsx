import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ViewMode = 'pipeline' | 'card' | 'grid' | 'list';

interface ViewToggleProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  className?: string;
  modes?: ViewMode[];
}

const labelFor = (mode: ViewMode): string => {
  switch (mode) {
    case 'pipeline':
      return 'Pipeline';
    case 'card':
      return 'Card';
    case 'grid':
      return 'Grid';
    case 'list':
      return 'List';
    default:
      return String(mode);
  }
};

export function ViewToggle({ value, onChange, className, modes }: ViewToggleProps) {
  const available: ViewMode[] = modes ?? ['card', 'grid', 'list'];

  return (
    <div className={cn('inline-flex items-center gap-px rounded-md border', className)}>
      {available.map((key) => (
        <Button
          key={key}
          type="button"
          variant={value === key ? 'default' : 'ghost'}
          size="sm"
          className={cn('rounded-none', value === key && 'pointer-events-none')}
          onClick={() => onChange(key)}
        >
          {labelFor(key)}
        </Button>
      ))}
    </div>
  );
}