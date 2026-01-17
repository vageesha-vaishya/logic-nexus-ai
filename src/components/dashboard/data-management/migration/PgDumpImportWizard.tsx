import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ChevronRight, 
  ChevronLeft, 
  Play, 
  Pause, 
  Square, 
  CheckCircle2,
  Loader2,
  FileUp,
  Database,
  Settings,
  Zap,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { SqlFileUploadZone } from './SqlFileUploadZone';
import { ExternalDbConnectionForm, ExternalDbConnection, ConnectionTestResult } from './ExternalDbConnectionForm';
import { ImportOptionsPanel, ImportOptions, DEFAULT_IMPORT_OPTIONS } from './ImportOptionsPanel';
import { ImportVerificationPanel } from './ImportVerificationPanel';
import { ImportHistoryService } from '@/lib/import-history-service';
import { usePgDumpImport } from '@/hooks/usePgDumpImport';
import { ParsedSqlFile } from '@/utils/sqlFileParser';
import { toast } from 'sonner';
import { useCRM } from '@/hooks/useCRM';
import { PgDumpOptionsPanel, PgDumpCategoryOptions, PgDumpGeneralOptions } from '@/components/dashboard/data-management/PgDumpOptionsPanel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type WizardStep = 'file' | 'connection' | 'options' | 'execute' | 'summary';

type ImportPresetId = 'custom' | 'safe_audit' | 'prod_upsert' | 'dev_reset';

const IMPORT_PRESETS: Array<{ id: ImportPresetId; label: string; description: string }> = [
  {
    id: 'safe_audit',
    label: 'Safe Audit Import',
    description: 'Append-only; never update or drop existing data.',
  },
  {
    id: 'prod_upsert',
    label: 'Conservative Production Import',
    description: 'Schema alignment and upserts without destructive drops.',
  },
  {
    id: 'dev_reset',
    label: 'Developer Reset (Non-Production)',
    description: 'Allow destructive drops and CASCADE in safe schemas.',
  },
];

const getPresetLabel = (id: ImportPresetId) => {
  if (id === 'custom') return 'Custom';
  const found = IMPORT_PRESETS.find(p => p.id === id);
  return found ? found.label : 'Custom';
};

const STEPS: { id: WizardStep; label: string; icon: React.ReactNode }[] = [
  { id: 'file', label: 'Select File', icon: <FileUp className="h-4 w-4" /> },
  { id: 'connection', label: 'Connect Database', icon: <Database className="h-4 w-4" /> },
  { id: 'options', label: 'Configure', icon: <Settings className="h-4 w-4" /> },
  { id: 'execute', label: 'Execute', icon: <Zap className="h-4 w-4" /> },
  { id: 'summary', label: 'Summary', icon: <CheckCircle2 className="h-4 w-4" /> },
];

