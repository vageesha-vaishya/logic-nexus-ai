import { useMemo, useState, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { UimDataListColumn } from '@/modules/uim/components/UimDataList';
import { UimDataList } from '@/modules/uim/components/UimDataList';

export type UimTemplateState = 'ready' | 'loading' | 'empty' | 'error';
export type UimTemplateMode = 'create' | 'edit' | 'readonly';

export type UimTemplateValidationState = {
  status: 'ok' | 'warning' | 'error';
  messages: string[];
};

export type UimTemplateListConfig = {
  records: Array<Record<string, unknown>>;
  total: number;
  columns: UimDataListColumn<Record<string, unknown>>[];
  exportFileName: string;
  defaultVisibleColumnKeys?: string[];
  showFieldSelector?: boolean;
  statusOptions?: Array<{ value: string; label: string }>;
};

export type UimStandardFormTemplateProps = {
  moduleTitle: string;
  moduleDescription?: string;
  moduleKey: string;
  mode: UimTemplateMode;
  state: UimTemplateState;
  statusBadge?: string;
  breadcrumbs?: string[];
  validation?: UimTemplateValidationState;
  list: UimTemplateListConfig;
  headerActionsSlot?: ReactNode;
  formSlot?: ReactNode;
  sidePanelSlot?: ReactNode;
  footerSlot?: ReactNode;
  onCreate?: () => void;
  onReplayNow?: () => void;
};

export function UimStandardFormTemplate({
  moduleTitle,
  moduleDescription,
  moduleKey,
  mode,
  state,
  statusBadge,
  breadcrumbs = [],
  validation = { status: 'ok', messages: [] },
  list,
  headerActionsSlot,
  formSlot,
  sidePanelSlot,
  footerSlot,
  onCreate = () => undefined,
  onReplayNow,
}: UimStandardFormTemplateProps) {
  const [searchValue, setSearchValue] = useState('');
  const [statusValue, setStatusValue] = useState('all');

  const filteredRecords = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    return list.records.filter((record) => {
      const payload = (record.payload || {}) as Record<string, unknown>;
      const tokens = [String(record.id || ''), ...Object.values(payload).map((v) => String(v ?? ''))];
      const matchesSearch = q.length === 0 || tokens.some((token) => token.toLowerCase().includes(q));
      const statusCandidate = String(payload.status || payload.reservation_status || payload.transaction_type || 'active').toLowerCase();
      const matchesStatus = statusValue === 'all' || statusCandidate === statusValue.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [list.records, searchValue, statusValue]);

  const recordsForState = state === 'empty' ? [] : filteredRecords;
  const loading = state === 'loading';
  const effectiveTotal = state === 'empty' ? 0 : list.total;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <CardTitle>{moduleTitle}</CardTitle>
              <CardDescription>{moduleDescription || `Standardized UIM template for ${moduleKey}`}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Mode: {mode}</Badge>
              {statusBadge ? <Badge variant="secondary">{statusBadge}</Badge> : null}
              {headerActionsSlot}
            </div>
          </div>
          {breadcrumbs.length > 0 ? (
            <div className="text-xs text-muted-foreground">{breadcrumbs.join(' / ')}</div>
          ) : null}
        </CardHeader>
      </Card>

      {validation.status !== 'ok' && validation.messages.length > 0 ? (
        <Alert variant={validation.status === 'error' ? 'destructive' : 'default'}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{validation.status === 'error' ? 'Validation Errors' : 'Validation Warnings'}</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {validation.messages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {state === 'error' ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Data Load Error</AlertTitle>
          <AlertDescription>Unable to load module records. Retry or verify API connectivity.</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <UimDataList
          records={recordsForState}
          total={effectiveTotal}
          loading={loading}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          statusValue={statusValue}
          onStatusChange={setStatusValue}
          onClearFilters={() => {
            setSearchValue('');
            setStatusValue('all');
          }}
          onCreate={onCreate}
          onRowClick={() => undefined}
          onRowDoubleClick={() => undefined}
          columns={list.columns}
          statusOptions={list.statusOptions}
          exportFileName={list.exportFileName}
          defaultVisibleColumnKeys={list.defaultVisibleColumnKeys}
          showFieldSelector={list.showFieldSelector !== false}
          onReplayNow={onReplayNow}
        />

        <Card>
          <CardHeader>
            <CardTitle>Form Panel</CardTitle>
            <CardDescription>Module-agnostic slot for form sections and actions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {formSlot || <div className="text-sm text-muted-foreground">Inject form fields via `formSlot`.</div>}
            {sidePanelSlot}
          </CardContent>
        </Card>
      </div>

      {footerSlot ? <div>{footerSlot}</div> : null}
    </div>
  );
}

export default UimStandardFormTemplate;
