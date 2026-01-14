import { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Upload, 
  FileCode, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  FileText,
  Database,
  Table,
  Loader2
} from 'lucide-react';
import { parseSqlFile, ParsedSqlFile, SqlParseProgress, getSqlPreview, validateSqlFile } from '@/utils/sqlFileParser';
import { toast } from 'sonner';

interface SqlFileUploadZoneProps {
  onFileSelected: (file: File, parsed: ParsedSqlFile) => void;
  onFileClear?: () => void;
  disabled?: boolean;
  maxSizeMb?: number;
}

export function SqlFileUploadZone({ 
  onFileSelected, 
  onFileClear,
  disabled = false,
  maxSizeMb = 100 
}: SqlFileUploadZoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedSqlFile | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState<SqlParseProgress | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [dragActive, setDragActive] = useState(false);
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
      // Get preview
      const text = await selectedFile.text();
      setPreview(getSqlPreview(text, 50));

      // Parse file
      const result = await parseSqlFile(selectedFile, (progress) => {
        setParseProgress(progress);
      });

      setParsed(result);
      
      // Validate
      const validation = validateSqlFile(result);
      if (validation.issues.length > 0) {
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
    } finally {
      setParsing(false);
    }
  }, [maxSizeMb, onFileSelected]);

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
    setShowPreview(false);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onFileClear?.();
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
                {/* Warnings */}
                {parsed.warnings.length > 0 && (
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
                {parsed.warnings.length === 0 && (
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
