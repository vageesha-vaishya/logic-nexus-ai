import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Zap, Shield, AlertTriangle } from 'lucide-react';

export interface ImportOptions {
  executeSchemaFirst: boolean;
  stopOnFirstError: boolean;
  useTransactions: boolean;
  batchSize: number;
  concurrency?: number;
  enableCheckpoint?: boolean;
  chunking?: {
    enabled?: boolean;
    chunkSize?: number;
  };
  adaptiveBatching?: {
    enabled?: boolean;
    targetLatencyMs?: number;
    minBatchSize?: number;
    maxBatchSize?: number;
    errorRateThreshold?: number; // 0..1
    backoffMs?: number;
    retryAttempts?: number;
  };
  resumeFrom?: {
    phase: 'schema' | 'data' | 'constraints' | 'indexes' | 'functions' | 'policies' | 'other';
    batchIndex: number;
  };
  skipExistingTables: boolean;
  dryRunFirst: boolean;
  executionOrder: 'schema-first' | 'file-order' | 'data-first';
  onConflict: 'error' | 'skip' | 'update';
  onConflictOverrides?: Record<string, 'error' | 'skip' | 'update'>;
  dropIfExistsConfig?: {
    allowSchemaDrop: boolean;
    safeSchemas: string[];
    cascade?: boolean;
  };
  postImportOwnershipEnabled?: boolean;
  postImportOwnershipTables?: string[]; // 'schema.table' names to include for ownership-only step
  disableConstraintsDuringData?: boolean;
  dataReorderHeuristics?: boolean;
  autoCreateMissingTables?: boolean;
  autoCreateMissingTablesSchemas?: string[];
  autoCreateMissingTablesTables?: string[];
  alignmentConfig?: {
    allowedSchemas?: string[]; // names or patterns to include (default: ['public'])
    allowedTables?: string[]; // 'schema.table' names to include
    excludedSchemas?: string[];
    excludedTables?: string[];
    maxRowEstimateForAlter?: number; // skip alignment for very large tables
    criticalTables?: string[]; // tables to avoid altering
    requiredNotNullColumns?: string[]; // 'schema.table.column' to enforce NOT NULL when possible
    heuristics?: {
      allowNotNullWhenDefault?: boolean; // set NOT NULL if default exists and backfilled
      allowNotNullWhenNoNulls?: boolean; // set NOT NULL if no NULLs present post-backfill
      backfillWithDefault?: boolean; // run UPDATE to fill NULLs using default
    };
  };
}

export const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  executeSchemaFirst: true,
  stopOnFirstError: true,
  useTransactions: true,
  batchSize: 100,
  concurrency: 2,
  enableCheckpoint: true,
  chunking: {
    enabled: true,
    chunkSize: 100,
  },
  adaptiveBatching: {
    enabled: true,
    targetLatencyMs: 1200,
    minBatchSize: 50,
    maxBatchSize: 300,
    errorRateThreshold: 0.05,
    backoffMs: 500,
    retryAttempts: 2,
  },
  skipExistingTables: false,
  dryRunFirst: true,
  executionOrder: 'schema-first',
  onConflict: 'error',
  onConflictOverrides: {},
  dropIfExistsConfig: {
    allowSchemaDrop: false,
    safeSchemas: ['public'],
    cascade: false,
  },
  postImportOwnershipEnabled: false,
  postImportOwnershipTables: [],
  disableConstraintsDuringData: false,
  dataReorderHeuristics: true,
  autoCreateMissingTables: true,
  autoCreateMissingTablesSchemas: ['public'],
  autoCreateMissingTablesTables: [],
  alignmentConfig: {
    allowedSchemas: ['public'],
    excludedSchemas: [],
    allowedTables: [],
    excludedTables: [],
    maxRowEstimateForAlter: 10_000_000,
    criticalTables: [],
    requiredNotNullColumns: [],
    heuristics: {
      allowNotNullWhenDefault: true,
      allowNotNullWhenNoNulls: true,
      backfillWithDefault: true,
    },
  },
};

interface ImportOptionsPanelProps {
  options: ImportOptions;
  onChange: (options: ImportOptions) => void;
  disabled?: boolean;
}

