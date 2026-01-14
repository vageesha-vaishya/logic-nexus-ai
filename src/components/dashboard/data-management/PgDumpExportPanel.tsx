import { useState, useRef, useCallback } from "react";
import { useCRM } from "@/hooks/useCRM";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Download, 
  FileCode, 
  Loader2, 
  AlertTriangle,
  CheckCircle,
  Info,
  Database,
  Copy,
  Terminal
} from "lucide-react";
import { toast } from "sonner";
import {
  generatePgDumpHeader,
  generatePgDumpFooter,
  generateSchemaStatements,
  generateEnumStatements,
  generateCreateTableStatement,
  generateInsertStatements,
  generateConstraintStatements,
  generateFunctionStatements,
  generateRlsStatements,
  PgDumpOptions,
  defaultPgDumpOptions,
} from "@/utils/pgDumpExport";
import { resolveDataTypeForValue } from "@/utils/dbExportUtils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ExportProgress {
  phase: string;
  percent: number;
  message: string;
}

export function PgDumpExportPanel() {
  const { scopedDb, context } = useCRM();
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [options, setOptions] = useState<PgDumpOptions>(defaultPgDumpOptions);
  const [showInstructions, setShowInstructions] = useState(false);
  const [lastExportFilename, setLastExportFilename] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const updateProgress = (phase: string, percent: number, message: string) => {
    setProgress({ phase, percent, message });
  };

  const downloadSqlFile = async (content: string, filename: string) => {
    try {
      if ('showSaveFilePicker' in window) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'SQL File',
            accept: { 'application/sql': ['.sql'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        return true;
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        toast.message("Save cancelled");
        return false;
      }
    }
    
    // Fallback download
    const blob = new Blob([content], { type: 'application/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  };

  const runExport = useCallback(async () => {
    cancelRef.current = false;
    setIsExporting(true);
    setProgress(null);
    
    let sqlContent = '';
    
    try {
      // 1. Header
      updateProgress('Initializing', 5, 'Generating SQL header...');
      sqlContent += generatePgDumpHeader();
      
      if (cancelRef.current) throw new Error('Export cancelled');
      
      // 2. Fetch schema data
      updateProgress('Schema', 10, 'Fetching database schema...');
      const { data: schemaData, error: schemaError } = await scopedDb.rpc("get_all_database_schema");
      if (schemaError) throw schemaError;
      
      if (cancelRef.current) throw new Error('Export cancelled');
      
      // Group by schema.table
      const tableGroups = (schemaData || []).reduce((acc: any, row: any) => {
        // Skip auth/storage if excluded
        if (options.excludeAuthSchema && row.schema_name === 'auth') return acc;
        if (options.excludeStorageSchema && row.schema_name === 'storage') return acc;
        
        const key = `${row.schema_name}.${row.table_name}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(row);
        return acc;
      }, {});
      
      // Get unique schemas
      const schemas = [...new Set(Object.keys(tableGroups).map(k => k.split('.')[0]))];
      
      // 3. Create schemas
      updateProgress('Schema', 15, 'Creating schema statements...');
      sqlContent += generateSchemaStatements(schemas.filter(s => s !== 'public'));
      
      if (cancelRef.current) throw new Error('Export cancelled');
      
      // 4. Enums
      updateProgress('Enums', 20, 'Fetching enum types...');
      try {
        const { data: enumData } = await scopedDb.rpc("get_database_enums");
        if (enumData && Array.isArray(enumData) && enumData.length > 0) {
          const enums = enumData.map((e: any) => ({
            name: e.enum_name || e.typname,
            labels: (e.labels || e.enum_values || '').replace(/^{|}$/g, '').split(',').map((l: string) => l.trim()).filter((l: string) => l.length > 0)
          }));
          sqlContent += generateEnumStatements(enums);
        }
      } catch {
        // Enums RPC may not exist
      }
      
      if (cancelRef.current) throw new Error('Export cancelled');
      
      // 5. Tables
      updateProgress('Tables', 30, 'Creating table definitions...');
      const tableNames = Object.keys(tableGroups);
      
      for (const tableKey of tableNames) {
        const columns = tableGroups[tableKey];
        const [schemaName, tableName] = tableKey.split('.');
        
        // Deduplicate columns
        const seen = new Set<string>();
        const uniqueCols = columns.filter((col: any) => {
          if (seen.has(col.column_name)) return false;
          seen.add(col.column_name);
          return true;
        });
        
        sqlContent += generateCreateTableStatement(
          schemaName,
          tableName,
          uniqueCols,
          options.includeDropStatements
        );
      }
      
      if (cancelRef.current) throw new Error('Export cancelled');
      
      // 6. Functions
      updateProgress('Functions', 40, 'Fetching database functions...');
      try {
        let functionsData: any[] | null = null;
        try {
          const { data } = await (scopedDb.rpc as any)("get_database_functions_with_body");
          functionsData = data;
        } catch {
          const { data } = await (scopedDb.rpc as any)("get_database_functions");
          functionsData = data;
        }
        
        if (functionsData && functionsData.length > 0) {
          sqlContent += generateFunctionStatements(functionsData);
        }
      } catch {
        // Functions RPC may not exist
      }
      
      if (cancelRef.current) throw new Error('Export cancelled');
      
      // 7. Table Data
      updateProgress('Data', 50, 'Fetching table data...');
      const { data: tablesData } = await scopedDb.rpc("get_all_database_tables");
      const baseTables = (tablesData || []).filter((t: any) => {
        if (options.excludeAuthSchema && t.schema_name === 'auth') return false;
        if (options.excludeStorageSchema && t.schema_name === 'storage') return false;
        return t.table_type === 'BASE TABLE';
      });
      
      // Build type map
      const typeMapByTable: Record<string, Record<string, string>> = (schemaData || []).reduce(
        (acc: Record<string, Record<string, string>>, col: any) => {
          const key = `${col.schema_name}.${col.table_name}`;
          if (!acc[key]) acc[key] = {};
          acc[key][col.column_name] = resolveDataTypeForValue(col);
          return acc;
        },
        {}
      );
      
      for (let i = 0; i < baseTables.length; i++) {
        const table = baseTables[i];
        const tableKey = `${table.schema_name}.${table.table_name}`;
        
        if (cancelRef.current) throw new Error('Export cancelled');
        
        const pct = 50 + Math.round((i / baseTables.length) * 35);
        updateProgress('Data', pct, `Exporting ${table.schema_name}.${table.table_name}...`);
        
        try {
          let data: any[] = [];
          let error: any = null;
          
          if (table.schema_name === 'public') {
            const res = await (scopedDb.from(table.table_name as any).select("*").limit(10000) as any);
            data = res.data || [];
            error = res.error;
          } else if (table.schema_name === 'auth' && table.table_name === 'users') {
            const res = await scopedDb.rpc('get_auth_users_export');
            data = res.data || [];
            error = res.error;
          } else if (table.schema_name === 'storage' && table.table_name === 'objects') {
            const res = await scopedDb.rpc('get_storage_objects_export');
            data = res.data || [];
            error = res.error;
          } else {
            const res = await scopedDb.rpc('get_table_data_dynamic', {
              target_schema: table.schema_name,
              target_table: table.table_name,
              offset_val: 0,
              limit_val: 10000
            });
            data = res.data || [];
            error = res.error;
          }
          
          if (error) {
            console.warn(`Error fetching ${tableKey}:`, error);
            continue;
          }
          
          if (data.length > 0) {
            const columns = Object.keys(data[0]);
            const typeMap = typeMapByTable[tableKey] || {};
            
            sqlContent += generateInsertStatements(
              table.schema_name,
              table.table_name,
              columns,
              data,
              typeMap
            );
          }
        } catch (err) {
          console.warn(`Error exporting ${tableKey}:`, err);
        }
      }
      
      if (cancelRef.current) throw new Error('Export cancelled');
      
      // 8. Constraints
      updateProgress('Constraints', 88, 'Adding constraints...');
      try {
        const { data: constraintsData } = await scopedDb.rpc("get_table_constraints");
        if (constraintsData && constraintsData.length > 0) {
          const filtered = constraintsData.filter((c: any) => {
            if (options.excludeAuthSchema && c.schema_name === 'auth') return false;
            if (options.excludeStorageSchema && c.schema_name === 'storage') return false;
            return true;
          });
          sqlContent += generateConstraintStatements(filtered);
        }
      } catch {
        // Constraints RPC may not exist
      }
      
      if (cancelRef.current) throw new Error('Export cancelled');
      
      // 9. RLS (optional)
      if (options.includeRls) {
        updateProgress('RLS', 92, 'Adding RLS policies...');
        try {
          const { data: rlsData } = await scopedDb.rpc("get_table_rls_policies");
          const rlsTables = baseTables.filter((t: any) => t.rls_enabled);
          if ((rlsData && rlsData.length > 0) || rlsTables.length > 0) {
            sqlContent += generateRlsStatements(rlsTables, rlsData || []);
          }
        } catch {
          // RLS RPC may not exist
        }
      }
      
      // 10. Footer
      updateProgress('Finalizing', 98, 'Generating footer...');
      sqlContent += generatePgDumpFooter();
      
      // 11. Download
      updateProgress('Complete', 100, 'Preparing download...');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `database_export_${timestamp}.sql`;
      
      const success = await downloadSqlFile(sqlContent, filename);
      
      if (success) {
        setLastExportFilename(filename);
        setShowInstructions(true);
        toast.success('Export complete!', {
          description: `Generated ${(sqlContent.length / 1024).toFixed(1)} KB SQL file`
        });
      }
      
    } catch (err: any) {
      if (err.message === 'Export cancelled') {
        toast.message('Export cancelled');
      } else {
        console.error('Export error:', err);
        toast.error('Export failed', { description: err.message });
      }
    } finally {
      setIsExporting(false);
      setProgress(null);
    }
  }, [scopedDb, options]);

  const handleCancel = () => {
    cancelRef.current = true;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            pg_dump Compatible Export
          </CardTitle>
          <CardDescription>
            Generate a single SQL file compatible with <code className="bg-muted px-1 rounded">psql -f</code> command
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Info Alert */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>PostgreSQL Compatible</AlertTitle>
            <AlertDescription>
              This export generates a standard SQL file that can be imported into any PostgreSQL database 
              (including external databases, AWS RDS, Azure, etc.) using standard tools.
            </AlertDescription>
          </Alert>
          
          {/* Options */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Export Options</Label>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeRls"
                  checked={options.includeRls}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, includeRls: !!checked }))
                  }
                />
                <Label htmlFor="includeRls" className="text-sm font-normal cursor-pointer">
                  Include RLS Policies
                  <span className="block text-xs text-muted-foreground">
                    Row Level Security (Supabase-specific)
                  </span>
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeDropStatements"
                  checked={options.includeDropStatements}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, includeDropStatements: !!checked }))
                  }
                />
                <Label htmlFor="includeDropStatements" className="text-sm font-normal cursor-pointer">
                  Include DROP statements
                  <span className="block text-xs text-muted-foreground">
                    Drops existing tables before creating
                  </span>
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="excludeAuthSchema"
                  checked={options.excludeAuthSchema}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, excludeAuthSchema: !!checked }))
                  }
                />
                <Label htmlFor="excludeAuthSchema" className="text-sm font-normal cursor-pointer">
                  Exclude auth schema
                  <span className="block text-xs text-muted-foreground">
                    Skip Supabase auth tables
                  </span>
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="excludeStorageSchema"
                  checked={options.excludeStorageSchema}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, excludeStorageSchema: !!checked }))
                  }
                />
                <Label htmlFor="excludeStorageSchema" className="text-sm font-normal cursor-pointer">
                  Exclude storage schema
                  <span className="block text-xs text-muted-foreground">
                    Skip Supabase storage tables
                  </span>
                </Label>
              </div>
            </div>
          </div>
          
          {/* Progress */}
          {progress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{progress.phase}</span>
                <span className="text-muted-foreground">{progress.percent}%</span>
              </div>
              <Progress value={progress.percent} className="h-2" />
              <p className="text-xs text-muted-foreground">{progress.message}</p>
            </div>
          )}
          
          {/* Actions */}
          <div className="flex gap-2">
            {isExporting ? (
              <Button variant="destructive" onClick={handleCancel}>
                Cancel Export
              </Button>
            ) : (
              <Button onClick={runExport} className="gap-2">
                <FileCode className="h-4 w-4" />
                Export SQL File
              </Button>
            )}
            
            {isExporting && (
              <Button variant="ghost" disabled>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Exporting...
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Instructions Dialog */}
      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Export Complete
            </DialogTitle>
            <DialogDescription>
              Your database has been exported to a PostgreSQL-compatible SQL file.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Import with psql
              </h4>
              <div className="relative">
                <pre className="text-xs bg-background p-3 rounded border overflow-x-auto">
{`psql -h hostname -U username -d database -f ${lastExportFilename || 'database_export.sql'}`}
                </pre>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-1 right-1 h-6 w-6"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `psql -h hostname -U username -d database -f ${lastExportFilename || 'database_export.sql'}`
                    );
                    toast.success('Copied to clipboard');
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <h4 className="font-medium">Or use a GUI tool</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>pgAdmin</strong>: Tools → Query Tool → Open file → Execute</li>
                <li>• <strong>DBeaver</strong>: SQL Editor → Open file → Execute</li>
                <li>• <strong>TablePlus</strong>: Import → From SQL file</li>
              </ul>
            </div>
            
            <Alert variant="default">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Important Notes</AlertTitle>
              <AlertDescription className="text-xs space-y-1">
                <p>• Ensure the target database is empty or use DROP statements option</p>
                <p>• RLS policies are Supabase-specific and may not work in vanilla PostgreSQL</p>
                <p>• Some functions may reference Supabase-specific extensions</p>
              </AlertDescription>
            </Alert>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
