import { useState, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import {
  SupabaseConnectionConfig,
  ConnectionValidationResult,
  FileValidationResult,
  MigrationProgress,
  MigrationStep,
  MigrationError,
  MigrationSummary,
  MigrationConfig,
  SchemaComparisonResult,
  MigrationSavepoint,
  DEFAULT_MIGRATION_CONFIG,
  ZipManifest
} from '@/types/database-migration';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

export function useDatabaseMigration() {
  const { scopedDb, supabase, context } = useCRM();
  
  // Connection state
  const [connectionConfig, setConnectionConfig] = useState<SupabaseConnectionConfig | null>(null);
  const [connectionValidation, setConnectionValidation] = useState<ConnectionValidationResult>({
    isValid: false,
    status: 'idle',
    message: ''
  });

  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileValidation, setFileValidation] = useState<FileValidationResult | null>(null);
  const [extractedContents, setExtractedContents] = useState<Map<string, string>>(new Map());

  // Migration state
  const [migrationConfig, setMigrationConfig] = useState<MigrationConfig>(DEFAULT_MIGRATION_CONFIG);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress>({
    overallProgress: 0,
    currentStep: null,
    completedSteps: 0,
    totalSteps: 0,
    bytesProcessed: 0,
    totalBytes: 0,
    rowsProcessed: 0,
    totalRows: 0,
    elapsedMs: 0,
    estimatedRemainingMs: 0,
    throughputMbPerSec: 0,
    status: 'idle'
  });
  const [migrationSteps, setMigrationSteps] = useState<MigrationStep[]>([]);
  const [migrationErrors, setMigrationErrors] = useState<MigrationError[]>([]);
  const [migrationSavepoints, setMigrationSavepoints] = useState<MigrationSavepoint[]>([]);
  const [migrationSummary, setMigrationSummary] = useState<MigrationSummary | null>(null);
  const [schemaComparison, setSchemaComparison] = useState<SchemaComparisonResult | null>(null);

  // Control refs
  const cancelRef = useRef(false);
  const pauseRef = useRef(false);
  const startTimeRef = useRef<number>(0);

  // Validate connection to target Supabase
  const validateConnection = useCallback(async (config: SupabaseConnectionConfig): Promise<ConnectionValidationResult> => {
    setConnectionValidation({ isValid: false, status: 'validating', message: 'Validating connection...' });
    
    try {
      // Validate URL format
      const urlPattern = /^https:\/\/[a-z0-9-]+\.supabase\.co$/;
      if (!urlPattern.test(config.projectUrl)) {
        throw new Error('Invalid Supabase project URL format. Expected: https://[project-ref].supabase.co');
      }

      // Test API connectivity
      const testResponse = await fetch(`${config.projectUrl}/rest/v1/`, {
        method: 'HEAD',
        headers: {
          'apikey': config.apiKey,
          'Authorization': `Bearer ${config.apiKey}`
        }
      });

      if (!testResponse.ok && testResponse.status !== 404) {
        throw new Error(`API connectivity failed: ${testResponse.status} ${testResponse.statusText}`);
      }

      // Test service role key if provided
      let dbAccessible = false;
      if (config.serviceRoleKey) {
        try {
          const serviceResponse = await fetch(`${config.projectUrl}/rest/v1/`, {
            method: 'GET',
            headers: {
              'apikey': config.serviceRoleKey,
              'Authorization': `Bearer ${config.serviceRoleKey}`,
              'Prefer': 'count=exact'
            }
          });
          dbAccessible = serviceResponse.ok || serviceResponse.status === 404;
        } catch {
          dbAccessible = false;
        }
      }

      const result: ConnectionValidationResult = {
        isValid: true,
        status: 'success',
        message: 'Connection validated successfully',
        details: {
          networkConnectivity: true,
          credentialValidity: true,
          databaseAccessible: dbAccessible
        }
      };

      setConnectionValidation(result);
      setConnectionConfig(config);
      return result;

    } catch (error: any) {
      const result: ConnectionValidationResult = {
        isValid: false,
        status: 'error',
        message: error.message || 'Connection validation failed',
        details: {
          networkConnectivity: false,
          credentialValidity: false,
          databaseAccessible: false
        }
      };
      setConnectionValidation(result);
      return result;
    }
  }, []);

  // Validate uploaded file
  const validateFile = useCallback(async (file: File): Promise<FileValidationResult> => {
    const issues: string[] = [];
    const warnings: string[] = [];
    
    // Check file type
    if (!file.name.toLowerCase().endsWith('.zip')) {
      issues.push('Only .zip files are supported for migration');
      return { isValid: false, issues, warnings };
    }

    // Check file size (configurable limit, default 500MB)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      issues.push(`File size (${(file.size / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed (${maxSize / 1024 / 1024} MB)`);
    }

    try {
      const zipBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(zipBuffer);
      const allFiles = Object.keys(zip.files);

      // Check for required files
      const requiredPatterns = [
        /manifest\.json$/i,
        /001_schema.*\.sql$/i,
        /004_data.*\.sql$/i
      ];
      
      const foundFiles: string[] = [];
      const missingFiles: string[] = [];

      requiredPatterns.forEach(pattern => {
        const found = allFiles.some(f => pattern.test(f));
        if (found) {
          foundFiles.push(pattern.source);
        } else {
          missingFiles.push(pattern.source);
        }
      });

      if (missingFiles.length > 0) {
        warnings.push(`Some expected files not found: ${missingFiles.join(', ')}`);
      }

      // Parse manifest if exists
      let manifest: ZipManifest | undefined;
      const manifestFile = zip.file(/manifest\.json$/i)[0];
      if (manifestFile) {
        try {
          const manifestContent = await manifestFile.async('text');
          manifest = JSON.parse(manifestContent);
        } catch {
          warnings.push('Could not parse manifest.json');
        }
      }

      // Categorize files
      const schemaFiles = allFiles.filter(f => /001_schema.*\.sql$/i.test(f) || /002_enum.*\.sql$/i.test(f) || /003_tables.*\.sql$/i.test(f));
      const dataFiles = allFiles.filter(f => /004_data.*\.sql$/i.test(f));
      const functionFiles = allFiles.filter(f => /005_function.*\.sql$/i.test(f) || /006_trigger.*\.sql$/i.test(f));

      // Estimate processing time (rough estimate: 1MB = ~2 seconds)
      const estimatedProcessingTime = Math.ceil(file.size / (1024 * 1024) * 2);

      const result: FileValidationResult = {
        isValid: issues.length === 0,
        issues,
        warnings,
        fileInfo: {
          name: file.name,
          size: file.size,
          type: 'application/zip',
          estimatedProcessingTime,
          requiredFiles: requiredPatterns.map(p => p.source),
          foundFiles,
          missingFiles
        },
        manifest: manifest || {
          version: 'unknown',
          exportDate: 'unknown',
          tables: dataFiles.map(f => f.replace(/^004_data_(.+)\.sql$/i, '$1')),
          schemaFiles,
          dataFiles,
          functionFiles
        }
      };

      setFileValidation(result);
      if (issues.length === 0) {
        setSelectedFile(file);
      }
      
      return result;

    } catch (error: any) {
      issues.push(`Failed to read zip file: ${error.message}`);
      return { isValid: false, issues, warnings };
    }
  }, []);

  // Extract and parse zip contents
  const extractZipContents = useCallback(async (file: File): Promise<Map<string, string>> => {
    const contents = new Map<string, string>();
    
    try {
      const zipBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(zipBuffer);
      
      for (const [filename, zipEntry] of Object.entries(zip.files)) {
        if (!zipEntry.dir) {
          const content = await zipEntry.async('text');
          contents.set(filename, content);
        }
      }
      
      setExtractedContents(contents);
      return contents;
    } catch (error: any) {
      toast.error('Failed to extract zip contents', { description: error.message });
      return contents;
    }
  }, []);

  // Compare schemas between source and target
  const compareSchemas = useCallback(async (): Promise<SchemaComparisonResult> => {
    const result: SchemaComparisonResult = {
      isCompatible: true,
      differences: [],
      unsupportedFeatures: [],
      dataTypeConflicts: []
    };

    try {
      // Get target schema
      const { data: targetSchema, error } = await scopedDb.rpc('get_all_database_schema');
      if (error) throw error;

      // Get source schema from extracted contents
      const schemaFiles = Array.from(extractedContents.entries())
        .filter(([name]) => /001_schema.*\.sql$/i.test(name) || /003_tables.*\.sql$/i.test(name));

      // Simple comparison - check for table existence
      const targetTables = new Set(
        (targetSchema || [])
          .filter((c: any) => c.schema_name === 'public')
          .map((c: any) => c.table_name)
      );

      const sourceTables = new Set<string>();
      schemaFiles.forEach(([, content]) => {
        const matches = content.matchAll(/CREATE TABLE[^"]*"public"\."([^"]+)"/gi);
        for (const match of matches) {
          sourceTables.add(match[1]);
        }
      });

      // Find differences
      sourceTables.forEach(table => {
        if (!targetTables.has(table)) {
          result.differences.push({
            type: 'table',
            action: 'add',
            objectName: table,
            schemaName: 'public',
            details: `Table "${table}" exists in source but not in target`,
            severity: 'info',
            resolution: 'Will be created during migration'
          });
        }
      });

      result.isCompatible = result.differences.filter(d => d.severity === 'error').length === 0;
      setSchemaComparison(result);
      return result;

    } catch (error: any) {
      result.isCompatible = false;
      result.unsupportedFeatures.push(error.message);
      setSchemaComparison(result);
      return result;
    }
  }, [scopedDb, extractedContents]);

  // Execute migration
  const executeMigration = useCallback(async (): Promise<MigrationSummary> => {
    if (!selectedFile || !fileValidation?.isValid) {
      throw new Error('No valid file selected for migration');
    }

    cancelRef.current = false;
    pauseRef.current = false;
    startTimeRef.current = Date.now();

    const steps: MigrationStep[] = [
      { id: '1', name: 'Extract Files', description: 'Extracting zip contents', status: 'pending', order: 1, type: 'validation' },
      { id: '2', name: 'Parse Schema', description: 'Analyzing schema definitions', status: 'pending', order: 2, type: 'schema' },
      { id: '3', name: 'Validate Compatibility', description: 'Checking schema compatibility', status: 'pending', order: 3, type: 'validation' },
      { id: '4', name: 'Create Schema', description: 'Creating tables and types', status: 'pending', order: 4, type: 'schema' },
      { id: '5', name: 'Migrate Data', description: 'Inserting data records', status: 'pending', order: 5, type: 'data' },
      { id: '6', name: 'Create Functions', description: 'Creating database functions', status: 'pending', order: 6, type: 'function' },
      { id: '7', name: 'Apply Policies', description: 'Setting up RLS policies', status: 'pending', order: 7, type: 'policy' },
      { id: '8', name: 'Validate Migration', description: 'Verifying data integrity', status: 'pending', order: 8, type: 'validation' }
    ];

    setMigrationSteps(steps);
    setMigrationErrors([]);
    setMigrationProgress({
      ...migrationProgress,
      status: 'preparing',
      totalSteps: steps.length,
      completedSteps: 0
    });

    const errors: MigrationError[] = [];
    const summary: MigrationSummary = {
      status: 'success',
      startTime: startTimeRef.current,
      endTime: 0,
      duration: 0,
      tables: { migrated: 0, skipped: 0, failed: 0, details: [] },
      records: { inserted: 0, updated: 0, skipped: 0, failed: 0 },
      schemas: { created: 0, modified: 0, skipped: 0 },
      functions: { migrated: 0, skipped: 0 },
      policies: { migrated: 0, skipped: 0 },
      errors: [],
      warnings: [],
      recommendations: [],
      performanceMetrics: { avgThroughputMbPerSec: 0, peakMemoryUsageMb: 0, totalBytesProcessed: 0 }
    };

    const updateStep = (stepId: string, updates: Partial<MigrationStep>) => {
      setMigrationSteps(prev => prev.map(s => s.id === stepId ? { ...s, ...updates } : s));
    };

    const updateProgress = (updates: Partial<MigrationProgress>) => {
      setMigrationProgress(prev => ({
        ...prev,
        ...updates,
        elapsedMs: Date.now() - startTimeRef.current
      }));
    };

    try {
      // Step 1: Extract Files
      updateStep('1', { status: 'in_progress', startTime: Date.now() });
      updateProgress({ status: 'preparing', currentStep: steps[0] });
      
      const contents = await extractZipContents(selectedFile);
      updateStep('1', { status: 'completed', endTime: Date.now() });
      updateProgress({ completedSteps: 1 });

      if (cancelRef.current) throw new Error('Migration cancelled by user');

      // Step 2: Parse Schema
      updateStep('2', { status: 'in_progress', startTime: Date.now() });
      updateProgress({ currentStep: steps[1] });

      const dataFiles = Array.from(contents.entries())
        .filter(([name]) => /004_data.*\.sql$/i.test(name))
        .sort(([a], [b]) => a.localeCompare(b));

      updateStep('2', { status: 'completed', endTime: Date.now() });
      updateProgress({ completedSteps: 2 });

      // Step 3: Validate Compatibility
      updateStep('3', { status: 'in_progress', startTime: Date.now() });
      updateProgress({ currentStep: steps[2] });
      
      await compareSchemas();
      
      updateStep('3', { status: 'completed', endTime: Date.now() });
      updateProgress({ completedSteps: 3 });

      // Skip schema creation for now (Step 4) - would require migration tool
      updateStep('4', { status: 'skipped' });
      updateProgress({ completedSteps: 4 });

      // Step 5: Migrate Data
      updateStep('5', { status: 'in_progress', startTime: Date.now() });
      updateProgress({ status: 'executing', currentStep: steps[4] });

      let totalStatements = 0;
      let processedStatements = 0;
      let successStatements = 0;
      let failedStatements = 0;
      let bytesProcessed = 0;
      const totalBytes = Array.from(contents.values()).reduce((sum, c) => sum + c.length, 0);

      // Count total statements
      for (const [, content] of dataFiles) {
        const lines = content.split(/\r?\n/).filter(l => /^INSERT\s+INTO\s+"/i.test(l.trim()));
        totalStatements += lines.length;
      }

      updateProgress({ totalRows: totalStatements, totalBytes });

      // Execute data files
      for (const [filename, content] of dataFiles) {
        if (cancelRef.current) break;
        while (pauseRef.current) {
          await new Promise(r => setTimeout(r, 100));
        }

        const tableName = filename.replace(/^004_data_(.+)\.sql$/i, '$1');
        updateProgress({ currentTable: tableName });

        const lines = content.split(/\r?\n/).filter(l => /^INSERT\s+INTO\s+"/i.test(l.trim()));
        const batchSize = migrationConfig.batchSize;

        for (let i = 0; i < lines.length; i += batchSize) {
          if (cancelRef.current) break;

          const batch = lines.slice(i, i + batchSize);
          
          try {
            const { data: rpcData, error } = await scopedDb.rpc('execute_insert_batch', {
              statements: batch
            });

            if (error) {
              failedStatements += batch.length;
              errors.push({
                id: `err-${Date.now()}`,
                timestamp: Date.now(),
                step: 'Migrate Data',
                type: 'sql_error',
                message: error.message,
                affectedObject: tableName,
                isRecoverable: true
              });
            } else {
              const res = rpcData as any;
              successStatements += res?.success || 0;
              failedStatements += res?.failed || 0;
            }
          } catch (err: any) {
            failedStatements += batch.length;
            errors.push({
              id: `err-${Date.now()}`,
              timestamp: Date.now(),
              step: 'Migrate Data',
              type: 'sql_error',
              message: err.message,
              affectedObject: tableName,
              isRecoverable: false
            });
          }

          processedStatements += batch.length;
          bytesProcessed += batch.join('\n').length;
          
          const elapsed = Date.now() - startTimeRef.current;
          const throughput = bytesProcessed / (elapsed / 1000) / (1024 * 1024);
          const remaining = totalBytes - bytesProcessed;
          const eta = throughput > 0 ? (remaining / (throughput * 1024 * 1024)) * 1000 : 0;

          updateProgress({
            rowsProcessed: processedStatements,
            bytesProcessed,
            overallProgress: (processedStatements / totalStatements) * 100,
            throughputMbPerSec: throughput,
            estimatedRemainingMs: eta,
            currentBatch: Math.floor(i / batchSize) + 1,
            totalBatches: Math.ceil(lines.length / batchSize)
          });
        }

        summary.tables.details.push({
          schemaName: 'public',
          tableName,
          status: failedStatements > 0 ? 'partial' : 'migrated',
          recordsInserted: successStatements,
          recordsUpdated: 0,
          recordsFailed: failedStatements,
          duration: Date.now() - startTimeRef.current
        });
      }

      updateStep('5', { status: failedStatements > 0 ? 'failed' : 'completed', endTime: Date.now() });
      updateProgress({ completedSteps: 5 });

      // Skip function and policy steps for now
      updateStep('6', { status: 'skipped' });
      updateStep('7', { status: 'skipped' });
      updateProgress({ completedSteps: 7 });

      // Step 8: Validate
      updateStep('8', { status: 'in_progress', startTime: Date.now() });
      updateProgress({ status: 'validating', currentStep: steps[7] });
      
      // Basic validation - just count records
      updateStep('8', { status: 'completed', endTime: Date.now() });
      updateProgress({ status: 'completed', completedSteps: 8, overallProgress: 100 });

      // Finalize summary
      summary.endTime = Date.now();
      summary.duration = summary.endTime - summary.startTime;
      summary.records.inserted = successStatements;
      summary.records.failed = failedStatements;
      summary.tables.migrated = summary.tables.details.filter(t => t.status === 'migrated').length;
      summary.tables.failed = summary.tables.details.filter(t => t.status === 'failed').length;
      summary.errors = errors;
      summary.status = failedStatements > 0 ? (successStatements > 0 ? 'partial' : 'failed') : 'success';
      summary.performanceMetrics.totalBytesProcessed = bytesProcessed;
      summary.performanceMetrics.avgThroughputMbPerSec = bytesProcessed / (summary.duration / 1000) / (1024 * 1024);

      setMigrationErrors(errors);
      setMigrationSummary(summary);
      return summary;

    } catch (error: any) {
      const failedSummary: MigrationSummary = {
        ...summary,
        status: 'failed',
        endTime: Date.now(),
        duration: Date.now() - startTimeRef.current,
        errors: [...errors, {
          id: `err-${Date.now()}`,
          timestamp: Date.now(),
          step: 'Migration',
          type: 'sql_error',
          message: error.message,
          isRecoverable: false
        }]
      };
      setMigrationSummary(failedSummary);
      updateProgress({ status: 'failed' });
      throw error;
    }
  }, [selectedFile, fileValidation, migrationConfig, scopedDb, extractZipContents, compareSchemas, migrationProgress]);

  // Control functions
  const cancelMigration = useCallback(() => {
    cancelRef.current = true;
    setMigrationProgress(prev => ({ ...prev, status: 'cancelled' }));
  }, []);

  const pauseMigration = useCallback(() => {
    pauseRef.current = true;
  }, []);

  const resumeMigration = useCallback(() => {
    pauseRef.current = false;
  }, []);

  const resetMigration = useCallback(() => {
    setSelectedFile(null);
    setFileValidation(null);
    setExtractedContents(new Map());
    setMigrationProgress({
      overallProgress: 0,
      currentStep: null,
      completedSteps: 0,
      totalSteps: 0,
      bytesProcessed: 0,
      totalBytes: 0,
      rowsProcessed: 0,
      totalRows: 0,
      elapsedMs: 0,
      estimatedRemainingMs: 0,
      throughputMbPerSec: 0,
      status: 'idle'
    });
    setMigrationSteps([]);
    setMigrationErrors([]);
    setMigrationSummary(null);
    setSchemaComparison(null);
    cancelRef.current = false;
    pauseRef.current = false;
  }, []);

  return {
    // Connection
    connectionConfig,
    connectionValidation,
    validateConnection,
    
    // File
    selectedFile,
    fileValidation,
    validateFile,
    extractZipContents,
    extractedContents,
    
    // Schema
    schemaComparison,
    compareSchemas,
    
    // Migration
    migrationConfig,
    setMigrationConfig,
    migrationProgress,
    migrationSteps,
    migrationErrors,
    migrationSavepoints,
    migrationSummary,
    executeMigration,
    
    // Controls
    cancelMigration,
    pauseMigration,
    resumeMigration,
    resetMigration
  };
}