export function ImportOptionsPanel({ options, onChange, disabled = false }: ImportOptionsPanelProps) {
  const updateOption = <K extends keyof ImportOptions>(key: K, value: ImportOptions[K]) => {
    onChange({ ...options, [key]: value });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Import Options</CardTitle>
        </div>
        <CardDescription>
          Configure how the SQL statements will be executed
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Execution Order */}
        <div className="space-y-2">
          <Label>Execution Order</Label>
          <Select
            value={options.executionOrder}
            onValueChange={(v) => updateOption('executionOrder', v as ImportOptions['executionOrder'])}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="schema-first">
                <div className="flex flex-col">
                  <span>Schema First (Recommended)</span>
                  <span className="text-xs text-muted-foreground">Create tables before inserting data</span>
                </div>
              </SelectItem>
              <SelectItem value="file-order">
                <div className="flex flex-col">
                  <span>File Order</span>
                  <span className="text-xs text-muted-foreground">Execute statements as they appear</span>
                </div>
              </SelectItem>
              <SelectItem value="data-first">
                <div className="flex flex-col">
                  <span>Data First</span>
                  <span className="text-xs text-muted-foreground">Insert data before constraints</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Conflict Handling */}
        <div className="space-y-2">
          <Label>On Conflict</Label>
          <Select
            value={options.onConflict}
            onValueChange={(v) => updateOption('onConflict', v as ImportOptions['onConflict'])}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="error">Raise Error</SelectItem>
              <SelectItem value="skip">Skip Row</SelectItem>
              <SelectItem value="update">Update Existing</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Batch Size */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Batch Size</Label>
            <span className="text-sm font-medium">{options.batchSize} statements</span>
          </div>
          <Slider
            value={[options.batchSize]}
            onValueChange={([v]) => updateOption('batchSize', v)}
            min={10}
            max={500}
            step={10}
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            Number of statements to execute per batch. Lower values are safer but slower.
          </p>
        </div>
        
        {/* Adaptive Batching */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Adaptive Batching
            </Label>
            <Switch
              checked={options.adaptiveBatching?.enabled ?? false}
              onCheckedChange={(v) => updateOption('adaptiveBatching', { ...(options.adaptiveBatching ?? {}), enabled: v })}
              disabled={disabled}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Target Latency</Label>
              <Slider
                value={[options.adaptiveBatching?.targetLatencyMs ?? 1200]}
                onValueChange={([v]) => updateOption('adaptiveBatching', { ...(options.adaptiveBatching ?? {}), targetLatencyMs: v })}
                min={200}
                max={3000}
                step={100}
                disabled={disabled || !(options.adaptiveBatching?.enabled ?? false)}
              />
              <p className="text-xs text-muted-foreground">
                Aim for per-batch execution time around this value (ms).
              </p>
            </div>
            <div className="space-y-2">
              <Label>Error Rate Threshold</Label>
              <Slider
                value={[Math.round(((options.adaptiveBatching?.errorRateThreshold ?? 0.05) * 100))]}
                onValueChange={([v]) => updateOption('adaptiveBatching', { ...(options.adaptiveBatching ?? {}), errorRateThreshold: v / 100 })}
                min={0}
                max={20}
                step={1}
                disabled={disabled || !(options.adaptiveBatching?.enabled ?? false)}
              />
              <p className="text-xs text-muted-foreground">
                Reduce batch size when failure ratio exceeds this percentage.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Min Batch Size</Label>
              <Slider
                value={[options.adaptiveBatching?.minBatchSize ?? 50]}
                onValueChange={([v]) => updateOption('adaptiveBatching', { ...(options.adaptiveBatching ?? {}), minBatchSize: v })}
                min={10}
                max={options.batchSize}
                step={10}
                disabled={disabled || !(options.adaptiveBatching?.enabled ?? false)}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Batch Size</Label>
              <Slider
                value={[options.adaptiveBatching?.maxBatchSize ?? 300]}
                onValueChange={([v]) => updateOption('adaptiveBatching', { ...(options.adaptiveBatching ?? {}), maxBatchSize: v })}
                min={options.batchSize}
                max={600}
                step={10}
                disabled={disabled || !(options.adaptiveBatching?.enabled ?? false)}
              />
            </div>
            <div className="space-y-2">
              <Label>Retry Attempts</Label>
              <Slider
                value={[options.adaptiveBatching?.retryAttempts ?? 2]}
                onValueChange={([v]) => updateOption('adaptiveBatching', { ...(options.adaptiveBatching ?? {}), retryAttempts: v })}
                min={0}
                max={5}
                step={1}
                disabled={disabled || !(options.adaptiveBatching?.enabled ?? false)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Dry Run First
              </Label>
              <p className="text-xs text-muted-foreground">
                Validate statements before executing
              </p>
            </div>
            <Switch
              checked={options.dryRunFirst}
              onCheckedChange={(v) => updateOption('dryRunFirst', v)}
              disabled={disabled}
            />
          </div>

          {/* Use Transactions */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Use Transactions
              </Label>
              <p className="text-xs text-muted-foreground">
                Wrap batches in BEGIN/COMMIT for rollback on error
              </p>
            </div>
            <Switch
              checked={options.useTransactions}
              onCheckedChange={(v) => updateOption('useTransactions', v)}
              disabled={disabled}
            />
          </div>

          {/* Stop on First Error */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Stop on First Error
              </Label>
              <p className="text-xs text-muted-foreground">
                Halt execution when an error occurs
              </p>
            </div>
            <Switch
              checked={options.stopOnFirstError}
              onCheckedChange={(v) => updateOption('stopOnFirstError', v)}
              disabled={disabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Skip Existing Tables</Label>
              <p className="text-xs text-muted-foreground">
                Don't create tables that already exist
              </p>
            </div>
            <Switch
              checked={options.skipExistingTables}
              onCheckedChange={(v) => updateOption('skipExistingTables', v)}
              disabled={disabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-Create Missing Tables</Label>
              <p className="text-xs text-muted-foreground">
                Create missing tables from dump definitions before inserting data
              </p>
            </div>
            <Switch
              checked={options.autoCreateMissingTables ?? true}
              onCheckedChange={(v) => updateOption('autoCreateMissingTables', v)}
              disabled={disabled}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Destructive DROP IF EXISTS
            </Label>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Allow DROP on selected schemas and rewrite as IF EXISTS
              </p>
              <Switch
                checked={options.dropIfExistsConfig?.allowSchemaDrop ?? false}
                onCheckedChange={(v) =>
                  updateOption('dropIfExistsConfig', {
                    ...(options.dropIfExistsConfig ?? { safeSchemas: ['public'], cascade: false }),
                    allowSchemaDrop: !!v,
                  })
                }
                disabled={disabled}
              />
            </div>
            <div className="space-y-1">
              <Label>Schemas (comma-separated)</Label>
              <input
                type="text"
                className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                placeholder="public"
                value={(options.dropIfExistsConfig?.safeSchemas ?? []).join(', ')}
                onChange={(e) => {
                  const raw = e.target.value;
                  const list = raw
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);
                  updateOption('dropIfExistsConfig', {
                    ...(options.dropIfExistsConfig ?? { allowSchemaDrop: false, cascade: false }),
                    safeSchemas: list,
                  });
                }}
                disabled={disabled || !(options.dropIfExistsConfig?.allowSchemaDrop ?? false)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Cascade dependent objects</Label>
                <p className="text-xs text-muted-foreground">
                  Append CASCADE to DROP statements for selected schemas
                </p>
              </div>
              <Switch
                checked={options.dropIfExistsConfig?.cascade ?? false}
                onCheckedChange={(v) =>
                  updateOption('dropIfExistsConfig', {
                    ...(options.dropIfExistsConfig ?? { allowSchemaDrop: false, safeSchemas: ['public'] }),
                    cascade: !!v,
                  })
                }
                disabled={disabled || !(options.dropIfExistsConfig?.allowSchemaDrop ?? false)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Post-Import Ownership Changes
            </Label>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Apply OWNER/GRANT statements with privileged credentials
              </p>
              <Switch
                checked={options.postImportOwnershipEnabled ?? false}
                onCheckedChange={(v) => updateOption('postImportOwnershipEnabled', v)}
                disabled={disabled}
              />
            </div>
            <div className="space-y-1">
              <Label>Tables (schema.table, comma-separated)</Label>
              <input
                type="text"
                className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                placeholder="public.audit_log_entries, public.opportunities"
                value={(options.postImportOwnershipTables ?? []).join(', ')}
                onChange={(e) => {
                  const raw = e.target.value;
                  const list = raw
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);
                  updateOption('postImportOwnershipTables', list);
                }}
                disabled={disabled || !(options.postImportOwnershipEnabled ?? false)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to apply to all filtered ownership statements
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Auto-Create Tables Scope</Label>
            <p className="text-xs text-muted-foreground">
              Limit synthesized tables to these schemas and tables. Leave empty to use defaults.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Schemas (comma-separated)</Label>
              <input
                type="text"
                className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                placeholder="public"
                value={(options.autoCreateMissingTablesSchemas ?? ['public']).join(', ')}
                onChange={(e) => {
                  const raw = e.target.value;
                  const list = raw
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);
                  updateOption('autoCreateMissingTablesSchemas', list.length > 0 ? list : ['public']);
                }}
                disabled={disabled || !(options.autoCreateMissingTables ?? true)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tables (schema.table, comma-separated)</Label>
              <input
                type="text"
                className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                placeholder="public.accounts, public.contacts"
                value={(options.autoCreateMissingTablesTables ?? []).join(', ')}
                onChange={(e) => {
                  const raw = e.target.value;
                  const list = raw
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);
                  updateOption('autoCreateMissingTablesTables', list);
                }}
                disabled={disabled || !(options.autoCreateMissingTables ?? true)}
              />
            </div>
          </div>

          {/* Disable Constraints During Data */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Disable Constraints During Data
              </Label>
              <p className="text-xs text-muted-foreground">
                Temporarily defer FKs and disable triggers per batch
              </p>
            </div>
            <Switch
              checked={options.disableConstraintsDuringData ?? false}
              onCheckedChange={(v) => updateOption('disableConstraintsDuringData', v)}
              disabled={disabled}
            />
          </div>

          {/* Heuristic Data Reordering */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Heuristic Data Reordering
              </Label>
              <p className="text-xs text-muted-foreground">
                Order INSERTs by parent tables first (e.g. leads before activities)
              </p>
            </div>
            <Switch
              checked={options.dataReorderHeuristics ?? false}
              onCheckedChange={(v) => updateOption('dataReorderHeuristics', v)}
              disabled={disabled}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
