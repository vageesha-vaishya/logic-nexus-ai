import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Download,
  RefreshCw,
  Clock,
  Database,
  Table,
  FileText,
  Info,
  ShieldCheck,
  Loader2
} from 'lucide-react';
import { ImportSummary, ImportError, ImportLog, ImportProgress, PgDumpErrorCategory, VerificationResult } from '@/hooks/usePgDumpImport';

interface ImportVerificationPanelProps {
  summary: ImportSummary;
  errors: ImportError[];
  logs: ImportLog[];
  onRetry?: () => void;
  onDownloadReport?: () => void;
  onVerify?: () => void;
  isVerifying?: boolean;
  verificationResults?: VerificationResult[];
}

export function ImportVerificationPanel({ 
  summary, 
  errors, 
  logs,
  onRetry,
  onDownloadReport,
  onVerify,
  isVerifying,
  verificationResults
}: ImportVerificationPanelProps) {
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  const getStatusIcon = () => {
    switch (summary.status) {
      case 'success':
        return <CheckCircle2 className="h-8 w-8 text-green-500" />;
      case 'partial':
        return <AlertTriangle className="h-8 w-8 text-warning" />;
      case 'failed':
        return <XCircle className="h-8 w-8 text-destructive" />;
    }
  };

  const getStatusMessage = () => {
    switch (summary.status) {
      case 'success':
        return 'Import completed successfully';
      case 'partial':
        return 'Import completed with some errors';
      case 'failed':
        return 'Import failed';
    }
  };

  const successRate = summary.statementsExecuted / (summary.statementsExecuted + summary.statementsFailed) * 100;

  const codeCounts = (() => {
    const map = new Map<number, number>();
    for (const e of errors) {
      if (typeof e.code === 'number') {
        map.set(e.code, (map.get(e.code) || 0) + 1);
      }
    }
    return map;
  })();

  const formatName = (name: string) => {
    const spaced = name.replace(/_/g, ' ').toLowerCase();
    return spaced.replace(/\b\w/g, s => s.toUpperCase());
  };

  const downloadReport = () => {
    const report = {
      summary: {
        status: summary.status,
        startTime: new Date(summary.startTime).toISOString(),
        endTime: new Date(summary.endTime).toISOString(),
        duration: formatDuration(summary.duration),
        statementsExecuted: summary.statementsExecuted,
        statementsFailed: summary.statementsFailed,
        successRate: `${successRate.toFixed(1)}%`,
      },
      phases: summary.phases,
      errors: errors.map(e => ({
        phase: e.phase,
        statement: e.statement,
        error: e.error,
        timestamp: new Date(e.timestamp).toISOString(),
      })),
      logs: logs.map(l => ({
        level: l.level,
        message: l.message,
        details: l.details,
        timestamp: new Date(l.timestamp).toISOString(),
      })),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    onDownloadReport?.();
  };

  const stage1Log = logs.find(l => l.message === 'Applying Stage 1 schema changes');
  const stage2Log = logs.find(l => l.message === 'Applying Stage 2 constraints');
  const rollbackStartLog = logs.find(l => l.message === 'Starting rollback of schema alignment');
  const rollbackPlanLog = logs.find(l => l.message === 'Rollback plan');
  const stage1Applied = stage1Log?.details ? stage1Log.details.split('\n').filter(Boolean).length : 0;
  const stage2Applied = stage2Log?.details ? stage2Log.details.split('\n').filter(Boolean).length : 0;
  const rollbackCount = rollbackStartLog?.message ? (() => {
    const m = rollbackStartLog.message.match(/(\d+)\s+statements/);
    return m ? Number(m[1]) : 0;
  })() : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <CardTitle className="text-lg">{getStatusMessage()}</CardTitle>
              <CardDescription>
                Completed in {formatDuration(summary.duration)}
              </CardDescription>
            </div>
          </div>
          <Badge 
            variant={summary.status === 'success' ? 'default' : summary.status === 'partial' ? 'secondary' : 'destructive'}
            className="text-sm"
          >
            {successRate.toFixed(1)}% Success Rate
          </Badge>
        </div>
        {codeCounts.size > 0 && (
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Code Legend</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <Info className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <div className="space-y-1">
                      {Object.entries(PgDumpErrorCategory)
                        .filter(([, v]) => typeof v === 'number')
                        .map(([name, code]) => (
                          <div key={name} className="flex items-center justify-between">
                            <span className="text-xs">{formatName(name)}</span>
                            <Badge variant="outline" className="text-xs">#{code as number}</Badge>
                          </div>
                        ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {Array.from(codeCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([code, count]) => (
                  <Badge key={code} variant="outline" className="text-xs">
                    {code} {formatName(PgDumpErrorCategory[code] as unknown as string)} · {count}
                  </Badge>
                ))}
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-muted rounded-lg text-center">
            <p className="text-3xl font-bold text-green-500">{summary.statementsExecuted}</p>
            <p className="text-sm text-muted-foreground">Executed</p>
          </div>
          <div className="p-4 bg-muted rounded-lg text-center">
            <p className="text-3xl font-bold text-destructive">{summary.statementsFailed}</p>
            <p className="text-sm text-muted-foreground">Failed</p>
          </div>
          <div className="p-4 bg-muted rounded-lg text-center">
            <p className="text-3xl font-bold">{formatDuration(summary.duration)}</p>
            <p className="text-sm text-muted-foreground">Duration</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span>{summary.statementsExecuted + summary.statementsFailed} / {summary.statementsExecuted + summary.statementsFailed} statements</span>
          </div>
          <Progress value={100} className="h-2" />
        </div>

        {/* Phase Breakdown */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Table className="h-4 w-4" />
            Phase Breakdown
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(summary.phases).map(([phase, stats]) => (
              stats.executed + stats.failed > 0 && (
                <div key={phase} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium capitalize">{phase}</span>
                    {stats.failed === 0 ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-warning" />
                    )}
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span className="text-green-600">{stats.executed} ok</span>
                    {stats.failed > 0 && (
                      <span className="text-destructive">{stats.failed} failed</span>
                    )}
                  </div>
                  {summary.metrics?.phases?.[(phase as ImportProgress['currentPhase'])] && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDuration(summary.metrics!.phases![(phase as ImportProgress['currentPhase'])]!.duration)} 
                    </div>
                  )}
                </div>
              )
            ))}
          </div>
        </div>

        {summary.metrics && (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Timing
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 border rounded-lg">
                <div className="text-sm text-muted-foreground">Total Runtime</div>
                <div className="text-2xl font-bold">{formatDuration(summary.metrics.totalDuration)}</div>
              </div>
              {Object.entries(summary.metrics.phases).map(([name, timing]) => timing && (
                <div key={name} className="p-3 border rounded-lg">
                  <div className="text-sm text-muted-foreground capitalize">{name} duration</div>
                  <div className="text-2xl font-bold">{formatDuration(timing.duration)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alignment Audit */}
        {(stage1Applied > 0 || stage2Applied > 0 || rollbackCount > 0) && (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Alignment Audit
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 border rounded-lg">
                <div className="text-sm text-muted-foreground">Stage 1: Columns Added/Backfilled</div>
                <div className="text-2xl font-bold">{stage1Applied}</div>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="text-sm text-muted-foreground">Stage 2: NOT NULL Applied</div>
                <div className="text-2xl font-bold">{stage2Applied}</div>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="text-sm text-muted-foreground">Rollback: Statements Executed</div>
                <div className="text-2xl font-bold">{rollbackCount}</div>
              </div>
            </div>
            {rollbackPlanLog?.details && (
              <div className="text-xs text-muted-foreground">
                Last rollback plan:
                <ScrollArea className="h-24 rounded-md border bg-muted/50 mt-2">
                  <div className="p-3 font-mono">
                    {rollbackPlanLog.details.split('\n').slice(0, 20).map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        {/* Verification Section */}
        {onVerify && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Post-Import Verification
              </h4>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onVerify}
                disabled={isVerifying}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Run Verification
                  </>
                )}
              </Button>
            </div>
            
            {verificationResults && verificationResults.length > 0 && (
              <div className="rounded-md border">
                <ScrollArea className="h-64">
                  <div className="p-0">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="p-3 font-medium">Table</th>
                          <th className="p-3 font-medium text-right">Expected</th>
                          <th className="p-3 font-medium text-right">Actual</th>
                          <th className="p-3 font-medium">Checksum</th>
                          <th className="p-3 font-medium text-center">Status</th>
                          <th className="p-3 font-medium">Integrity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {verificationResults.map((res, i) => (
                          <tr key={i} className="hover:bg-muted/50">
                            <td className="p-3 font-mono text-xs">{res.table}</td>
                            <td className="p-3 text-right font-mono text-xs text-muted-foreground">{res.expected.toLocaleString()}</td>
                            <td className="p-3 text-right font-mono text-xs">{res.actual === -1 ? 'Error' : res.actual.toLocaleString()}</td>
                            <td className="p-3 font-mono text-xs text-muted-foreground truncate max-w-[100px]" title={res.checksum || '-'}>
                              {res.checksum ? res.checksum.slice(0, 8) + '...' : '-'}
                            </td>
                            <td className="p-3 text-center">
                              {res.match ? (
                                <Badge variant="outline" className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20">
                                  Match
                                </Badge>
                              ) : res.actual === -1 ? (
                                <Badge variant="destructive">Error</Badge>
                              ) : (
                                <Badge variant="outline" className="text-warning border-warning/50">
                                  Mismatch
                                </Badge>
                              )}
                            </td>
                            <td className="p-3">
                              {res.orphanCheck?.hasOrphans ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center gap-1 text-destructive text-xs font-medium cursor-help">
                                        <AlertTriangle className="h-3 w-3" />
                                        {res.orphanCheck.orphanCount} Orphans
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Constraint: {res.orphanCheck.constraintName}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <span className="text-green-500 text-xs flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> OK
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        {/* Errors List */}
        {errors.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" />
              Errors ({errors.length})
            </h4>
            <ScrollArea className="h-48 rounded-md border">
              <div className="p-4 space-y-3">
                {errors.slice(0, 50).map((error, i) => (
                  <div key={i} className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{error.phase}</Badge>
                        {error.severity && (
                          <Badge variant={error.severity === 'warning' ? 'secondary' : 'destructive'} className="text-xs">
                            {error.severity.toUpperCase()}
                          </Badge>
                        )}
                        {typeof error.category === 'number' && (
                          <Badge variant="outline" className="text-xs">
                            {formatName(PgDumpErrorCategory[error.category] as unknown as string)}
                          </Badge>
                        )}
                        {typeof error.code === 'number' && (
                          <Badge variant="outline" className="text-xs">Code {error.code}</Badge>
                        )}
                        {summary.metrics?.phases?.[(error.phase as ImportProgress['currentPhase'])] && (
                          <Badge variant="outline" className="text-xs">
                            {formatDuration(summary.metrics!.phases![(error.phase as ImportProgress['currentPhase'])]!.duration)}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">Statement #{error.index + 1}</span>
                    </div>
                    <p className="text-destructive font-medium">{error.error}</p>
                    <pre className="mt-2 text-xs text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                      {error.statement}
                    </pre>
                  </div>
                ))}
                {errors.length > 50 && (
                  <p className="text-center text-sm text-muted-foreground">
                    ... and {errors.length - 50} more errors
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Execution Log */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Execution Log
          </h4>
          <ScrollArea className="h-48 rounded-md border bg-muted/50">
            <div className="p-4 space-y-1 font-mono text-xs">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-muted-foreground">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={
                    log.level === 'error' ? 'text-destructive' :
                    log.level === 'warn' ? 'text-warning' :
                    log.level === 'success' ? 'text-green-500' :
                    'text-foreground'
                  }>
                    [{log.level.toUpperCase()}]
                  </span>
                  <span>{log.message}</span>
                  {log.details && (
                    <span className="text-muted-foreground">- {log.details}</span>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={downloadReport}>
            <Download className="mr-2 h-4 w-4" />
            Download Report
          </Button>
          {summary.status !== 'success' && onRetry && (
            <Button className="flex-1" onClick={onRetry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Import
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
