import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2,
  Database,
  Zap,
  AlertTriangle,
  ArrowRight,
  SkipForward
} from 'lucide-react';
import { MigrationProgress, MigrationStep, MigrationError } from '@/types/database-migration';
import { cn } from '@/lib/utils';

interface MigrationProgressPanelProps {
  progress: MigrationProgress;
  steps: MigrationStep[];
  errors: MigrationError[];
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onReset: () => void;
  isPaused?: boolean;
}

export function MigrationProgressPanel({
  progress,
  steps,
  errors,
  onPause,
  onResume,
  onCancel,
  onReset,
  isPaused = false
}: MigrationProgressPanelProps) {
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const getStepIcon = (step: MigrationStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'skipped':
        return <SkipForward className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = () => {
    switch (progress.status) {
      case 'completed':
        return 'bg-green-500';
      case 'failed':
      case 'cancelled':
        return 'bg-destructive';
      case 'executing':
      case 'validating':
        return 'bg-primary';
      default:
        return 'bg-muted-foreground';
    }
  };

  const getStatusBadge = () => {
    switch (progress.status) {
      case 'idle':
        return <Badge variant="outline">Ready</Badge>;
      case 'preparing':
        return <Badge variant="secondary">Preparing...</Badge>;
      case 'executing':
        return <Badge className="bg-primary">Migrating</Badge>;
      case 'validating':
        return <Badge variant="secondary">Validating...</Badge>;
      case 'completed':
        return <Badge className="bg-green-500">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{progress.status}</Badge>;
    }
  };

  const isRunning = progress.status === 'executing' || progress.status === 'validating' || progress.status === 'preparing';
  const isFinished = progress.status === 'completed' || progress.status === 'failed' || progress.status === 'cancelled';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Migration Progress
            </CardTitle>
            <CardDescription>
              {progress.currentTable ? `Processing: ${progress.currentTable}` : 'Awaiting start'}
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">{Math.round(progress.overallProgress)}%</span>
          </div>
          <Progress value={progress.overallProgress} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Step {progress.completedSteps} of {progress.totalSteps}</span>
            <span>{progress.rowsProcessed.toLocaleString()} / {progress.totalRows.toLocaleString()} rows</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Elapsed</p>
            <p className="text-sm font-medium">{formatTime(progress.elapsedMs)}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">ETA</p>
            <p className="text-sm font-medium">
              {progress.estimatedRemainingMs > 0 ? formatTime(progress.estimatedRemainingMs) : '-'}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <Zap className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Throughput</p>
            <p className="text-sm font-medium">
              {progress.throughputMbPerSec > 0 ? `${progress.throughputMbPerSec.toFixed(2)} MB/s` : '-'}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <Database className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Data</p>
            <p className="text-sm font-medium">
              {formatBytes(progress.bytesProcessed)} / {formatBytes(progress.totalBytes)}
            </p>
          </div>
        </div>

        {/* Current Batch Info */}
        {progress.currentBatch && progress.totalBatches && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>Batch {progress.currentBatch} of {progress.totalBatches}</span>
            {progress.currentTable && (
              <>
                <ArrowRight className="h-4 w-4" />
                <span className="font-medium text-foreground">{progress.currentTable}</span>
              </>
            )}
          </div>
        )}

        {/* Steps Timeline */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Migration Steps</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {steps.map((step) => (
              <div 
                key={step.id}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-lg text-sm transition-colors",
                  step.status === 'in_progress' && "bg-primary/5 border border-primary/20",
                  step.status === 'completed' && "bg-green-500/5",
                  step.status === 'failed' && "bg-destructive/5"
                )}
              >
                {getStepIcon(step)}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "font-medium truncate",
                    step.status === 'pending' && "text-muted-foreground"
                  )}>
                    {step.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                </div>
                {step.status === 'completed' && step.startTime && step.endTime && (
                  <span className="text-xs text-muted-foreground">
                    {formatTime(step.endTime - step.startTime)}
                  </span>
                )}
                {step.status === 'in_progress' && step.progress !== undefined && (
                  <span className="text-xs text-primary font-medium">
                    {step.progress}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-sm font-medium">Errors ({errors.length})</p>
            </div>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {errors.slice(0, 5).map((error) => (
                <div key={error.id} className="p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                  <p className="text-xs font-medium text-destructive">{error.step}</p>
                  <p className="text-xs text-destructive/80">{error.message}</p>
                  {error.affectedObject && (
                    <p className="text-xs text-muted-foreground mt-1">Affected: {error.affectedObject}</p>
                  )}
                </div>
              ))}
              {errors.length > 5 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{errors.length - 5} more errors
                </p>
              )}
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex gap-2">
          {isRunning && !isPaused && (
            <Button variant="outline" onClick={onPause} className="flex-1">
              <Pause className="mr-2 h-4 w-4" />
              Pause
            </Button>
          )}
          {isRunning && isPaused && (
            <Button onClick={onResume} className="flex-1">
              <Play className="mr-2 h-4 w-4" />
              Resume
            </Button>
          )}
          {isRunning && (
            <Button variant="destructive" onClick={onCancel} className="flex-1">
              <Square className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          )}
          {isFinished && (
            <Button variant="outline" onClick={onReset} className="flex-1">
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
