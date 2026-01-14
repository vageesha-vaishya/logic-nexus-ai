import { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Upload, 
  FileCode, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  FileText,
  Table,
  Loader2,
  AlertCircle,
  Wrench,
  ChevronDown,
  Info,
  FileWarning,
  Trash2
} from 'lucide-react';
import { 
  parseSqlFile, 
  ParsedSqlFile, 
  SqlParseProgress, 
  getSqlPreview, 
  validateSqlFile,
  repairSqlFile,
  checkFileIntegrity,
  FileIntegrityIssue
} from '@/utils/sqlFileParser';
import { toast } from 'sonner';

interface SqlFileUploadZoneProps {
  onFileSelected: (file: File, parsed: ParsedSqlFile) => void;
  onFileClear?: () => void;
  onRepairApplied?: (repairedContent: string, parsed: ParsedSqlFile) => void;
  disabled?: boolean;
  maxSizeMb?: number;
}

export function SqlFileUploadZone({ 
  onFileSelected, 
  onFileClear,
  onRepairApplied,
  disabled = false,
  maxSizeMb = 100 
}: SqlFileUploadZoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [parsed, setParsed] = useState<ParsedSqlFile | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState<SqlParseProgress | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [showIntegrityDetails, setShowIntegrityDetails] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (selectedFile: File) => {
    // Validate file type
    const validExtensions = ['.sql', '.dump', '.pgsql'];
    const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
    if (!validExtensions.includes(ext)) {
      toast.error('Invalid file type', { description: 'Please select a .sql, .dump, or .pgsql file' });
      return;
    }

    // Validate file size
    const maxSize = maxSizeMb * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      toast.error('File too large', { description: `Maximum file size is ${maxSizeMb}MB` });
      return;
    }

    setFile(selectedFile);
    setParsing(true);
    setParseProgress(null);

    try {
      // Get file content and preview
      const text = await selectedFile.text();
      setFileContent(text);
      setPreview(getSqlPreview(text, 50));

      // Check file integrity first
      const integrityReport = checkFileIntegrity(text, selectedFile.size);
      if (!integrityReport.isLikelyComplete) {
        toast.warning('File integrity issue detected', {
          description: 'The file may be incomplete or corrupted. See details below.',
          duration: 8000
        });
      }

      // Parse file
      const result = await parseSqlFile(selectedFile, (progress) => {
        setParseProgress(progress);
      });

      setParsed(result);
      
      // Validate
      const validation = validateSqlFile(result);
      
      if (!result.metadata.isComplete) {
        toast.error('Incomplete SQL file detected', {
          description: result.metadata.truncatedTableName 
            ? `Truncated statement found for table: ${result.metadata.truncatedTableName}`
            : 'The file ends with an incomplete SQL statement',
          duration: 10000
        });
        setShowIntegrityDetails(true);
      } else if (validation.issues.length > 0) {
        toast.warning('File has potential issues', { 
          description: validation.issues[0],
          duration: 5000 
        });
      } else {
        toast.success('File parsed successfully');
      }

      onFileSelected(selectedFile, result);
    } catch (err: any) {
      toast.error('Failed to parse file', { description: err.message });
      setFile(null);
      setParsed(null);
      setFileContent('');
    } finally {
      setParsing(false);
    }
  }, [maxSizeMb, onFileSelected]);

  const handleRepair = async (mode: 'skip' | 'autoClose') => {
    if (!parsed || !fileContent) return;
    
    setRepairing(true);
    try {
      const repairResult = repairSqlFile(
        fileContent, 
        parsed, 
        { skipIncomplete: mode === 'skip', autoClose: mode === 'autoClose' }
      );
      
      if (repairResult.success) {
        // Re-parse the repaired content
        const newParsed = await parseSqlFile(
          new File([repairResult.repairedContent], file?.name || 'repaired.sql', { type: 'text/plain' })
        );
        
        setParsed(newParsed);
        setFileContent(repairResult.repairedContent);
        setPreview(getSqlPreview(repairResult.repairedContent, 50));
        
        toast.success('File repaired successfully', {
          description: repairResult.repairsApplied.join(', ')
        });
        
        onRepairApplied?.(repairResult.repairedContent, newParsed);
      } else {
        toast.error('Could not repair file automatically');
      }
    } catch (err: any) {
      toast.error('Repair failed', { description: err.message });
    } finally {
      setRepairing(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    if (disabled) return;
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  }, [disabled, handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setDragActive(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  };

  const clearFile = () => {
    setFile(null);
    setParsed(null);
    setPreview('');
    setFileContent('');
    setShowPreview(false);
    setShowIntegrityDetails(false);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onFileClear?.();
  };

  const getSeverityIcon = (severity: FileIntegrityIssue['severity']) => {
    switch (severity) {
      case 'error': return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'info': return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: FileIntegrityIssue['severity']) => {
    switch (severity) {
      case 'error': return 'border-destructive/50 bg-destructive/10';
      case 'warning': return 'border-warning/50 bg-warning/10';
      case 'info': return 'border-blue-500/50 bg-blue-500/10';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileCode className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">SQL File Upload</CardTitle>
        </div>
        <CardDescription>
          Upload a pg_dump SQL file (.sql, .dump, .pgsql)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!file ? (
          /* Drop Zone */
          <div
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
              ${dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !disabled && inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".sql,.dump,.pgsql"
              onChange={handleInputChange}
              disabled={disabled}
              className="hidden"
            />
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm font-medium">
              Drop your SQL file here or click to browse
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Maximum file size: {maxSizeMb}MB
            </p>
          </div>
        ) : (
          /* File Info */
          <div className="space-y-4">
            {/* File Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatBytes(file.size)} • Modified {new Date(file.lastModified).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={clearFile}
                disabled={disabled || parsing}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Parsing Progress */}
            {parsing && parseProgress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Parsing file...
                  </span>
                  <span>{parseProgress.statementsFound} statements found</span>
                </div>
                <Progress 
                  value={(parseProgress.bytesProcessed / parseProgress.totalBytes) * 100} 
                />
              </div>
            )}

            {/* Parsed Info */}
            {parsed && !parsing && (
              <div className="space-y-3">
                {/* Critical: File Integrity Issues */}
                {!parsed.metadata.isComplete && (
                  <Alert variant="destructive">
                    <FileWarning className="h-4 w-4" />
                    <AlertTitle>Incomplete SQL File Detected</AlertTitle>
                    <AlertDescription className="space-y-3">
                      <p>
                        The file ends with an incomplete SQL statement
                        {parsed.metadata.truncatedTableName && (
                          <> affecting table <strong>{parsed.metadata.truncatedTableName}</strong></>
                        )}.
                      </p>
                      
                      {/* Incomplete Statement Preview */}
                      {parsed.metadata.incompleteStatement && (
                        <div className="mt-2 p-2 bg-destructive/20 rounded text-xs font-mono overflow-x-auto">
                          {parsed.metadata.incompleteStatement.substring(0, 200)}...
                        </div>
                      )}
                      
                      {/* Repair Options */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleRepair('skip')}
                          disabled={repairing}
                        >
                          {repairing ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Trash2 className="mr-2 h-3 w-3" />}
                          Skip Incomplete Statement
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleRepair('autoClose')}
                          disabled={repairing}
                        >
                          {repairing ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Wrench className="mr-2 h-3 w-3" />}
                          Try Auto-Repair
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Integrity Details Collapsible */}
                {parsed.metadata.integrityIssues.length > 0 && (
                  <Collapsible open={showIntegrityDetails} onOpenChange={setShowIntegrityDetails}>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-between">
                        <span className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-destructive" />
                          {parsed.metadata.integrityIssues.length} Integrity Issue(s) Detected
                        </span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${showIntegrityDetails ? 'rotate-180' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-2">
                      {parsed.metadata.integrityIssues.map((issue, idx) => (
                        <div 
                          key={idx} 
                          className={`p-3 rounded-lg border ${getSeverityColor(issue.severity)}`}
                        >
                          <div className="flex items-start gap-2">
                            {getSeverityIcon(issue.severity)}
                            <div className="flex-1 space-y-1">
                              <p className="text-sm font-medium">{issue.description}</p>
                              {issue.lineNumber && (
                                <p className="text-xs text-muted-foreground">Line: {issue.lineNumber}</p>
                              )}
                              {issue.affectedTable && (
                                <p className="text-xs text-muted-foreground">Table: {issue.affectedTable}</p>
                              )}
                              {issue.context && (
                                <pre className="text-xs bg-muted/50 p-2 rounded mt-2 overflow-x-auto">
                                  {issue.context}
                                </pre>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* Repair Suggestions */}
                      {parsed.metadata.repairSuggestions.length > 0 && (
                        <div className="mt-3 p-3 border rounded-lg bg-muted/50">
                          <p className="text-sm font-medium mb-2 flex items-center gap-2">
                            <Wrench className="h-4 w-4" />
                            Repair Suggestions
                          </p>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {parsed.metadata.repairSuggestions.map((suggestion, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-primary">•</span>
                                <span>
                                  {suggestion.description}
                                  {suggestion.automatable && (
                                    <Badge variant="outline" className="ml-2 text-xs">Auto-fixable</Badge>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Missing Completion Marker Warning */}
                {!parsed.metadata.hasProperEnding && parsed.metadata.isComplete && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Possible Incomplete Dump</AlertTitle>
                    <AlertDescription>
                      The file is missing the pg_dump completion marker. This may indicate the dump was interrupted.
                      Consider regenerating the dump file if you experience issues during import.
                    </AlertDescription>
                  </Alert>
                )}

                {/* General Warnings */}
                {parsed.warnings.length > 0 && parsed.metadata.isComplete && (
                  <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      {parsed.warnings.map((warning, i) => (
                        <p key={i} className="text-sm text-warning">{warning}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Success Summary */}
                {parsed.metadata.isComplete && parsed.warnings.length === 0 && parsed.metadata.hasProperEnding && (
                  <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <p className="text-sm text-green-600">File parsed successfully - ready for import</p>
                  </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold">{parsed.metadata.totalStatements}</p>
                    <p className="text-xs text-muted-foreground">Total Statements</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold">{parsed.metadata.tableNames.length}</p>
                    <p className="text-xs text-muted-foreground">Tables</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold">{parsed.metadata.estimatedRowCount.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Est. Rows</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold">{parsed.functionStatements.length}</p>
                    <p className="text-xs text-muted-foreground">Functions</p>
                  </div>
                </div>

                {/* Statement Breakdown */}
                <div className="flex flex-wrap gap-2">
                  {parsed.schemaStatements.length > 0 && (
                    <Badge variant="outline">{parsed.schemaStatements.length} Schema</Badge>
                  )}
                  {parsed.tableStatements.length > 0 && (
                    <Badge variant="outline">{parsed.tableStatements.length} Tables</Badge>
                  )}
                  {parsed.dataStatements.length > 0 && (
                    <Badge variant="outline">{parsed.dataStatements.length} Data</Badge>
                  )}
                  {parsed.constraintStatements.length > 0 && (
                    <Badge variant="outline">{parsed.constraintStatements.length} Constraints</Badge>
                  )}
                  {parsed.indexStatements.length > 0 && (
                    <Badge variant="outline">{parsed.indexStatements.length} Indexes</Badge>
                  )}
                  {parsed.policyStatements.length > 0 && (
                    <Badge variant="outline">{parsed.policyStatements.length} RLS Policies</Badge>
                  )}
                  {parsed.triggerStatements.length > 0 && (
                    <Badge variant="outline">{parsed.triggerStatements.length} Triggers</Badge>
                  )}
                </div>

                {/* Table Names */}
                {parsed.metadata.tableNames.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Table className="h-4 w-4" />
                      Tables Found
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {parsed.metadata.tableNames.slice(0, 10).map((name) => (
                        <Badge key={name} variant="secondary" className="text-xs">
                          {name}
                        </Badge>
                      ))}
                      {parsed.metadata.tableNames.length > 10 && (
                        <Badge variant="secondary" className="text-xs">
                          +{parsed.metadata.tableNames.length - 10} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                {(parsed.metadata.pgDumpVersion || parsed.metadata.exportDate) && (
                  <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                    {parsed.metadata.pgDumpVersion && (
                      <p>PostgreSQL Version: {parsed.metadata.pgDumpVersion}</p>
                    )}
                    {parsed.metadata.exportDate && (
                      <p>Export Date: {parsed.metadata.exportDate}</p>
                    )}
                  </div>
                )}

                {/* Preview Toggle */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                  className="w-full"
                >
                  <FileCode className="mr-2 h-4 w-4" />
                  {showPreview ? 'Hide Preview' : 'Show SQL Preview'}
                </Button>

                {/* SQL Preview */}
                {showPreview && preview && (
                  <ScrollArea className="h-64 rounded-md border bg-muted/50">
                    <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
                      {preview}
                    </pre>
                  </ScrollArea>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}