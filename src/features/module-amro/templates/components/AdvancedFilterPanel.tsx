/**
 * Advanced Filter Panel Component
 * 
 * Features:
 * - Date range picker (Updated At, Created At)
 * - Number range inputs (Tasks Count, Labor Hours)
 * - Multi-select aircraft models
 * - Filter presets (save/load filter combinations)
 * - Clear all filters
 * - Keyboard accessible
 */

import { useState, useCallback } from 'react';
import { Calendar, Filter, X, Save, FolderOpen, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DateRange {
  from?: Date;
  to?: Date;
}

interface NumberRange {
  min?: number;
  max?: number;
}

interface AdvancedFilters {
  updatedAtRange?: DateRange;
  createdAtRange?: DateRange;
  tasksCountRange?: NumberRange;
  laborHoursRange?: NumberRange;
  aircraftModels?: string[];
}

interface AdvancedFilterPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: AdvancedFilters;
  onFilterChange: (filters: AdvancedFilters) => void;
  aircraftModels?: Array<{ id: string; name: string; code: string }>;
  savedPresets?: Array<{ id: string; name: string; filters: AdvancedFilters }>;
  onSavePreset?: (name: string, filters: AdvancedFilters) => void;
  onLoadPreset?: (presetId: string) => void;
  onDeletePreset?: (presetId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AdvancedFilterPanel({
  open,
  onOpenChange,
  filters,
  onFilterChange,
  aircraftModels = [],
  savedPresets = [],
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
}: AdvancedFilterPanelProps) {
  const [updatedAtRange, setUpdatedAtRange] = useState<DateRange>(
    filters.updatedAtRange || {}
  );
  const [createdAtRange, setCreatedAtRange] = useState<DateRange>(
    filters.createdAtRange || {}
  );
  const [tasksCountRange, setTasksCountRange] = useState<NumberRange>(
    filters.tasksCountRange || {}
  );
  const [laborHoursRange, setLaborHoursRange] = useState<NumberRange>(
    filters.laborHoursRange || {}
  );
  const [selectedAircraftModels, setSelectedAircraftModels] = useState<string[]>(
    filters.aircraftModels || []
  );
  const [presetName, setPresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);

  // Handle apply filters
  const handleApply = useCallback(() => {
    onFilterChange({
      updatedAtRange: updatedAtRange.from || updatedAtRange.to ? updatedAtRange : undefined,
      createdAtRange: createdAtRange.from || createdAtRange.to ? createdAtRange : undefined,
      tasksCountRange: tasksCountRange.min !== undefined || tasksCountRange.max !== undefined
        ? tasksCountRange
        : undefined,
      laborHoursRange: laborHoursRange.min !== undefined || laborHoursRange.max !== undefined
        ? laborHoursRange
        : undefined,
      aircraftModels: selectedAircraftModels.length > 0 ? selectedAircraftModels : undefined,
    });
    onOpenChange(false);
  }, [
    updatedAtRange,
    createdAtRange,
    tasksCountRange,
    laborHoursRange,
    selectedAircraftModels,
    onFilterChange,
    onOpenChange,
  ]);

  // Handle clear filters
  const handleClear = useCallback(() => {
    setUpdatedAtRange({});
    setCreatedAtRange({});
    setTasksCountRange({});
    setLaborHoursRange({});
    setSelectedAircraftModels([]);
    onFilterChange({});
  }, [onFilterChange]);

  // Handle save preset
  const handleSavePreset = useCallback(() => {
    if (!presetName.trim() || !onSavePreset) return;

    onSavePreset(presetName.trim(), {
      updatedAtRange,
      createdAtRange,
      tasksCountRange,
      laborHoursRange,
      aircraftModels: selectedAircraftModels,
    });

    setPresetName('');
    setShowSavePreset(false);
  }, [presetName, updatedAtRange, createdAtRange, tasksCountRange, laborHoursRange, selectedAircraftModels, onSavePreset]);

  // Toggle aircraft model
  const toggleAircraftModel = useCallback((modelId: string) => {
    setSelectedAircraftModels(prev =>
      prev.includes(modelId)
        ? prev.filter(id => id !== modelId)
        : [...prev, modelId]
    );
  }, []);

  // Count active filters
  const activeFilterCount = [
    updatedAtRange.from || updatedAtRange.to,
    createdAtRange.from || createdAtRange.to,
    tasksCountRange.min !== undefined || tasksCountRange.max !== undefined,
    laborHoursRange.min !== undefined || laborHoursRange.max !== undefined,
    selectedAircraftModels.length > 0,
  ].filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Advanced Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary">{activeFilterCount} active</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Apply advanced filters to narrow down your template search.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Saved Presets */}
            {savedPresets.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Saved Presets</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSavePreset(true)}
                    className="gap-2 h-7"
                  >
                    <Save className="w-3 h-3" />
                    Save Current
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {savedPresets.map((preset) => (
                    <Badge
                      key={preset.id}
                      variant="outline"
                      className="gap-1 pr-1 cursor-pointer hover:bg-accent"
                      onClick={() => onLoadPreset?.(preset.id)}
                    >
                      <FolderOpen className="w-3 h-3" />
                      {preset.name}
                      {onDeletePreset && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeletePreset(preset.id);
                          }}
                          className="ml-1 hover:text-destructive"
                          aria-label={`Delete preset ${preset.name}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>

                <Separator />
              </div>
            )}

            {/* Save Preset Dialog */}
            {showSavePreset && (
              <div className="flex gap-2">
                <Input
                  placeholder="Preset name..."
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  className="flex-1"
                />
                <Button size="sm" onClick={handleSavePreset} disabled={!presetName.trim()}>
                  Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSavePreset(false)}
                >
                  Cancel
                </Button>
              </div>
            )}

            {/* Date Range Filters */}
            <div className="space-y-4">
              <Label>Date Ranges</Label>

              {/* Updated At Range */}
              <div className="space-y-2">
                <Label className="text-sm">Updated At</Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'justify-start text-left font-normal flex-1',
                          !updatedAtRange.from && 'text-muted-foreground'
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {updatedAtRange.from ? (
                          format(updatedAtRange.from, 'PPP')
                        ) : (
                          <span>From date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={updatedAtRange.from}
                        onSelect={(date) =>
                          setUpdatedAtRange(prev => ({ ...prev, from: date }))
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'justify-start text-left font-normal flex-1',
                          !updatedAtRange.to && 'text-muted-foreground'
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {updatedAtRange.to ? (
                          format(updatedAtRange.to, 'PPP')
                        ) : (
                          <span>To date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={updatedAtRange.to}
                        onSelect={(date) =>
                          setUpdatedAtRange(prev => ({ ...prev, to: date }))
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  {(updatedAtRange.from || updatedAtRange.to) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setUpdatedAtRange({})}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Created At Range */}
              <div className="space-y-2">
                <Label className="text-sm">Created At</Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'justify-start text-left font-normal flex-1',
                          !createdAtRange.from && 'text-muted-foreground'
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {createdAtRange.from ? (
                          format(createdAtRange.from, 'PPP')
                        ) : (
                          <span>From date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={createdAtRange.from}
                        onSelect={(date) =>
                          setCreatedAtRange(prev => ({ ...prev, from: date }))
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'justify-start text-left font-normal flex-1',
                          !createdAtRange.to && 'text-muted-foreground'
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {createdAtRange.to ? (
                          format(createdAtRange.to, 'PPP')
                        ) : (
                          <span>To date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={createdAtRange.to}
                        onSelect={(date) =>
                          setCreatedAtRange(prev => ({ ...prev, to: date }))
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  {(createdAtRange.from || createdAtRange.to) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCreatedAtRange({})}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Number Range Filters */}
            <div className="space-y-4">
              <Label>Number Ranges</Label>

              {/* Tasks Count Range */}
              <div className="space-y-2">
                <Label className="text-sm">Tasks Count</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={tasksCountRange.min ?? ''}
                    onChange={(e) =>
                      setTasksCountRange(prev => ({
                        ...prev,
                        min: e.target.value ? parseInt(e.target.value, 10) : undefined,
                      }))
                    }
                    min={0}
                    className="flex-1"
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={tasksCountRange.max ?? ''}
                    onChange={(e) =>
                      setTasksCountRange(prev => ({
                        ...prev,
                        max: e.target.value ? parseInt(e.target.value, 10) : undefined,
                      }))
                    }
                    min={0}
                    className="flex-1"
                  />
                  {(tasksCountRange.min !== undefined || tasksCountRange.max !== undefined) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTasksCountRange({})}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Labor Hours Range */}
              <div className="space-y-2">
                <Label className="text-sm">Estimated Labor Hours</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={laborHoursRange.min ?? ''}
                    onChange={(e) =>
                      setLaborHoursRange(prev => ({
                        ...prev,
                        min: e.target.value ? parseFloat(e.target.value) : undefined,
                      }))
                    }
                    min={0}
                    step="0.1"
                    className="flex-1"
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={laborHoursRange.max ?? ''}
                    onChange={(e) =>
                      setLaborHoursRange(prev => ({
                        ...prev,
                        max: e.target.value ? parseFloat(e.target.value) : undefined,
                      }))
                    }
                    min={0}
                    step="0.1"
                    className="flex-1"
                  />
                  {(laborHoursRange.min !== undefined || laborHoursRange.max !== undefined) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLaborHoursRange({})}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Aircraft Models */}
            {aircraftModels.length > 0 && (
              <div className="space-y-3">
                <Label>Aircraft Models</Label>
                <div className="flex flex-wrap gap-2">
                  {aircraftModels.map((model) => (
                    <Badge
                      key={model.id}
                      variant={selectedAircraftModels.includes(model.id) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleAircraftModel(model.id)}
                    >
                      {model.name} ({model.code})
                    </Badge>
                  ))}
                </div>
                {selectedAircraftModels.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {selectedAircraftModels.length} model{selectedAircraftModels.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClear}
            className="gap-2"
          >
            <X className="w-4 h-4" />
            Clear All
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleApply}>
            Apply Filters
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
