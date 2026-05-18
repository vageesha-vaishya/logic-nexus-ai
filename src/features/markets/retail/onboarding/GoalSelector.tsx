import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { GOALS } from '../types';

interface GoalSelectorProps {
  selected: string[];
  onChange: (goals: string[]) => void;
}

export function GoalSelector({ selected, onChange }: GoalSelectorProps) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((g) => g !== id));
    } else if (selected.length < 3) {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Select up to 3 goals</p>
      {GOALS.map(({ id, label }) => (
        <div
          key={id}
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => toggle(id)}
        >
          <Checkbox
            id={id}
            checked={selected.includes(id)}
            onCheckedChange={() => toggle(id)}
          />
          <Label htmlFor={id} className="cursor-pointer text-sm">
            {label}
          </Label>
        </div>
      ))}
    </div>
  );
}
