import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Filter, Search } from "lucide-react";

export type FilterOperator = 'equals' | 'contains' | 'gt' | 'lt' | 'starts_with';

export interface FilterCriterion {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
}

interface AdvancedSearchFilterProps {
  onFilterApply: (criteria: FilterCriterion[], matchMode: 'all' | 'any') => void;
  activeFilters: FilterCriterion[];
  onRemoveFilter: (id: string) => void;
}

const AVAILABLE_FIELDS = [
  { value: 'quote_number', label: 'Quote Number' },
  { value: 'account_name', label: 'Customer' },
  { value: 'total_amount', label: 'Total Amount' },
  { value: 'status', label: 'Status' },
  { value: 'created_at', label: 'Creation Date' },
  { value: 'valid_until', label: 'Expiration Date' },
  { value: 'sales_rep', label: 'Salesperson' },
];

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'starts_with', label: 'Starts With' },
  { value: 'gt', label: 'Greater Than' },
  { value: 'lt', label: 'Less Than' },
];

export function AdvancedSearchFilter({ onFilterApply, activeFilters, onRemoveFilter }: AdvancedSearchFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [matchMode, setMatchMode] = useState<'all' | 'any'>('all');
  const [tempFilters, setTempFilters] = useState<FilterCriterion[]>([
    { id: '1', field: 'quote_number', operator: 'contains', value: '' }
  ]);

  const addFilterRow = () => {
    setTempFilters([
      ...tempFilters,
      { id: Date.now().toString(), field: 'quote_number', operator: 'contains', value: '' }
    ]);
  };

  const removeFilterRow = (id: string) => {
    if (tempFilters.length > 1) {
      setTempFilters(tempFilters.filter(f => f.id !== id));
    }
  };

  const updateFilterRow = (id: string, key: keyof FilterCriterion, val: string) => {
    setTempFilters(tempFilters.map(f => f.id === id ? { ...f, [key]: val } : f));
  };

  const handleApply = () => {
    // Only apply valid filters (non-empty value)
    const validFilters = tempFilters.filter(f => f.value.trim() !== '');
    if (validFilters.length > 0) {
      onFilterApply(validFilters, matchMode);
      setIsOpen(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Active Filters Tags */}
      <div className="flex flex-wrap gap-2">
        {activeFilters.map(filter => (
          <Badge key={filter.id} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1">
            <span className="font-normal text-muted-foreground">
              {AVAILABLE_FIELDS.find(f => f.value === filter.field)?.label}:
            </span>
            <span className="font-medium">
              {filter.operator === 'contains' ? '~' : filter.operator === 'equals' ? '=' : filter.operator} "{filter.value}"
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 ml-1 hover:bg-transparent hover:text-destructive"
              onClick={() => onRemoveFilter(filter.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
      </div>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <Filter className="h-4 w-4" />
            <span>Filters</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[600px] p-4" align="start">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-medium">Match</span>
              <Select value={matchMode} onValueChange={(v: 'all' | 'any') => setMatchMode(v)}>
                <SelectTrigger className="w-[80px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="any">Any</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm font-medium">of the following rules:</span>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {tempFilters.map((filter, idx) => (
                <div key={filter.id} className="flex items-center gap-2">
                  <Select
                    value={filter.field}
                    onValueChange={(val) => updateFilterRow(filter.id, 'field', val)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_FIELDS.map(f => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={filter.operator}
                    onValueChange={(val) => updateFilterRow(filter.id, 'operator', val as FilterOperator)}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Operator" />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map(op => (
                        <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    value={filter.value}
                    onChange={(e) => updateFilterRow(filter.id, 'value', e.target.value)}
                    placeholder="Value..."
                    className="flex-1"
                  />

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFilterRow(filter.id)}
                    disabled={tempFilters.length === 1}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2Icon className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={addFilterRow}
              className="text-primary hover:text-primary/80 pl-0"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add rule
            </Button>

            <div className="flex justify-end gap-2 pt-4 border-t mt-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button onClick={handleApply}>
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function Trash2Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}
