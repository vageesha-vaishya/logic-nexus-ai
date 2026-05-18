import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { GOALS } from '../types';

interface GoalSelectorProps {
  selected: string[];
  onChange: (goals: string[]) => void;
  maxSelections?: number;
}

export function GoalSelector({ selected, onChange, maxSelections = 3 }: GoalSelectorProps) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((g) => g !== id));
      return;
    }
    if (selected.length >= maxSelections) return;
    onChange([...selected, id]);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Select up to {maxSelections} goals
      </p>
      <div className="space-y-2">
        {GOALS.map(({ id, label }) => {
          const isSelected = selected.includes(id);
          const isDisabled = !isSelected && selected.length >= maxSelections;
          return (
            <div
              key={id}
              className={`flex items-center gap-3 rounded-md border p-3 transition-colors ${
                isDisabled ? 'opacity-50' : 'cursor-pointer hover:bg-muted/40'
              } ${isSelected ? 'border-primary bg-primary/5' : ''}`}
              onClick={() => !isDisabled && toggle(id)}
            >
              <Checkbox
                id={id}
                checked={isSelected}
                disabled={isDisabled}
                onCheckedChange={() => toggle(id)}
                onClick={(e) => e.stopPropagation()}
              />
              <Label htmlFor={id} className="cursor-pointer text-sm flex-1">
                {label}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
