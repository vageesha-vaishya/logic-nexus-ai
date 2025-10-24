// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
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

  const exportDatabaseDump = async () => {
    setLoading(true);
    try {
      const promises: Promise<any>[] = [];
      
      // Fetch schema, functions, enums, RLS policies
      promises.push(
        supabase.rpc("get_database_schema"),
        supabase.rpc("get_database_functions"),
        supabase.rpc("get_database_enums"),
        supabase.rpc("get_rls_policies"),
        supabase.rpc("get_table_constraints"),
        supabase.rpc("get_table_indexes")
      );
      
      const [schemaRes, functionsRes, enumsRes, rlsRes, constraintsRes, indexesRes] = await Promise.all(promises);
      
      if (schemaRes.error) throw schemaRes.error;
      if (functionsRes.error) throw functionsRes.error;
      if (enumsRes.error) throw enumsRes.error;
      if (rlsRes.error) throw rlsRes.error;
      
      let sqlDump = `-- Complete Database Dump\n-- Generated: ${new Date().toISOString()}\n\n`;
      
      // Export enums
      sqlDump += `-- ENUMS\n`;
      (enumsRes.data || []).forEach((e: any) => {
        sqlDump += `CREATE TYPE ${e.enum_type} AS ENUM (${e.labels.split(', ').map((l: string) => `'${l}'`).join(', ')});\n`;
      });
      sqlDump += `\n`;
      
      // Export tables
      sqlDump += `-- TABLES\n`;
      const tablesByName: Record<string, any[]> = {};
      (schemaRes.data || []).forEach((col: any) => {
        if (!tablesByName[col.table_name]) tablesByName[col.table_name] = [];
        tablesByName[col.table_name].push(col);
      });
      
      for (const [tableName, columns] of Object.entries(tablesByName)) {
        sqlDump += `CREATE TABLE ${tableName} (\n`;
        sqlDump += columns.map((col: any) => {
          let line = `  ${col.column_name} ${col.data_type}`;
          if (!col.is_nullable) line += ' NOT NULL';
          if (col.column_default) line += ` DEFAULT ${col.column_default}`;
          return line;
        }).join(',\n');
        sqlDump += `\n);\n\n`;
      }
      
      // Export constraints
      sqlDump += `-- CONSTRAINTS\n`;
      (constraintsRes.data || []).forEach((c: any) => {
        sqlDump += `ALTER TABLE ${c.table_name} ADD CONSTRAINT ${c.constraint_name} ${c.constraint_type} (${c.constraint_details});\n`;
      });
      sqlDump += `\n`;
      
      // Export indexes
      sqlDump += `-- INDEXES\n`;
      (indexesRes.data || []).forEach((idx: any) => {
        sqlDump += `${idx.index_definition};\n`;
      });
      sqlDump += `\n`;
      
      // Export table data
      sqlDump += `-- TABLE DATA\n`;
      for (const tableName of Object.keys(tablesByName)) {
        const { data, error } = await supabase.from(tableName).select("*");
        if (!error && data && data.length > 0) {
          sqlDump += `-- Data for ${tableName}\n`;
          data.forEach((row: any) => {
            const cols = Object.keys(row).join(', ');
            const vals = Object.values(row).map(v => {
              if (v === null) return 'NULL';
              if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
              if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
              return v;
            }).join(', ');
            sqlDump += `INSERT INTO ${tableName} (${cols}) VALUES (${vals});\n`;
          });
          sqlDump += `\n`;
        }
      }
      
      // Export functions
      sqlDump += `-- FUNCTIONS\n`;
      (functionsRes.data || []).forEach((f: any) => {
        sqlDump += `-- Function: ${f.name}\n`;
        sqlDump += `-- Note: Function body not included in dump. Please export manually from database.\n\n`;
      });
      
      // Export RLS policies
      sqlDump += `-- RLS POLICIES\n`;
      (rlsRes.data || []).forEach((p: any) => {
        sqlDump += `CREATE POLICY "${p.policy_name}" ON ${p.table_name} FOR ${p.command} USING (${p.using_expression});\n`;
      });
      
      downloadFile("database-dump.sql", sqlDump, "text/plain");
      toast.success("Database dump exported", { description: "Complete SQL dump has been downloaded." });
    } catch (e: any) {
      toast.error("Database dump failed", { description: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Database Export</CardTitle>
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
            <Button variant="outline" onClick={exportDatabaseDump} disabled={loading}>
              Export Complete DB Dump (SQL)
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
    </div>
  );
}
