import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ViewMode = 'card' | 'grid' | 'list';

interface ViewToggleProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  className?: string;
}

export function ViewToggle({ value, onChange, className }: ViewToggleProps) {
  const modes: { key: ViewMode; label: string }[] = [
    { key: 'card', label: 'Card' },
    { key: 'grid', label: 'Grid' },
    { key: 'list', label: 'List' },
  ];

  return (
    <div className={cn('inline-flex items-center gap-px rounded-md border', className)}>
      {modes.map((m) => (
        <Button
          key={m.key}
          type="button"
          variant={value === m.key ? 'default' : 'ghost'}
          size="sm"
          className={cn('rounded-none', value === m.key && 'pointer-events-none')}
          onClick={() => onChange(m.key)}
        >
          {m.label}
        </Button>
      ))}
    </div>
  );
}