import React, { useState } from 'react';
import { X, Plus, Filter, Save, Trash2, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export interface FilterField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select';
  options?: { label: string; value: string }[];
}

export interface FilterCondition {
  id: string;
  fieldId: string;
  operator: string;
  value: string;
}

interface AdvancedFilterProps {
  fields: FilterField[];
  onApply: (conditions: FilterCondition[]) => void;
  onSavePreset?: (name: string, conditions: FilterCondition[]) => void;
  savedPresets?: { id: string; name: string; conditions: FilterCondition[] }[];
  className?: string;
}

const OPERATORS = {
  text: [
    { label: 'Contains', value: 'contains' },
    { label: 'Equals', value: 'equals' },
    { label: 'Starts with', value: 'starts_with' },
  ],
  number: [
    { label: 'Equals', value: 'equals' },
    { label: 'Greater than', value: 'gt' },
    { label: 'Less than', value: 'lt' },
  ],
  date: [
    { label: 'Is', value: 'is' },
    { label: 'Before', value: 'before' },
    { label: 'After', value: 'after' },
  ],
  select: [
    { label: 'Is', value: 'is' },
    { label: 'Is not', value: 'is_not' },
  ],
};

export function AdvancedFilter({
  fields,
  onApply,
  onSavePreset,
  savedPresets = [],
  className,
}: AdvancedFilterProps) {
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [presetName, setPresetName] = useState('');

  const addCondition = () => {
    const field = fields[0];
    const newCondition: FilterCondition = {
      id: Math.random().toString(36).substr(2, 9),
      fieldId: field.id,
      operator: OPERATORS[field.type][0].value,
      value: '',
    };
    setConditions([...conditions, newCondition]);
  };

  const updateCondition = (id: string, updates: Partial<FilterCondition>) => {
    setConditions(
      conditions.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, ...updates };
        // Reset operator/value if field changes
        if (updates.fieldId) {
          const newField = fields.find((f) => f.id === updates.fieldId);
          if (newField) {
            updated.operator = OPERATORS[newField.type][0].value;
            updated.value = '';
          }
        }
        return updated;
      })
    );
  };

  const removeCondition = (id: string) => {
    setConditions(conditions.filter((c) => c.id !== id));
  };

  const handleApply = () => {
    onApply(conditions);
    setIsOpen(false);
  };

  const handleSavePreset = () => {
    if (onSavePreset && presetName) {
      onSavePreset(presetName, conditions);
      setPresetName('');
    }
  };

  const loadPreset = (presetConditions: FilterCondition[]) => {
    setConditions(presetConditions);
    onApply(presetConditions);
  };

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-center gap-2 flex-wrap">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 border-dashed">
              <Filter className="mr-2 h-4 w-4" />
              Filter
              {conditions.length > 0 && (
                <Badge variant="secondary" className="ml-2 rounded-sm px-1 font-normal">
                  {conditions.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[500px] p-4" align="start">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium leading-none">Filters</h4>
                <Button variant="ghost" size="sm" onClick={() => setConditions([])}>
                  Clear all
                </Button>
              </div>
              
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {conditions.map((condition) => {
                  const field = fields.find((f) => f.id === condition.fieldId);
                  const operators = field ? OPERATORS[field.type] : [];

                  return (
                    <div key={condition.id} className="flex items-center gap-2 group">
                      <Select
                        value={condition.fieldId}
                        onValueChange={(val) => updateCondition(condition.id, { fieldId: val })}
                      >
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {fields.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={condition.operator}
                        onValueChange={(val) => updateCondition(condition.id, { operator: val })}
                      >
                        <SelectTrigger className="w-[110px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {operators.map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {field?.type === 'date' ? (
                         <Popover>
                         <PopoverTrigger asChild>
                           <Button
                             variant={"outline"}
                             className={cn(
                               "w-full h-8 justify-start text-left font-normal text-xs",
                               !condition.value && "text-muted-foreground"
                             )}
                           >
                             <CalendarIcon className="mr-2 h-3 w-3" />
                             {condition.value ? format(new Date(condition.value), "PPP") : <span>Pick a date</span>}
                           </Button>
                         </PopoverTrigger>
                         <PopoverContent className="w-auto p-0">
                           <Calendar
                             mode="single"
                             selected={condition.value ? new Date(condition.value) : undefined}
                             onSelect={(date) => updateCondition(condition.id, { value: date ? date.toISOString() : '' })}
                             initialFocus
                           />
                         </PopoverContent>
                       </Popover>
                      ) : field?.type === 'select' ? (
                        <Select
                          value={condition.value}
                          onValueChange={(val) => updateCondition(condition.id, { value: val })}
                        >
                          <SelectTrigger className="flex-1 h-8 text-xs">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options?.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={condition.value}
                          onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                          className="flex-1 h-8 text-xs"
                          placeholder="Value..."
                          type={field?.type === 'number' ? 'number' : 'text'}
                        />
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeCondition(condition.id)}
                        aria-label="Remove condition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
                
                {conditions.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-8 border-2 border-dashed rounded-lg">
                    No filters applied
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={addCondition} className="h-8">
                  <Plus className="mr-2 h-3 w-3" />
                  Add Filter
                </Button>
                <div className="flex-1" />
                <Button size="sm" onClick={handleApply} className="h-8">
                  Apply Filters
                </Button>
              </div>

              {onSavePreset && conditions.length > 0 && (
                <div className="pt-4 border-t flex items-center gap-2">
                  <Input 
                    placeholder="Save as preset..." 
                    className="h-8 text-xs"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                  />
                  <Button variant="secondary" size="sm" onClick={handleSavePreset} disabled={!presetName} className="h-8">
                    <Save className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {savedPresets.length > 0 && (
          <div className="flex items-center gap-2 border-l pl-2 ml-2">
             <span className="text-xs text-muted-foreground">Presets:</span>
             {savedPresets.map(preset => (
               <Badge 
                key={preset.id} 
                variant="outline" 
                className="cursor-pointer hover:bg-slate-100"
                onClick={() => loadPreset(preset.conditions)}
              >
                 {preset.name}
               </Badge>
             ))}
          </div>
        )}

        {/* Active Filter Chips */}
        {conditions.map((condition) => {
          const field = fields.find(f => f.id === condition.fieldId);
          if (!field) return null;
          return (
            <Badge key={condition.id} variant="secondary" className="h-8 pl-2 pr-1 gap-1">
              <span>{field.label}</span>
              <span className="text-muted-foreground px-1">{condition.operator}</span>
              <span className="font-semibold max-w-[100px] truncate">
                {field.type === 'date' ? format(new Date(condition.value || new Date()), 'MMM d') : condition.value}
              </span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-4 w-4 ml-1 hover:bg-transparent"
                onClick={() => removeCondition(condition.id)}
                aria-label="Remove filter"
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
