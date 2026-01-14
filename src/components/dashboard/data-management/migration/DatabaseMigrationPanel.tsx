import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Database, Upload, Play, Settings2, ArrowRight } from 'lucide-react';
import { ConnectionConfigForm } from './ConnectionConfigForm';
import { FileUploadZone } from './FileUploadZone';
import { MigrationProgressPanel } from './MigrationProgressPanel';
import { MigrationSummaryReport } from './MigrationSummaryReport';
import { useDatabaseMigration } from '@/hooks/useDatabaseMigration';
import { toast } from 'sonner';

export function DatabaseMigrationPanel() {
  const [activeTab, setActiveTab] = useState('file');
  const [isPaused, setIsPaused] = useState(false);
  
  const {
    connectionConfig,
    connectionValidation,
    validateConnection,
    selectedFile,
    fileValidation,
    validateFile,
    migrationProgress,
    migrationSteps,
    migrationErrors,
    migrationSummary,
    executeMigration,
    cancelMigration,
    pauseMigration,
    resumeMigration,
    resetMigration
  } = useDatabaseMigration();

  const handleStartMigration = async () => {
    try {
      setActiveTab('progress');
      await executeMigration();
      toast.success('Migration completed');
    } catch (error: any) {
      toast.error('Migration failed', { description: error.message });
    }
  };

  const handlePause = () => {
    pauseMigration();
    setIsPaused(true);
  };

  const handleResume = () => {
    resumeMigration();
    setIsPaused(false);
  };

  const handleReset = () => {
    resetMigration();
    setActiveTab('file');
    setIsPaused(false);
  };

  const canStartMigration = fileValidation?.isValid && migrationProgress.status === 'idle';
  const isRunning = ['preparing', 'executing', 'validating'].includes(migrationProgress.status);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database Migration
            </CardTitle>
            <CardDescription>
              Migrate your database to a new Supabase infrastructure
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">Advanced</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="connection" disabled={isRunning}>
              <Database className="h-4 w-4 mr-2" />
              Connection
            </TabsTrigger>
            <TabsTrigger value="file" disabled={isRunning}>
              <Upload className="h-4 w-4 mr-2" />
              File
            </TabsTrigger>
            <TabsTrigger value="progress">
              <Play className="h-4 w-4 mr-2" />
              Progress
            </TabsTrigger>
            <TabsTrigger value="settings" disabled={isRunning}>
              <Settings2 className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connection" className="mt-4">
            <ConnectionConfigForm
              onValidate={validateConnection}
              validationResult={connectionValidation}
            />
          </TabsContent>

          <TabsContent value="file" className="mt-4 space-y-4">
            <FileUploadZone
              onFileSelect={validateFile}
              validationResult={fileValidation}
              selectedFile={selectedFile}
              disabled={isRunning}
            />
            
            {canStartMigration && (
              <Button onClick={handleStartMigration} className="w-full" size="lg">
                <Play className="mr-2 h-4 w-4" />
                Start Migration
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </TabsContent>

          <TabsContent value="progress" className="mt-4 space-y-4">
            {migrationSummary ? (
              <MigrationSummaryReport
                summary={migrationSummary}
                onClose={handleReset}
              />
            ) : (
              <MigrationProgressPanel
                progress={migrationProgress}
                steps={migrationSteps}
                errors={migrationErrors}
                onPause={handlePause}
                onResume={handleResume}
                onCancel={cancelMigration}
                onReset={handleReset}
                isPaused={isPaused}
              />
            )}
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Migration Settings</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>Configure batch size, parallel processing, and error handling options.</p>
                <p className="mt-2">Default settings are optimized for most use cases.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
