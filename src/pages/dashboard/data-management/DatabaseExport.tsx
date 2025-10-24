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

  const exportSchemaMetadata = async () => {
    setLoading(true);
    try {
      const [schema, constraints, indexes, functionsList, policies, enums, edgeFunctionsResponse] = await Promise.all([
        supabase.rpc("get_database_schema"),
        supabase.rpc("get_table_constraints"),
        supabase.rpc("get_table_indexes"),
        supabase.rpc("get_database_functions"),
        supabase.rpc("get_rls_policies"),
        supabase.rpc("get_database_enums"),
        supabase.functions.invoke("list-edge-functions"),
      ]);

      const error = schema.error || constraints.error || indexes.error || functionsList.error || policies.error || enums.error;
      if (error) {
        throw new Error(error.message);
      }

      const edgeFunctionsData = edgeFunctionsResponse.data || { edge_functions: [], secrets: [] };

      const payload = {
        exported_at: new Date().toISOString(),
        tables,
        schema: schema.data,
        constraints: constraints.data,
        indexes: indexes.data,
        database_functions: functionsList.data,
        rls_policies: policies.data,
        enums: enums.data,
        edge_functions: edgeFunctionsData.edge_functions,
        secrets: edgeFunctionsData.secrets,
      };
      downloadFile("schema-metadata.json", JSON.stringify(payload, null, 2), "application/json");
      toast.success("Full schema exported", { description: "Includes DB functions, edge functions, and secrets list" });
    } catch (e: any) {
      toast.error("Schema export failed", { description: e.message || String(e) });
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Database Export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Select tables to export</div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Checkbox id="select-all" checked={allSelected} onCheckedChange={(v: any) => toggleAll(Boolean(v))} />
                <label htmlFor="select-all" className="text-sm">Select all</label>
              </div>
              <Button variant="outline" onClick={exportSelectedCSV} disabled={loading}>Export Selected as CSV</Button>
              <Button onClick={exportSchemaMetadata} disabled={loading}>Export Schema Metadata</Button>
            </div>
          </div>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Rows (est.)</TableHead>
                  <TableHead>RLS</TableHead>
                  <TableHead>Policies</TableHead>
                  <TableHead>Columns</TableHead>
                  <TableHead>Indexes</TableHead>
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
                    <TableCell>{t.column_count}</TableCell>
                    <TableCell>{t.index_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
