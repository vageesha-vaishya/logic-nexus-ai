import { useEffect, useState, useRef, useCallback } from "react";
import { useCRM } from "@/hooks/useCRM";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
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
  validateAndRepairSql,
  repairSqlSyntax,
} from "@/utils/pgDumpExport";
import { resolveDataTypeForValue, validateSQL, calculateChecksum } from "@/utils/dbExportUtils";
import { generateIndexStatements } from "@/utils/pgDumpExport";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PgDumpOptionsPanel, PgDumpCategoryOptions, PgDumpGeneralOptions } from "./PgDumpOptionsPanel";

interface ExportProgress {
  phase: string;
  percent: number;
  message: string;
}

export function PgDumpExportPanel() {
  const { scopedDb, context } = useCRM();
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [options] = useState<PgDumpOptions>(defaultPgDumpOptions);
  const [showInstructions, setShowInstructions] = useState(false);
  const [lastExportFilename, setLastExportFilename] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  const [permissionOk, setPermissionOk] = useState<boolean>(false);
  const [categories, setCategories] = useState<PgDumpCategoryOptions>(() => {
    try {
      const raw = localStorage.getItem("pgdump.categories");
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      all: true,
      schema: true,
      constraints: true,
      indexes: true,
      dbFunctions: true,
      rlsPolicies: true,
      enums: true,
      edgeFunctions: false,
      secrets: false,
      tableData: true,
    };
  });
  const [general, setGeneral] = useState<PgDumpGeneralOptions>(() => {
    try {
      const raw = localStorage.getItem("pgdump.general");
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      outputMode: "insert",
      includeDropStatements: defaultPgDumpOptions.includeDropStatements,
      excludeAuthSchema: defaultPgDumpOptions.excludeAuthSchema,
      excludeStorageSchema: defaultPgDumpOptions.excludeStorageSchema,
      customSchemas: "",
      baseFilename: "database_export.sql",
    };
  });

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

  const downloadTextFile = async (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const ok = !!(context.isPlatformAdmin || context.isTenantAdmin);
    setPermissionOk(ok);
  }, [context.isPlatformAdmin, context.isTenantAdmin]);

  useEffect(() => {
    (async () => {
      try {
        const res = await scopedDb.rpc("execute_sql_query", { query_text: "SELECT 1" });
        setConnectionOk(!res.error);
      } catch {
        setConnectionOk(false);
      }
    })();
  }, [scopedDb]);

  useEffect(() => {
    try {
      localStorage.setItem("pgdump.categories", JSON.stringify(categories));
    } catch {}
  }, [categories]);

  useEffect(() => {
    try {
      localStorage.setItem("pgdump.general", JSON.stringify(general));
    } catch {}
  }, [general]);

  const runExport = useCallback(async () => {
    cancelRef.current = false;
    setIsExporting(true);
    setProgress(null);
    
    const effectiveOptions: PgDumpOptions = {
      ...options,
      includeDropStatements: general.includeDropStatements,
      excludeAuthSchema: general.excludeAuthSchema,
      excludeStorageSchema: general.excludeStorageSchema,
      useInsertFormat: general.outputMode === "insert",
      includeRls: categories.rlsPolicies && options.includeRls,
    };
    
    let sqlContent = '';
    let dataSql = '';
    const logLines: string[] = [];
    const objectSummaries: string[] = [];
    const warningMessages: string[] = [];
    const errorMessages: string[] = [];
    let totalRowsExported = 0;
    const startedAt = new Date();
    logLines.push(`Export started at ${startedAt.toISOString()}`);
    
    try {
      // 1. Header
      updateProgress('Initializing', 5, 'Generating SQL header...');
      sqlContent += generatePgDumpHeader();
      logLines.push('Generated pg_dump-compatible header');
      
      if (cancelRef.current) throw new Error('Export cancelled');
      
      // 2. Fetch schema data
      updateProgress('Schema', 10, 'Fetching database schema...');
      const { data: schemaData, error: schemaError } = await scopedDb.rpc("get_all_database_schema");
      if (schemaError) throw schemaError;
      logLines.push(`Fetched schema metadata for ${schemaData ? schemaData.length : 0} columns`);
      
      if (cancelRef.current) throw new Error('Export cancelled');
      
      // Group by schema.table
      const tableGroups = (schemaData || []).reduce((acc: any, row: any) => {
        // Skip auth/storage if excluded
        if (effectiveOptions.excludeAuthSchema && row.schema_name === 'auth') return acc;
        if (effectiveOptions.excludeStorageSchema && row.schema_name === 'storage') return acc;
        
        const key = `${row.schema_name}.${row.table_name}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(row);
        return acc;
      }, {});
      
      // Get unique schemas
      const schemas = [...new Set(Object.keys(tableGroups).map(k => k.split('.')[0]))];
      
      // 3. Create schemas
      if (categories.schema) {
        updateProgress('Schema', 15, 'Creating schema statements...');
        sqlContent += generateSchemaStatements(schemas.filter(s => s !== 'public'));
        logLines.push(`Generated CREATE SCHEMA statements for ${schemas.filter(s => s !== "public").length} schemas`);
      }
      
      if (cancelRef.current) throw new Error('Export cancelled');
      
      // 4. Enums
      if (categories.enums) {
        updateProgress('Enums', 20, 'Fetching enum types...');
        try {
          const { data: enumData } = await scopedDb.rpc("get_database_enums");
          if (enumData && Array.isArray(enumData) && enumData.length > 0) {
            const enums = enumData.map((e: any) => ({
              name: e.enum_name || e.typname,
              labels: (e.labels || e.enum_values || '').replace(/^{|}$/g, '').split(',').map((l: string) => l.trim()).filter((l: string) => l.length > 0)
            }));
            sqlContent += generateEnumStatements(enums);
            logLines.push(`Exported ${enums.length} enum types`);
          }
        } catch (err: any) {
          warningMessages.push(`Enum metadata export skipped or failed: ${err?.message || String(err)}`);
        }
      }
      
      if (cancelRef.current) throw new Error('Export cancelled');
      
      // 5. Tables
      if (categories.schema) {
        updateProgress('Tables', 30, 'Creating table definitions...');
        const tableNames = Object.keys(tableGroups);
        logLines.push(`Preparing CREATE TABLE statements for ${tableNames.length} tables`);
        
        for (const tableKey of tableNames) {
          const columns = tableGroups[tableKey];
          const [schemaName, tableName] = tableKey.split('.');
          const seen = new Set<string>();
          const uniqueCols = columns.filter((col: any) => {
            if (seen.has(col.column_name)) return false;
            seen.add(col.column_name);
            return true;
          });
          const tableSql = generateCreateTableStatement(
            schemaName,
            tableName,
            uniqueCols,
            effectiveOptions.includeDropStatements
          );
          sqlContent += tableSql;
          objectSummaries.push(`TABLE ${schemaName}.${tableName}: definition bytes=${tableSql.length}`);
        }
      }
      
      if (cancelRef.current) throw new Error('Export cancelled');
      
      // 6. Functions
      if (categories.dbFunctions) {
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
            logLines.push(`Exported ${functionsData.length} functions`);
          }
        } catch (err: any) {
          warningMessages.push(`Function export skipped or failed: ${err?.message || String(err)}`);
        }
      }
      
      if (cancelRef.current) throw new Error('Export cancelled');
      
      // 7. Table Data
      let baseTables: any[] = [];
      if (categories.tableData) {
        updateProgress('Data', 50, 'Fetching table data...');
        const { data: tablesData } = await scopedDb.rpc("get_all_database_tables");
        baseTables = (tablesData || []).filter((t: any) => {
          if (effectiveOptions.excludeAuthSchema && t.schema_name === 'auth') return false;
          if (effectiveOptions.excludeStorageSchema && t.schema_name === 'storage') return false;
          return t.table_type === 'BASE TABLE';
        });
        logLines.push(`Preparing data export for ${baseTables.length} base tables`);

        try {
          const { data: constraintsData } = await scopedDb.rpc("get_table_constraints");
          const tableByKey = new Map<string, any>();
          baseTables.forEach((t: any) => {
            const key = `${t.schema_name}.${t.table_name}`.toLowerCase();
            tableByKey.set(key, t);
          });
          const priority: string[] = [
            'public.tenants',
            'public.profiles',
            'public.accounts',
            'public.contacts',
            'public.leads',
            'public.opportunities',
            'public.queues',
            'public.queue_members',
            'public.email_accounts',
            'public.emails',
            'public.activities',
            'public.segment_members',
          ];
          const deps = new Map<string, Set<string>>();
          const childrenByParent = new Map<string, Set<string>>();
          const addEdge = (child: string, parent: string) => {
            if (!tableByKey.has(child) || !tableByKey.has(parent)) return;
            if (!deps.has(child)) deps.set(child, new Set());
            deps.get(child)!.add(parent);
            if (!childrenByParent.has(parent)) childrenByParent.set(parent, new Set());
            childrenByParent.get(parent)!.add(child);
          };
          let edgeCount = 0;
          const fkPattern = /FOREIGN\s+KEY\s*\([^)]+\)\s+REFERENCES\s+"?([A-Za-z0-9_]+)"?\."?([A-Za-z0-9_]+)"?/i;
          const rows = (constraintsData || []) as any[];
          for (const c of rows) {
            const childRef = `${c.schema_name}.${c.table_name}`.toLowerCase();
            if (!tableByKey.has(childRef)) continue;
            const details = String(c.constraint_details || '');
            const m = details.match(fkPattern);
            if (!m) continue;
            const parentSchema = (m[1] || 'public').toLowerCase();
            const parentTable = (m[2] || '').toLowerCase();
            if (!parentTable) continue;
            const parentRef = `${parentSchema}.${parentTable}`;
            if (parentRef === childRef) continue;
            addEdge(childRef, parentRef);
            edgeCount++;
          }
          if (edgeCount > 0) {
            const keys = Array.from(tableByKey.keys());
            const indegree = new Map<string, number>();
            keys.forEach(k => indegree.set(k, 0));
            for (const [child, parents] of deps) {
              for (const p of parents) {
                if (!indegree.has(child)) continue;
                indegree.set(child, (indegree.get(child) || 0) + 1);
              }
            }
            const priorityIndex = new Map<string, number>();
            priority.forEach((name, idx) => {
              priorityIndex.set(name, idx);
            });
            const queue: string[] = [];
            for (const [k, deg] of indegree) {
              if (deg === 0) queue.push(k);
            }
            queue.sort((a, b) => {
              const pa = priorityIndex.has(a) ? priorityIndex.get(a)! : Number.MAX_SAFE_INTEGER;
              const pb = priorityIndex.has(b) ? priorityIndex.get(b)! : Number.MAX_SAFE_INTEGER;
              if (pa !== pb) return pa - pb;
              return a.localeCompare(b);
            });
            const orderedKeys: string[] = [];
            const seen = new Set<string>();
            while (queue.length > 0) {
              const k = queue.shift()!;
              if (seen.has(k)) continue;
              seen.add(k);
              orderedKeys.push(k);
              const children = childrenByParent.get(k);
              if (children) {
                for (const child of children) {
                  if (!indegree.has(child)) continue;
                  const d = (indegree.get(child) || 0) - 1;
                  indegree.set(child, d);
                  if (d === 0) {
                    queue.push(child);
                  }
                }
                queue.sort((a, b) => {
                  const pa = priorityIndex.has(a) ? priorityIndex.get(a)! : Number.MAX_SAFE_INTEGER;
                  const pb = priorityIndex.has(b) ? priorityIndex.get(b)! : Number.MAX_SAFE_INTEGER;
                  if (pa !== pb) return pa - pb;
                  return a.localeCompare(b);
                });
              }
            }
            if (orderedKeys.length === keys.length) {
              baseTables = orderedKeys.map(k => tableByKey.get(k));
              logLines.push('Reordered table data export using foreign key dependencies');
            } else {
              warningMessages.push(
                'Foreign key dependency graph could not be fully resolved; using default table order for data export'
              );
            }
          }
        } catch (err: any) {
          warningMessages.push(
            `Table data ordering by foreign keys skipped or failed: ${err?.message || String(err)}`
          );
        }
      }
      
      updateProgress('Validation', 55, 'Validating foreign key relationships...');
      try {
        const { data: fkOrphans, error: fkError } = await scopedDb.rpc("get_fk_orphans");
        if (fkError) {
          warningMessages.push(`Foreign key validation skipped or failed: ${fkError.message || String(fkError)}`);
        } else if (fkOrphans && Array.isArray(fkOrphans) && fkOrphans.length > 0) {
          const filtered = (fkOrphans as any[]).filter(o => {
            if (effectiveOptions.excludeAuthSchema && (o.constraint_schema === 'auth' || o.parent_schema === 'auth')) {
              return false;
            }
            if (effectiveOptions.excludeStorageSchema && (o.constraint_schema === 'storage' || o.parent_schema === 'storage')) {
              return false;
            }
            return true;
          });
          if (filtered.length > 0) {
            logLines.push('');
            logLines.push('Foreign key validation detected orphaned references:');
            for (const o of filtered) {
              const msg =
                `Constraint ${o.constraint_schema}.${o.table_name}.${o.constraint_name}: ` +
                `${o.orphan_count} orphan rows where ${o.table_name}.${o.child_column} ` +
                `references missing ${o.parent_schema}.${o.parent_table}.${o.parent_column}`;
              logLines.push(msg);
              errorMessages.push(msg);
            }
            throw new Error(`Foreign key validation failed: ${filtered.length} constraint(s) with orphaned rows`);
          } else {
            logLines.push('Foreign key validation passed: no orphaned references detected');
          }
        } else {
          logLines.push('Foreign key validation passed: no orphaned references detected');
        }
      } catch (err: any) {
        if (err && typeof err.message === 'string' && err.message.startsWith('Foreign key validation failed')) {
          throw err;
        }
        const msg = err instanceof Error ? err.message : String(err);
        warningMessages.push(`Foreign key validation skipped or failed: ${msg}`);
      }
      
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
            warningMessages.push(`Error fetching data for ${tableKey}: ${error.message || String(error)}`);
            continue;
          }
          
          if (data.length > 0) {
            const columns = Object.keys(data[0]);
            const typeMap = typeMapByTable[tableKey] || {};
            
            const insertSql = generateInsertStatements(
              table.schema_name,
              table.table_name,
              columns,
              data,
              typeMap
            );
            dataSql += insertSql;
            totalRowsExported += data.length;
            objectSummaries.push(
              `TABLE ${table.schema_name}.${table.table_name}: rows=${data.length}, data bytes=${insertSql.length}`
            );
          }
        } catch (err) {
          console.warn(`Error exporting ${tableKey}:`, err);
          warningMessages.push(`Error exporting data for ${tableKey}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      
      if (cancelRef.current) throw new Error('Export cancelled');
      
      sqlContent += dataSql;
      
      // 8. Constraints
      if (categories.constraints) {
        updateProgress('Constraints', 88, 'Adding constraints...');
        try {
          const { data: constraintsData } = await scopedDb.rpc("get_table_constraints");
          if (constraintsData && constraintsData.length > 0) {
            const filtered = constraintsData.filter((c: any) => {
              if (effectiveOptions.excludeAuthSchema && c.schema_name === 'auth') return false;
              if (effectiveOptions.excludeStorageSchema && c.schema_name === 'storage') return false;
              return true;
            });
            sqlContent += generateConstraintStatements(filtered);
            logLines.push(`Exported ${filtered.length} table constraints`);
          }
        } catch (err: any) {
          warningMessages.push(`Constraint export skipped or failed: ${err?.message || String(err)}`);
        }
      }

      if (categories.indexes) {
        updateProgress('Indexes', 90, 'Adding indexes...');
        try {
          const { data: indexData } = await scopedDb.rpc("get_table_indexes");
          const filtered = (indexData || []).filter((idx: any) => {
            if (effectiveOptions.excludeAuthSchema && idx.schema_name === 'auth') return false;
            if (effectiveOptions.excludeStorageSchema && idx.schema_name === 'storage') return false;
            return true;
          });
          if (filtered.length > 0) {
            sqlContent += generateIndexStatements(filtered);
            logLines.push(`Exported ${filtered.length} indexes`);
          }
        } catch (err: any) {
          warningMessages.push(`Index export skipped or failed: ${err?.message || String(err)}`);
        }
      }
      
      if (cancelRef.current) throw new Error('Export cancelled');
      
      // 9. RLS (optional)
      if (effectiveOptions.includeRls && categories.rlsPolicies) {
        updateProgress('RLS', 92, 'Adding RLS policies...');
        try {
          const { data: rlsData } = await scopedDb.rpc("get_table_rls_policies");
          const rlsTables = baseTables.filter((t: any) => t.rls_enabled);
          if ((rlsData && rlsData.length > 0) || rlsTables.length > 0) {
            sqlContent += generateRlsStatements(rlsTables, rlsData || []);
            logLines.push(
              `Exported RLS for ${rlsTables.length} tables and ${rlsData ? rlsData.length : 0} policies`
            );
          }
        } catch (err: any) {
          warningMessages.push(`RLS export skipped or failed: ${err?.message || String(err)}`);
        }
      }
      if (categories.edgeFunctions) {
        warningMessages.push("Edge functions are not included in pg_dump SQL; manage via Supabase CLI.");
      }
      if (categories.secrets) {
        warningMessages.push("Secrets (Vault) are not included in pg_dump SQL; manage via Vault tooling.");
      }
      
      updateProgress('Validating', 96, 'Validating SQL syntax...');
      sqlContent += generatePgDumpFooter();
      logLines.push('Appended pg_dump-compatible footer');

      // Comprehensive SQL validation with auto-repair
      const fullSql = sqlContent;
      const validationResult = validateAndRepairSql(fullSql);
      
      // Also validate data SQL separately
      const dataValidation = validateSQL(dataSql, 'pg_dump_export_data', false);
      
      const allErrors = [...validationResult.errors, ...dataValidation];
      if (allErrors.length > 0) {
        allErrors.forEach(e => warningMessages.push(e));
      }
      
      if (allErrors.length > 0) {
        console.warn('pg_dump export validation warnings:', allErrors);
        
        // Attempt auto-repair
        updateProgress('Repairing', 97, 'Attempting to repair SQL issues...');
        const { repairedSql, repairs } = repairSqlSyntax(fullSql);
        
        if (repairs.length > 0) {
          console.log('Applied SQL repairs:', repairs);
          sqlContent = repairedSql;
          
          // Re-validate after repair
          const revalidation = validateAndRepairSql(sqlContent);
          if (revalidation.errors.length > 0) {
            console.error('Errors remain after repair:', revalidation.errors);
            revalidation.errors.forEach(e => errorMessages.push(e));
            toast.warning('Export completed with warnings', {
              description: `${revalidation.errors.length} syntax issues could not be auto-repaired. The file may need manual review.`
            });
          } else {
            toast.success('SQL issues auto-repaired', {
              description: `Fixed ${repairs.length} syntax issue(s)`
            });
          }
        } else {
          // No repairs possible, warn but continue
          toast.warning('Export completed with warnings', {
            description: `${allErrors.length} potential issue(s) detected. Review the SQL file before import.`
          });
        }
      }

      const finalValidation = validateAndRepairSql(sqlContent);
      finalValidation.warnings.forEach(w => {
        if (!warningMessages.includes(w)) warningMessages.push(w);
      });
      finalValidation.errors.forEach(e => {
        if (!errorMessages.includes(e)) errorMessages.push(e);
      });

      const hasHeaderMarker = sqlContent.includes('-- PostgreSQL database dump');
      const hasFooterMarker = sqlContent.includes('-- PostgreSQL database dump complete');
      const hasBeginBlock = sqlContent.includes('\nBEGIN;\n');
      const hasCommitBlock = sqlContent.includes('\nCOMMIT;\n');

      const structureIssues: string[] = [];
      if (!hasHeaderMarker) structureIssues.push('Missing standard pg_dump header marker');
      if (!hasBeginBlock) structureIssues.push('Missing BEGIN transaction block');
      if (!hasCommitBlock) structureIssues.push('Missing COMMIT transaction block');
      if (!hasFooterMarker) structureIssues.push('Missing standard pg_dump footer marker');

      if (structureIssues.length > 0) {
        structureIssues.forEach(m => warningMessages.push(m));
      }

      const isCompatible =
        finalValidation.errors.length === 0 &&
        structureIssues.length === 0;

      updateProgress('Complete', 100, 'Preparing download...');
      const finishedAt = new Date();
      const timestamp = finishedAt.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `database_export_${timestamp}.sql`;
      
      const success = await downloadSqlFile(sqlContent, filename);
      
      if (success) {
        setLastExportFilename(filename);
        setShowInstructions(true);
        toast.success('Export complete!', {
          description: `Generated ${(sqlContent.length / 1024).toFixed(1)} KB SQL file`
        });

        const checksum = calculateChecksum(sqlContent);
        logLines.push(`Export finished at ${finishedAt.toISOString()}`);
        logLines.push(`Output file: ${filename}`);
        logLines.push(`Output size (bytes): ${sqlContent.length}`);
        logLines.push(`Checksum: ${checksum}`);
        logLines.push(`Total rows exported: ${totalRowsExported}`);

        if (objectSummaries.length > 0) {
          logLines.push('');
          logLines.push('Exported objects:');
          objectSummaries.forEach(line => logLines.push(line));
        }

        if (warningMessages.length > 0) {
          logLines.push('');
          logLines.push('Warnings:');
          warningMessages.forEach(w => logLines.push(w));
        }

        if (errorMessages.length > 0) {
          logLines.push('');
          logLines.push('Errors:');
          errorMessages.forEach(e => logLines.push(e));
        }

        logLines.push('');
        logLines.push(
          isCompatible
            ? 'Compatibility test with psql -f: PASSED (no validation errors detected)'
            : 'Compatibility test with psql -f: FAILED (validation errors detected; manual review recommended)'
        );

        const logFilename = `database_export_${timestamp}.log`;
        const logContent = logLines.join('\n');
        await downloadTextFile(logContent, logFilename);
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
  }, [scopedDb, options, categories, general]);

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
          
          {!permissionOk && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Insufficient Permissions</AlertTitle>
              <AlertDescription>
                You do not have permission to perform export operations.
              </AlertDescription>
            </Alert>
          )}
          
          {permissionOk && connectionOk === false && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Connection Error</AlertTitle>
              <AlertDescription>
                Could not verify database connection. Check environment and try again.
              </AlertDescription>
            </Alert>
          )}
          
          {permissionOk && connectionOk && (
            <PgDumpOptionsPanel
              categories={categories}
              general={general}
              onChangeCategories={setCategories}
              onChangeGeneral={setGeneral}
            />
          )}
          
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
              <Button onClick={runExport} className="gap-2" disabled={!permissionOk || !connectionOk}>
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
