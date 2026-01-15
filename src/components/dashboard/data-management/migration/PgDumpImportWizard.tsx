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
import { usePgDumpImport } from '@/hooks/usePgDumpImport';
import { ParsedSqlFile } from '@/utils/sqlFileParser';
import { toast } from 'sonner';
import { useCRM } from '@/hooks/useCRM';
import { PgDumpOptionsPanel, PgDumpCategoryOptions, PgDumpGeneralOptions } from '@/components/dashboard/data-management/PgDumpOptionsPanel';

type WizardStep = 'file' | 'connection' | 'options' | 'execute' | 'summary';

const STEPS: { id: WizardStep; label: string; icon: React.ReactNode }[] = [
  { id: 'file', label: 'Select File', icon: <FileUp className="h-4 w-4" /> },
  { id: 'connection', label: 'Connect Database', icon: <Database className="h-4 w-4" /> },
  { id: 'options', label: 'Configure', icon: <Settings className="h-4 w-4" /> },
  { id: 'execute', label: 'Execute', icon: <Zap className="h-4 w-4" /> },
  { id: 'summary', label: 'Summary', icon: <CheckCircle2 className="h-4 w-4" /> },
];

export function PgDumpImportWizard() {
  const { context } = useCRM();
  const [currentStep, setCurrentStep] = useState<WizardStep>('file');
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedSqlFile | null>(null);
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
    canStart,
    canPause,
    canResume,
    canCancel,
  } = usePgDumpImport();

  const getCurrentStepIndex = () => STEPS.findIndex(s => s.id === currentStep);

  const canProceed = useCallback((): boolean => {
    switch (currentStep) {
      case 'file':
        return file !== null && parsed !== null;
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
  };

  const handleFileClear = () => {
    setFile(null);
    setParsed(null);
  };

  const handleConnectionTested = (result: ConnectionTestResult) => {
    setConnectionTested(result.success);
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

    await startImport(parsed, connection, options);
  };

  const handleRetry = () => {
    reset();
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

  const formatProgress = () => {
    if (!progress) return '0%';
    const pct = (progress.statementsExecuted / progress.totalStatements) * 100;
    return `${pct.toFixed(1)}%`;
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'file':
        return (
          <SqlFileUploadZone
            onFileSelected={handleFileSelected}
            onFileClear={handleFileClear}
          />
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
