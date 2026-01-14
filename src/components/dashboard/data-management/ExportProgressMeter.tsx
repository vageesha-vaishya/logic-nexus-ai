import { motion, AnimatePresence } from "framer-motion";
import { 
  Loader2, CheckCircle, XCircle, AlertTriangle, Pause, Play, X, 
  ChevronDown, ChevronUp, Clock, FileText, Activity, RefreshCw 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DetailedProgress, LogEntry } from "@/utils/dbExportUtils";
import { useEffect, useRef } from "react";

interface ExportProgressMeterProps {
  progress: DetailedProgress;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  onToggleDetails?: () => void;
  showDetails: boolean;
}

const formatTime = (seconds: number | null) => {
  if (seconds === null || !isFinite(seconds)) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export function ExportProgressMeter({
  progress,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onToggleDetails,
  showDetails
}: ExportProgressMeterProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (showDetails && scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [progress.logs, showDetails]);

  const getStatusColor = () => {
    switch (progress.status) {
      case 'completed': return 'text-green-500';
      case 'error': return 'text-red-500';
      case 'paused': return 'text-yellow-500';
      case 'cancelled': return 'text-gray-500';
      default: return 'text-primary';
    }
  };

  const getStatusIcon = () => {
    switch (progress.status) {
      case 'completed': return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'error': return <XCircle className="h-6 w-6 text-red-500" />;
      case 'paused': return <Pause className="h-6 w-6 text-yellow-500" />;
      case 'cancelled': return <XCircle className="h-6 w-6 text-gray-500" />;
      default: return <Loader2 className="h-6 w-6 animate-spin text-primary" />;
    }
  };

  return (
    <Card className="border-primary/20 shadow-lg overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              {getStatusIcon()}
              {progress.status === 'running' && (
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-primary"
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </div>
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                Exporting Database
                {progress.status === 'paused' && <Badge variant="outline" className="text-yellow-500 border-yellow-500">Paused</Badge>}
                {progress.status === 'error' && <Badge variant="destructive">Error</Badge>}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{progress.message}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             {progress.status === 'running' && onPause && (
              <Button variant="outline" size="sm" onClick={onPause}>
                <Pause className="h-4 w-4 mr-1" /> Pause
              </Button>
            )}
            {progress.status === 'paused' && onResume && (
              <Button variant="outline" size="sm" onClick={onResume}>
                <Play className="h-4 w-4 mr-1" /> Resume
              </Button>
            )}
            {(progress.status === 'error' || progress.status === 'cancelled') && onRetry && (
               <Button variant="outline" size="sm" onClick={onRetry}>
                 <RefreshCw className="h-4 w-4 mr-1" /> Retry
               </Button>
            )}
            {progress.status !== 'completed' && progress.status !== 'cancelled' && onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground hover:text-destructive">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Main Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm font-medium">
            <span>Overall Progress</span>
            <span>{progress.percent}%</span>
          </div>
          <Progress value={progress.percent} className="h-3" />
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-muted/30 p-3 rounded-lg border">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Activity className="h-3 w-3" /> Current Step
            </div>
            <div className="font-medium text-sm truncate" title={progress.currentStep}>
              {progress.currentStep}
            </div>
          </div>
          
          <div className="bg-muted/30 p-3 rounded-lg border">
             <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <FileText className="h-3 w-3" /> Processing
            </div>
            <div className="font-medium text-sm truncate" title={progress.currentItem}>
              {progress.currentItem || '-'}
            </div>
          </div>

          <div className="bg-muted/30 p-3 rounded-lg border">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Clock className="h-3 w-3" /> Est. Remaining
            </div>
            <div className="font-medium text-sm">
              {formatTime(progress.estimatedTimeRemaining)}
            </div>
          </div>

          <div className="bg-muted/30 p-3 rounded-lg border">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Activity className="h-3 w-3" /> Items
            </div>
            <div className="font-medium text-sm">
              {progress.processedItems} / {progress.totalItems || '?'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-muted/30 p-3 rounded-lg border">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <FileText className="h-3 w-3" /> Item Type
            </div>
            <div className="font-medium text-sm truncate" title={progress.currentItemType}>
              {progress.currentItemType || '-'}
            </div>
          </div>

          <div className="bg-muted/30 p-3 rounded-lg border">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Activity className="h-3 w-3" /> Item Size
            </div>
            <div className="font-medium text-sm">
              {progress.currentItemSize !== undefined ? progress.currentItemSize : '-'}
            </div>
          </div>

          <div className="bg-muted/30 p-3 rounded-lg border">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Activity className="h-3 w-3" /> Throughput
            </div>
            <div className="font-medium text-sm">
              {progress.currentThroughput !== undefined
                ? `${progress.currentThroughput.toFixed(1)} items/s`
                : '-'}
            </div>
          </div>
        </div>

        {/* Detailed Logs Toggle */}
        <div className="pt-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full flex justify-between items-center text-muted-foreground hover:text-foreground"
            onClick={onToggleDetails}
          >
            <span className="flex items-center gap-2">
              {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showDetails ? 'Hide Details' : 'Show Details'}
            </span>
            {progress.errors.length > 0 && (
              <Badge variant="destructive" className="ml-2">{progress.errors.length} Errors</Badge>
            )}
          </Button>

          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-4 border rounded-md bg-muted/20" ref={scrollRef}>
                  <ScrollArea className="h-[200px] w-full p-4">
                    <div className="space-y-2 font-mono text-xs">
                      {progress.logs.map((log, i) => (
                        <div key={i} className={cn(
                          "flex items-start gap-2",
                          log.type === 'error' && "text-red-500",
                          log.type === 'warning' && "text-yellow-500",
                          log.type === 'success' && "text-green-500",
                          log.type === 'info' && "text-muted-foreground"
                        )}>
                          <span className="opacity-50 shrink-0">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <span>{log.message}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
