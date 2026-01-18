import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Database, 
  Upload, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Loader2,
  FileCode,
  Play,
  RotateCcw,
  Eye
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { fixAllMigrations, analyzeMigrations, type MigrationFile, type MigrationIssue } from '@/utils/migrationFixer';

interface MigrationResult {
  name: string;
  success: boolean;
  error?: string;
  duration_ms: number;
}

interface PushResponse {
  success: boolean;
  total: number;
  applied: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  results: MigrationResult[];
  error?: string;
}

// Hardcoded migration file list - in real implementation, this would be fetched from the repo
const MIGRATION_FILES: MigrationFile[] = [];

export default function MigrationPushPanel() {
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<{
    totalIssues: number;
    errorCount: number;
    warningCount: number;
    issues: MigrationIssue[];
  } | null>(null);
  const [pushResult, setPushResult] = useState<PushResponse | null>(null);
  const [migrations, setMigrations] = useState<MigrationFile[]>([]);
  const [activeTab, setActiveTab] = useState('upload');

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    const loadedMigrations: MigrationFile[] = [];

    try {
      for (const file of Array.from(files)) {
        if (file.name.endsWith('.sql')) {
          const content = await file.text();
          loadedMigrations.push({
            name: file.name,
            sql: content
          });
        }
      }

      // Sort by filename (timestamp prefix)
      loadedMigrations.sort((a, b) => a.name.localeCompare(b.name));
      setMigrations(loadedMigrations);
      toast.success(`Loaded ${loadedMigrations.length} migration files`);
      setActiveTab('analyze');
    } catch (error) {
      console.error('Error loading migrations:', error);
      toast.error('Failed to load migration files');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleAnalyze = useCallback(() => {
    if (migrations.length === 0) {
      toast.error('No migrations to analyze');
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = analyzeMigrations(migrations);
      setAnalysisResult(result);
      
      if (result.errorCount > 0) {
        toast.warning(`Found ${result.errorCount} errors and ${result.warningCount} warnings`);
      } else if (result.warningCount > 0) {
        toast.info(`Found ${result.warningCount} warnings (auto-fixable)`);
      } else {
        toast.success('No issues found');
      }
    } catch (error) {
      console.error('Error analyzing migrations:', error);
      toast.error('Failed to analyze migrations');
    } finally {
      setIsAnalyzing(false);
    }
  }, [migrations]);

  const handlePush = useCallback(async (dryRun: boolean) => {
    if (migrations.length === 0) {
      toast.error('No migrations to push');
      return;
    }

    setIsPushing(true);
    setProgress(0);
    setPushResult(null);

    try {
      // Fix all migrations before pushing
      const { fixed, issues } = fixAllMigrations(migrations);
      
      console.log(`Pushing ${fixed.length} migrations (${issues.length} issues auto-fixed)`);
      
      // Call edge function
      const { data, error } = await supabase.functions.invoke('push-migrations-to-target', {
        body: {
          migrations: fixed,
          dryRun
        }
      });

      if (error) throw error;

      setPushResult(data as PushResponse);
      
      if (data.success) {
        toast.success(
          dryRun 
            ? `Dry run complete: ${data.applied} migrations would be applied`
            : `Successfully applied ${data.applied} migrations`
        );
      } else {
        toast.error(`Migration push failed: ${data.failed} errors`);
      }

      setActiveTab('results');
    } catch (error) {
      console.error('Error pushing migrations:', error);
      toast.error('Failed to push migrations');
      setPushResult({
        success: false,
        total: migrations.length,
        applied: 0,
        skipped: 0,
        failed: migrations.length,
        dryRun,
        results: [],
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsPushing(false);
      setProgress(100);
    }
  }, [migrations]);

  const handleReset = useCallback(() => {
    setMigrations([]);
    setAnalysisResult(null);
    setPushResult(null);
    setProgress(0);
    setActiveTab('upload');
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Migration Push Manager
            </CardTitle>
            <CardDescription>
              Fix and push SQL migrations to target database
            </CardDescription>
          </div>
          {migrations.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="upload">
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="analyze" disabled={migrations.length === 0}>
              <Eye className="h-4 w-4 mr-2" />
              Analyze
            </TabsTrigger>
            <TabsTrigger value="push" disabled={migrations.length === 0}>
              <Play className="h-4 w-4 mr-2" />
              Push
            </TabsTrigger>
            <TabsTrigger value="results" disabled={!pushResult}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Results
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <FileCode className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                Upload your SQL migration files to analyze and push to target database
              </p>
              <input
                type="file"
                multiple
                accept=".sql"
                onChange={handleFileUpload}
                className="hidden"
                id="migration-upload"
                disabled={isLoading}
              />
              <label htmlFor="migration-upload">
                <Button asChild disabled={isLoading}>
                  <span>
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Select Migration Files
                      </>
                    )}
                  </span>
                </Button>
              </label>
            </div>

            {migrations.length > 0 && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Files Loaded</AlertTitle>
                <AlertDescription>
                  {migrations.length} migration files ready for analysis
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="analyze" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">{migrations.length} Migrations Loaded</h3>
                <p className="text-sm text-muted-foreground">
                  Click analyze to check for issues
                </p>
              </div>
              <Button onClick={handleAnalyze} disabled={isAnalyzing}>
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Analyze
                  </>
                )}
              </Button>
            </div>

            {analysisResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">{analysisResult.totalIssues}</div>
                      <div className="text-sm text-muted-foreground">Total Issues</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold text-destructive">{analysisResult.errorCount}</div>
                      <div className="text-sm text-muted-foreground">Errors</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold text-warning">{analysisResult.warningCount}</div>
                      <div className="text-sm text-muted-foreground">Warnings</div>
                    </CardContent>
                  </Card>
                </div>

                {analysisResult.issues.length > 0 && (
                  <ScrollArea className="h-[300px] border rounded-lg p-4">
                    <div className="space-y-2">
                      {analysisResult.issues.map((issue, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-start gap-2 p-2 rounded bg-muted/50"
                        >
                          {issue.severity === 'error' ? (
                            <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
                          )}
                          <div className="flex-1">
                            <div className="text-sm font-medium">{issue.file}</div>
                            <div className="text-sm text-muted-foreground">{issue.issue}</div>
                          </div>
                          {issue.fixed && (
                            <Badge variant="outline" className="text-xs">
                              Auto-fixed
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="push" className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Target Database</AlertTitle>
              <AlertDescription>
                Migrations will be pushed to the target database configured in TARGET_DB_URL secret.
                All issues will be auto-fixed before pushing.
              </AlertDescription>
            </Alert>

            <div className="flex gap-4">
              <Button 
                variant="outline" 
                onClick={() => handlePush(true)}
                disabled={isPushing}
                className="flex-1"
              >
                {isPushing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4 mr-2" />
                )}
                Dry Run
              </Button>
              <Button 
                onClick={() => handlePush(false)}
                disabled={isPushing}
                className="flex-1"
              >
                {isPushing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Push to Target DB
              </Button>
            </div>

            {isPushing && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-center text-muted-foreground">
                  Pushing migrations...
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            {pushResult && (
              <>
                <Alert variant={pushResult.success ? 'default' : 'destructive'}>
                  {pushResult.success ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <AlertTitle>
                    {pushResult.success ? 'Migration Complete' : 'Migration Failed'}
                  </AlertTitle>
                  <AlertDescription>
                    {pushResult.dryRun ? 'Dry run - no changes applied. ' : ''}
                    Applied: {pushResult.applied}, Skipped: {pushResult.skipped}, Failed: {pushResult.failed}
                  </AlertDescription>
                </Alert>

                {pushResult.error && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{pushResult.error}</AlertDescription>
                  </Alert>
                )}

                <ScrollArea className="h-[400px] border rounded-lg p-4">
                  <div className="space-y-2">
                    {pushResult.results.map((result, idx) => (
                      <div 
                        key={idx} 
                        className={`flex items-center justify-between p-2 rounded ${
                          result.success ? 'bg-muted/50' : 'bg-destructive/10'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {result.success ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                          <span className="text-sm font-mono">{result.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {result.error && (
                            <span className="text-xs text-muted-foreground max-w-[200px] truncate">
                              {result.error}
                            </span>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {result.duration_ms}ms
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
