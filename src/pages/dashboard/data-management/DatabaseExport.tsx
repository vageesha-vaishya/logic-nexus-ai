 import { useEffect, useMemo, useState, useRef } from "react";
import { useCRM } from "@/hooks/useCRM";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
 import { 
   Loader2, 
   Shield
 } from "lucide-react";
import Papa from "papaparse";
 import { toast } from "sonner";
 // import { BackupDownloader } from "@/components/admin/BackupDownloader";
 import { validateSQL, resolveDataTypeForValue, formatValue, calculateChecksum, generateManifest, DetailedProgress, calculateSchemaSignature } from "@/utils/dbExportUtils";
import { ExportProgressMeter } from "@/components/dashboard/data-management/ExportProgressMeter";
import { ExportCompletionDialog } from "@/components/dashboard/data-management/ExportCompletionDialog";
import ExportWorker from "@/workers/export.worker?worker";

type TableInfo = {
  schema_name: string;
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
  
  // Advanced Progress State
  const [progress, setProgress] = useState<DetailedProgress | null>(null);
  const [showProgressDetails, setShowProgressDetails] = useState(false);
  const [completionSummary, setCompletionSummary] = useState<any>(null);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  
  const pauseRef = useRef(false);
  const cancelRef = useRef(false);
  const workerRef = useRef<Worker | null>(null);

  const [query, setQuery] = useState("SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name LIMIT 50;");
  const [queryResult, setQueryResult] = useState<any[]>([]);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreMode, setRestoreMode] = useState<'insert' | 'upsert'>('upsert');
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
  
  // Export Configuration
  const [batchSize] = useState(1000);
  const [validateReservedWords] = useState(true);

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
  
  // Notification settings
  const [playSoundOnComplete, setPlaySoundOnComplete] = useState(false);

  const playSuccessSound = () => {
    if (!playSoundOnComplete) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
      setTimeout(() => {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
          gain2.gain.setValueAtTime(0.1, ctx.currentTime);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.2);
      }, 200);
    } catch (e) {
      console.error("Audio playback failed", e);
    }
  };

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
      // Try fetching from all schemas first
      let { data, error } = await scopedDb.rpc("get_all_database_tables");
      
      // Fallback to old method if new RPC doesn't exist yet
      if (error && (error.message.includes("function") || error.message.includes("does not exist"))) {
          console.warn("Enhanced export RPC not found, falling back to public schema only.");
          const res = await scopedDb.rpc("get_database_tables");
          data = (res.data || []).map((t: any) => ({ ...t, schema_name: 'public' }));
          error = res.error;
      }

      if (error) {
        toast.error("Failed to load tables", { description: error.message });
        return;
      }
      
      setTables(data || []);
      
      if (data) {
          console.log(`[DatabaseExport] Loaded ${data.length} relations.`);
      }

      const sel: Record<string, boolean> = {};
      (data || []).forEach((t: TableInfo) => (sel[`${t.schema_name}.${t.table_name}`] = true));
      setSelected(sel);
    };
    loadTables();
    
    // Load last backup timestamp from localStorage
    const lastBackup = localStorage.getItem('last_database_backup');
    if (lastBackup) {
      setLastBackupTime(lastBackup);
    }
  }, []);

  const allSelected = useMemo(() => tables.length > 0 && tables.every(t => selected[`${t.schema_name}.${t.table_name}`]), [tables, selected]);

  const toggleAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    tables.forEach(t => (next[`${t.schema_name}.${t.table_name}`] = checked));
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
    const chosen = tables.filter(t => selected[`${t.schema_name}.${t.table_name}`]);
    if (chosen.length === 0) {
      toast.message("No tables selected", { description: "Select at least one table to export." });
      return;
    }
    setLoading(true);
    try {
      const files: Array<{ name: string; content: string; type: string }> = [];
      for (const t of chosen) {
        let data: any[] = [];
        let error: any = null;

        if (t.schema_name === 'public') {
             const res = await (scopedDb.from(t.table_name as any).select("*") as any);
             data = res.data;
             error = res.error;
        } else if (t.schema_name === 'auth' && t.table_name === 'users') {
             const res = await scopedDb.rpc('get_auth_users_export');
             data = res.data;
             error = res.error;
        } else if (t.schema_name === 'storage' && t.table_name === 'objects') {
             const res = await scopedDb.rpc('get_storage_objects_export');
             data = res.data;
             error = res.error;
        } else {
             // Fallback to dynamic for extensions/others
             const res = await scopedDb.rpc('get_table_data_dynamic', { 
                 target_schema: t.schema_name, 
                 target_table: t.table_name,
                 offset_val: 0,
                 limit_val: 100000 // Limit for CSV export to prevent browser crash
             });
             data = res.data;
             error = res.error;
        }

        if (error) {
          toast.error(`Failed exporting ${t.schema_name}.${t.table_name}`, { description: error.message });
          continue;
        }
        const csv = Papa.unparse(data || []);
        files.push({ name: `${t.schema_name}_${t.table_name}.csv`, content: csv, type: "text/csv" });
      }
      await saveMultipleFiles(files);
      toast.success("Export complete", { description: "Downloaded CSVs for selected tables." });
    } catch (e: any) {
      toast.error("Export failed", { description: e.message || String(e) });
    } finally {
      setLoading(false);
      // Clear progress after a short delay
      setTimeout(() => setProgress(null), 3000);
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

  // Progress Helper Functions
  const updateProgress = (updates: Partial<DetailedProgress>) => {
    setProgress(prev => {
      if (!prev) return null;
      const now = Date.now();
      let eta = prev.estimatedTimeRemaining;
      
      // Calculate ETA if percent changed
      if (updates.percent !== undefined && updates.percent > prev.percent && updates.percent > 0) {
        const elapsed = (now - prev.startTime) / 1000;
        const rate = updates.percent / elapsed; // percent per second
        const remaining = 100 - updates.percent;
        eta = remaining / rate;
      }

      return { ...prev, ...updates, estimatedTimeRemaining: eta };
    });
  };

  const cancelExport = () => {
    cancelRef.current = true;
    if (progress) {
      setProgress({ ...progress, status: 'cancelled', message: 'Cancelling...' });
    }
  };

  const pauseExport = () => {
    pauseRef.current = true;
    if (progress) {
      setProgress({ ...progress, status: 'paused' });
    }
  };

  const resumeExport = () => {
    pauseRef.current = false;
    if (progress) {
      setProgress({ ...progress, status: 'running' });
    }
  };

  const exportSchemaSQL = async () => {
    const hasAnySelected = Object.values(exportOptions).some(v => v);
    if (!hasAnySelected) {
      toast.message("No components selected", { description: "Select at least one export option." });
      return;
    }

    setLoading(true);
    cancelRef.current = false;
    pauseRef.current = false;

    // Initialize Progress
    const initialProgress: DetailedProgress = {
      status: 'running',
      percent: 0,
      message: 'Starting export...',
      currentStep: 'Initialization',
      currentItem: '',
      processedItems: 0,
      totalItems: 0,
      startTime: Date.now(),
      estimatedTimeRemaining: null,
      logs: [{ timestamp: Date.now(), message: 'Export started', type: 'info' }],
      errors: []
    };
    setProgress(initialProgress);
    setShowProgressDetails(true);

    const summary: string[] = ["Database Export Summary", "=======================", `Date: ${new Date().toISOString()}`, ""];
    
    // Helper to check pause/cancel
    const checkStatus = async () => {
      if (cancelRef.current) throw new Error("Export cancelled by user");
      while (pauseRef.current) {
        await new Promise(r => setTimeout(r, 500));
        if (cancelRef.current) throw new Error("Export cancelled by user");
      }
    };

    const addLog = (message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info') => {
      setProgress(prev => prev ? ({
        ...prev,
        logs: [...prev.logs, { timestamp: Date.now(), message, type }]
      }) : null);
    };

    const updateStep = (step: string, percent: number) => {
      setProgress(prev => prev ? ({
        ...prev,
        currentStep: step,
        percent: Math.max(prev.percent, percent) // Monotonic increase
      }) : null);
    };

    try {
      await checkStatus();
      
      // Initialize Worker
      if (workerRef.current) workerRef.current.terminate();
      const worker = new ExportWorker();
      workerRef.current = worker;
      worker.postMessage({ type: 'INIT' });

      const addFileToZip = (name: string, content: string) => {
        worker.postMessage({ type: 'ADD_FILE', payload: { name, content } });
      };

      const validationErrors: string[] = [];
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const manifestTables: { name: string; rowCount: number; checksum: string; schemaSignature?: string }[] = [];
      const skippedTables: { name: string; reason: string }[] = [];
      const expectedCounts: Record<string, number> = {};
      
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

      // Phase 0: Pre-flight Verification
      if (exportOptions.tableData) {
        addLog('Starting Pre-flight Verification...', 'info');
        let chosen = tables.filter(t => selected[`${t.schema_name}.${t.table_name}`]);
        
        // Filter out secrets if not selected
        if (!exportOptions.secrets) {
            chosen = chosen.filter(t => t.schema_name !== 'vault');
        }
        // Only base tables have data exports
        chosen = chosen.filter(t => t.table_type === 'BASE TABLE');

        // Parallelize count checks for speed
         for (let i = 0; i < chosen.length; i++) {
            const t = chosen[i];
            let count = 0;
            let error: any = null;
            if (t.schema_name === 'public') {
              const res = await scopedDb.from(t.table_name as any).select('*', { count: 'exact', head: true });
              count = res.count || 0;
              error = res.error;
            } else {
              const res = await scopedDb.rpc('get_table_count', {
                target_schema: t.schema_name,
                target_table: t.table_name
              });
              if (res.error) {
                error = res.error;
              } else {
                count = (res.data as number) || 0;
              }
            }
            
            if (error) {
              addLog(`Pre-flight: Failed to verify count for ${t.schema_name}.${t.table_name}: ${error.message}`, 'error');
              validationErrors.push(`[Pre-flight] Count verification failed for ${t.schema_name}.${t.table_name}`);
            } else {
              expectedCounts[`${t.schema_name}.${t.table_name}`] = count;
              if (count > 0) {
                addLog(`Verified ${t.schema_name}.${t.table_name}: ${count} rows expected`);
              }
            }
         }
        addLog('Pre-flight Verification Completed', 'success');
      }

      // Calculate total steps and weights
      let totalDataRows = 0;
      if (exportOptions.tableData) {
         totalDataRows = Object.values(expectedCounts).reduce((a, b) => a + b, 0);
      }
      
      // Initialize progress totals
      setProgress(prev => prev ? ({ ...prev, totalItems: totalDataRows }) : null);

      // Assign work units
      let totalWorkUnits = 0;
      if (exportOptions.enums) totalWorkUnits += 100;
      if (exportOptions.schema) totalWorkUnits += 200;
      if (exportOptions.constraints) totalWorkUnits += 200; // PK + FK
      if (exportOptions.dbFunctions) totalWorkUnits += 100;
      if (exportOptions.indexes) totalWorkUnits += 100;
      if (exportOptions.rlsPolicies) totalWorkUnits += 50;
      if (exportOptions.edgeFunctions) totalWorkUnits += 100;
      
      // Give data export significant weight, but ensure it doesn't break if 0 rows
      // We scale data units to ensure it takes up appropriate visual space (e.g., 70-80% of bar if meaningful data exists)
      const dataUnits = exportOptions.tableData ? Math.max(2000, totalDataRows) : 0;
      totalWorkUnits += dataUnits;

      let currentWorkUnits = 0;
      let processedRowsTotal = 0;

      const advanceProgress = (units: number, message: string, stepName?: string) => {
        currentWorkUnits += units;
        const percent = Math.min(99, Math.round((currentWorkUnits / totalWorkUnits) * 100));
        updateStep(stepName || message, percent);
      };

      // 1. Enums / Types (001_enums.sql)
      if (exportOptions.enums) {
        await checkStatus();
        updateStep('Exporting Enums', Math.round((currentWorkUnits / totalWorkUnits) * 100));
        addLog('Fetching database enums...');
        
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
              validationErrors.push(...validateSQL(sql, 'Enums', validateReservedWords));
              addFileToZip("001_enums.sql", sql);
              summary.push(`- Enums: ${counts.enums} exported`);
              addLog(`Exported ${counts.enums} enums`, 'success');
          }
        } catch (err: any) {
          console.error("Error exporting enums:", err);
          summary.push(`- Enums: FAILED (${err.message})`);
          validationErrors.push(`[Enums] Export failed: ${err.message}`);
          addLog(`Failed to export enums: ${err.message}`, 'error');
        }
        advanceProgress(100, 'Enums exported');
      }

      // 2. Schema / Tables (002_tables.sql)
      if (exportOptions.schema) {
        await checkStatus();
        updateStep('Exporting Schema', Math.round((currentWorkUnits / totalWorkUnits) * 100));
        addLog('Fetching table schema...');

        try {
          // Use new RPC that supports all schemas
          const { data: schemaData, error } = await scopedDb.rpc("get_all_database_schema");
          
          // Fallback if new RPC not available
          if (error && (error.message.includes("function") || error.message.includes("does not exist"))) {
             console.warn("get_all_database_schema not found, falling back to public only");
             const { data: oldData, error: oldError } = await scopedDb.rpc("get_database_schema");
             if (oldError) throw oldError;
             // Adapt old data to new format (add schema_name = 'public')
             if (oldData) {
                 const adapted = oldData.map((d: any) => ({ ...d, schema_name: 'public' }));
                 // Proceed with adapted data
                 processSchemaData(adapted);
             }
          } else if (error) {
              throw error;
          } else {
              processSchemaData(schemaData);
          }

          function processSchemaData(data: any[]) {
            if (data && Array.isArray(data) && data.length > 0) {
                // Group by schema.table
                const tableGroups = data.reduce((acc: any, row: any) => {
                  const key = `${row.schema_name}.${row.table_name}`;
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(row);
                  return acc;
                }, {});
    
                const resolveColumnType = (col: any) => {
                  const dt = (col.data_type || '').toString();
                  // udt_name might not be in RPC result if not added, checking RPC...
                  // RPC returns: schema_name, table_name, column_name, data_type, is_nullable, column_default, is_primary_key, is_foreign_key...
                  // It seems udt_name is missing from get_all_database_schema. 
                  // But standard types are fine. Arrays might be issue. 
                  // If data_type is ARRAY, we might need more info. 
                  // For now, trust data_type.
                  if ((dt === 'character varying' || dt === 'varchar') && col.character_maximum_length) {
                    return `${dt}(${col.character_maximum_length})`;
                  }
                  return dt || 'text';
                };
    
                // Process BASE TABLES
                let tablesSql = "-- 002_tables.sql\n-- Tables Schema (Structure Only, No Constraints)\n\n";
                let viewsSql = "-- 002c_views.sql\n-- Views\n\n";
                let viewCount = 0;
                let tableCount = 0;
                
                // Track schemas to create
                const schemas = new Set<string>();
    
                Object.entries(tableGroups).forEach(([key, columns]: [string, any]) => {
                  const firstCol = (columns as any[])[0];
                  const schemaName = firstCol.schema_name;
                  const tableName = firstCol.table_name;
                  
                  if (schemaName !== 'public') {
                      schemas.add(schemaName);
                  }
    
                  // Heuristic: check if any row for this table has table_type = 'VIEW'
                  // The RPC doesn't return table_type directly, we rely on is_view logic or just assume table
                  // If we want to detect views, we might need another RPC or check table list.
                  // For now, assume everything is a table unless we know otherwise.
                  // We can check 'tables' state if we have it.
                  const tableInfo = tables.find(t => t.schema_name === schemaName && t.table_name === tableName);
                  const isView = tableInfo?.table_type === 'VIEW';
                  
                  if (isView) {
                      viewsSql += `CREATE OR REPLACE VIEW "${schemaName}"."${tableName}" AS\n`;
                      viewsSql += `-- View definition not available in standard schema export\n`; 
                      viewsSql += `-- Please ensure views are exported separately or use pg_dump.\n\n`;
                      viewCount++;
                  } else {
                      tablesSql += `CREATE TABLE IF NOT EXISTS "${schemaName}"."${tableName}" (\n`;
                      const seen = new Set<string>();
                      // Deduplicate columns (joins might cause dupes if multiple constraints? no, group by column_name)
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
                      tablesSql += columnDefs.join(',\n') + '\n);\n\n';
                      tableCount++;
                      
                      // Calculate Schema Signature for manifest
                      const signature = calculateSchemaSignature(uniqueCols);
                      const manifestEntry = manifestTables.find(m => m.name === key);
                      if (manifestEntry) {
                          manifestEntry.schemaSignature = signature;
                      } else {
                          // If table had no data, it might not be in manifestTables yet (if we iterate tables logic differently)
                          // But manifestTables is populated in Phase 0? No, Phase 0 only checks counts.
                          // manifestTables is populated... wait, where? 
                          // It seems it wasn't populated in previous code for Schema export. 
                          // We should populate it here if missing.
                          manifestTables.push({
                              name: key,
                              rowCount: expectedCounts[key] || 0, 
                              checksum: '', // calculated during data export
                              schemaSignature: signature
                          });
                      }
                  }
                });
                
                // Add Schema Creation SQL
                if (schemas.size > 0) {
                    let schemaSql = "-- 000_schemas.sql\n\n";
                    schemas.forEach(s => {
                        schemaSql += `CREATE SCHEMA IF NOT EXISTS "${s}";\n`;
                    });
                    addFileToZip("000_schemas.sql", schemaSql);
                }
                
                if (tableCount > 0) {
                    validationErrors.push(...validateSQL(tablesSql, 'Tables', validateReservedWords));
                    addFileToZip("002_tables.sql", tablesSql);
                    summary.push(`- Tables: ${tableCount} exported`);
                    counts.tables = tableCount;
                    addLog(`Exported schema for ${tableCount} tables`, 'success');
                }
                
                if (viewCount > 0) {
                    summary.push(`- Views: ${viewCount} detected (Definition export not supported via this method)`);
                }
            }
          }
        } catch (err: any) {
          console.error("Error exporting tables:", err);
          summary.push(`- Tables: FAILED (${err.message})`);
          validationErrors.push(`[Tables] Export failed: ${err.message}`);
          addLog(`Failed to export tables: ${err.message}`, 'error');
        }
        advanceProgress(200, 'Schema exported');
      }

      // 2b. Primary Keys & Unique (002b_primary_keys.sql)
      if (exportOptions.constraints) {
        await checkStatus();
        advanceProgress(0, 'Starting Primary Keys export...', 'Exporting Primary Keys');
        
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
                sql += `ALTER TABLE "${constraint.schema_name}"."${constraint.table_name}" ADD CONSTRAINT "${constraint.constraint_name}" ${details};\n`;
                count++;
              }
            });
            if (count > 0) {
                validationErrors.push(...validateSQL(sql, 'Primary Keys', validateReservedWords));
                addFileToZip("002b_primary_keys.sql", sql);
                summary.push(`- Primary Keys & Unique: ${count} exported`);
                counts.constraints += count;
                addLog(`Exported ${count} primary keys/unique constraints`, 'success');
            }
          }
        } catch (err: any) {
          console.error("Error exporting primary keys:", err);
          summary.push(`- Primary Keys: FAILED (${err.message})`);
          validationErrors.push(`[Primary Keys] Export failed: ${err.message}`);
          addLog(`Failed to export primary keys: ${err.message}`, 'error');
        }
        advanceProgress(100, 'Primary Keys exported');
      }

      // 3. Database Functions (003_functions.sql)
      if (exportOptions.dbFunctions) {
        await checkStatus();
        advanceProgress(0, 'Starting Functions export...', 'Exporting Functions');
        
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
            validationErrors.push(...validateSQL(sql, 'Functions', validateReservedWords));
            addFileToZip("003_functions.sql", sql);
            summary.push(`- Functions: ${counts.functions} exported`);
            addLog(`Exported ${counts.functions} functions`, 'success');
          }
        } catch (err: any) {
          console.error("Error exporting functions:", err);
          summary.push(`- Functions: FAILED (${err.message})`);
          validationErrors.push(`[Functions] Export failed: ${err.message}`);
          addLog(`Failed to export functions: ${err.message}`, 'error');
        }
        advanceProgress(100, 'Functions exported');
      }

      // 4. Data (004_data_{tablename}.sql)
      if (exportOptions.tableData) {
        await checkStatus();
        advanceProgress(0, 'Starting Data export...', 'Exporting Data');
        
        try {
          let chosen = tables.filter(t => selected[`${t.schema_name}.${t.table_name}`]);
          if (!exportOptions.secrets) {
              chosen = chosen.filter(t => t.schema_name !== 'vault');
          }
          // Skip views/materialized views for data export
          chosen = chosen.filter(t => t.table_type === 'BASE TABLE');

          if (chosen.length > 0) {
              
              // Helper to get schema info for type formatting
              const { data: schemaData, error: schemaError } = await scopedDb.rpc("get_all_database_schema");
              if (schemaError) throw schemaError;
              
              const typeMapByTable: Record<string, Record<string, string>> = (schemaData || []).reduce(
                (acc: Record<string, Record<string, string>>, col: any) => {
                  const key = `${col.schema_name}.${col.table_name}`;
                  if (!acc[key]) acc[key] = {};
                  acc[key][col.column_name] = resolveDataTypeForValue(col);
                  return acc;
                },
                {}
              );
              
              let totalRowsExported = 0;
              let exportedTablesCount = 0;

              for (let i = 0; i < chosen.length; i++) {
                  await checkStatus();
                  const table = chosen[i];
                  let tableFailed = false;
                  
                  updateProgress({ 
                      message: `Exporting data for ${table.table_name}...`, 
                      currentItem: table.table_name,
                      processedItems: processedRowsTotal
                  });
                  addLog(`Exporting table ${table.table_name}...`);
                  
                  let tableSql = `-- 004_data_${table.table_name}.sql\n-- Table Data for ${table.table_name}\n\n`;
                  let offset = 0;
                  let hasData = false;
                  let tableRows = 0;
                  let tableChecksumStr = "";
                  
                  while (true) {
                      await checkStatus();
                      
                      let data: any[] = [];
                      let error: any = null;

                      if (table.schema_name === 'public') {
                          const res = await (scopedDb.from(table.table_name as any)
                              .select("*")
                              .range(offset, offset + batchSize - 1) as any);
                          data = res.data;
                          error = res.error;
                      } else if (table.schema_name === 'auth' && table.table_name === 'users') {
                          // Auth users export usually returns all users at once
                          if (offset === 0) {
                              const res = await scopedDb.rpc('get_auth_users_export');
                              data = res.data;
                              error = res.error;
                          } else {
                              data = [];
                          }
                      } else if (table.schema_name === 'storage' && table.table_name === 'objects') {
                          // Storage objects export usually returns all objects at once
                          if (offset === 0) {
                              const res = await scopedDb.rpc('get_storage_objects_export');
                              data = res.data;
                              error = res.error;
                          } else {
                              data = [];
                          }
                      } else {
                          // Fallback to dynamic for others (extensions, etc.)
                          const res = await scopedDb.rpc('get_table_data_dynamic', { 
                              target_schema: table.schema_name, 
                              target_table: table.table_name,
                              offset_val: offset,
                              limit_val: batchSize
                          });
                          data = res.data;
                          error = res.error;
                      }
                          
                      if (error) {
                          console.error(`Failed exporting ${table.table_name} (offset ${offset}):`, error.message);
                          summary.push(`  - Table ${table.table_name}: Partial/Failed (${error.message})`);
                          validationErrors.push(`[Data: ${table.table_name}] Batch failed: ${error.message}`);
                          skippedTables.push({ name: table.table_name, reason: error.message });
                          addLog(`Error exporting batch for ${table.table_name}: ${error.message}`, 'error');
                          tableFailed = true;
                          break; 
                      }
                      
                      if (!data || data.length === 0) break;
                      
                      hasData = true;
                      const colTypes = typeMapByTable[`${table.schema_name}.${table.table_name}`] || {};
                      // If first batch, determine columns from data if schema missing (fallback)
                      const columns = Object.keys(colTypes).length > 0 ? Object.keys(colTypes) : Object.keys(data[0]);
                      const columnNames = columns.map((col) => `"${col}"`).join(", ");
                      
                      const fqn = `"${table.schema_name}"."${table.table_name}"`;
                      data.forEach((row: any) => {
                          // Simple checksum calculation on raw data
                          tableChecksumStr += JSON.stringify(row);
                          
                          const values = columns.map((col) => formatValue(row[col], colTypes[col])).join(", ");
                          tableSql += `INSERT INTO ${fqn} (${columnNames}) VALUES (${values});\n`;
                          totalRowsExported++;
                          tableRows++;
                          processedRowsTotal++;
                      });

                      // Update progress per batch
                      advanceProgress(data.length, `Exporting data for ${table.table_name}`, 'Exporting Table Data');
                      
                      offset += batchSize;
                      // Yield to event loop to avoid freezing UI
                      await new Promise(r => setTimeout(r, 0)); 
                  }
                  
                  // Verification Step
                  const checksum = calculateChecksum(tableChecksumStr);
                  const expected = expectedCounts[`${table.schema_name}.${table.table_name}`];
                  
                  if (hasData) {
                      validationErrors.push(...validateSQL(tableSql, `Data: ${table.table_name}`, validateReservedWords));
                      addFileToZip(`004_data_${table.table_name}.sql`, tableSql);
                      exportedTablesCount++;
                      
                      // Check count
                      if (expected !== undefined && tableRows !== expected) {
                         const msg = `Data mismatch for ${table.table_name}: Expected ${expected}, got ${tableRows}`;
                         validationErrors.push(`[Verification] ${msg}`);
                         summary.push(`- ${table.table_name}: VERIFICATION FAILED (${tableRows}/${expected})`);
                         addLog(msg, 'error');
                      } else {
                         addLog(`Exported ${tableRows} rows from ${table.table_name} (Verified)`, 'success');
                      }
                  } else {
                      if (expected > 0) {
                         const msg = `Data mismatch for ${table.table_name}: Expected ${expected}, got 0`;
                         validationErrors.push(`[Verification] ${msg}`);
                         addLog(msg, 'error');
                      } else {
                         addLog(`Table ${table.table_name} is empty`, 'info');
                      }
                  }
                  
                  manifestTables.push({
                      name: `${table.schema_name}.${table.table_name}`,
                      rowCount: tableRows,
                      checksum
                  });
              }
              counts.data_rows = totalRowsExported;
              summary.push(`- Data: ${counts.data_rows} rows exported across ${chosen.length} tables`);
              summary.push(`- Tables Exported (data files): ${exportedTablesCount}/${chosen.length}`);
          }
        } catch (err: any) {
          console.error("Error exporting data:", err);
          summary.push(`- Data: FAILED (${err.message})`);
          validationErrors.push(`[Data] Export failed: ${err.message}`);
          addLog(`Failed to export data: ${err.message}`, 'error');
        }
      }

      // 5. Indexes (005_indexes.sql)
      if (exportOptions.indexes) {
        await checkStatus();
        advanceProgress(0, 'Starting Indexes export...', 'Exporting Indexes');
        
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
            validationErrors.push(...validateSQL(sql, 'Indexes', validateReservedWords));
            addFileToZip("005_indexes.sql", sql);
            summary.push(`- Indexes: ${counts.indexes} exported`);
            addLog(`Exported ${counts.indexes} indexes`, 'success');
          }
        } catch (err: any) {
          console.error("Error exporting indexes:", err);
          summary.push(`- Indexes: FAILED (${err.message})`);
          validationErrors.push(`[Indexes] Export failed: ${err.message}`);
          addLog(`Failed to export indexes: ${err.message}`, 'error');
        }
        advanceProgress(100, 'Indexes exported');
      }

      // 6. Foreign Keys & Checks (006_foreign_keys.sql)
      if (exportOptions.constraints) {
        await checkStatus();
        advanceProgress(0, 'Starting Foreign Keys export...', 'Exporting Foreign Keys');
        
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
                sql += `ALTER TABLE "${constraint.schema_name}"."${constraint.table_name}" ADD CONSTRAINT "${constraint.constraint_name}" ${details};\n`;
                count++;
              }
            });
            if (count > 0) {
                validationErrors.push(...validateSQL(sql, 'Foreign Keys', validateReservedWords));
                addFileToZip("006_foreign_keys.sql", sql);
                summary.push(`- Foreign Keys & Checks: ${count} exported`);
                counts.constraints += count;
                addLog(`Exported ${count} foreign keys/check constraints`, 'success');
            }
          }
        } catch (err: any) {
          console.error("Error exporting foreign keys:", err);
          summary.push(`- Foreign Keys: FAILED (${err.message})`);
          validationErrors.push(`[Foreign Keys] Export failed: ${err.message}`);
          addLog(`Failed to export foreign keys: ${err.message}`, 'error');
        }
        advanceProgress(100, 'Foreign Keys exported');
      }

      // 7. RLS Policies (007_rls_policies.sql)
      if (exportOptions.rlsPolicies) {
        await checkStatus();
        advanceProgress(0, 'Starting RLS Policies export...', 'Exporting RLS Policies');
        
        try {
          const { data: policiesData, error } = await scopedDb.rpc("get_rls_policies");
          if (error) throw error;
          
          if (policiesData && Array.isArray(policiesData) && policiesData.length > 0) {
            let sql = "-- 007_rls_policies.sql\n-- Row Level Security Policies\n\n";
            const tableGroups = policiesData.reduce((acc: any, policy: any) => {
              const key = `${policy.schema_name}.${policy.table_name}`;
              if (!acc[key]) {
                acc[key] = { schema: policy.schema_name, table: policy.table_name, policies: [] };
              }
              acc[key].policies.push(policy);
              return acc;
            }, {});

            Object.values(tableGroups).forEach((group: any) => {
              const { schema, table, policies } = group;
              const fqn = `"${schema}"."${table}"`;
              
              sql += `\n-- Enable RLS on ${schema}.${table}\n`;
              sql += `ALTER TABLE ${fqn} ENABLE ROW LEVEL SECURITY;\n`;
              
              policies.forEach((policy: any) => {
                sql += `CREATE POLICY "${policy.policy_name}" ON ${fqn}\n`;
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
            validationErrors.push(...validateSQL(sql, 'RLS Policies', validateReservedWords));
            addFileToZip("007_rls_policies.sql", sql);
            summary.push(`- RLS Policies: ${counts.policies} exported`);
            addLog(`Exported ${counts.policies} RLS policies`, 'success');
          }
        } catch (err: any) {
          console.error("Error exporting RLS policies:", err);
          summary.push(`- RLS Policies: FAILED (${err.message})`);
          validationErrors.push(`[RLS Policies] Export failed: ${err.message}`);
          addLog(`Failed to export RLS policies: ${err.message}`, 'error');
        }
        advanceProgress(50, 'RLS Policies exported');
      }

      // 8. Edge Functions (008_edge_functions.json)
      if (exportOptions.edgeFunctions || exportOptions.secrets) {
        await checkStatus();
        advanceProgress(0, 'Starting Edge Functions export...', 'Exporting Edge Functions');
        
        try {
          const { data, error } = await scopedDb.client.functions.invoke("list-edge-functions");
          if (!error && data) {
              addFileToZip("008_edge_functions.json", JSON.stringify(data, null, 2));
              const funcCount = data.edge_functions ? data.edge_functions.length : 0;
              counts.edge_functions = funcCount;
              summary.push(`- Edge Functions: ${funcCount} exported`);
              addLog(`Exported ${funcCount} edge functions`, 'success');
          }
        } catch (err: any) {
          console.error("Error exporting edge functions:", err);
          summary.push(`- Edge Functions: FAILED (${err.message})`);
          // Don't fail the whole export for this
          addLog(`Failed to export edge functions: ${err.message}`, 'warning');
        }
        advanceProgress(100, 'Edge Functions exported');
      }

      // 9. Generate Manifest and Reports
      const manifest = generateManifest(
          manifestTables,
          counts.data_rows,
          validationErrors.length === 0 ? 'success' : 'partial',
          validationErrors
      );
      addFileToZip("manifest.json", JSON.stringify(manifest, null, 2));

      // Schema Signature Verification Report
      try {
        const { data: verifySchemaData, error: verifySchemaError } = await scopedDb.rpc("get_all_database_schema");
        if (!verifySchemaError && verifySchemaData) {
          const grouped: Record<string, any[]> = {};
          (verifySchemaData as any[]).forEach((col: any) => {
            const key = `${col.schema_name}.${col.table_name}`;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(col);
          });
          const signatureMap: Record<string, string> = {};
          Object.entries(grouped).forEach(([key, cols]) => {
            signatureMap[key] = calculateSchemaSignature(cols);
          });
          
          const sigReport: string[] = ["Schema Signature Verification", "============================", ""];
          let mismatches = 0;
          manifestTables.forEach((m) => {
            const currentSig = signatureMap[m.name];
            if (m.schemaSignature && currentSig && m.schemaSignature !== currentSig) {
              mismatches++;
              sigReport.push(`- ${m.name}: MISMATCH (manifest=${m.schemaSignature}, current=${currentSig})`);
            }
          });
          if (mismatches === 0) {
            sigReport.push("All schema signatures match current database definitions.");
          } else {
            sigReport.unshift(`Mismatches: ${mismatches}`);
          }
          addFileToZip("schema_signature_verification.txt", sigReport.join("\n"));
          addLog('Schema signature verification completed', mismatches === 0 ? 'success' : 'warning');
        }
      } catch (sigErr: any) {
        addLog(`Schema signature verification failed: ${sigErr.message}`, 'warning');
      }

      // Skipped Tables Report
      if (skippedTables.length > 0) {
          summary.push("\nSKIPPED TABLES:");
          summary.push("===============");
          skippedTables.forEach(t => summary.push(`- ${t.name}: ${t.reason}`));
          summary.push("");
          addLog(`${skippedTables.length} tables were skipped/failed`, 'warning');
      }

      // Add Validation Report
      if (validationErrors.length > 0) {
          addFileToZip("validation_warnings.txt", "Validation Warnings:\n====================\n" + validationErrors.join("\n"));
          toast.warning("Export completed with validation warnings", { description: "Check validation_warnings.txt in the zip file." });
          summary.push("\nWARNING: Validation errors were found. See validation_warnings.txt.");
          addLog('Validation warnings found', 'warning');
      } else {
          summary.push("\nValidation: Passed (No syntax issues detected)");
          summary.push(`Manifest Generated: ${manifestTables.length} tables verified.`);
          addLog('Validation passed', 'success');
      }
      
      // Add Summary Report
      addFileToZip("export_summary.txt", summary.join("\n"));

      // Generate Zip
      updateStep('Finalizing Export', 99);
      addLog('Compressing files...');
      
      const content = await new Promise<Blob>((resolve, reject) => {
        worker.onmessage = (e) => {
          const { type, payload } = e.data;
          if (type === 'COMPLETE') {
            resolve(payload.blob);
          } else if (type === 'ERROR') {
            reject(new Error(payload.message));
          } else if (type === 'PROGRESS') {
             // Optional: Update progress based on zip compression
             // updateStep('Compressing...', Math.round(payload.percent));
          }
        };
        worker.postMessage({ type: 'GENERATE' });
      });
      
      let downloadUrl = '';
        const fileName = `database_export_${timestamp}.zip`;

        if (destination === 'cloud') {
          addLog('Uploading to cloud storage...');
          // Upload zip to cloud
          await saveToCloud(fileName, content, 'application/zip');
      } else {
          addLog('Starting download...');
          const url = URL.createObjectURL(content);
          downloadUrl = url;
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          a.click();
          // Clean up handled in dialog or timeout
          setTimeout(() => URL.revokeObjectURL(url), 60000); // Extended timeout
      }
      
      // Calculate duration
      const endTime = Date.now();
      const durationMs = endTime - initialProgress.startTime;
      const durationSec = Math.round(durationMs / 1000);
      const durationStr = durationSec > 60 
          ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s` 
          : `${durationSec}s`;

      setCompletionSummary({
          totalTables: counts.tables + counts.enums + counts.functions + counts.indexes + counts.constraints + counts.policies + counts.edge_functions, // Aggregate objects
          totalRows: counts.data_rows,
          errors: validationErrors,
          skipped: skippedTables,
          timestamp: new Date().toISOString(),
          duration: durationStr,
          fileName: fileName,
          downloadUrl: downloadUrl
      });
      
      setProgress(prev => prev ? ({ ...prev, percent: 100, status: 'completed', message: 'Export Completed Successfully!' }) : null);
      setShowCompletionDialog(true);
      toast.success("Database Exported Successfully");
      playSuccessSound();
    } catch (e: any) {
      if (e.message === "Export cancelled by user") {
        toast.info("Export cancelled");
        addLog('Export cancelled by user', 'warning');
        setProgress(prev => prev ? ({ ...prev, status: 'cancelled', message: 'Export Cancelled' }) : null);
      } else {
        toast.error("SQL Export failed", { description: e.message || String(e) });
        addLog(`Export failed: ${e.message}`, 'error');
        setProgress(prev => prev ? ({ ...prev, status: 'error', message: `Failed: ${e.message}` }) : null);
      }
    } finally {
      setLoading(false);
      cancelRef.current = false;
      pauseRef.current = false;
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
        let data: any[] = [];
        let error: any = null;
        
        // Use unique key for backup to avoid collisions
        const tableKey = `${table.schema_name}.${table.table_name}`;

        if (table.schema_name === 'public') {
             const res = await (scopedDb.from(table.table_name as any).select("*") as any);
             data = res.data;
             error = res.error;
        } else if (table.schema_name === 'auth' && table.table_name === 'users') {
             const res = await scopedDb.rpc('get_auth_users_export');
             data = res.data;
             error = res.error;
        } else if (table.schema_name === 'storage' && table.table_name === 'objects') {
             const res = await scopedDb.rpc('get_storage_objects_export');
             data = res.data;
             error = res.error;
        } else {
             // Fallback to dynamic for extensions/others
             const res = await scopedDb.rpc('get_table_data_dynamic', { 
                 target_schema: table.schema_name, 
                 target_table: table.table_name,
                 offset_val: 0,
                 limit_val: 100000 // Limit for JSON backup
             });
             data = res.data;
             error = res.error;
        }

        if (error) {
          console.error(`Failed to backup ${tableKey}:`, error.message);
          continue;
        }
        
        if (data && data.length > 0) {
            backup.tables[tableKey] = data;
        }
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
        let data: any[] = [];
        let error: any = null;
        const tableKey = `${table.schema_name}.${table.table_name}`;

        if (table.schema_name === 'public') {
             const res = await (scopedDb
               .from(table.table_name as any)
               .select("*")
               .or(`created_at.gte.${lastBackupTime},updated_at.gte.${lastBackupTime}`) as any);
             data = res.data;
             error = res.error;
        } else {
             // Use incremental RPC for non-public schemas
             // Note: This requires the table to have created_at or updated_at columns
             const res = await scopedDb.rpc('get_table_data_incremental', { 
                 target_schema: table.schema_name, 
                 target_table: table.table_name,
                 min_timestamp: lastBackupTime,
                 offset_val: 0,
                 limit_val: 100000 
             });
             data = res.data;
             error = res.error;
        }
        
        if (error) {
          // Don't fail completely on individual table errors, just log
          console.error(`Failed to backup ${tableKey}:`, error.message);
          continue;
        }
        
        if (data && data.length > 0) {
          backup.tables[tableKey] = data;
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

      // Fetch schema to identify Primary Keys for upsert
      const { data: schemaData } = await scopedDb.rpc("get_all_database_schema");
      const pkMap: Record<string, string[]> = {};
      
      if (schemaData) {
          schemaData.forEach((col: any) => {
              if (col.is_primary_key) {
                  const key = `${col.schema_name}.${col.table_name}`;
                  if (!pkMap[key]) pkMap[key] = [];
                  pkMap[key].push(col.column_name);
              }
          });
      }

      let totalRestored = 0;
      let errors = 0;

      for (const [key, records] of Object.entries(backup.tables)) {
        const recordsArray = records as any[];
        // Parse key which is "schema.table" or just "table" (legacy)
        const parts = key.split('.');
        const schema = parts.length > 1 ? parts[0] : 'public';
        const table = parts.length > 1 ? parts[1] : parts[0];
        const fullKey = `${schema}.${table}`;
        
        if (schema === 'public') {
             // Use scopedDb for public tables to respect tenant isolation
             const pks = pkMap[fullKey];
             const onConflict = pks && pks.length > 0 ? pks.join(',') : undefined;

             for (const record of recordsArray) {
               if (restoreMode === 'upsert') {
                 // If no PK found, upsert might fail or fallback to insert depending on DB, 
                 // but usually requires conflict target. If undefined, supabase-js might default or error.
                 // Safer to use 'id' as fallback if map is empty? Or just let it be undefined if library handles it.
                 // Actually, supabase-js upsert requires onConflict if not inferable?
                 // Let's use 'id' as fallback if nothing found, for backward compatibility.
                 const conflictTarget = onConflict || 'id';
                 
                 const { error } = await (scopedDb
                   .from(table as any)
                   .upsert(record, { onConflict: conflictTarget }) as any);
                 
                 if (error) {
                   console.error(`Error upserting to ${key}:`, error.message);
                   errors++;
                 } else {
                   totalRestored++;
                 }
               } else {
                 const { error } = await (scopedDb
                   .from(table as any)
                   .insert(record) as any);
                 
                 if (error) {
                   console.error(`Error inserting to ${key}:`, error.message);
                   errors++;
                 } else {
                   totalRestored++;
                 }
               }
             }
        } else {
             // Use RPC for non-public tables (auth, storage, etc.)
             // Batch process for efficiency
             const { data: rpcResult, error } = await scopedDb.rpc('restore_table_data', {
                 target_schema: schema,
                 target_table: table,
                 data: recordsArray,
                 mode: restoreMode,
                 conflict_target: pkMap[fullKey] || null
             });

             if (error) {
                 console.error(`Error restoring ${key}:`, error.message);
                 errors += recordsArray.length; // Count all as errors
             } else if (rpcResult) {
                 const res = rpcResult as any;
                 totalRestored += (res.success || 0);
                 errors += (res.failed || 0);
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
      {/* Completion Dialog */}
      {completionSummary && (
        <ExportCompletionDialog
          open={showCompletionDialog}
          onOpenChange={setShowCompletionDialog}
          summary={completionSummary}
          onDownload={() => {
             if (completionSummary.downloadUrl) {
                 const a = document.createElement("a");
                 a.href = completionSummary.downloadUrl;
                 a.download = completionSummary.fileName;
                 a.click();
             } else {
                 toast.error("Download link expired or unavailable.");
             }
          }}
          onCloudUpload={destination === 'device' ? async () => {
             toast.info("Please use the Save Settings to configure cloud upload.");
          } : undefined}
        />
      )}

      {/* Progress UI */}
      {progress && (
        <ExportProgressMeter
          progress={progress}
          onPause={pauseExport}
          onResume={resumeExport}
          onCancel={cancelExport}
          onRetry={exportSchemaSQL}
          onToggleDetails={() => setShowProgressDetails(!showProgressDetails)}
          showDetails={showProgressDetails}
        />
      )}

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
          
          <div className="flex items-center space-x-2 pt-2 border-t">
            <Checkbox 
              id="playSound" 
              checked={playSoundOnComplete} 
              onCheckedChange={(v: any) => setPlaySoundOnComplete(Boolean(v))} 
            />
            <Label htmlFor="playSound" className="text-sm cursor-pointer">Play sound on completion</Label>
          </div>
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
              <Label htmlFor="export-secrets" className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Secrets (Vault)
              </Label>
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
                      <TableHead>Type</TableHead>
                      <TableHead>Rows (est.)</TableHead>
                      <TableHead>Columns</TableHead>
                      <TableHead>Indexes</TableHead>
                      <TableHead>Policies</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tables.map((t) => (
                      <TableRow key={`${t.schema_name}.${t.table_name}`}>
                        <TableCell>
                          <Checkbox 
                            checked={!!selected[`${t.schema_name}.${t.table_name}`]} 
                            onCheckedChange={(v: any) => toggle(`${t.schema_name}.${t.table_name}`, Boolean(v))}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{t.table_name}</span>
                            {t.schema_name !== 'public' && (
                              <span className="text-xs text-muted-foreground">{t.schema_name}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            t.table_type === 'BASE TABLE' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                            t.table_type === 'VIEW' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                          }`}>
                            {t.table_type}
                          </span>
                        </TableCell>
                        <TableCell>{t.row_estimate >= 0 ? t.row_estimate.toLocaleString() : 'N/A'}</TableCell>
                        <TableCell>{t.column_count}</TableCell>
                        <TableCell>{t.index_count}</TableCell>
                        <TableCell>{t.policy_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          
          <div className="flex justify-end gap-2">
             <Button onClick={exportSchemaSQL} disabled={loading}>
               {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
               Export SQL Dump
             </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Run SQL Query</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            className="font-mono text-sm h-[150px]"
            placeholder="SELECT * FROM tables..." 
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={exportQueryCSV} disabled={!queryResult.length}>
              Export Result CSV
            </Button>
            <Button onClick={runQuery} disabled={loading}>
              Run Query
            </Button>
          </div>
          
          {queryResult.length > 0 && (
            <div className="border rounded-md max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {Object.keys(queryResult[0]).map((k) => (
                      <TableHead key={k}>{k}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queryResult.map((row, i) => (
                    <TableRow key={i}>
                      {Object.values(row).map((v: any, j) => (
                        <TableCell key={j} className="max-w-[200px] truncate">
                          {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
