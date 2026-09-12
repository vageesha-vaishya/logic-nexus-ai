import { Search, Filter, TrendingUp, Users as UsersIcon, SlidersHorizontal, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TextOp } from '@/lib/utils';
import { LIST_FIELD_OPTIONS, type LeadGroupBy, type ListFieldKey } from '@/pages/dashboard/leadsListUtils';

export interface LeadsActiveFilterTag {
  key: string;
  label: string;
  onClear: () => void;
}

interface LeadsFilterToolbarProps {
  localSearch: string;
  onLocalSearchChange: (value: string) => void;
  hasActiveSearch: boolean;
  matchedLeadIds: string[];
  activeMatchedLeadId: string | null;
  onNavigateMatchedLeads: (direction: 'next' | 'prev') => void;

  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  ownerFilter: 'any' | 'unassigned' | 'me';
  onOwnerFilterChange: (value: 'any' | 'unassigned' | 'me') => void;
  scoreFilter: string;
  onScoreFilterChange: (value: string) => void;
  groupBy: LeadGroupBy;
  onGroupByChange: (value: LeadGroupBy) => void;

  valueMin: string;
  onValueMinChange: (value: string) => void;
  valueMax: string;
  onValueMaxChange: (value: string) => void;

  nameOp: TextOp;
  onNameOpChange: (value: TextOp) => void;
  nameQuery: string;
  onNameQueryChange: (value: string) => void;

  visibleFieldSet: Set<ListFieldKey>;
  onFieldVisibilityChange: (field: ListFieldKey, checked: boolean | 'indeterminate') => void;

  activeFilterTags: LeadsActiveFilterTag[];
  onClearAllFilters: () => void;
}