export function PgDumpImportWizard() {
  const { context, scopedDb, user } = useCRM();
  const [currentStep, setCurrentStep] = useState<WizardStep>('file');
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedSqlFile | null>(null);
  const [overrideValidation, setOverrideValidation] = useState(false);
  const [resumePoint, setResumePoint] = useState<{ phase: 'schema' | 'data' | 'constraints' | 'indexes' | 'functions' | 'policies' | 'other'; batch: number; totalBatches: number; timestamp: number } | null>(null);
  const [remoteCheckpoints, setRemoteCheckpoints] = useState<Array<{ phase: 'schema' | 'data' | 'constraints' | 'indexes' | 'functions' | 'policies' | 'other'; batch: number; total_batches?: number; timestamp?: string; created_at?: string }>>([]);
  const [selectedCheckpointIndex, setSelectedCheckpointIndex] = useState<number>(-1);
  const [connection, setConnection] = useState<ExternalDbConnection>({
    host: '',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: '',
    ssl: 'require',
  });
  const [connectionTested, setConnectionTested] = useState(false);
  const [options, setOptions] = useState<ImportOptions>(DEFAULT_IMPORT_OPTIONS);
  const [preset, setPreset] = useState<ImportPresetId>(() => {
    try {
      const raw = localStorage.getItem('pgdump.import.preset');
      if (raw === 'custom' || raw === 'safe_audit' || raw === 'prod_upsert' || raw === 'dev_reset') {
        return raw;
      }
    } catch {}
    return 'custom';
  });
  const [activePreset, setActivePreset] = useState<ImportPresetId | null>(null);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [permissionOk, setPermissionOk] = useState<boolean>(false);
  const [categories, setCategories] = useState<PgDumpCategoryOptions>(() => {
    try {
      const raw = localStorage.getItem("pgdump.import.categories");
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      all: true,
      schema: true,
      constraints: true,
      indexes: true,
      dbFunctions: true,
      rlsPolicies: true,
      enums: true,
      edgeFunctions: false,
      secrets: false,
      tableData: true,
    };
  });
  const [general, setGeneral] = useState<PgDumpGeneralOptions>(() => {
    try {
      const raw = localStorage.getItem("pgdump.import.general");
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      outputMode: "insert",
      includeDropStatements: false,
      excludeAuthSchema: false,
      excludeStorageSchema: false,
      customSchemas: "",
      baseFilename: "database_import.sql",
      dataCompletenessThresholdRatio: 1.1,
    };
  });

  const {
    status,
    progress,
    errors,
    logs,
    summary,
    startImport,
    pauseImport,
    resumeImport,
    cancelImport,
    reset,
    rollbackAlignment,
    rerunFailedBatches,
    clearCheckpoint,
    canStart,
    canPause,
    canResume,
    canCancel,
    verifyIntegrity,
    isVerifying,
    verificationResults,
  } = usePgDumpImport();

  const getCurrentStepIndex = () => STEPS.findIndex(s => s.id === currentStep);

  const canProceed = useCallback((): boolean => {
    switch (currentStep) {
      case 'file':
        return file !== null && parsed !== null && (parsed.metadata.isComplete || overrideValidation);
      case 'connection':
        return connectionTested;
      case 'options':
        return true;
      case 'execute':
        return status === 'completed' || status === 'failed' || status === 'cancelled';
      default:
        return false;
    }
  }, [currentStep, file, parsed, connectionTested, status]);

  const goToStep = (step: WizardStep) => {
    const targetIndex = STEPS.findIndex(s => s.id === step);
    const currentIndex = getCurrentStepIndex();
    
    // Can only go back or to completed steps
    if (targetIndex < currentIndex) {
      setCurrentStep(step);
    }
  };

  const nextStep = () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1].id);
    }
  };

  const prevStep = () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].id);
    }
  };

  const handleFileSelected = (selectedFile: File, parsedFile: ParsedSqlFile) => {
    setFile(selectedFile);
    setParsed(parsedFile);
    setOverrideValidation(false);
  };

  const handleFileClear = () => {
    setFile(null);
    setParsed(null);
    setOverrideValidation(false);
  };

  const handleOverrideChange = async (enabled: boolean) => {
    setOverrideValidation(enabled);
    
    if (enabled && user && file) {
      try {
        await ImportHistoryService.logOverrideAction(
          scopedDb, 
          user.id, 
          {
            name: file.name,
            size: file.size,
            issues: parsed && !parsed.metadata.isComplete ? ['Incomplete file'] : []
          }
        );
      } catch (err) {
        console.error('Failed to log override', err);
      }
    }
  };

  const handleRepairApplied = (content: string, parsedFile: ParsedSqlFile) => {
    // Create a virtual file for the repaired content
    const virtualFile = new File([content], file?.name || 'repaired.sql', { type: 'text/plain' });
    setFile(virtualFile);
    setParsed(parsedFile);
    setOverrideValidation(false);
  };

  const handleConnectionTested = (result: ConnectionTestResult) => {
    setConnectionTested(result.success);
  };

  useEffect(() => {
    try {
      localStorage.setItem('pgdump.import.preset', preset);
    } catch {}
  }, [preset]);

  const applyPreset = (id: ImportPresetId, base: ImportOptions): ImportOptions => {
    if (id === 'safe_audit') {
      return {
        ...base,
        executionOrder: 'schema-first',
        useTransactions: true,
        stopOnFirstError: true,
        enableCheckpoint: true,
        onConflict: 'skip',
        onConflictOverrides: {
          ...base.onConflictOverrides,
          'public.audit_log_entries': 'error',
          'public.activities_history': 'error',
        },
        disableConstraintsDuringData: false,
        autoCreateMissingTables: false,
        autoCreateMissingTablesSchemas: base.autoCreateMissingTablesSchemas ?? ['public'],
        autoCreateMissingTablesTables: base.autoCreateMissingTablesTables ?? [],
        alignmentConfig: {
          ...base.alignmentConfig,
          allowedSchemas: ['public'],
          requiredNotNullColumns: base.alignmentConfig?.requiredNotNullColumns ?? [],
        },
        dropIfExistsConfig: {
          allowSchemaDrop: false,
          safeSchemas: ['public'],
          cascade: false,
        },
      };
    }
    if (id === 'prod_upsert') {
      return {
        ...base,
        executionOrder: 'schema-first',
        useTransactions: true,
        stopOnFirstError: true,
        enableCheckpoint: true,
        onConflict: 'update',
        onConflictOverrides: {
          ...base.onConflictOverrides,
          'public.audit_log_entries': 'error',
          'public.email_events': 'skip',
        },
        disableConstraintsDuringData: false,
        autoCreateMissingTables: true,
        autoCreateMissingTablesSchemas: ['public'],
        autoCreateMissingTablesTables: base.autoCreateMissingTablesTables ?? [],
        alignmentConfig: {
          ...base.alignmentConfig,
          allowedSchemas: ['public'],
          requiredNotNullColumns: base.alignmentConfig?.requiredNotNullColumns ?? [],
        },
        dropIfExistsConfig: {
          allowSchemaDrop: false,
          safeSchemas: ['public'],
          cascade: false,
        },
      };
    }
    if (id === 'dev_reset') {
      return {
        ...base,
        executionOrder: base.executionOrder,
        useTransactions: true,
        stopOnFirstError: false,
        enableCheckpoint: true,
        onConflict: base.onConflict,
        onConflictOverrides: base.onConflictOverrides,
        disableConstraintsDuringData: true,
        autoCreateMissingTables: true,
        autoCreateMissingTablesSchemas: base.alignmentConfig?.allowedSchemas ?? ['public', 'extensions'],
        autoCreateMissingTablesTables: base.autoCreateMissingTablesTables ?? [],
        alignmentConfig: {
          ...base.alignmentConfig,
          allowedSchemas: base.alignmentConfig?.allowedSchemas ?? ['public', 'extensions'],
        },
        dropIfExistsConfig: {
          allowSchemaDrop: true,
          safeSchemas: ['public'],
          cascade: true,
        },
      };
    }
    return base;
  };

  useEffect(() => {
    const ok = !!(context.isPlatformAdmin || context.isTenantAdmin);
    setPermissionOk(ok);
  }, [context.isPlatformAdmin, context.isTenantAdmin]);

  useEffect(() => {
    try {
      localStorage.setItem("pgdump.import.categories", JSON.stringify(categories));
    } catch {}
  }, [categories]);

  useEffect(() => {
    try {
      localStorage.setItem("pgdump.import.general", JSON.stringify(general));
    } catch {}
  }, [general]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('pgdump.import.checkpoint');
      if (raw) {
        const cp = JSON.parse(raw);
        if (cp && cp.phase && typeof cp.batch === 'number') {
          setResumePoint({
            phase: cp.phase,
            batch: cp.batch,
            totalBatches: cp.totalBatches ?? 0,
            timestamp: cp.timestamp ?? Date.now(),
          });
        }
      } else {
        setResumePoint(null);
      }
    } catch {
      setResumePoint(null);
    }
  }, [status]);

  useEffect(() => {
    (async () => {
      try {
        if (!user) return;
        const { data, error } = await (scopedDb.client as any)
          .from('import_checkpoints')
          .select('phase, batch, total_batches, timestamp, created_at, user_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (error) {
          setRemoteCheckpoints([]);
          return;
        }
        const list = (data || []).map((row: any) => ({
          phase: row.phase,
          batch: row.batch,
          total_batches: row.total_batches,
          timestamp: row.timestamp,
          created_at: row.created_at,
        }));
        setRemoteCheckpoints(list);
      } catch {
        setRemoteCheckpoints([]);
      }
    })();
  }, [user?.id, status]);

  const handleStartImport = async () => {
    if (!permissionOk) {
      toast.error('Insufficient permissions to start import');
      return;
    }

    if (!connectionTested) {
      toast.error('Please test the database connection before starting import');
      return;
    }

    if (!parsed) {
      toast.error('No file selected');
      return;
    }

    if (!parsed.metadata.isComplete && !overrideValidation) {
      toast.error('Cannot start import with incomplete SQL file');
      return;
    }

    console.log('[PgDumpImportWizard] Starting import with parsed file:', {
      totalStatements: parsed.metadata.totalStatements,
      dataStatementsCount: parsed.dataStatements.length,
      tableStatementsCount: parsed.tableStatements.length,
      schemaStatementsCount: parsed.schemaStatements.length,
      firstDataStatement: parsed.dataStatements[0]?.substring(0, 100),
      options
    });

    setActivePreset(preset);
    await startImport(parsed, connection, options);
  };

  const handleResumeFromCheckpoint = async () => {
    if (!permissionOk) {
      toast.error('Insufficient permissions to resume import');
      return;
    }
    if (!connectionTested) {
      toast.error('Please test the database connection before resuming import');
      return;
    }
    if (!parsed) {
      toast.error('No file selected');
      return;
    }
    let usePhase: 'schema' | 'data' | 'constraints' | 'indexes' | 'functions' | 'policies' | 'other';
    let useBatch: number;
    if (selectedCheckpointIndex >= 0 && remoteCheckpoints[selectedCheckpointIndex]) {
      const cp = remoteCheckpoints[selectedCheckpointIndex];
      usePhase = cp.phase;
      useBatch = Math.max(0, (cp.batch ?? 1) - 1);
    } else if (resumePoint) {
      usePhase = resumePoint.phase;
      useBatch = Math.max(0, (resumePoint.batch ?? 1) - 1);
    } else {
      toast.error('No checkpoint available to resume from');
      return;
    }
    const nextOptions = { 
      ...options, 
      resumeFrom: { phase: usePhase, batchIndex: useBatch }
    };
    setActivePreset(preset);
    await startImport(parsed, connection, nextOptions);
  };

  const handleRetry = () => {
    reset();
    setActivePreset(null);
    setCurrentStep('execute');
  };

  const handleRollback = async () => {
    try {
      await rollbackAlignment(connection);
      toast.success('Rollback completed');
    } catch (err: any) {
      toast.error('Rollback failed', { description: err.message || String(err) });
    }
  };

  const handleVerify = async () => {
    if (!parsed) return;
    await verifyIntegrity(connection, parsed);
  };

  const formatProgress = () => {
    if (!progress) return '0%';
    const pct = (progress.statementsExecuted / progress.totalStatements) * 100;
    return `${pct.toFixed(1)}%`;
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'file':
        return (
          <div className="space-y-4">
            <SqlFileUploadZone
              onFileSelected={handleFileSelected}
              onFileClear={handleFileClear}
              onRepairApplied={handleRepairApplied}
              overrideEnabled={overrideValidation}
              onOverrideChange={handleOverrideChange}
            />
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Import behavior</CardTitle>
                <CardDescription className="text-xs">
                  Tables referenced in the dump that do not exist in the target database will be
                  created automatically from their CREATE TABLE definitions before data is inserted.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">
                  For non-plain dumps (custom, directory, compressed), first generate a plain SQL
                  file with pg_restore and upload that here, for example:
                  <span className="block font-mono mt-1">
                    pg_restore -f dump.sql path/to/archive
                  </span>
                </p>
              </CardContent>
            </Card>
          </div>
        );

      case 'connection':
        return (
          <ExternalDbConnectionForm
            connection={connection}
            onChange={setConnection}
            onConnectionTested={handleConnectionTested}
          />
        );

      case 'options':
        return (
          <div className="space-y-6">
            {!permissionOk && (
              <div className="rounded-md border p-4">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Insufficient Permissions</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  You do not have permission to perform import operations.
                </p>
              </div>
            )}
            {!connectionTested && (
              <div className="rounded-md border p-4">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  <span className="font-medium">Connection Not Verified</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Test and verify the database connection before configuring options.
                </p>
              </div>
            )}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Import Preset</CardTitle>
                <CardDescription className="text-xs">
                  Quickly apply recommended combinations of import options.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                <Select
                  value={preset}
                  onValueChange={value => {
                    const id = value as ImportPresetId;
                    setPreset(id);
                    if (id === 'custom') return;
                    setOptions(prev => applyPreset(id, prev));
                  }}
                  disabled={!permissionOk || !connectionTested}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a preset" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">
                      <div className="flex flex-col">
                        <span>Custom</span>
                        <span className="text-xs text-muted-foreground">
                          Manually configure all options
                        </span>
                      </div>
                    </SelectItem>
                    {IMPORT_PRESETS.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex flex-col">
                          <span>{p.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {p.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  In the Execute step, the Preset badge shows the preset that was active when you
                  started or resumed this run.
                </p>
              </CardContent>
            </Card>
            <ImportOptionsPanel
              options={options}
              onChange={setOptions}
              disabled={!permissionOk || !connectionTested}
            />
            <PgDumpOptionsPanel
              categories={categories}
              general={general}
              onChangeCategories={setCategories}
              onChangeGeneral={setGeneral}
              disabled={!permissionOk || !connectionTested}
            />
          </div>
        );

      case 'execute':
        return (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Execute Import</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {activePreset && (
                    <Badge variant="outline" className="text-xs">
                      Preset: {getPresetLabel(activePreset)}
                    </Badge>
                  )}
                  <Badge variant={
                    status === 'executing' ? 'default' :
                    status === 'completed' ? 'secondary' :
                    status === 'failed' ? 'destructive' :
                    status === 'paused' ? 'outline' :
                    'secondary'
                  }>
                    {status}
                  </Badge>
                </div>
              </div>
              <CardDescription>
                {status === 'idle' && 'Ready to execute import'}
                {status === 'executing' && 'Import in progress...'}
                {status === 'paused' && 'Import paused'}
                {status === 'completed' && 'Import completed'}
                {status === 'failed' && 'Import failed'}
                {status === 'cancelled' && 'Import cancelled'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Import Summary */}
              {parsed && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">File:</span>
                    <span>{file?.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Target:</span>
                    <span>{connection.user}@{connection.host}/{connection.database}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Statements:</span>
                    <span>{parsed.metadata.totalStatements}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Est. Rows:</span>
                    <span>{parsed.metadata.estimatedRowCount.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {(remoteCheckpoints.length > 0 || resumePoint) && status === 'idle' && (
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Available Checkpoints</span>
                    {resumePoint && !remoteCheckpoints.length && (
                      <Badge variant="outline">Local</Badge>
                    )}
                  </div>
                  {remoteCheckpoints.length > 0 ? (
                    <div className="space-y-2">
                      {remoteCheckpoints.slice(0, 5).map((cp, idx) => {
                        const ts = cp.created_at || cp.timestamp || '';
                        const readable = ts ? new Date(ts).toLocaleString() : '';
                        const isSelected = selectedCheckpointIndex === idx;
                        return (
                          <button
                            key={idx}
                            onClick={() => setSelectedCheckpointIndex(idx)}
                            className={`w-full text-left p-2 rounded border ${isSelected ? 'border-primary bg-primary/10' : 'border-muted'}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Phase: <span className="font-medium capitalize">{cp.phase}</span></span>
                              <span className="text-xs">{readable}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Batch {cp.batch}{cp.total_batches ? ` / ${cp.total_batches}` : ''}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    resumePoint && (
                      <div className="text-sm">
                        Phase: <span className="font-medium capitalize">{resumePoint.phase}</span> · Batch {resumePoint.batch} / {resumePoint.totalBatches}
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Warnings */}
              {parsed?.warnings && parsed.warnings.length > 0 && (
                <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    <span className="font-medium text-warning">Warnings</span>
                  </div>
                  <ul className="list-disc list-inside text-sm text-warning space-y-1">
                    {parsed.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Progress */}
              {progress && status === 'executing' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Phase: <span className="font-medium capitalize">{progress.currentPhase}</span></span>
                      <span>{formatProgress()}</span>
                    </div>
                    <Progress 
                      value={(progress.statementsExecuted / progress.totalStatements) * 100} 
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div>
                      <p className="text-2xl font-bold text-green-500">{progress.statementsExecuted}</p>
                      <p className="text-muted-foreground">Executed</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-destructive">{progress.statementsFailed}</p>
                      <p className="text-muted-foreground">Failed</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{Math.round(progress.elapsedMs / 1000)}s</p>
                      <p className="text-muted-foreground">Elapsed</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Live Logs */}
              {logs.length > 0 && (
                <div className="space-y-2">
                  <span className="text-sm font-medium">Live Log</span>
                  <ScrollArea className="h-32 rounded-md border bg-muted/50">
                    <div className="p-3 font-mono text-xs space-y-1">
                      {logs.slice(-20).map((log, i) => (
                        <div
                          key={i}
                          className={
                            log.level === 'error'
                              ? 'text-destructive'
                              : log.level === 'warn'
                              ? 'text-warning'
                              : log.level === 'success'
                              ? 'text-green-500'
                              : 'text-foreground'
                          }
                        >
                          [{log.level.toUpperCase()}] {log.message}
                          {log.details ? `: ${log.details}` : ''}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                {canStart && status !== 'completed' && (
                  <Button onClick={handleStartImport} className="flex-1">
                    <Play className="mr-2 h-4 w-4" />
                    Start Import
                  </Button>
                )}
                {resumePoint && status === 'idle' && (
                  <Button onClick={handleResumeFromCheckpoint} variant="default" className="flex-1">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Resume from checkpoint
                  </Button>
                )}
                {status !== 'executing' && (
                  <Button onClick={() => rerunFailedBatches(connection)} variant="outline" className="flex-1">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Re-run failed batches
                  </Button>
                )}
                {status === 'idle' && (
                  <Button onClick={() => clearCheckpoint()} variant="outline" className="flex-1">
                    <Square className="mr-2 h-4 w-4" />
                    Clear checkpoints
                  </Button>
                )}
                {canPause && (
                  <Button onClick={pauseImport} variant="outline" className="flex-1">
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                  </Button>
                )}
                {canResume && (
                  <Button onClick={resumeImport} className="flex-1">
                    <Play className="mr-2 h-4 w-4" />
                    Resume
                  </Button>
                )}
                {canCancel && (
                  <Button onClick={cancelImport} variant="destructive">
                    <Square className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                )}
                {status !== 'idle' && (
                  <Button onClick={() => setRollbackOpen(true)} variant="outline" className="flex-1">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Rollback Alignment
                  </Button>
                )}
              </div>
              <Dialog open={rollbackOpen} onOpenChange={setRollbackOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm Rollback</DialogTitle>
                    <DialogDescription>
                      This will revert recent alignment changes (column adds and NOT NULL constraints).
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setRollbackOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        await handleRollback();
                        setRollbackOpen(false);
                      }}
                    >
                      Confirm Rollback
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        );

      case 'summary':
        return summary ? (
          <ImportVerificationPanel
            summary={summary}
            errors={errors}
            logs={logs}
            onRetry={handleRetry}
            onVerify={handleVerify}
            isVerifying={isVerifying}
            verificationResults={verificationResults}
          />
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No import results available
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((step, index) => {
          const isCurrent = step.id === currentStep;
          const isCompleted = getCurrentStepIndex() > index;
          const isClickable = index < getCurrentStepIndex();

          return (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => isClickable && goToStep(step.id)}
                disabled={!isClickable}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg transition-colors
                  ${isCurrent ? 'bg-primary text-primary-foreground' : ''}
                  ${isCompleted ? 'bg-primary/20 text-primary' : ''}
                  ${!isCurrent && !isCompleted ? 'bg-muted text-muted-foreground' : ''}
                  ${isClickable ? 'cursor-pointer hover:bg-primary/30' : 'cursor-default'}
                `}
              >
                {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : step.icon}
                <span className="text-sm font-medium hidden md:inline">{step.label}</span>
              </button>
              {index < STEPS.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      {renderStepContent()}

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={getCurrentStepIndex() === 0 || status === 'executing'}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {currentStep !== 'summary' && (
          <Button
            onClick={() => {
              if (currentStep === 'execute' && status === 'completed') {
                nextStep();
              } else if (currentStep !== 'execute') {
                nextStep();
              }
            }}
            disabled={!canProceed()}
          >
            {currentStep === 'execute' ? (
              status === 'executing' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  View Summary
                  <ChevronRight className="ml-2 h-4 w-4" />
                </>
              )
            ) : (
              <>
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
