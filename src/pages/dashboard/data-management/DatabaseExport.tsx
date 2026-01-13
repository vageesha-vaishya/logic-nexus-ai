import { useEffect, useMemo, useState } from "react";
import { useCRM } from "@/hooks/useCRM";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import Papa from "papaparse";
import JSZip from "jszip";
import { toast } from "sonner";
import { BackupDownloader } from "@/components/admin/BackupDownloader";

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
  const { scopedDb } = useCRM();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name LIMIT 50;");
  const [queryResult, setQueryResult] = useState<any[]>([]);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreMode, setRestoreMode] = useState<'insert' | 'upsert'>('upsert');
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
  
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

  // Storage settings
  const [destination, setDestination] = useState<'device' | 'cloud'>('device');
  const [conflictPolicy, setConflictPolicy] = useState<'ask' | 'overwrite' | 'rename'>('rename');
  const [cloudBasePath, setCloudBasePath] = useState<string>('db-exports');

  // Manual download queue for restricted iframes/browsers
  const [pendingDownloads, setPendingDownloads] = useState<Array<{ name: string; url: string }>>([]);
  const clearPendingDownloads = () => {
    try {
      pendingDownloads.forEach((d) => URL.revokeObjectURL(d.url));
    } catch {
      // ignore
    }
    setPendingDownloads([]);
  };
  useEffect(() => {
    const loadTables = async () => {
      const { data, error } = await scopedDb.rpc("get_database_tables");
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

  const downloadFile = async (filename: string, content: string, type = "text/plain") => {
    try {
      // Use File System Access API for better UX (save location dialog)
      if ('showSaveFilePicker' in window) {
        const extension = filename.split('.').pop() || 'txt';
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'File',
            accept: { [type]: ['.' + extension] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        return;
      }
    } catch (e: any) {
      // User cancelled or API not available, fall back to standard download
      if (e.name === 'AbortError') {
        toast.message("Save cancelled");
        return;
      }
    }
    
    // Fallback for browsers without File System Access API or when blocked in iframes
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    // Keep a manual download link for the user to click if auto-download is blocked
    setPendingDownloads((prev) => [...prev, { name: filename, url }]);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.target = "_blank";
    a.click();
    // Do not revoke here; user can use Manual Downloads to save and then clear
  };

  // Cloud storage helpers and unified save functions
  const splitPath = (path: string) => {
    const normalized = path.replace(/^\/+|\/+$/g, '');
    const parts = normalized.split('/');
    const name = parts.pop() || '';
    const folder = parts.join('/');
    return { folder, name };
  };

  const fileExists = async (fullPath: string) => {
    const { folder, name } = splitPath(fullPath);
    const { data } = await scopedDb.client.storage.from('db-backups').list(folder || undefined, { search: name });
    return (data || []).some((o: any) => o.name === name);
  };

  const resolveConflictPath = async (fullPath: string): Promise<string | null> => {
    if (conflictPolicy === 'overwrite') return fullPath;
    if (!(await fileExists(fullPath))) return fullPath;
    if (conflictPolicy === 'ask') {
      const ok = window.confirm(`File "${fullPath}" exists. Overwrite? Click Cancel to auto-rename.`);
      if (ok) return fullPath;
    }
    const dot = fullPath.lastIndexOf('.');
    const base = dot > -1 ? fullPath.slice(0, dot) : fullPath;
    const ext = dot > -1 ? fullPath.slice(dot) : '';
    let i = 1;
    let candidate = `${base} (${i})${ext}`;
    while (await fileExists(candidate)) {
      i++;
      candidate = `${base} (${i})${ext}`;
    }
    return candidate;
  };

  const saveToCloud = async (filename: string, content: string | Blob, type: string) => {
    const { data: { user } } = await scopedDb.client.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    const userFolder = user.id;
    const dir = (cloudBasePath || '').replace(/^\/+|\/+$/g, '');
    const fullPath = dir ? `${userFolder}/${dir}/${filename}` : `${userFolder}/${filename}`;
    const finalPath = await resolveConflictPath(fullPath);
    if (!finalPath) return;

    const blob = content instanceof Blob ? content.slice(0, content.size, type) : new Blob([content], { type });
    const { error } = await scopedDb.client.storage.from('db-backups').upload(finalPath, blob, { upsert: conflictPolicy === 'overwrite' });
    if (error) throw error;
    toast.success('Saved to Cloud storage', { description: finalPath });
  };

  const saveFile = async (filename: string, content: string, type = 'text/plain') => {
    if (destination === 'cloud') {
      return await saveToCloud(filename, content, type);
    }
    await downloadFile(filename, content, type);
  };

  const saveMultipleFiles = async (files: Array<{ name: string; content: string; type: string }>) => {
    if (destination === 'cloud') {
      for (const f of files) {
        await saveToCloud(f.name, f.content, f.type);
      }
      return;
    }
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker({ id: 'db-exports' });
        for (const f of files) {
          let name = f.name;
          try {
            // If exists, handle conflict according to policy
            await dirHandle.getFileHandle(name, { create: false });
            if (conflictPolicy === 'overwrite') {
              // keep name
            } else if (conflictPolicy === 'ask') {
              const ok = window.confirm(`File "${name}" exists. Overwrite? Click Cancel to auto-rename.`);
              if (!ok) {
                const dot = name.lastIndexOf('.');
                const base = dot > -1 ? name.slice(0, dot) : name;
                const ext = dot > -1 ? name.slice(dot) : '';
                const i = 1;
                name = `${base} (${i})${ext}`;
              }
            } else {
              const dot = name.lastIndexOf('.');
              const base = dot > -1 ? name.slice(0, dot) : name;
              const ext = dot > -1 ? name.slice(dot) : '';
              const i = 1;
              name = `${base} (${i})${ext}`;
            }
          } catch {
            // ignore
          }
          const fileHandle = await dirHandle.getFileHandle(name, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(f.content);
          await writable.close();
        }
        toast.success('Saved files to chosen folder');
        return;
      } catch (e: any) {
        if (e.name === 'AbortError') {
          toast.message('Folder selection cancelled');
          return;
        }
      }
    }
    for (const f of files) {
      await downloadFile(f.name, f.content, f.type);
    }
  };

  const exportSelectedCSV = async () => {
    const chosen = tables.filter(t => selected[t.table_name]);
    if (chosen.length === 0) {
      toast.message("No tables selected", { description: "Select at least one table to export." });
      return;
    }
    setLoading(true);
    try {
      const files: Array<{ name: string; content: string; type: string }> = [];
      for (const t of chosen) {
        const { data, error } = await (scopedDb.from(t.table_name as any).select("*") as any);
        if (error) {
          toast.error(`Failed exporting ${t.table_name}`, { description: error.message });
          continue;
        }
        const csv = Papa.unparse(data || []);
        files.push({ name: `${t.table_name}.csv`, content: csv, type: "text/csv" });
      }
      await saveMultipleFiles(files);
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
        promises.push((scopedDb.rpc as any)("get_database_schema"));
        keys.push("schema");
      }
      if (exportOptions.constraints) {
        promises.push((scopedDb.rpc as any)("get_table_constraints"));
        keys.push("constraints");
      }
      if (exportOptions.indexes) {
        promises.push((scopedDb.rpc as any)("get_table_indexes"));
        keys.push("indexes");
      }
      if (exportOptions.dbFunctions) {
        promises.push((scopedDb.rpc as any)("get_database_functions"));
        keys.push("database_functions");
      }
      if (exportOptions.rlsPolicies) {
        promises.push((scopedDb.rpc as any)("get_rls_policies"));
        keys.push("rls_policies");
      }
      if (exportOptions.enums) {
        promises.push((scopedDb.rpc as any)("get_database_enums"));
        keys.push("enums");
      }
      if (exportOptions.edgeFunctions || exportOptions.secrets) {
        promises.push(scopedDb.client.functions.invoke("list-edge-functions"));
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
            const { data, error } = await (scopedDb.from(t.table_name as any).select("*") as any);
            if (error) {
              console.error(`Failed exporting ${t.table_name}:`, error.message);
              return { table_name: t.table_name, data: [], error: error.message };
            }
            return { table_name: t.table_name, data: data || [] };
          });
          payload.table_data = await Promise.all(tableDataPromises);
        }
      }

      await saveFile(`schema-metadata.json`, JSON.stringify(payload, null, 2), "application/json");
      
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

  const validateSQL = (sql: string, context: string) => {
    const errors: string[] = [];
    if (!sql.trim()) return errors;
    
    // Check for common issues
    const openQuotes = (sql.match(/'/g) || []).length;
    if (openQuotes % 2 !== 0) errors.push(`[${context}] Potentially unclosed single quote`);
    
    const openDoubleQuotes = (sql.match(/"/g) || []).length;
    if (openDoubleQuotes % 2 !== 0) errors.push(`[${context}] Potentially unclosed double quote`);
    
    // Check for potentially dangerous operations in export (shouldn't happen but good to flag)
    if (sql.toUpperCase().includes('DROP DATABASE')) errors.push(`[${context}] Contains DROP DATABASE statement`);
    if (sql.toUpperCase().includes('TRUNCATE')) errors.push(`[${context}] Contains TRUNCATE statement`);
    if (sql.includes('\u0000')) errors.push(`[${context}] Contains null byte characters`);
    
    return errors;
  };

  const exportSchemaSQL = async () => {
    const hasAnySelected = Object.values(exportOptions).some(v => v);
    if (!hasAnySelected) {
      toast.message("No components selected", { description: "Select at least one export option." });
      return;
    }

    setLoading(true);
    const summary: string[] = ["Database Export Summary", "=======================", `Date: ${new Date().toISOString()}`, ""];
    
    try {
      const zip = new JSZip();
      const validationErrors: string[] = [];
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Track exported counts for summary
      const counts: Record<string, number> = {
        enums: 0,
        tables: 0,
        functions: 0,
        indexes: 0,
        constraints: 0,
        policies: 0,
        data_rows: 0,
        edge_functions: 0
      };

      // 1. Enums / Types (001_enums.sql)
      if (exportOptions.enums) {
        try {
          const { data: enumsData, error } = await scopedDb.rpc("get_database_enums");
          if (error) throw error;
          
          if (enumsData && Array.isArray(enumsData) && enumsData.length > 0) {
              let sql = "-- 001_enums.sql\n-- Database Enums and Types\n\n";
              enumsData.forEach((enumItem: any) => {
                  const enumType = enumItem?.enum_type;
                  const labelsText = (enumItem?.labels ?? '').toString();
                  if (!enumType || labelsText.trim() === '') return;
                  
                  const labels = labelsText
                    .replace(/^{|}$/g, '')
                    .split(',')
                    .map((l: string) => l.trim())
                    .filter((l: string) => l.length > 0)
                    .map((l: string) => `'${l.replace(/'/g, "''")}'`)
                    .join(', ');
                    
                  sql += `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${enumType}') THEN
        CREATE TYPE "${enumType}" AS ENUM (${labels});
    END IF;
END $$;\n\n`;
                  counts.enums++;
              });
              validationErrors.push(...validateSQL(sql, 'Enums'));
              zip.file("001_enums.sql", sql);
              summary.push(`- Enums: ${counts.enums} exported`);
          }
        } catch (err: any) {
          console.error("Error exporting enums:", err);
          summary.push(`- Enums: FAILED (${err.message})`);
          validationErrors.push(`[Enums] Export failed: ${err.message}`);
        }
      }

      // 2. Schema / Tables (002_tables.sql)
      if (exportOptions.schema) {
        try {
          const { data: schemaData, error } = await scopedDb.rpc("get_database_schema");
          if (error) throw error;
          
          if (schemaData && Array.isArray(schemaData) && schemaData.length > 0) {
            let sql = "-- 002_tables.sql\n-- Tables Schema (Structure Only, No Constraints)\n\n";
            const tableGroups = schemaData.reduce((acc: any, row: any) => {
              if (!acc[row.table_name]) acc[row.table_name] = [];
              acc[row.table_name].push(row);
              return acc;
            }, {});

            const resolveColumnType = (col: any) => {
              const dt = (col.data_type || '').toString();
              const udt = (col.udt_name || '').toString();
              if (dt.toUpperCase() === 'USER-DEFINED' && udt) return `"${udt}"`;
              if (dt.toUpperCase() === 'ARRAY' && udt) {
                const base = udt.startsWith('_') ? udt.slice(1) : udt;
                return `${base}[]`;
              }
              if ((dt === 'character varying' || dt === 'varchar') && col.character_maximum_length) {
                return `${dt}(${col.character_maximum_length})`;
              }
              return dt || 'text';
            };

            Object.entries(tableGroups).forEach(([tableName, columns]: [string, any]) => {
              sql += `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;
              const seen = new Set<string>();
              const uniqueCols = (columns as any[]).filter((col) => {
                const name = col.column_name;
                if (seen.has(name)) return false;
                seen.add(name);
                return true;
              });
              const columnDefs = uniqueCols.map((col: any) => {
                let def = `  "${col.column_name}" ${resolveColumnType(col)}`;
                if (col.is_nullable === false) {
                  def += ' NOT NULL';
                }
                if (col.column_default) {
                  def += ` DEFAULT ${col.column_default}`;
                }
                return def;
              });
              sql += columnDefs.join(',\n') + '\n);\n\n';
              counts.tables++;
            });
            
            validationErrors.push(...validateSQL(sql, 'Tables'));
            zip.file("002_tables.sql", sql);
            summary.push(`- Tables: ${counts.tables} exported`);
          }
        } catch (err: any) {
          console.error("Error exporting tables:", err);
          summary.push(`- Tables: FAILED (${err.message})`);
          validationErrors.push(`[Tables] Export failed: ${err.message}`);
        }
      }

      // 2b. Primary Keys & Unique (002b_primary_keys.sql)
      if (exportOptions.constraints) {
        try {
          const { data: constraintsData, error } = await scopedDb.rpc("get_table_constraints");
          if (error) throw error;
          
          if (constraintsData && Array.isArray(constraintsData) && constraintsData.length > 0) {
            let sql = "-- 002b_primary_keys.sql\n-- Primary Keys and Unique Constraints\n\n";
            let count = 0;
            constraintsData.forEach((constraint: any) => {
              const type = (constraint.constraint_type || '').toUpperCase();
              const details = (constraint.constraint_details || '').toString();
              const isPkOrUnique = type === 'PRIMARY KEY' || type === 'UNIQUE' || 
                                   details.toUpperCase().startsWith('PRIMARY KEY') || 
                                   details.toUpperCase().startsWith('UNIQUE');
                                   
              if (isPkOrUnique && details.trim().length > 0) {
                sql += `ALTER TABLE "${constraint.table_name}" ADD CONSTRAINT "${constraint.constraint_name}" ${details};\n`;
                count++;
              }
            });
            if (count > 0) {
                validationErrors.push(...validateSQL(sql, 'Primary Keys'));
                zip.file("002b_primary_keys.sql", sql);
                summary.push(`- Primary Keys & Unique: ${count} exported`);
                counts.constraints += count;
            }
          }
        } catch (err: any) {
          console.error("Error exporting primary keys:", err);
          summary.push(`- Primary Keys: FAILED (${err.message})`);
          validationErrors.push(`[Primary Keys] Export failed: ${err.message}`);
        }
      }

      // 3. Database Functions (003_functions.sql)
      if (exportOptions.dbFunctions) {
        try {
          let functionsData: any[] | null = null;
          try {
            const { data } = await (scopedDb.rpc as any)("get_database_functions_with_body");
            functionsData = data;
          } catch (e) {
            functionsData = null;
          }
          if (!functionsData) {
            const { data } = await (scopedDb.rpc as any)("get_database_functions");
            functionsData = data;
          }
          
          if (functionsData && Array.isArray(functionsData) && functionsData.length > 0) {
            let sql = "-- 003_functions.sql\n-- Database Functions\n\n";
            functionsData.forEach((func: any) => {
              const name = func?.name || func?.function_name;
              const schema = func?.schema || 'public';
              const def = func?.function_definition;
              if (def && name) {
                const trimmed = String(def).trim();
                sql += `-- Function: ${schema}.${name}\n`;
                sql += `${trimmed}\n\n`;
                counts.functions++;
              } else if (name) {
                 sql += `-- Function metadata: ${schema}.${name} (definition unavailable)\n\n`;
              }
            });
            validationErrors.push(...validateSQL(sql, 'Functions'));
            zip.file("003_functions.sql", sql);
            summary.push(`- Functions: ${counts.functions} exported`);
          }
        } catch (err: any) {
          console.error("Error exporting functions:", err);
          summary.push(`- Functions: FAILED (${err.message})`);
          validationErrors.push(`[Functions] Export failed: ${err.message}`);
        }
      }

      // 4. Data (004_data.sql) - Moved BEFORE Constraints/Indexes to avoid FK issues
      if (exportOptions.tableData) {
        try {
          const chosen = tables.filter(t => selected[t.table_name]);
          if (chosen.length > 0) {
              let sql = "-- 004_data.sql\n-- Table Data (Inserts)\n\n";
              
              // Helper to get schema info for type formatting
              const { data: schemaData, error: schemaError } = await scopedDb.rpc("get_database_schema");
              if (schemaError) throw schemaError;
              
              const resolveDataTypeForValue = (col: any) => {
                const dt = (col.data_type || '').toString();
                const udt = (col.udt_name || '').toString();
                if (dt.toUpperCase() === 'ARRAY' && udt) {
                  const base = udt.startsWith('_') ? udt.slice(1) : udt;
                  return `${base}[]`;
                }
                if (dt.toUpperCase() === 'USER-DEFINED' && udt) {
                  return udt;
                }
                return dt;
              };
              
              const typeMapByTable: Record<string, Record<string, string>> = (schemaData || []).reduce(
                (acc: Record<string, Record<string, string>>, col: any) => {
                  if (!acc[col.table_name]) acc[col.table_name] = {};
                  acc[col.table_name][col.column_name] = resolveDataTypeForValue(col);
                  return acc;
                },
                {}
              );
              
              const escapeStr = (s: string) => s.replace(/'/g, "''");
              const formatArray = (arr: any[], baseType?: string): string => {
                  const numericTypes = ["integer", "bigint", "smallint", "numeric", "real", "double precision"];
                  const items = arr.map((v) => {
                      if (v === null) return "NULL";
                      if (baseType && numericTypes.includes(baseType)) return String(v);
                      if (baseType === "boolean") return v ? "true" : "false";
                      const s = String(v).replace(/"/g, '\\"').replace(/\\/g, "\\\\").replace(/'/g, "''");
                      return `"${s}"`;
                  }).join(",");
                  const literal = `{${items}}`;
                  return baseType ? `'${literal}'::${baseType}[]` : `'${literal}'`;
              };

              const formatValue = (value: any, dataType?: string) => {
                  if (value === undefined || value === null) return "NULL";
                  if (dataType === "json" || dataType === "jsonb") {
                    const json = JSON.stringify(value);
                    return `'${escapeStr(json)}'::${dataType}`;
                  }
                  if (dataType && dataType.endsWith("[]") && Array.isArray(value)) {
                    return formatArray(value, dataType.slice(0, -2));
                  }
                  if (typeof value === "string") return `'${escapeStr(value)}'`;
                  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
                  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
                  if (value instanceof Date) return `'${value.toISOString()}'`;
                  if (typeof value === "object") {
                    const json = JSON.stringify(value);
                    return `'${escapeStr(json)}'`;
                  }
                  return `'${escapeStr(String(value))}'`;
              };

              for (const table of chosen) {
                  const { data, error } = await (scopedDb.from(table.table_name as any).select("*") as any);
                  if (error) {
                      console.error(`Failed exporting ${table.table_name}:`, error.message);
                      summary.push(`  - Table ${table.table_name}: FAILED (${error.message})`);
                      continue;
                  }
                  if (data && data.length > 0) {
                      sql += `\n-- Data for table: ${table.table_name}\n`;
                      const colTypes = typeMapByTable[table.table_name] || {};
                      const columns = Object.keys(colTypes).length > 0 ? Object.keys(colTypes) : Object.keys(data[0]);
                      const columnNames = columns.map((col) => `"${col}"`).join(", ");
                      
                      data.forEach((row: any) => {
                          const values = columns.map((col) => formatValue(row[col], colTypes[col])).join(", ");
                          sql += `INSERT INTO "${table.table_name}" (${columnNames}) VALUES (${values});\n`;
                          counts.data_rows++;
                      });
                  }
              }
              validationErrors.push(...validateSQL(sql, 'Data'));
              zip.file("004_data.sql", sql);
              summary.push(`- Data: ${counts.data_rows} rows exported across ${chosen.length} tables`);
          }
        } catch (err: any) {
          console.error("Error exporting data:", err);
          summary.push(`- Data: FAILED (${err.message})`);
          validationErrors.push(`[Data] Export failed: ${err.message}`);
        }
      }

      // 5. Indexes (005_indexes.sql)
      if (exportOptions.indexes) {
        try {
          const { data: indexesData, error } = await scopedDb.rpc("get_table_indexes");
          if (error) throw error;
          
          if (indexesData && Array.isArray(indexesData) && indexesData.length > 0) {
            let sql = "-- 005_indexes.sql\n-- Table Indexes\n\n";
            indexesData.forEach((index: any) => {
              const def = (index.index_definition || '').toString();
              if (def.trim().length > 0) {
                sql += `${def};\n`;
                counts.indexes++;
              }
            });
            validationErrors.push(...validateSQL(sql, 'Indexes'));
            zip.file("005_indexes.sql", sql);
            summary.push(`- Indexes: ${counts.indexes} exported`);
          }
        } catch (err: any) {
          console.error("Error exporting indexes:", err);
          summary.push(`- Indexes: FAILED (${err.message})`);
          validationErrors.push(`[Indexes] Export failed: ${err.message}`);
        }
      }

      // 6. Foreign Keys & Checks (006_foreign_keys.sql)
      if (exportOptions.constraints) {
        try {
          const { data: constraintsData, error } = await scopedDb.rpc("get_table_constraints");
          if (error) throw error;
          
          if (constraintsData && Array.isArray(constraintsData) && constraintsData.length > 0) {
            let sql = "-- 006_foreign_keys.sql\n-- Foreign Keys and Check Constraints\n\n";
            let count = 0;
            constraintsData.forEach((constraint: any) => {
              const type = (constraint.constraint_type || '').toUpperCase();
              const details = (constraint.constraint_details || '').toString();
              const isPkOrUnique = type === 'PRIMARY KEY' || type === 'UNIQUE' || 
                                   details.toUpperCase().startsWith('PRIMARY KEY') || 
                                   details.toUpperCase().startsWith('UNIQUE');
              
              if (!isPkOrUnique && details.trim().length > 0) {
                sql += `ALTER TABLE "${constraint.table_name}" ADD CONSTRAINT "${constraint.constraint_name}" ${details};\n`;
                count++;
              }
            });
            if (count > 0) {
                validationErrors.push(...validateSQL(sql, 'Foreign Keys'));
                zip.file("006_foreign_keys.sql", sql);
                summary.push(`- Foreign Keys & Checks: ${count} exported`);
                counts.constraints += count;
            }
          }
        } catch (err: any) {
          console.error("Error exporting foreign keys:", err);
          summary.push(`- Foreign Keys: FAILED (${err.message})`);
          validationErrors.push(`[Foreign Keys] Export failed: ${err.message}`);
        }
      }

      // 7. RLS Policies (007_rls_policies.sql)
      if (exportOptions.rlsPolicies) {
        try {
          const { data: policiesData, error } = await scopedDb.rpc("get_rls_policies");
          if (error) throw error;
          
          if (policiesData && Array.isArray(policiesData) && policiesData.length > 0) {
            let sql = "-- 007_rls_policies.sql\n-- Row Level Security Policies\n\n";
            const tableGroups = policiesData.reduce((acc: any, policy: any) => {
              if (!acc[policy.table_name]) {
                acc[policy.table_name] = [];
              }
              acc[policy.table_name].push(policy);
              return acc;
            }, {});

            Object.entries(tableGroups).forEach(([tableName, policies]: [string, any]) => {
              sql += `\n-- Enable RLS on ${tableName}\n`;
              sql += `ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY;\n`;
              
              policies.forEach((policy: any) => {
                sql += `CREATE POLICY "${policy.policy_name}" ON "${tableName}"\n`;
                sql += `  FOR ${policy.command || 'ALL'}\n`;
                
                const rolesText = (policy.roles ?? '').toString();
                if (rolesText.trim() !== '') {
                  const parsedRoles = rolesText
                    .replace(/^{|}$/g, '')
                    .split(',')
                    .map((r: string) => r.trim())
                    .filter((r: string) => r.length > 0);
                  if (parsedRoles.length > 0) {
                    const rolesSql = parsedRoles
                      .map((r: string) => {
                        const lower = r.toLowerCase();
                        if (lower === 'public') return 'PUBLIC';
                        if (lower === 'current_user') return 'CURRENT_USER';
                        if (lower === 'session_user') return 'SESSION_USER';
                        return `"${r}"`;
                      })
                      .join(', ');
                    sql += `  TO ${rolesSql}\n`;
                  }
                }
                if (policy.using_expression) {
                  sql += `  USING (${policy.using_expression})\n`;
                }
                if (policy.with_check_expression) {
                  sql += `  WITH CHECK (${policy.with_check_expression})\n`;
                }
                sql += ';\n';
                counts.policies++;
              });
            });
            validationErrors.push(...validateSQL(sql, 'RLS Policies'));
            zip.file("007_rls_policies.sql", sql);
            summary.push(`- RLS Policies: ${counts.policies} exported`);
          }
        } catch (err: any) {
          console.error("Error exporting RLS policies:", err);
          summary.push(`- RLS Policies: FAILED (${err.message})`);
          validationErrors.push(`[RLS Policies] Export failed: ${err.message}`);
        }
      }

      // 8. Edge Functions (008_edge_functions.json)
      if (exportOptions.edgeFunctions || exportOptions.secrets) {
        try {
          const { data, error } = await scopedDb.client.functions.invoke("list-edge-functions");
          if (!error && data) {
              zip.file("008_edge_functions.json", JSON.stringify(data, null, 2));
              const funcCount = data.edge_functions ? data.edge_functions.length : 0;
              counts.edge_functions = funcCount;
              summary.push(`- Edge Functions: ${funcCount} exported`);
          }
        } catch (err: any) {
          console.error("Error exporting edge functions:", err);
          summary.push(`- Edge Functions: FAILED (${err.message})`);
          // Don't fail the whole export for this
        }
      }

      // Add Validation Report
      if (validationErrors.length > 0) {
          zip.file("validation_warnings.txt", "Validation Warnings:\n====================\n" + validationErrors.join("\n"));
          toast.warning("Export completed with validation warnings", { description: "Check validation_warnings.txt in the zip file." });
          summary.push("\nWARNING: Validation errors were found. See validation_warnings.txt.");
      } else {
          summary.push("\nValidation: Passed (No syntax issues detected)");
      }
      
      // Add Summary Report
      zip.file("export_summary.txt", summary.join("\n"));

      // Generate Zip
      const content = await zip.generateAsync({ type: "blob" });
      
      if (destination === 'cloud') {
          // Upload zip to cloud
          const fileName = `database_export_${timestamp}.zip`;
          await saveToCloud(fileName, content, 'application/zip');
      } else {
          const url = URL.createObjectURL(content);
          const a = document.createElement("a");
          a.href = url;
          a.download = `database_export_${timestamp}.zip`;
          a.click();
          // Clean up
          setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
      
      toast.success("Database Exported Successfully");
    } catch (e: any) {
      toast.error("SQL Export failed", { description: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  const runQuery = async () => {
    setLoading(true);
    try {
      const { data, error } = await scopedDb.rpc("execute_sql_query", { query_text: query });
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

  const exportQueryCSV = async () => {
    if (!queryResult || queryResult.length === 0) {
      toast.message("No data to export", { description: "Run a query first." });
      return;
    }
    const csv = Papa.unparse(queryResult);
    await saveFile("query-result.csv", csv, "text/csv");
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
        const { data, error } = await (scopedDb.from(table.table_name as any).select("*") as any);
        if (error) {
          console.error(`Failed to backup ${table.table_name}:`, error.message);
          continue;
        }
        backup.tables[table.table_name] = data || [];
      }

      await saveFile(`full-backup-${timestamp}.json`, JSON.stringify(backup, null, 2), "application/json");
      
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
        const { data, error } = await (scopedDb
          .from(table.table_name as any)
          .select("*")
          .or(`created_at.gte.${lastBackupTime},updated_at.gte.${lastBackupTime}`) as any);
        
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

      await saveFile(`incremental-backup-${timestamp}.json`, JSON.stringify(backup, null, 2), "application/json");
      
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
            const { error } = await (scopedDb
              .from(tableName as any)
              .upsert(record, { onConflict: 'id' }) as any);
            
            if (error) {
              console.error(`Error upserting to ${tableName}:`, error.message);
              errors++;
            } else {
              totalRestored++;
            }
          } else {
            const { error } = await (scopedDb
              .from(tableName as any)
              .insert(record) as any);
            
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
      {/* Save Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Save Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="destination" className="text-sm font-medium mb-2 block">Save Destination</Label>
              <RadioGroup value={destination} onValueChange={(v) => setDestination(v as 'device' | 'cloud')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="device" id="device" />
                  <Label htmlFor="device" className="font-normal cursor-pointer">Device (Local Download)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="cloud" id="cloud" />
                  <Label htmlFor="cloud" className="font-normal cursor-pointer">Cloud Storage (Supabase)</Label>
                </div>
              </RadioGroup>
            </div>
            
            <div>
              <Label htmlFor="conflict" className="text-sm font-medium mb-2 block">If File Exists</Label>
              <RadioGroup value={conflictPolicy} onValueChange={(v) => setConflictPolicy(v as 'ask' | 'overwrite' | 'rename')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="rename" id="rename" />
                  <Label htmlFor="rename" className="font-normal cursor-pointer">Auto-rename (file-1, file-2...)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ask" id="ask" />
                  <Label htmlFor="ask" className="font-normal cursor-pointer">Ask me</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="overwrite" id="overwrite" />
                  <Label htmlFor="overwrite" className="font-normal cursor-pointer">Overwrite</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          
          {destination === 'cloud' && (
            <div>
              <Label htmlFor="cloudPath" className="text-sm font-medium mb-2 block">Cloud Storage Path (optional)</Label>
              <Input
                id="cloudPath"
                value={cloudBasePath}
                onChange={(e) => setCloudBasePath(e.target.value)}
                placeholder="e.g., backups/2024"
                className="max-w-md"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Files will be saved to: db-backups/{cloudBasePath || '(root)'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {pendingDownloads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Manual Downloads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Your browser blocked automatic downloads. Click the links below to save files, or clear when done.</p>
            <div className="space-y-2">
              {pendingDownloads.map((d, i) => (
                <div key={`${d.name}-${i}`} className="flex items-center justify-between gap-2">
                  <a href={d.url} download={d.name} className="text-primary underline break-all">{d.name}</a>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={clearPendingDownloads}>Clear</Button>
            </div>
          </CardContent>
        </Card>
      )}

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
            <Button onClick={exportSchemaSQL} disabled={loading}>
              Export as SQL File
            </Button>
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

      {/* Cloud Storage Backups */}
      <BackupDownloader />
    </div>
  );
}
