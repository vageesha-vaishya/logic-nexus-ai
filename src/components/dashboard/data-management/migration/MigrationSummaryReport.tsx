import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Download, 
  FileText,
  Database,
  Clock,
  Zap,
  BarChart3,
  Info
} from 'lucide-react';
import { MigrationSummary, MigrationError, TableMigrationResult } from '@/types/database-migration';
import { cn } from '@/lib/utils';

interface MigrationSummaryReportProps {
  summary: MigrationSummary;
  onDownloadReport?: () => void;
  onClose?: () => void;
}

export function MigrationSummaryReport({ summary, onDownloadReport, onClose }: MigrationSummaryReportProps) {
  const formatDuration = (ms: number) => {
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

  const getStatusIcon = () => {
    switch (summary.status) {
      case 'success':
        return <CheckCircle2 className="h-8 w-8 text-green-500" />;
      case 'partial':
        return <AlertTriangle className="h-8 w-8 text-amber-500" />;
      case 'failed':
        return <XCircle className="h-8 w-8 text-destructive" />;
    }
  };

  const getStatusMessage = () => {
    switch (summary.status) {
      case 'success':
        return 'Migration completed successfully';
      case 'partial':
        return 'Migration completed with some errors';
      case 'failed':
        return 'Migration failed';
    }
  };

  const getStatusBadge = () => {
    switch (summary.status) {
      case 'success':
        return <Badge className="bg-green-500">Success</Badge>;
      case 'partial':
        return <Badge className="bg-amber-500">Partial</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
    }
  };

  const totalRecords = summary.records.inserted + summary.records.updated + summary.records.skipped + summary.records.failed;
  const successRate = totalRecords > 0 
    ? ((summary.records.inserted + summary.records.updated) / totalRecords * 100).toFixed(1) 
    : '0';

  const downloadReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      ...summary
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `migration-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    onDownloadReport?.();
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {getStatusIcon()}
            <div>
              <CardTitle className="text-xl">{getStatusMessage()}</CardTitle>
              <CardDescription>
                Completed at {new Date(summary.endTime).toLocaleString()}
              </CardDescription>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-muted/50 text-center">
            <Clock className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{formatDuration(summary.duration)}</p>
            <p className="text-xs text-muted-foreground">Total Duration</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50 text-center">
            <Database className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{summary.tables.migrated}</p>
            <p className="text-xs text-muted-foreground">Tables Migrated</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50 text-center">
            <BarChart3 className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{summary.records.inserted.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Records Inserted</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50 text-center">
            <Zap className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{successRate}%</p>
            <p className="text-xs text-muted-foreground">Success Rate</p>
          </div>
        </div>

        {/* Detailed Tabs */}
        <Tabs defaultValue="tables" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="tables">Tables</TabsTrigger>
            <TabsTrigger value="records">Records</TabsTrigger>
            <TabsTrigger value="errors">Errors ({summary.errors.length})</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="tables" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                <p className="text-lg font-bold text-green-600">{summary.tables.migrated}</p>
                <p className="text-xs text-muted-foreground">Migrated</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                <p className="text-lg font-bold text-amber-600">{summary.tables.skipped}</p>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
                <p className="text-lg font-bold text-destructive">{summary.tables.failed}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>

            {summary.tables.details.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Table</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Inserted</TableHead>
                      <TableHead className="text-right">Failed</TableHead>
                      <TableHead className="text-right">Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.tables.details.slice(0, 10).map((table, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">
                          {table.schemaName}.{table.tableName}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={table.status === 'migrated' ? 'default' : table.status === 'partial' ? 'secondary' : 'destructive'}
                            className={cn(
                              table.status === 'migrated' && 'bg-green-500',
                              table.status === 'partial' && 'bg-amber-500'
                            )}
                          >
                            {table.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{table.recordsInserted.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-destructive">{table.recordsFailed.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{formatDuration(table.duration)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {summary.tables.details.length > 10 && (
                  <div className="p-2 text-center text-xs text-muted-foreground bg-muted/30">
                    +{summary.tables.details.length - 10} more tables
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="records" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                <CheckCircle2 className="h-5 w-5 mx-auto mb-2 text-green-500" />
                <p className="text-2xl font-bold text-green-600">{summary.records.inserted.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Inserted</p>
              </div>
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                <Info className="h-5 w-5 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold text-blue-600">{summary.records.updated.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Updated</p>
              </div>
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-amber-500" />
                <p className="text-2xl font-bold text-amber-600">{summary.records.skipped.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
                <XCircle className="h-5 w-5 mx-auto mb-2 text-destructive" />
                <p className="text-2xl font-bold text-destructive">{summary.records.failed.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="errors" className="space-y-4">
            {summary.errors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p>No errors encountered during migration</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {summary.errors.map((error) => (
                  <div 
                    key={error.id} 
                    className="p-3 rounded-lg bg-destructive/5 border border-destructive/20"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive" className="text-xs">{error.type}</Badge>
                          <span className="text-xs text-muted-foreground">{error.step}</span>
                        </div>
                        <p className="text-sm mt-1">{error.message}</p>
                        {error.affectedObject && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Affected: {error.affectedObject}
                          </p>
                        )}
                        {error.suggestedAction && (
                          <p className="text-xs text-primary mt-1">
                            Suggestion: {error.suggestedAction}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {error.isRecoverable ? 'Recoverable' : 'Fatal'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <Zap className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-2xl font-bold">{summary.performanceMetrics.avgThroughputMbPerSec.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Avg MB/s</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <Database className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-2xl font-bold">{formatBytes(summary.performanceMetrics.totalBytesProcessed)}</p>
                <p className="text-xs text-muted-foreground">Data Processed</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <BarChart3 className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-2xl font-bold">
                  {totalRecords > 0 
                    ? Math.round(totalRecords / (summary.duration / 1000)) 
                    : 0}
                </p>
                <p className="text-xs text-muted-foreground">Records/sec</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Recommendations */}
        {summary.recommendations.length > 0 && (
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              Recommendations
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              {summary.recommendations.map((rec, idx) => (
                <li key={idx}>{rec}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={downloadReport} variant="outline" className="flex-1">
            <Download className="mr-2 h-4 w-4" />
            Download Report
          </Button>
          {onClose && (
            <Button onClick={onClose} className="flex-1">
              <FileText className="mr-2 h-4 w-4" />
              Close
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
