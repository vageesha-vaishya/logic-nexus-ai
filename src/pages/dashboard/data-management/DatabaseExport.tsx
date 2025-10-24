// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import Papa from "papaparse";
import { toast } from "sonner";

type TableInfo = {
  table_name: string;
  table_type: string;
  rls_enabled: boolean;
  policy_count: number;
  column_count: number;
  index_count: number;
  row_estimate: number;
};

export default function DatabaseExport() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name LIMIT 50;");
  const [queryResult, setQueryResult] = useState<any[]>([]);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreMode, setRestoreMode] = useState<'insert' | 'upsert'>('upsert');
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
  const [backupType, setBackupType] = useState<'full' | 'incremental'>('full');
  
  // Export component selection
  const [exportOptions, setExportOptions] = useState({
    schema: true,
    constraints: true,
    indexes: true,
    dbFunctions: true,
    rlsPolicies: true,
    enums: true,
    edgeFunctions: true,
    secrets: true,
    tableData: true,
  });

  useEffect(() => {
    const loadTables = async () => {
      const { data, error } = await supabase.rpc("get_database_tables");
      if (error) {
        toast.error("Failed to load tables", { description: error.message });
        return;
      }
      setTables(data || []);
      const sel: Record<string, boolean> = {};
      (data || []).forEach((t: TableInfo) => (sel[t.table_name] = false));
      setSelected(sel);
    };
    loadTables();
    
    // Load last backup timestamp from localStorage
    const lastBackup = localStorage.getItem('last_database_backup');
    if (lastBackup) {
      setLastBackupTime(lastBackup);
    }
  }, []);

  const allSelected = useMemo(() => tables.length > 0 && tables.every(t => selected[t.table_name]), [tables, selected]);

  const toggleAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    tables.forEach(t => (next[t.table_name] = checked));
    setSelected(next);
  };

  const toggle = (name: string, checked: boolean) => {
    setSelected(prev => ({ ...prev, [name]: checked }));
  };

  const downloadFile = (filename: string, content: string, type = "text/plain") => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportSelectedCSV = async () => {
    const chosen = tables.filter(t => selected[t.table_name]);
    if (chosen.length === 0) {
      toast.message("No tables selected", { description: "Select at least one table to export." });
      return;
    }
    setLoading(true);
    try {
      await Promise.all(
        chosen.map(async (t) => {
          const { data, error } = await supabase.from(t.table_name).select("*");
          if (error) {
            toast.error(`Failed exporting ${t.table_name}`, { description: error.message });
            return;
          }
          const csv = Papa.unparse(data || []);
          downloadFile(`${t.table_name}.csv`, csv, "text/csv");
        })
      );
      toast.success("Export complete", { description: "Downloaded CSVs for selected tables." });
    } catch (e: any) {
      toast.error("Export failed", { description: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  const allExportOptionsSelected = Object.values(exportOptions).every(v => v);
  
  const toggleAllExportOptions = (checked: boolean) => {
    setExportOptions({
      schema: checked,
      constraints: checked,
      indexes: checked,
      dbFunctions: checked,
      rlsPolicies: checked,
      enums: checked,
      edgeFunctions: checked,
      secrets: checked,
      tableData: checked,
    });
  };

  const exportSchemaMetadata = async () => {
    const hasAnySelected = Object.values(exportOptions).some(v => v);
    if (!hasAnySelected) {
      toast.message("No components selected", { description: "Select at least one export option." });
      return;
    }

    setLoading(true);
    try {
      const promises: Promise<any>[] = [];
      const keys: string[] = [];

      if (exportOptions.schema) {
        promises.push(supabase.rpc("get_database_schema"));
        keys.push("schema");
      }
      if (exportOptions.constraints) {
        promises.push(supabase.rpc("get_table_constraints"));
        keys.push("constraints");
      }
      if (exportOptions.indexes) {
        promises.push(supabase.rpc("get_table_indexes"));
        keys.push("indexes");
      }
      if (exportOptions.dbFunctions) {
        promises.push(supabase.rpc("get_database_functions"));
        keys.push("database_functions");
      }
      if (exportOptions.rlsPolicies) {
        promises.push(supabase.rpc("get_rls_policies"));
        keys.push("rls_policies");
      }
      if (exportOptions.enums) {
        promises.push(supabase.rpc("get_database_enums"));
        keys.push("enums");
      }
      if (exportOptions.edgeFunctions || exportOptions.secrets) {
        promises.push(supabase.functions.invoke("list-edge-functions"));
        keys.push("edge_functions_response");
      }

      const results = await Promise.all(promises);
      
      const payload: any = {
        exported_at: new Date().toISOString(),
      };

      if (exportOptions.schema || exportOptions.constraints || exportOptions.indexes) {
        payload.tables = tables;
      }

      results.forEach((result, idx) => {
        const key = keys[idx];
        if (key === "edge_functions_response") {
          const data = result.data || { edge_functions: [], secrets: [] };
          if (exportOptions.edgeFunctions) {
            payload.edge_functions = data.edge_functions;
          }
          if (exportOptions.secrets) {
            payload.secrets = data.secrets;
          }
        } else {
          if (result.error) {
            throw new Error(result.error.message);
          }
          payload[key] = result.data;
        }
      });

      // Export table data if selected
      if (exportOptions.tableData) {
        const chosen = tables.filter(t => selected[t.table_name]);
        if (chosen.length > 0) {
          const tableDataPromises = chosen.map(async (t) => {
            const { data, error } = await supabase.from(t.table_name).select("*");
            if (error) {
              console.error(`Failed exporting ${t.table_name}:`, error.message);
              return { table_name: t.table_name, data: [], error: error.message };
            }
            return { table_name: t.table_name, data: data || [] };
          });
          payload.table_data = await Promise.all(tableDataPromises);
        }
      }

      downloadFile("schema-metadata.json", JSON.stringify(payload, null, 2), "application/json");
      
      const exportedItems = Object.entries(exportOptions)
        .filter(([_, v]) => v)
        .map(([k]) => k)
        .join(", ");
      toast.success("Export complete", { description: `Exported: ${exportedItems}` });
    } catch (e: any) {
      toast.error("Export failed", { description: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  const runQuery = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("execute_sql_query", { query_text: query });
      if (error) throw error;
      const result = (data as any) || [];
      setQueryResult(result);
      toast.success(`Query returned ${result.length} rows`);
    } catch (e: any) {
      toast.error("Query failed", { description: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  const exportQueryCSV = () => {
    if (!queryResult || queryResult.length === 0) {
      toast.message("No data to export", { description: "Run a query first." });
      return;
    }
    const csv = Papa.unparse(queryResult);
    downloadFile("query-result.csv", csv, "text/csv");
  };

  const exportFullBackup = async () => {
    setLoading(true);
    try {
      const timestamp = new Date().toISOString();
      const backup: any = {
        backup_type: 'full',
        timestamp,
        tables: {},
      };

      // Export all table data
      for (const table of tables) {
        const { data, error } = await supabase.from(table.table_name).select("*");
        if (error) {
          console.error(`Failed to backup ${table.table_name}:`, error.message);
          continue;
        }
        backup.tables[table.table_name] = data || [];
      }

      downloadFile(`full-backup-${timestamp}.json`, JSON.stringify(backup, null, 2), "application/json");
      
      // Save backup timestamp
      localStorage.setItem('last_database_backup', timestamp);
      setLastBackupTime(timestamp);
      
      toast.success("Full backup completed", { 
        description: `Backed up ${Object.keys(backup.tables).length} tables` 
      });
    } catch (e: any) {
      toast.error("Full backup failed", { description: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  const exportIncrementalBackup = async () => {
    if (!lastBackupTime) {
      toast.error("No previous backup found", { 
        description: "Please create a full backup first." 
      });
      return;
    }

    setLoading(true);
    try {
      const timestamp = new Date().toISOString();
      const backup: any = {
        backup_type: 'incremental',
        timestamp,
        since: lastBackupTime,
        tables: {},
      };

      let totalChanges = 0;

      // Export only changed records since last backup
      for (const table of tables) {
        const { data, error } = await supabase
          .from(table.table_name)
          .select("*")
          .or(`created_at.gte.${lastBackupTime},updated_at.gte.${lastBackupTime}`);
        
        if (error) {
          console.error(`Failed to backup ${table.table_name}:`, error.message);
          continue;
        }
        
        if (data && data.length > 0) {
          backup.tables[table.table_name] = data;
          totalChanges += data.length;
        }
      }

      if (totalChanges === 0) {
        toast.message("No changes to backup", { 
          description: "Database has no changes since last backup." 
        });
        setLoading(false);
        return;
      }

      downloadFile(`incremental-backup-${timestamp}.json`, JSON.stringify(backup, null, 2), "application/json");
      
      // Update backup timestamp
      localStorage.setItem('last_database_backup', timestamp);
      setLastBackupTime(timestamp);
      
      toast.success("Incremental backup completed", { 
        description: `Backed up ${totalChanges} changed records across ${Object.keys(backup.tables).length} tables` 
      });
    } catch (e: any) {
      toast.error("Incremental backup failed", { description: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  const restoreDatabase = async () => {
    if (!restoreFile) {
      toast.error("No file selected", { description: "Please select a backup file to restore." });
      return;
    }

    setLoading(true);
    try {
      const fileContent = await restoreFile.text();
      const backup = JSON.parse(fileContent);

      if (!backup.backup_type || !backup.tables) {
        throw new Error("Invalid backup file format");
      }

      let totalRestored = 0;
      let errors = 0;

      for (const [tableName, records] of Object.entries(backup.tables)) {
        const recordsArray = records as any[];
        
        for (const record of recordsArray) {
          if (restoreMode === 'upsert') {
            const { error } = await supabase
              .from(tableName)
              .upsert(record, { onConflict: 'id' });
            
            if (error) {
              console.error(`Error upserting to ${tableName}:`, error.message);
              errors++;
            } else {
              totalRestored++;
            }
          } else {
            const { error } = await supabase
              .from(tableName)
              .insert(record);
            
            if (error) {
              console.error(`Error inserting to ${tableName}:`, error.message);
              errors++;
            } else {
              totalRestored++;
            }
          }
        }
      }

      if (errors > 0) {
        toast.warning("Restore completed with errors", { 
          description: `Restored ${totalRestored} records, ${errors} failed` 
        });
      } else {
        toast.success("Database restored successfully", { 
          description: `Restored ${totalRestored} records from backup` 
        });
      }
      
      setRestoreFile(null);
    } catch (e: any) {
      toast.error("Restore failed", { description: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Database Backup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Full Backup</h3>
                <p className="text-sm text-muted-foreground">Export complete database with all records</p>
              </div>
              <Button onClick={exportFullBackup} disabled={loading}>
                Create Full Backup
              </Button>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Incremental Backup</h3>
                <p className="text-sm text-muted-foreground">
                  Export only changes since last backup
                  {lastBackupTime && (
                    <span className="block text-xs mt-1">
                      Last backup: {new Date(lastBackupTime).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={exportIncrementalBackup} 
                disabled={loading || !lastBackupTime}
              >
                Create Incremental Backup
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Database Restore</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Select Backup File</label>
              <input
                type="file"
                accept=".json"
                onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                className="mt-2 block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
              {restoreFile && (
                <p className="text-sm text-muted-foreground mt-2">
                  Selected: {restoreFile.name}
                </p>
              )}
            </div>
            
            <div>
              <label className="text-sm font-medium">Restore Mode</label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="upsert"
                    checked={restoreMode === 'upsert'}
                    onChange={(e) => setRestoreMode(e.target.value as 'upsert')}
                  />
                  <span className="text-sm">Upsert (Update or Insert)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="insert"
                    checked={restoreMode === 'insert'}
                    onChange={(e) => setRestoreMode(e.target.value as 'insert')}
                  />
                  <span className="text-sm">Insert Only</span>
                </label>
              </div>
            </div>

            <Button 
              onClick={restoreDatabase} 
              disabled={loading || !restoreFile}
              className="w-full"
            >
              Restore Database
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Advanced Export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground mb-3">Select components to export</div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <Checkbox 
                id="export-all" 
                checked={allExportOptionsSelected} 
                onCheckedChange={(v: any) => toggleAllExportOptions(Boolean(v))} 
              />
              <label htmlFor="export-all" className="text-sm font-semibold">ALL</label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox 
                id="export-schema" 
                checked={exportOptions.schema} 
                onCheckedChange={(v: any) => setExportOptions(prev => ({ ...prev, schema: Boolean(v) }))} 
              />
              <label htmlFor="export-schema" className="text-sm">Schema (Tables/Columns)</label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox 
                id="export-constraints" 
                checked={exportOptions.constraints} 
                onCheckedChange={(v: any) => setExportOptions(prev => ({ ...prev, constraints: Boolean(v) }))} 
              />
              <label htmlFor="export-constraints" className="text-sm">Constraints</label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox 
                id="export-indexes" 
                checked={exportOptions.indexes} 
                onCheckedChange={(v: any) => setExportOptions(prev => ({ ...prev, indexes: Boolean(v) }))} 
              />
              <label htmlFor="export-indexes" className="text-sm">Indexes</label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox 
                id="export-dbfunctions" 
                checked={exportOptions.dbFunctions} 
                onCheckedChange={(v: any) => setExportOptions(prev => ({ ...prev, dbFunctions: Boolean(v) }))} 
              />
              <label htmlFor="export-dbfunctions" className="text-sm">DB Functions</label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox 
                id="export-rls" 
                checked={exportOptions.rlsPolicies} 
                onCheckedChange={(v: any) => setExportOptions(prev => ({ ...prev, rlsPolicies: Boolean(v) }))} 
              />
              <label htmlFor="export-rls" className="text-sm">RLS Policies</label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox 
                id="export-enums" 
                checked={exportOptions.enums} 
                onCheckedChange={(v: any) => setExportOptions(prev => ({ ...prev, enums: Boolean(v) }))} 
              />
              <label htmlFor="export-enums" className="text-sm">Enums</label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox 
                id="export-edge" 
                checked={exportOptions.edgeFunctions} 
                onCheckedChange={(v: any) => setExportOptions(prev => ({ ...prev, edgeFunctions: Boolean(v) }))} 
              />
              <label htmlFor="export-edge" className="text-sm">Edge Functions</label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox 
                id="export-secrets" 
                checked={exportOptions.secrets} 
                onCheckedChange={(v: any) => setExportOptions(prev => ({ ...prev, secrets: Boolean(v) }))} 
              />
              <label htmlFor="export-secrets" className="text-sm">Secrets (names only)</label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox 
                id="export-tabledata" 
                checked={exportOptions.tableData} 
                onCheckedChange={(v: any) => setExportOptions(prev => ({ ...prev, tableData: Boolean(v) }))} 
              />
              <label htmlFor="export-tabledata" className="text-sm">Table Data</label>
            </div>
          </div>

          {exportOptions.tableData && (
            <div className="mt-4 p-4 border rounded-lg bg-muted/20">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium">Select tables to export:</div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox id="select-all-tables" checked={allSelected} onCheckedChange={(v: any) => toggleAll(Boolean(v))} />
                    <label htmlFor="select-all-tables" className="text-sm">Select all tables</label>
                  </div>
                  <Button size="sm" variant="outline" onClick={exportSelectedCSV} disabled={loading}>Export as CSV</Button>
                </div>
              </div>
              <div className="border rounded-md max-h-[300px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Rows (est.)</TableHead>
                      <TableHead>RLS</TableHead>
                      <TableHead>Policies</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tables.map((t) => (
                      <TableRow key={t.table_name}>
                        <TableCell>
                          <Checkbox checked={!!selected[t.table_name]} onCheckedChange={(v: any) => toggle(t.table_name, Boolean(v))} />
                        </TableCell>
                        <TableCell>{t.table_name}</TableCell>
                        <TableCell>{t.row_estimate}</TableCell>
                        <TableCell>{t.rls_enabled ? "On" : "Off"}</TableCell>
                        <TableCell>{t.policy_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button onClick={exportSchemaMetadata} disabled={loading}>
              Export Selected Components
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Read-only SQL Runner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={query} onChange={(e) => setQuery(e.target.value)} rows={6} />
          <div className="flex gap-2">
            <Button variant="outline" onClick={runQuery} disabled={loading}>Run</Button>
            <Button onClick={exportQueryCSV} disabled={loading || queryResult.length === 0}>Export Result CSV</Button>
          </div>
          <div className="text-sm text-muted-foreground">Rows: {queryResult.length}</div>
        </CardContent>
      </Card>
    </div>
  );
}
