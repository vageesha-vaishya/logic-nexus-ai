import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import posthog from 'posthog-js';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { OpportunityHistory, stageLabels } from '@/pages/dashboard/opportunities-data';
import { ExportField, HistoryFilters, HistoryFilterPreset, HistoryTypeFilter, buildCsvRows, filterHistory } from './opportunityHistoryUtils';
import { useCRM } from '@/hooks/useCRM';

type Props = {
  history: OpportunityHistory[];
  onRefresh: () => void;
};

export function OpportunityHistoryTab({ history, onRefresh }: Props) {
  const { supabase, context } = useCRM();
  const [filters, setFilters] = useState<HistoryFilters>({ type: 'any' });
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFields, setExportFields] = useState<ExportField[]>([
    'changed_at',
    'old_stage',
    'new_stage',
    'old_probability',
    'new_probability',
    'changed_by_name',
    'changed_by_email',
  ]);
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx'>('csv');
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [presets, setPresets] = useState<HistoryFilterPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [newPresetName, setNewPresetName] = useState<string>('');

  useEffect(() => {
    posthog.capture('crm.opportunity_history.view');
    loadPresets();
  }, []);

  const filtered = useMemo(() => {
    const res = filterHistory(history, filters);
    return res;
  }, [history, filters]);

  const loadPresets = async () => {
    // history_filter_presets table doesn't exist - use empty list
    setPresets([]);
  };

  const savePreset = async () => {
    // history_filter_presets table doesn't exist - feature disabled
    toast.info('Presets feature is not available');
  };

  const applyPreset = async (id: string) => {
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    setFilters(preset.filters || { type: 'any' });
    setSelectedPresetId(id);
    posthog.capture('crm.opportunity_history.preset_apply', { name: preset.name });
  };

  const deletePreset = async (id: string) => {
    // history_filter_presets table doesn't exist - feature disabled
    toast.info('Presets feature is not available');
  };

  const renamePreset = async (id: string, name: string) => {
    // history_filter_presets table doesn't exist - feature disabled
    toast.info('Presets feature is not available');
  };

  const applyFilters = (next: Partial<HistoryFilters>) => {
    const updated = { ...filters, ...next };
    setFilters(updated);
    posthog.capture('crm.opportunity_history.filter_apply', {
      type: updated.type,
      has_query: !!updated.query,
      has_start: !!updated.startDate,
      has_end: !!updated.endDate,
    });
  };

  const resetFilters = () => {
    setFilters({ type: 'any', query: '', startDate: undefined, endDate: undefined });
    posthog.capture('crm.opportunity_history.filter_reset');
  };

  const toggleField = (f: ExportField) => {
    setExportFields((prev) => {
      if (prev.includes(f)) return prev.filter((x) => x !== f);
      return [...prev, f];
    });
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      setProgress(0);
      posthog.capture('crm.opportunity_history.export_start', {
        rows: filtered.length,
        fields: exportFields,
        format: exportFormat,
      });
      if (filtered.length > 5) {
        const chunk = Math.max(1, Math.floor(filtered.length / 10));
        for (let i = 0; i < filtered.length; i += chunk) {
          const pct = Math.min(100, Math.round(((i + chunk) / filtered.length) * 100));
          setProgress(pct);
          await new Promise((r) => setTimeout(r, 30));
        }
      } else {
        setProgress(100);
      }
      const rows = buildCsvRows(filtered, exportFields);
      if (exportFormat === 'csv') {
        const csv = Papa.unparse(rows, { quotes: true });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `opportunity_history_${new Date().toISOString()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'History');
        XLSX.writeFile(wb, `opportunity_history_${new Date().toISOString().split('T')[0]}.xlsx`);
      }
      posthog.capture('crm.opportunity_history.export_success', {
        rows: filtered.length,
        fields: exportFields,
        format: exportFormat,
      });
      toast.success('Export complete');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      posthog.capture('crm.opportunity_history.export_failure', { error: message });
      toast.error('Export failed', { description: message || 'Unexpected error' });
    } finally {
      setExporting(false);
      setProgress(0);
    }
  };

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Stage and Probability Changes</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onRefresh}>Refresh</Button>
          <Button onClick={() => setExportOpen(true)}>Export CSV</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 border rounded-md space-y-3">
          <p className="text-sm text-muted-foreground">Presets</p>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Saved presets</Label>
              <Select value={selectedPresetId} onValueChange={(v) => applyPreset(v)}>
                <SelectTrigger><SelectValue placeholder={presets.length ? 'Select preset' : 'No presets'} /></SelectTrigger>
                <SelectContent>
                  {presets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Preset name</Label>
              <Input value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} placeholder="My favorite filters" />
            </div>
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button onClick={savePreset}>Save current as preset</Button>
            </div>
          </div>
          {presets.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Manage presets</p>
              <div className="flex flex-wrap gap-2">
                {presets.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 border rounded px-2 py-1">
                    <Input
                      value={p.name}
                      onChange={(e) => renamePreset(p.id, e.target.value)}
                      className="h-8 w-40"
                    />
                    <Button variant="destructive" size="sm" onClick={() => deletePreset(p.id)}>Delete</Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-2">
            <Label>Start date</Label>
            <Input type="date" value={filters.startDate || ''} onChange={(e) => applyFilters({ startDate: e.target.value || undefined })} />
          </div>
          <div className="space-y-2">
            <Label>End date</Label>
            <Input type="date" value={filters.endDate || ''} onChange={(e) => applyFilters({ endDate: e.target.value || undefined })} />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={(filters.type as HistoryTypeFilter) || 'any'} onValueChange={(v) => applyFilters({ type: v as HistoryTypeFilter })}>
              <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="stage">Stage changed</SelectItem>
                <SelectItem value="probability">Probability changed</SelectItem>
                <SelectItem value="both">Both changed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Search</Label>
            <Input placeholder="User, stage, probability…" value={filters.query || ''} onChange={(e) => applyFilters({ query: e.target.value })} />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {filters.startDate && <Badge variant="outline">Start: {filters.startDate}</Badge>}
          {filters.endDate && <Badge variant="outline">End: {filters.endDate}</Badge>}
          {filters.type && filters.type !== 'any' && <Badge variant="outline">Type: {filters.type}</Badge>}
          {filters.query && <Badge variant="outline">Query: {filters.query}</Badge>}
          <Button variant="ghost" onClick={resetFilters}>Reset filters</Button>
        </div>

        {exportOpen && (
          <div className="p-3 border rounded-md space-y-3">
            <p className="text-sm text-muted-foreground">Export fields</p>
            <div className="flex gap-2 flex-wrap">
              {(['changed_at','old_stage','new_stage','old_probability','new_probability','changed_by_name','changed_by_email'] as ExportField[]).map((f) => (
                <Badge
                  key={f}
                  className={exportFields.includes(f) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                  onClick={() => toggleField(f)}
                >
                  {f.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as 'csv' | 'xlsx')}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Format" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="xlsx">XLSX</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleExport} disabled={exporting || filtered.length === 0}>
                {exporting ? 'Exporting…' : `Download ${exportFormat.toUpperCase()}`}
              </Button>
              {exporting && <Progress value={progress} className="w-40" />}
              <Button variant="ghost" onClick={() => setExportOpen(false)}>Close</Button>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground">No matching records.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Probability</TableHead>
                  <TableHead>Changed By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{new Date(h.changed_at).toLocaleString()}</TableCell>
                    <TableCell>
                      {(h.old_stage ? stageLabels[h.old_stage] : '-') + ' → ' + (h.new_stage ? stageLabels[h.new_stage] : '-')}
                    </TableCell>
                    <TableCell>
                      {(h.old_probability ?? '-') + ' → ' + (h.new_probability ?? '-')}
                    </TableCell>
                    <TableCell>
                      {h.changer ? `${h.changer.first_name} ${h.changer.last_name}` : h.changed_by || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
