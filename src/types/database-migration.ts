// Database Migration Types

export interface SupabaseConnectionConfig {
  projectUrl: string;
  dbHost: string;
  dbPort: number;
  dbName: string;
  apiKey: string;
  serviceRoleKey: string;
  sslMode: 'disable' | 'require' | 'verify-ca' | 'verify-full';
}

export interface ConnectionValidationResult {
  isValid: boolean;
  status: 'idle' | 'validating' | 'success' | 'error';
  message: string;
  details?: {
    networkConnectivity: boolean;
    credentialValidity: boolean;
    databaseAccessible: boolean;
    version?: string;
  };
}

export interface FileValidationResult {
  isValid: boolean;
  issues: string[];
  warnings: string[];
  fileInfo?: {
    name: string;
    size: number;
    type: string;
    estimatedProcessingTime: number;
    requiredFiles: string[];
    foundFiles: string[];
    missingFiles: string[];
  };
  manifest?: ZipManifest;
}

export interface ZipManifest {
  version: string;
  exportDate: string;
  sourceProject?: string;
  tables: string[];
  schemaFiles: string[];
  dataFiles: string[];
  functionFiles: string[];
  metadata?: Record<string, any>;
}

export interface SchemaComparisonResult {
  isCompatible: boolean;
  sourceVersion?: string;
  targetVersion?: string;
  differences: SchemaDifference[];
  unsupportedFeatures: string[];
  dataTypeConflicts: DataTypeConflict[];
}

export interface SchemaDifference {
  type: 'table' | 'column' | 'constraint' | 'index' | 'function' | 'policy';
  action: 'add' | 'modify' | 'remove';
  objectName: string;
  schemaName: string;
  details: string;
  severity: 'info' | 'warning' | 'error';
  resolution?: string;
}

export interface DataTypeConflict {
  table: string;
  column: string;
  sourceType: string;
  targetType: string;
  isAutoConvertible: boolean;
  suggestedResolution: string;
}

export interface MigrationStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  order: number;
  type: 'schema' | 'data' | 'function' | 'policy' | 'validation';
  progress?: number;
  error?: string;
  startTime?: number;
  endTime?: number;
  affectedObjects?: string[];
}

export interface MigrationProgress {
  overallProgress: number;
  currentStep: MigrationStep | null;
  completedSteps: number;
  totalSteps: number;
  bytesProcessed: number;
  totalBytes: number;
  rowsProcessed: number;
  totalRows: number;
  elapsedMs: number;
  estimatedRemainingMs: number;
  throughputMbPerSec: number;
  status: 'idle' | 'preparing' | 'executing' | 'validating' | 'completed' | 'failed' | 'cancelled';
  currentTable?: string;
  currentBatch?: number;
  totalBatches?: number;
}

export interface MigrationError {
  id: string;
  timestamp: number;
  step: string;
  type: 'sql_error' | 'constraint_violation' | 'timeout' | 'connection' | 'validation';
  message: string;
  details?: string;
  affectedObject?: string;
  statement?: string;
  isRecoverable: boolean;
  suggestedAction?: string;
}

export interface MigrationSavepoint {
  id: string;
  name: string;
  timestamp: number;
  step: string;
  rowsCompleted: number;
  canRollbackTo: boolean;
}

export interface MigrationSummary {
  status: 'success' | 'partial' | 'failed';
  startTime: number;
  endTime: number;
  duration: number;
  tables: {
    migrated: number;
    skipped: number;
    failed: number;
    details: TableMigrationResult[];
  };
  records: {
    inserted: number;
    updated: number;
    skipped: number;
    failed: number;
  };
  schemas: {
    created: number;
    modified: number;
    skipped: number;
  };
  functions: {
    migrated: number;
    skipped: number;
  };
  policies: {
    migrated: number;
    skipped: number;
  };
  errors: MigrationError[];
  warnings: string[];
  recommendations: string[];
  performanceMetrics: {
    avgThroughputMbPerSec: number;
    peakMemoryUsageMb: number;
    totalBytesProcessed: number;
  };
}

export interface TableMigrationResult {
  schemaName: string;
  tableName: string;
  status: 'migrated' | 'skipped' | 'failed' | 'partial';
  recordsInserted: number;
  recordsUpdated: number;
  recordsFailed: number;
  error?: string;
  duration: number;
}

export interface ConflictResolution {
  type: 'schema_mismatch' | 'data_type' | 'constraint' | 'duplicate_key';
  objectName: string;
  resolution: 'skip' | 'overwrite' | 'rename' | 'transform' | 'manual';
  transformFunction?: string;
  newName?: string;
}

export interface MigrationConfig {
  batchSize: number;
  parallelTables: number;
  enableTransactions: boolean;
  stopOnError: boolean;
  validateAfterMigration: boolean;
  cleanupTempFiles: boolean;
  enableAuditLogging: boolean;
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
  conflictResolutions: ConflictResolution[];
}

export const DEFAULT_MIGRATION_CONFIG: MigrationConfig = {
  batchSize: 500,
  parallelTables: 1,
  enableTransactions: true,
  stopOnError: false,
  validateAfterMigration: true,
  cleanupTempFiles: true,
  enableAuditLogging: true,
  maxRetries: 3,
  retryDelayMs: 1000,
  timeoutMs: 300000, // 5 minutes
  conflictResolutions: []
};