export function LeadsFilterToolbar({
  localSearch,
  onLocalSearchChange,
  hasActiveSearch,
  matchedLeadIds,
  activeMatchedLeadId,
  onNavigateMatchedLeads,
  statusFilter,
  onStatusFilterChange,
  ownerFilter,
  onOwnerFilterChange,
  scoreFilter,
  onScoreFilterChange,
  groupBy,
  onGroupByChange,
  valueMin,
  onValueMinChange,
  valueMax,
  onValueMaxChange,
  nameOp,
  onNameOpChange,
  nameQuery,
  onNameQueryChange,
  visibleFieldSet,
  onFieldVisibilityChange,
  activeFilterTags,
  onClearAllFilters,
}: LeadsFilterToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-0.5 mb-1.5">
      <div className="w-full overflow-x-auto">
        <div className="flex flex-nowrap items-center gap-0.5 min-w-max">
          <div className="relative w-[280px] shrink-0">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('leads.filters.searchPlaceholder', 'Search by name, company, or email')}
              value={localSearch}
              onChange={(e) => onLocalSearchChange(e.target.value)}
              onKeyDown={(event) => {
                if (!hasActiveSearch) return;
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  onNavigateMatchedLeads('next');
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  onNavigateMatchedLeads('prev');
                }
              }}
              className="h-7 pl-8.5 bg-background"
            />
          </div>
          {hasActiveSearch && (
            <span className="text-xs text-muted-foreground px-1">
              {matchedLeadIds.length > 0
                ? `${Math.max(1, matchedLeadIds.indexOf(activeMatchedLeadId || '') + 1)} / ${matchedLeadIds.length}`
                : '0 / 0'}
            </span>
          )}

          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="h-7 w-[160px] shrink-0 bg-background px-1">
              <Filter className="mr-0.5 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder={t('leads.filters.status', 'Stage')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('leads.filters.allStatus', 'All Status')}</SelectItem>
              <SelectItem value="new">{t('leads.filters.statusOptions.new', 'New')}</SelectItem>
              <SelectItem value="contacted">{t('leads.filters.statusOptions.contacted', 'Contacted')}</SelectItem>
              <SelectItem value="qualified">{t('leads.filters.statusOptions.qualified', 'Qualified')}</SelectItem>
              <SelectItem value="proposal">{t('leads.filters.statusOptions.proposal', 'Proposal')}</SelectItem>
              <SelectItem value="negotiation">{t('leads.filters.statusOptions.negotiation', 'Negotiation')}</SelectItem>
              <SelectItem value="won">{t('leads.filters.statusOptions.won', 'Won')}</SelectItem>
              <SelectItem value="lost">{t('leads.filters.statusOptions.lost', 'Lost')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={ownerFilter} onValueChange={(v) => onOwnerFilterChange(v as 'any' | 'unassigned' | 'me')}>
            <SelectTrigger className="h-7 w-[160px] shrink-0 bg-background px-1">
              <UsersIcon className="mr-0.5 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder={t('leads.filters.owner', 'Owner')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t('leads.filters.anyOwner', 'Any Owner')}</SelectItem>
              <SelectItem value="me">{t('leads.filters.ownerOptions.me', 'Assigned to Me')}</SelectItem>
              <SelectItem value="unassigned">{t('leads.filters.ownerOptions.unassigned', 'Unassigned')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={scoreFilter} onValueChange={onScoreFilterChange}>
            <SelectTrigger className="h-7 w-[160px] shrink-0 bg-background px-1">
              <TrendingUp className="mr-0.5 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder={t('leads.filters.score', 'Score')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('leads.filters.allScores', 'All Scores')}</SelectItem>
              <SelectItem value="high">{t('leads.filters.scoreOptions.high', 'High')}</SelectItem>
              <SelectItem value="medium">{t('leads.filters.scoreOptions.medium', 'Medium')}</SelectItem>
              <SelectItem value="low">{t('leads.filters.scoreOptions.low', 'Low')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={groupBy} onValueChange={(value) => onGroupByChange(value as LeadGroupBy)}>
            <SelectTrigger className="h-7 w-[170px] shrink-0 bg-background px-1" aria-label={t('leads.filters.groupBy', 'Group By')}>
              <SelectValue placeholder={t('leads.filters.groupBy', 'Group By')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('leads.groupBy.none', 'No Grouping')}</SelectItem>
              <SelectItem value="status">{t('leads.groupBy.status', 'Lead Status')}</SelectItem>
              <SelectItem value="source">{t('leads.groupBy.source', 'Lead Source')}</SelectItem>
              <SelectItem value="assigned_to">{t('leads.groupBy.assignedTo', 'Assigned To')}</SelectItem>
              <SelectItem value="industry">{t('leads.groupBy.industry', 'Industry')}</SelectItem>
              <SelectItem value="created_date">{t('leads.groupBy.createdDate', 'Created Date')}</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex flex-nowrap items-center gap-0.5 shrink-0">
            <Input
              type="number"
              placeholder={t('leads.filters.valueMin', 'Min Value')}
              value={valueMin}
              onChange={(e) => onValueMinChange(e.target.value)}
              className="h-7 w-[120px] bg-background"
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="number"
              placeholder={t('leads.filters.valueMax', 'Max Value')}
              value={valueMax}
              onChange={(e) => onValueMaxChange(e.target.value)}
              className="h-7 w-[120px] bg-background"
            />
          </div>

          <div className="flex flex-nowrap items-center gap-0.5 shrink-0">
            <Select value={nameOp} onValueChange={(v) => onNameOpChange(v as TextOp)}>
              <SelectTrigger className="h-7 w-[130px] bg-background px-1">
                <SelectValue placeholder={t('leads.filters.nameMatch', 'Name Match')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">{t('leads.filters.ops.contains', 'Contains')}</SelectItem>
                <SelectItem value="equals">{t('leads.filters.ops.equals', 'Equals')}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder={t('leads.filters.name', 'Lead Name')}
              value={nameQuery}
              onChange={(e) => onNameQueryChange(e.target.value)}
              className="h-7 w-[150px] bg-background"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-7 shrink-0 px-1.5">
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                {t('leads.filters.fields', 'Fields')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 max-h-96 overflow-y-auto">
              <DropdownMenuLabel>{t('leads.filters.visibleFields', 'Visible Fields')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {LIST_FIELD_OPTIONS.map((field) => (
                <DropdownMenuCheckboxItem
                  key={field.key}
                  checked={visibleFieldSet.has(field.key)}
                  onCheckedChange={(checked) => onFieldVisibilityChange(field.key, checked)}
                >
                  {field.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            className="h-7 shrink-0 px-1.5"
            disabled={activeFilterTags.length === 0}
            onClick={onClearAllFilters}
          >
            {t('leads.filters.clearFilters', 'Clear Filters')}
          </Button>
        </div>
      </div>
      {activeFilterTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeFilterTags.map((tag) => (
            <Badge key={tag.key} variant="secondary" className="flex items-center gap-1 pr-1">
              <span>{tag.label}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0"
                onClick={tag.onClear}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
