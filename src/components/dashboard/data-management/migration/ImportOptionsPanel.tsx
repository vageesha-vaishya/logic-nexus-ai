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
  skipExistingTables: boolean;
  dryRunFirst: boolean;
  executionOrder: 'schema-first' | 'file-order' | 'data-first';
  onConflict: 'error' | 'skip' | 'update';
}

export const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  executeSchemaFirst: true,
  stopOnFirstError: false,
  useTransactions: true,
  batchSize: 100,
  skipExistingTables: false,
  dryRunFirst: true,
  executionOrder: 'schema-first',
  onConflict: 'error',
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

        {/* Toggle Options */}
        <div className="space-y-4">
          {/* Dry Run First */}
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

          {/* Skip Existing Tables */}
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
        </div>
      </CardContent>
    </Card>
  );
}
