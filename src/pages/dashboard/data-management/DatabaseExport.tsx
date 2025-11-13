// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [restoreSource, setRestoreSource] = useState<'device' | 'cloud'>('device');
  const [restoreLogs, setRestoreLogs] = useState<Array<{ time: string; table: string; action: 'insert' | 'upsert'; status: 'success' | 'error'; message?: string }>>([]);
  const [restoreSummary, setRestoreSummary] = useState<{ restored: number; errors: number } | null>(null);
  // Restore (SQL inline helper)
  const [restoreDbUrl, setRestoreDbUrl] = useState<string>('');
  const [restoreInlineCommands, setRestoreInlineCommands] = useState<string | null>(null);
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
    views: true,
    materializedViews: true,
    triggers: true,
    edgeFunctions: true,
    secrets: true,
    tableData: true,
    fkOrderEnabled: true,
    dataChunkSize: 1000,
    splitDataGroups: false,
    dataGroupSize: 6,
    rowFilterWhere: '',
    logSkippedRows: 'file',
    columnRenameMap: {},
    skipUniqueConflicts: true,
    customDataSql: '',
    continuousRunOnError: false,
    retryDelayMs: 1000,
    maxRetries: 10,
  });

  // Storage settings
  const [destination, setDestination] = useState<'device' | 'cloud'>('device');
  const [conflictPolicy, setConflictPolicy] = useState<'ask' | 'overwrite' | 'rename'>('rename');
  const [cloudBasePath, setCloudBasePath] = useState<string>('db-exports');
  const [cloudRestorePath, setCloudRestorePath] = useState<string>('db-exports');
  const [cloudRestoreFiles, setCloudRestoreFiles] = useState<Array<{ name: string; id?: string; updated_at?: string; size?: number }>>([]);
  const [selectedCloudBackup, setSelectedCloudBackup] = useState<string | null>(null);
  const [runLocallyOpen, setRunLocallyOpen] = useState(false);
  const restoreDbUrlRef = useRef<HTMLInputElement | null>(null);
  // Supabase CLI wizard state
  const [cliOperation, setCliOperation] = useState<'backup' | 'restore'>('backup');
  const [cliPreset, setCliPreset] = useState<'full' | 'incremental'>('full');
  const [cliProjectRef, setCliProjectRef] = useState<string>('');
  const [cliDbUrl, setCliDbUrl] = useState<string>('');
  const [cliOutputFile, setCliOutputFile] = useState<string>('backup.sql');
  const [cliFormat, setCliFormat] = useState<'plain' | 'custom'>('custom');
  const [cliSchemaOnly, setCliSchemaOnly] = useState<boolean>(false);
  const [cliDataOnly, setCliDataOnly] = useState<boolean>(false);
  const [cliCommands, setCliCommands] = useState<string>('');
  const [cliLogs, setCliLogs] = useState<string>('');
  const [cliAnalysis, setCliAnalysis] = useState<{ errors: number; warnings: number; fatals: number } | null>(null);
  const [cliRunning, setCliRunning] = useState<boolean>(false);
  const [cliExitCode, setCliExitCode] = useState<number | null>(null);
  const [cliLastRunAt, setCliLastRunAt] = useState<string | null>(null);
  // CLI Wizard: local dump file upload + cloud staging
  const [cliDumpFile, setCliDumpFile] = useState<File | null>(null);
  const [cliCloudPath, setCliCloudPath] = useState<string>('db-exports');
  const [cliUploadedPath, setCliUploadedPath] = useState<string | null>(null);
  const [cliSignedTtl, setCliSignedTtl] = useState<number>(3600);
  const [cliActivity, setCliActivity] = useState<Array<{ time: string; action: string; message: string }>>([]);
  // Connection test state
  const [connTesting, setConnTesting] = useState<boolean>(false);
  const [connResult, setConnResult] = useState<{
    dns?: { ok: boolean; addresses: string[]; message: string };
    tcp?: { ok?: boolean; message: string };
    pooling?: boolean;
  } | null>(null);
  // Page organization
  const [dbTab, setDbTab] = useState<'overview' | 'backup' | 'restore' | 'cli' | 'downloads'>('overview');

  // Manual download queue for restricted iframes/browsers
  const [pendingDownloads, setPendingDownloads] = useState<Array<{ name: string; url: string }>>([]);
  const clearPendingDownloads = () => {
    try {
      pendingDownloads.forEach((d) => URL.revokeObjectURL(d.url));
    } catch {}
    setPendingDownloads([]);
  };
  // Global progress meter state
  const [progressActive, setProgressActive] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const startProgress = (label: string) => {
    setProgressActive(true);
    setProgressValue(0);
    setProgressLabel(label);
  };
  const updateProgress = (value: number, label?: string) => {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    setProgressValue(clamped);
    if (label) setProgressLabel(label);
  };
  const endProgress = () => {
    setProgressValue(100);
    // brief completion before hiding
    setTimeout(() => {
      setProgressActive(false);
      setProgressLabel('');
      setProgressValue(0);
    }, 700);
  };
  // Helper: detect file extension
  const getExtension = (name: string) => (name.split('.').pop() || '').toLowerCase();
  // Helper: generate inline restore commands for SQL/custom dumps
  const generateInlineRestoreCommands = (dbUrl: string, fileName: string) => {
    const ext = getExtension(fileName);
    const lines: string[] = [];
    if (ext === 'sql') {
      lines.push('# Plain SQL restore');
      lines.push(`psql "${dbUrl}" -v ON_ERROR_STOP=1 -f "${fileName}"`);
    } else {
      lines.push('# Custom dump restore');
      lines.push(`pg_restore --clean --if-exists --no-owner --no-privileges --dbname "${dbUrl}" "${fileName}"`);
    }
    return lines.join('\n');
  };
  // Helper: stage a Blob for manual download
  const stageDownloadBlob = (filename: string, blob: Blob) => {
    try {
      const url = URL.createObjectURL(blob);
      setPendingDownloads((prev) => [...prev, { name: filename, url }]);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      a.target = '_blank';
      a.click();
    } catch (e: any) {
      toast.error('Download failed', { description: e?.message || String(e) });
    }
  };

  // Upload a Blob to cloud storage (db-backups), honoring conflict policy
  const uploadBlobToCloud = async (filename: string, blob: Blob, type: string, basePath: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    const userFolder = user.id;
    const dir = (basePath || '').replace(/^\/+|\/+$/g, '');
    const fullPath = dir ? `${userFolder}/${dir}/${filename}` : `${userFolder}/${filename}`;
    const finalPath = await resolveConflictPath(fullPath);
    if (!finalPath) return null;
    const { error } = await supabase.storage.from('db-backups').upload(finalPath, blob, { upsert: conflictPolicy === 'overwrite' });
    if (error) throw error;
    return finalPath;
  };

  const createSignedUrlForPath = async (fullPath: string, expiresInSeconds = 3600) => {
    const { data, error } = await supabase.storage.from('db-backups').createSignedUrl(fullPath, expiresInSeconds);
    if (error) throw error;
    return data?.signedUrl as string;
  };

  const addCliActivity = (action: string, message: string) => {
    setCliActivity((prev) => [...prev, { time: new Date().toISOString(), action, message }]);
  };
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

  // Auto-generate inline restore commands when a cloud file is selected and DB URL is present
  useEffect(() => {
    if (restoreSource !== 'cloud') return;
    if (!selectedCloudBackup) {
      setRestoreInlineCommands(null);
      return;
    }
    const ext = getExtension(selectedCloudBackup);
    if (ext !== 'json' && restoreDbUrl.trim()) {
      setRestoreInlineCommands(generateInlineRestoreCommands(restoreDbUrl.trim(), selectedCloudBackup));
    } else {
      setRestoreInlineCommands(null);
    }
  }, [restoreSource, selectedCloudBackup, restoreDbUrl]);

const allSelected = useMemo(() => tables.length > 0 && tables.every(t => selected[t.table_name]), [tables, selected]);
const selectedCount = useMemo(() => Object.values(selected).filter(Boolean).length, [selected]);

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
    const { data } = await supabase.storage.from('db-backups').list(folder || undefined, { search: name });
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

  const saveToCloud = async (filename: string, content: string, type: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    const userFolder = user.id;
    const dir = (cloudBasePath || '').replace(/^\/+|\/+$/g, '');
    const fullPath = dir ? `${userFolder}/${dir}/${filename}` : `${userFolder}/${filename}`;
    const finalPath = await resolveConflictPath(fullPath);
    if (!finalPath) return;
    const blob = new Blob([content], { type });
    const { error } = await supabase.storage.from('db-backups').upload(finalPath, blob, { upsert: conflictPolicy === 'overwrite' });
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
                let i = 1;
                name = `${base} (${i})${ext}`;
              }
            } else {
              const dot = name.lastIndexOf('.');
              const base = dot > -1 ? name.slice(0, dot) : name;
              const ext = dot > -1 ? name.slice(dot) : '';
              let i = 1;
              name = `${base} (${i})${ext}`;
            }
          } catch {}
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

  // Cloud Restore helpers
  const resolveUserCloudFolder = async (base: string) => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) throw new Error('User not authenticated');
    const dir = (base || '').replace(/^\/+|\/+$/g, '');
    return dir ? `${uid}/${dir}` : `${uid}`;
  };

  const listCloudBackupsForRestore = async () => {
    try {
      startProgress('Listing cloud backups...');
      const folder = await resolveUserCloudFolder(cloudRestorePath);
      const { data, error } = await supabase.storage.from('db-backups').list(folder || undefined);
      if (error) throw error;
      setCloudRestoreFiles((data || []).map((o: any) => ({ name: o.name, id: o.id, updated_at: o.updated_at, size: o.size })));
      toast.success('Cloud backups listed', { description: `Found ${(data || []).length} file(s)` });
      endProgress();
    } catch (e: any) {
      console.error('Error listing cloud backups:', e?.message || e);
      toast.error('Failed to list cloud backups', { description: e?.message || String(e) });
      setCloudRestoreFiles([]);
      endProgress();
    }
  };

  const downloadCloudBackupAndRestore = async () => {
    if (!selectedCloudBackup) {
      toast.message('No cloud backup selected', { description: 'Select a file from the list to restore.' });
      return;
    }
    setLoading(true);
    try {
      startProgress('Downloading cloud backup...');
      const folder = await resolveUserCloudFolder(cloudRestorePath);
      const fullPath = `${folder}/${selectedCloudBackup}`;
      const { data, error } = await supabase.storage.from('db-backups').download(fullPath);
      if (error) throw error;
      updateProgress(50, 'Download complete');
      const ext = getExtension(selectedCloudBackup);
      if (ext !== 'json') {
        // Not a JSON backup; stage for download and guide to CLI restore
        stageDownloadBlob(selectedCloudBackup, data);
        setCliOperation('restore');
        setCliPreset('full');
        setCliFormat('custom');
        setCliOutputFile(selectedCloudBackup);
        toast.message('SQL dump not supported in app restore', {
          description: 'Downloaded the file. Use the CLI wizard below to run pg_restore/psql.',
        });
        endProgress();
        return;
      }
      updateProgress(60, 'Parsing backup...');
      const text = await data.text();
      let backup: any;
      try {
        backup = JSON.parse(text);
      } catch (parseErr: any) {
        throw new Error('Invalid backup file format: expected JSON');
      }
      endProgress();
      await applyRestoreFromBackup(backup);
      toast.success('Cloud restore completed');
    } catch (e: any) {
      console.error('Cloud restore failed:', e?.message || e);
      toast.error('Cloud restore failed', { description: e?.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  const downloadSelectedCloudFile = async () => {
    if (!selectedCloudBackup) {
      toast.message('No cloud backup selected', { description: 'Select a file from the list to download.' });
      return;
    }
    setLoading(true);
    try {
      startProgress('Downloading file...');
      const folder = await resolveUserCloudFolder(cloudRestorePath);
      const fullPath = `${folder}/${selectedCloudBackup}`;
      const { data, error } = await supabase.storage.from('db-backups').download(fullPath);
      if (error) throw error;
      stageDownloadBlob(selectedCloudBackup, data);
      toast.success('File downloaded', { description: selectedCloudBackup });
      endProgress();
    } catch (e: any) {
      console.error('Download failed:', e?.message || e);
      toast.error('Download failed', { description: e?.message || String(e) });
      endProgress();
    } finally {
      setLoading(false);
    }
  };

  // Supabase CLI Wizard: command generator and log analyzer
  // Helpers: parse Postgres URL, enforce SSL, and build preflight checks
  const parsePostgresUrl = (url: string) => {
    try {
      const normalized = url.replace(/^postgres:\/\//, 'postgresql://');
      const u = new URL(normalized);
      const protocol = u.protocol.replace(':', '');
      const host = u.hostname;
      const port = u.port ? Number(u.port) : undefined;
      const database = (u.pathname || '').replace(/^\//, '') || 'postgres';
      const user = u.username || 'postgres';
      const password = u.password || '';
      const params = Object.fromEntries(u.searchParams.entries());
      return { protocol, host, port, database, user, password, params, raw: normalized };
    } catch {
      return null;
    }
  };

  const ensureSslRequire = (url: string) => {
    const hasQuery = url.includes('?');
    const hasSslMode = /[?&]sslmode=/i.test(url);
    if (hasSslMode) return url;
    return hasQuery ? `${url}&sslmode=require` : `${url}?sslmode=require`;
  };

  const isSupabasePoolerHostname = (host?: string) => host ? /(pooler\.|aws-|gcp-).*supabase\.(co|com)$/i.test(host) : false;

  const buildPreflightCommands = (host?: string, port?: number) => {
    if (!host) return '';
    const p = port || 5432;
    return [
      `# DNS resolution`,
      `nslookup ${host} || host ${host}`,
      `\n# TCP connectivity`,
      `nc -vz ${host} ${p}`,
    ].join('\n');
  };
  const generateCliCommands = () => {
    const lines: string[] = [];
    const op = cliOperation;
    const projectRef = (cliProjectRef || '').trim();
    const dbUrl = (cliDbUrl || '').trim();
    const outFile = (cliOutputFile || '').trim();
    const ext = getExtension(outFile);
    if (!dbUrl) {
      toast.message('Database URL required', { description: 'Provide the DB connection string from Supabase project settings.' });
      return;
    }
    if (!outFile) {
      toast.message('Output file required', { description: 'Provide the output file path/name.' });
      return;
    }
    lines.push('# Prerequisites: Postgres tools (pg_dump/psql). Optional: Supabase CLI.');
    lines.push('');
    if (projectRef) {
      lines.push('# Link project (optional, for using CLI with project context)');
      lines.push(`supabase link --project-ref "${projectRef}"`);
      lines.push('');
    }
    if (op === 'backup') {
      const pgFormatArg = cliFormat === 'custom' ? '--format=custom' : '--format=plain';
      const isIncremental = cliPreset === 'incremental';
      const pgDataSchemaArg = isIncremental ? '--data-only' : (cliDataOnly ? '--data-only' : (cliSchemaOnly ? '--schema-only' : ''));
      // Recommended: full schema + data (or data-only for incremental) in a single file
      lines.push('# pg_dump (single file)');
      lines.push(`pg_dump "${dbUrl}" ${pgFormatArg} ${pgDataSchemaArg} --blobs --no-owner --no-privileges --file "${outFile}"`.trim());
      lines.push('');
      lines.push('# Supabase CLI (alternative)');
      const formatArg = cliFormat === 'custom' ? '--format custom' : '--format plain';
      const dataSchemaArg = isIncremental ? '--data-only' : (cliDataOnly ? '--data-only' : (cliSchemaOnly ? '--schema-only' : ''));
      lines.push(`supabase db dump --db-url "${dbUrl}" --file "${outFile}" ${formatArg} ${dataSchemaArg}`.trim());
      lines.push('');
      lines.push('# Verify file');
      lines.push(`ls -lh "${outFile}"`);
      if (!isIncremental) {
        lines.push('');
        lines.push('# Notes:');
        lines.push('- Custom format enables selective restores via pg_restore.');
        lines.push('- Excluding owner/privileges improves cross-environment restore safety.');
      }
    } else {
      const isIncremental = cliPreset === 'incremental';
      const parsed = parsePostgresUrl(dbUrl);
      const safeDbUrl = ensureSslRequire(dbUrl);
      const host = parsed?.host;
      const port = parsed?.port || 5432;
      const dockerEnvParts: string[] = [];
      if (host) dockerEnvParts.push(`-e PGHOST=\"${host}\"`);
      dockerEnvParts.push(`-e PGPORT=\"${port}\"`);
      if (parsed?.user) dockerEnvParts.push(`-e PGUSER=\"${parsed.user}\"`);
      if (parsed?.password) dockerEnvParts.push(`-e PGPASSWORD=\"${parsed.password}\"`);
      if (parsed?.database) dockerEnvParts.push(`-e PGDATABASE=\"${parsed.database}\"`);
      dockerEnvParts.push(`-e PGSSLMODE=\"require\"`);
      const dockerEnv = dockerEnvParts.join(' ');

      if (host) {
        lines.push('# Preflight checks (copy into your shell)');
        lines.push(buildPreflightCommands(host, port));
        lines.push('');
      }
      if (ext === 'sql') {
        // Plain SQL file: restores schema objects and table data via psql
        lines.push('# Restore plain SQL (schema objects + table data)');
        lines.push('# Note: schema-only or data-only selective restore requires a custom-format dump.');
        lines.push('# Local psql (requires Postgres.app or libpq)');
        lines.push(`psql "${safeDbUrl}" -v ON_ERROR_STOP=1 -f "${outFile}"`);
        lines.push('');
        lines.push('# Dockerized psql (no local installation needed)');
        lines.push(`docker run --rm ${dockerEnv} -v "$PWD:/mnt" postgres:16-alpine sh -lc 'psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 -f /mnt/${outFile}'`);
        lines.push('');
        if (parsed && isSupabasePoolerHostname(parsed.host)) {
          lines.push('# Note: pooling hosts may reject certain restore statements (PgBouncer). Prefer the Direct host.');
        }
      } else {
        if (!isIncremental) {
          // Full restore from custom dump
          lines.push('# Full restore: custom format with pg_restore');
          lines.push('# Local pg_restore');
          lines.push(`pg_restore --clean --if-exists --no-owner --no-privileges --dbname "${safeDbUrl}" "${outFile}"`);
          lines.push('');
          lines.push('# Plain SQL restore (alternative)');
          lines.push(`psql "${safeDbUrl}" -v ON_ERROR_STOP=1 -f "${outFile}"`);
          lines.push('');
          lines.push('# Dockerized pg_restore');
          lines.push(`docker run --rm ${dockerEnv} -v "$PWD:/mnt" postgres:16-alpine sh -lc 'pg_restore --clean --if-exists --no-owner --no-privileges -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" /mnt/${outFile}'`);
          if (parsed && isSupabasePoolerHostname(parsed.host)) {
            lines.push('');
            lines.push('# Note: pooling hosts may reject certain restore statements (PgBouncer). Prefer the Direct host.');
          }
        } else {
          // Incremental restore from custom dump
          lines.push('# Incremental restore (data-only)');
          lines.push('# Local pg_restore');
          lines.push(`pg_restore --data-only --no-owner --no-privileges -d "${safeDbUrl}" "${outFile}"`);
          lines.push('');
          lines.push('# Incremental restore (single table data)');
          lines.push(`pg_restore --data-only --table public.my_table -d "${safeDbUrl}" "${outFile}"`);
          lines.push('');
          lines.push('# Dockerized pg_restore (data-only)');
          lines.push(`docker run --rm ${dockerEnv} -v "$PWD:/mnt" postgres:16-alpine sh -lc 'pg_restore --data-only --no-owner --no-privileges -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" /mnt/${outFile}'`);
          if (parsed && isSupabasePoolerHostname(parsed.host)) {
            lines.push('');
            lines.push('# Note: pooling hosts may reject certain restore statements (PgBouncer). Prefer the Direct host.');
          }
        }
      }
    }
    setCliCommands(lines.join('\n'));
    toast.success('CLI commands generated');
  };

  // Generate a restore script that downloads a signed URL then restores
  const generateSignedRestoreScript = async () => {
    try {
      const dbUrl = (cliDbUrl || '').trim();
      if (!dbUrl) {
        toast.message('Database URL required', { description: 'Provide the DB connection string from Supabase project settings.' });
        return;
      }
      const uploadedPath = cliUploadedPath;
      if (!uploadedPath) {
        toast.message('No uploaded dump found', { description: 'Upload a dump via the file picker first.' });
        return;
      }
      startProgress('Generating signed restore script...');
      const ttl = Number(cliSignedTtl) > 0 ? Number(cliSignedTtl) : 3600;
      const signed = await createSignedUrlForPath(uploadedPath, ttl);
      const filename = uploadedPath.split('/').pop() || 'dump.file';
      const ext = getExtension(filename);
      const localFile = filename;
      const parsed = parsePostgresUrl(dbUrl);
      const safeDbUrl = ensureSslRequire(dbUrl);
      const host = parsed?.host;
      const port = parsed?.port || 5432;
      const dockerEnvParts: string[] = [];
      if (host) dockerEnvParts.push(`-e PGHOST=\"${host}\"`);
      dockerEnvParts.push(`-e PGPORT=\"${port}\"`);
      if (parsed?.user) dockerEnvParts.push(`-e PGUSER=\"${parsed.user}\"`);
      if (parsed?.password) dockerEnvParts.push(`-e PGPASSWORD=\"${parsed.password}\"`);
      if (parsed?.database) dockerEnvParts.push(`-e PGDATABASE=\"${parsed.database}\"`);
      dockerEnvParts.push(`-e PGSSLMODE=\"require\"`);
      const dockerEnv = dockerEnvParts.join(' ');
      const lines: string[] = [];
      if (host) {
        lines.push('# Preflight checks');
        lines.push(buildPreflightCommands(host, port));
        lines.push('');
      }
      lines.push('# Download dump from signed URL');
      lines.push(`curl -L "${signed}" -o "${localFile}"`);
      lines.push('');
      if (ext === 'sql') {
        lines.push('# Restore plain SQL via psql');
        lines.push(`# Local psql`);
        lines.push(`psql "${safeDbUrl}" -v ON_ERROR_STOP=1 -f "${localFile}"`);
        lines.push('');
        lines.push('# Dockerized psql');
        lines.push(`docker run --rm ${dockerEnv} -v "$PWD:/mnt" postgres:16-alpine sh -lc 'psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 -f /mnt/${localFile}'`);
      } else {
        lines.push('# Restore custom dump via pg_restore');
        lines.push('# Local pg_restore');
        lines.push(`pg_restore --clean --if-exists --no-owner --no-privileges --dbname "${safeDbUrl}" "${localFile}"`);
        lines.push('');
        lines.push('# Dockerized pg_restore');
        lines.push(`docker run --rm ${dockerEnv} -v "$PWD:/mnt" postgres:16-alpine sh -lc 'pg_restore --clean --if-exists --no-owner --no-privileges -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" /mnt/${localFile}'`);
        if (parsed && isSupabasePoolerHostname(parsed.host)) {
          lines.push('');
          lines.push('# Note: pooling hosts may reject certain restore statements (PgBouncer). Prefer the Direct host.');
        }
      }
      lines.push('');
      lines.push('# Verify');
      lines.push('echo "Restore completed"');
      setCliCommands(lines.join('\n'));
      endProgress();
      toast.success('Signed restore script generated');
      addCliActivity('generate_script', `TTL=${ttl}, path=${uploadedPath}`);
    } catch (err: any) {
      endProgress();
      toast.error('Failed generating signed script', { description: err?.message || String(err) });
      addCliActivity('generate_script_error', String(err?.message || err));
    }
  };

  const analyzeCliLogs = () => {
    const logs = cliLogs || '';
    const errors = (logs.match(/\bERROR\b/gi) || []).length;
    const warnings = (logs.match(/\bWARNING\b/gi) || []).length;
    const fatals = (logs.match(/\bFATAL\b/gi) || []).length;
    setCliAnalysis({ errors, warnings, fatals });
    if (errors === 0 && fatals === 0) {
      toast.success('No errors detected in CLI logs', { description: warnings > 0 ? `${warnings} warning(s) present` : 'Clean run' });
    } else {
      toast.warning('Issues detected in CLI logs', { description: `Errors: ${errors}, Fatals: ${fatals}, Warnings: ${warnings}` });
    }
  };

  const applyPreset = (preset: 'full' | 'incremental') => {
    setCliPreset(preset);
    // Default to custom format for both presets
    setCliFormat('custom');
    if (preset === 'full') {
      setCliSchemaOnly(false);
      setCliDataOnly(false);
    } else {
      // Incremental: favor data-only for minimal changes
      setCliSchemaOnly(false);
      setCliDataOnly(true);
      // Optionally hint a different filename, but avoid overriding user input
    }
  };

  // Determine the primary command to execute (prefer pg_dump/psql for reliability)
  const getPrimaryCommand = () => {
    const lines = (cliCommands || '').split('\n').map((l) => l.trim()).filter(Boolean);
    const pgDump = lines.find((l) => l.startsWith('pg_dump'));
    const psql = lines.find((l) => l.startsWith('psql'));
    const supDump = lines.find((l) => l.startsWith('supabase db dump'));
    const supRestore = lines.find((l) => l.startsWith('supabase db restore'));
    if (cliOperation === 'backup') {
      return pgDump || supDump || '';
    }
    // restore
    return psql || supRestore || '';
  };

  // One-click execution hook (safe prompt + clipboard copy)
  const runCliWithPrompt = async () => {
    const primary = getPrimaryCommand();
    if (!primary) {
      toast.error('No runnable command found', { description: 'Generate commands first, then try running again.' });
      return;
    }
    const ok = window.confirm(`This will attempt to run:\n\n${primary}\n\nConfirm you have the required tools installed and want to proceed?`);
    if (!ok) return;
    setCliRunning(true);
    setCliExitCode(null);
    const startedAt = new Date().toISOString();
    setCliLastRunAt(startedAt);
    try {
      await navigator.clipboard.writeText(primary);
      toast.success('Primary command copied', { description: 'Paste in your terminal to execute. Output can be pasted below for analysis.' });
      setCliLogs((prev) => [`# Started: ${startedAt}`, `# Command: ${primary}`, '', prev].filter(Boolean).join('\n'));
      // NOTE: Browser apps cannot directly execute local shell commands.
      // This hook safely stages the command and workflow. For auto-run, integrate a secure backend job runner.
    } catch (err: any) {
      toast.error('Failed to copy command', { description: String(err?.message || err) });
    } finally {
      setCliRunning(false);
      setCliExitCode(0);
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
        const { data, error } = await supabase.from(t.table_name).select("*");
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

  const booleanExportKeys = [
    'schema',
    'constraints',
    'indexes',
    'dbFunctions',
    'rlsPolicies',
    'enums',
    'views',
    'materializedViews',
    'triggers',
    'edgeFunctions',
    'secrets',
    'tableData',
  ] as const;
  const allExportOptionsSelected = booleanExportKeys.every((k) => (exportOptions as any)[k]);
  
  const toggleAllExportOptions = (checked: boolean) => {
    setExportOptions((prev) => ({
      ...prev,
      schema: checked,
      constraints: checked,
      indexes: checked,
      dbFunctions: checked,
      rlsPolicies: checked,
      enums: checked,
      views: checked,
      materializedViews: checked,
      triggers: checked,
      edgeFunctions: checked,
      secrets: checked,
      tableData: checked,
    }));
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

  const exportSchemaSQL = async () => {
    const hasAnySelected = Object.values(exportOptions).some(v => v);
    if (!hasAnySelected) {
      toast.message("No components selected", { description: "Select at least one export option." });
      return;
    }

    setLoading(true);
    try {
      let sqlContent = `-- Database Full Restore Export\n-- Generated on: ${new Date().toISOString()}\n-- Order: Extensions -> Enums -> Sequences -> Tables -> Constraints -> Indexes -> Functions -> RLS -> Data\n\n`;

      // Export extensions first (required for types/functions used elsewhere)
      try {
        const { data: extData } = await supabase.rpc("execute_sql_query", { 
          query_text: "SELECT e.extname, n.nspname AS schema_name FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace;" 
        });
        if (Array.isArray(extData) && extData.length > 0) {
          sqlContent += "-- Extensions\n";
          extData.forEach((row: any) => {
            const name = row.extname || row.ext_name || row.name;
            const schema = row.schema_name || 'public';
            if (name) {
              // Try to install into the recorded schema; fall back to default if not relocatable
              sqlContent += `DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS "${name}" WITH SCHEMA "${schema}"; EXCEPTION WHEN others THEN CREATE EXTENSION IF NOT EXISTS "${name}"; END $$;\n`;
            }
          });
          sqlContent += "\n";
        }
      } catch {}

      // Export enums (types) before tables
      if (exportOptions.enums) {
        const { data: enumsData, error } = await supabase.rpc("get_database_enums");
        if (error) throw error;
        sqlContent += "-- Enums\n";
        if (enumsData && Array.isArray(enumsData)) {
          enumsData.forEach((enumItem: any) => {
            const enumType = enumItem?.enum_type;
            const labelsText = (enumItem?.labels ?? '').toString();
            if (!enumType || labelsText.trim() === '') return;
            const labelArray = labelsText
              .replace(/^{|}$/g, '')
              .split(',')
              .map((l: string) => l.trim())
              .filter((l: string) => l.length > 0);
            const labelsForCreate = labelArray
              .map((l: string) => `'${l.replace(/'/g, "''")}'`)
              .join(', ');
            const arrayLiteral = labelArray
              .map((l: string) => `'${l.replace(/'/g, "''")}'`)
              .join(', ');
            sqlContent += `DO $$\nDECLARE lbl text;\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM pg_type t\n    JOIN pg_namespace n ON n.oid = t.typnamespace\n    WHERE t.typname = '${enumType}' AND n.nspname = 'public'\n  ) THEN\n    EXECUTE 'CREATE TYPE public."${enumType}" AS ENUM (${labelsForCreate})';\n  ELSE\n    FOREACH lbl IN ARRAY ARRAY[${arrayLiteral}] LOOP\n      IF NOT EXISTS (\n        SELECT 1 FROM pg_enum e\n        JOIN pg_type t ON t.oid = e.enumtypid\n        JOIN pg_namespace n ON n.oid = t.typnamespace\n        WHERE t.typname = '${enumType}' AND n.nspname = 'public' AND e.enumlabel = lbl\n      ) THEN\n        EXECUTE 'ALTER TYPE public."${enumType}" ADD VALUE ' || quote_literal(lbl) || ';';\n      END IF;\n    END LOOP;\n  END IF;\nEND $$;\n`;
          });
          sqlContent += "\n";
        }
      }

      // Export sequences (used by serial/identity defaults)
      if (exportOptions.schema) {
        try {
          const { data: sequences } = await supabase.rpc("execute_sql_query", {
            query_text: "SELECT sequence_schema, sequence_name FROM information_schema.sequences WHERE sequence_schema='public';",
          });
          if (Array.isArray(sequences) && sequences.length > 0) {
            sqlContent += "-- Sequences\n";
            sequences.forEach((seq: any) => {
              const name = seq.sequence_name;
              if (name) {
                sqlContent += `CREATE SEQUENCE IF NOT EXISTS "${name}";\n`;
              }
            });
            sqlContent += "\n";
          }
          // Map sequences to table columns for ownership (best effort)
          const { data: seqOwners } = await supabase.rpc("execute_sql_query", {
            query_text:
              "SELECT rel.relname AS table_name, att.attname AS column_name, regexp_replace(pg_get_expr(def.adbin, def.adrelid), 'nextval\\(''([^'']+)''::regclass\\)', '\\1') AS sequence_name FROM pg_class rel JOIN pg_namespace n ON n.oid=rel.relnamespace JOIN pg_attribute att ON att.attrelid=rel.oid AND att.attnum>0 JOIN pg_attrdef def ON def.adrelid=rel.oid AND def.adnum=att.attnum WHERE n.nspname='public' AND pg_get_expr(def.adbin, def.adrelid) LIKE 'nextval(%'",
          });
          if (Array.isArray(seqOwners)) {
            seqOwners.forEach((row: any) => {
              const seq = row.sequence_name;
              const tbl = row.table_name;
              const col = row.column_name;
              if (seq && tbl && col) {
                sqlContent += `ALTER SEQUENCE "${seq}" OWNED BY "${tbl}"."${col}";\n`;
              }
            });
            sqlContent += "\n";
          }
        } catch {}
      }

      // Export schema (tables and columns)
      if (exportOptions.schema) {
        const { data: schemaData, error } = await supabase.rpc("get_database_schema");
        if (error) throw error;
        
        sqlContent += "-- Tables and Columns\n";
        if (schemaData && Array.isArray(schemaData)) {
          const tableGroups = schemaData.reduce((acc: any, row: any) => {
            if (!acc[row.table_name]) {
              acc[row.table_name] = [];
            }
            acc[row.table_name].push(row);
            return acc;
          }, {});

          const resolveColumnType = (col: any) => {
            const dt = (col.data_type || '').toString();
            const udt = (col.udt_name || '').toString();
            const def = (col.column_default || '').toString();
            // Resolve enums/domains and other user-defined types
            if (dt.toUpperCase() === 'USER-DEFINED') {
              if (udt) {
                return `"${udt}"`;
              }
              // Attempt to infer type from DEFAULT cast (e.g., 'value'::type)
              const castMatch = def.match(/::([a-zA-Z0-9_\.]+)/);
              if (castMatch && castMatch[1]) {
                const castType = castMatch[1];
                // Prefer explicit schema qualification if present; otherwise quote type name
                if (castType.includes('.')) {
                  const [schema, typeName] = castType.split('.');
                  return `${schema}."${typeName}"`;
                }
                return `"${castType}"`;
              }
              // Fallback to text to avoid invalid USER-DEFINED in emitted DDL
              return 'text';
            }
            // Resolve arrays; prefer udt_name, otherwise infer from DEFAULT cast and fallback to text[]
            if (dt.toUpperCase() === 'ARRAY') {
              if (udt) {
                const base = udt.startsWith('_') ? udt.slice(1) : udt;
                return `${base}[]`;
              }
              // Try to infer array element type from DEFAULT cast (e.g., ...::type[])
              const arrayCastMatch = def.match(/::([a-zA-Z0-9_\.]+)\[\]/);
              if (arrayCastMatch && arrayCastMatch[1]) {
                const castType = arrayCastMatch[1];
                if (castType.includes('.')) {
                  const [schema, typeName] = castType.split('.');
                  return `${schema}."${typeName}"[]`;
                }
                return `${castType}[]`;
              }
              // Safe fallback to text[] to avoid bare ARRAY keyword
              return 'text[]';
            }
            // Numeric/decimal with precision/scale
            if ((dt === 'numeric' || dt === 'decimal') && (col.numeric_precision || col.numeric_scale)) {
              const prec = col.numeric_precision ? String(col.numeric_precision) : undefined;
              const scale = col.numeric_scale != null ? String(col.numeric_scale) : undefined;
              if (prec && scale) return `${dt}(${prec},${scale})`;
              if (prec) return `${dt}(${prec})`;
              return dt;
            }
            // Length only for character types
            if ((dt === 'character varying' || dt === 'varchar') && col.character_maximum_length) {
              return `${dt}(${col.character_maximum_length})`;
            }
            return dt || 'text';
          };

          Object.entries(tableGroups).forEach(([tableName, columns]: [string, any]) => {
            sqlContent += `\nCREATE TABLE IF NOT EXISTS "${tableName}" (\n`;
            // Deduplicate column definitions by column_name
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
            sqlContent += columnDefs.join(',\n') + '\n);\n';
          });
        }
      }

      // Export constraints (emit valid PK/UNIQUE/CHECK/FK clauses, idempotent)
      if (exportOptions.constraints) {
        // Collect CHECK constraints to defer until after data import
        const deferredCheckConstraints: { table: string; name: string; clause: string }[] = [];
        const { data: constraintsData, error } = await supabase.rpc("get_table_constraints");
        if (error) throw error;

        // Helper to extract column list from details in various formats
        const extractColumns = (raw: string): string => {
          const s = raw.trim();
          const columnsMatch = s.match(/columns:\s*([^;]+)/i);
          if (columnsMatch) return columnsMatch[1].trim();
          return s;
        };

        // Helper to normalize CHECK clause body to `CHECK (...)`
        const normalizeCheck = (raw: string): string => {
          const s = raw.trim();
          // If already wrapped with parentheses, keep; else wrap
          if (s.startsWith('(') && s.endsWith(')')) return `CHECK ${s}`;
          return `CHECK (${s})`;
        };

        // Helper to construct FK clause; prefer parsing, else fetch from pg_get_constraintdef
        const buildFkClause = async (cname: string, tname: string, raw: string): Promise<string> => {
          const s = raw.trim();
          const cols = s.match(/columns:\s*([^;]+)/i);
          const refs = s.match(/references:\s*([^()]+)\(([^)]+)\)/i);
          if (cols && refs) {
            const colList = cols[1].trim();
            const refTable = refs[1].trim();
            const refCols = refs[2].trim();
            return `FOREIGN KEY (${colList}) REFERENCES ${refTable}(${refCols})`;
          }
          // Fallback to pg_get_constraintdef for precise definition
          const { data: defData } = await supabase.rpc("execute_sql_query", {
            query_text: `SELECT pg_get_constraintdef(c.oid) AS def
                         FROM pg_constraint c
                         JOIN pg_class t ON t.oid = c.conrelid
                         JOIN pg_namespace n ON n.oid = t.relnamespace
                         WHERE c.conname = '${cname}' AND t.relname = '${tname}' AND n.nspname = 'public'
                         LIMIT 1;`
          });
          const def = Array.isArray(defData) && defData[0]?.def ? String(defData[0].def) : '';
          // pg_get_constraintdef returns e.g. "FOREIGN KEY (account_id) REFERENCES accounts(id)"
          return def || '';
        };

        sqlContent += "\n-- Constraints\n";
        if (constraintsData && Array.isArray(constraintsData)) {
          for (const constraint of constraintsData) {
            const detailsRaw = (constraint.constraint_details || '').toString();
            const type = (constraint.constraint_type || '').toString().toUpperCase();
            if (detailsRaw.trim().length === 0) continue;

            const tableName = String(constraint.table_name);
            const tname = tableName.replace(/"/g, '"');
            const cname = String(constraint.constraint_name).replace(/"/g, '"');

            // Suppress artificially named NOT NULL constraints; column-level NOT NULL is already emitted
            const nameLower = cname.toLowerCase();
            if (nameLower.endsWith('_not_null')) {
              continue;
            }
            // Also skip CHECK clauses that are pure NOT NULL expressions
            const dr = detailsRaw.trim();
            if (type === 'CHECK' && /^\(?\s*[a-zA-Z0-9_]+\s+IS\s+NOT\s+NULL\s*\)?$/i.test(dr)) {
              continue;
            }

            let clause = '';
            if (type === 'PRIMARY KEY') {
              const cols = extractColumns(detailsRaw);
              clause = `PRIMARY KEY (${cols})`;
            } else if (type === 'UNIQUE') {
              const cols = extractColumns(detailsRaw);
              clause = `UNIQUE (${cols})`;
            } else if (type === 'CHECK') {
              // Avoid invalid "... id IS NOT NULL" by emitting proper CHECK
              clause = normalizeCheck(detailsRaw);
            } else if (type === 'FOREIGN KEY') {
              clause = await buildFkClause(cname, tname, detailsRaw);
            } else {
              // Unknown type: attempt to use pg_get_constraintdef; if unavailable, skip to avoid invalid SQL
              const { data: defData } = await supabase.rpc("execute_sql_query", {
                query_text: `SELECT pg_get_constraintdef(c.oid) AS def
                             FROM pg_constraint c
                             JOIN pg_class t ON t.oid = c.conrelid
                             JOIN pg_namespace n ON n.oid = t.relnamespace
                             WHERE c.conname = '${cname}' AND t.relname = '${tname}' AND n.nspname = 'public'
                             LIMIT 1;`
              });
              clause = Array.isArray(defData) && defData[0]?.def ? String(defData[0].def) : '';
            }

            if (clause && clause.trim().length > 0) {
              if (type === 'CHECK') {
                // Defer CHECK constraints until after data import
                deferredCheckConstraints.push({ table: tableName, name: String(constraint.constraint_name), clause });
                // Emit a comment to indicate deferral
                sqlContent += `-- Deferred CHECK constraint "${constraint.constraint_name}" on "${tableName}" will be added post data import\n`;
              } else {
                sqlContent += `DO $$
BEGIN
  -- Only add constraint if the table exists and the constraint does not
  IF EXISTS (
    SELECT 1
    FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE t.relname = '${tname}' AND n.nspname = 'public'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      WHERE c.conname = '${cname}' AND t.relname = '${tname}'
    ) THEN
      ALTER TABLE "${tableName}" ADD CONSTRAINT "${constraint.constraint_name}" ${clause};
    END IF;
  END IF;
END
$$;\n`;
              }
            }
          }
        }

        // If there are deferred CHECK constraints, drop them before data import to avoid 23514 errors
        if (deferredCheckConstraints.length > 0) {
          sqlContent += "\n-- Temporarily drop CHECK constraints prior to data import\n";
          deferredCheckConstraints.forEach((c) => {
            // Use IF EXISTS for idempotency; assume public schema
            sqlContent += `ALTER TABLE "public"."${c.table}" DROP CONSTRAINT IF EXISTS "${c.name}";\n`;
          });
          // Stash the list for re-add after data import by emitting a marker
          sqlContent += "-- End dropping deferred CHECK constraints\n";
        }
      }

      // Export indexes (guard with table existence and add IF NOT EXISTS)
      if (exportOptions.indexes) {
        const { data: indexesData, error } = await supabase.rpc("get_table_indexes");
        if (error) throw error;
        
        sqlContent += "\n-- Indexes\n";
        if (indexesData && Array.isArray(indexesData)) {
          indexesData.forEach((index: any) => {
            // Use full index definition from pg_get_indexdef for correctness
            const def = (index.index_definition || '').toString();
            if (def.trim().length > 0) {
              const tableName = (index.table_name || '').toString();
              let stmt = def;
              stmt = stmt.replace(/^CREATE\s+UNIQUE\s+INDEX/i, 'CREATE UNIQUE INDEX IF NOT EXISTS');
              stmt = stmt.replace(/^CREATE\s+INDEX/i, 'CREATE INDEX IF NOT EXISTS');
              // Only attempt to create index if the table exists; wrap in exception handler to skip on missing deps
              sqlContent += `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace WHERE t.relname='${tableName.replace(/"/g, '"')}' AND n.nspname='public') THEN BEGIN ${stmt}; EXCEPTION WHEN undefined_column THEN RAISE NOTICE 'Skipping index on %: missing column', '${tableName.replace(/"/g, '"')}'; WHEN undefined_table THEN RAISE NOTICE 'Skipping index on %: missing table', '${tableName.replace(/"/g, '"')}'; WHEN undefined_function THEN RAISE NOTICE 'Skipping index on %: missing function', '${tableName.replace(/"/g, '"')}'; WHEN undefined_object THEN RAISE NOTICE 'Skipping index on %: missing type/object', '${tableName.replace(/"/g, '"')}'; END; END IF; END $$;\n`;
            }
          });
        }
      }

      // Export database functions
      if (exportOptions.dbFunctions) {
        // Prefer RPC with full bodies; gracefully fall back to metadata-only
        let functionsData: any[] | null = null;
        try {
          const { data: functionsWithBody } = await supabase.rpc("get_database_functions_with_body");
          functionsData = functionsWithBody || null;
        } catch (e) {
          functionsData = null;
        }
        if (!functionsData) {
          const { data: metaData, error } = await supabase.rpc("get_database_functions");
          if (error) throw error;
          functionsData = metaData || [];
        }
        
        sqlContent += "\n-- Database Functions\n";
        if (functionsData && Array.isArray(functionsData)) {
          let anyPrinted = false;
          functionsData.forEach((func: any) => {
            const name = func?.name || func?.function_name;
            const schema = func?.schema || 'public';
            const def = func?.function_definition;
            if (def && name) {
              const trimmed = String(def).trim();
              sqlContent += `-- Function: ${schema}.${name}\n`;
              // Use CREATE OR REPLACE for idempotence
              const replaced = trimmed.replace(/^CREATE\s+FUNCTION/i, 'CREATE OR REPLACE FUNCTION');
              sqlContent += `${replaced}\n\n`;
              anyPrinted = true;
            } else if (name) {
              sqlContent += `-- Function metadata only: ${schema}.${name} (${func?.argument_types ?? ''}) RETURNS ${func?.return_type ?? ''} [definition unavailable]\n`;
              anyPrinted = true;
            }
          });
          if (!anyPrinted) {
            sqlContent += "-- No function definitions available from introspection.\n";
          }
        }
      }

      // Export views
      if (exportOptions.views) {
        try {
          const { data: views } = await supabase.rpc("execute_sql_query", {
            query_text:
              "SELECT v.schemaname, v.viewname, pg_get_viewdef((quote_ident(v.schemaname)||'.'||quote_ident(v.viewname))::regclass, true) AS definition FROM pg_views v WHERE v.schemaname NOT IN ('pg_catalog','information_schema') ORDER BY v.schemaname, v.viewname;",
          });
          if (Array.isArray(views) && views.length > 0) {
            sqlContent += "\n-- Views\n";
            views.forEach((v: any) => {
              const schema = v.schemaname || 'public';
              const name = v.viewname;
              const def = String(v.definition || '').trim();
              if (name && def) {
                sqlContent += `CREATE OR REPLACE VIEW "${schema}"."${name}" AS ${def};\n`;
              }
            });
          }
        } catch {}
      }

      // Export materialized views
      if (exportOptions.materializedViews) {
        try {
          const { data: matviews } = await supabase.rpc("execute_sql_query", {
            query_text:
              "SELECT schemaname, matviewname, definition FROM pg_matviews WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY schemaname, matviewname;",
          });
          if (Array.isArray(matviews) && matviews.length > 0) {
            sqlContent += "\n-- Materialized Views\n";
            matviews.forEach((mv: any) => {
              const schema = mv.schemaname || 'public';
              const name = mv.matviewname;
              const def = String(mv.definition || '').trim();
              if (name && def) {
                sqlContent += `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname='${schema}' AND matviewname='${name}') THEN CREATE MATERIALIZED VIEW "${schema}"."${name}" AS ${def}; END IF; END $$;\n`;
              }
            });
          }
        } catch {}
      }

      // Export triggers (after functions/tables, guard with table existence)
      if (exportOptions.triggers) {
        try {
          const { data: triggers } = await supabase.rpc("execute_sql_query", {
            query_text:
              "SELECT t.tgname AS trigger_name, c.relname AS table_name, n.nspname AS schema_name, pg_get_triggerdef(t.oid) AS trigger_def FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE NOT t.tgisinternal AND n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY n.nspname, c.relname, t.tgname;",
          });
          if (Array.isArray(triggers) && triggers.length > 0) {
            sqlContent += "\n-- Triggers\n";
            triggers.forEach((tr: any) => {
              const schema = tr.schema_name || 'public';
              const def = String(tr.trigger_def || '').trim();
              const tname = tr.table_name;
              const gname = tr.trigger_name;
              if (def && tname && gname) {
                // Create trigger only if table exists and trigger does not already exist; wrap in exception handler
                sqlContent += `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_class cc JOIN pg_namespace nn ON cc.relnamespace=nn.oid WHERE cc.relname='${tname.replace(/"/g, '"')}' AND nn.nspname='${schema}') AND NOT EXISTS (SELECT 1 FROM pg_trigger tt JOIN pg_class cc ON tt.tgrelid=cc.oid JOIN pg_namespace nn ON cc.relnamespace=nn.oid WHERE tt.tgname='${gname.replace(/"/g, '"')}' AND cc.relname='${tname.replace(/"/g, '"')}' AND nn.nspname='${schema}') THEN BEGIN ${def}; EXCEPTION WHEN undefined_function THEN RAISE NOTICE 'Skipping trigger % on %: missing function', '${gname.replace(/"/g, '"')}', '${tname.replace(/"/g, '"')}'; WHEN undefined_column THEN RAISE NOTICE 'Skipping trigger % on %: missing column', '${gname.replace(/"/g, '"')}', '${tname.replace(/"/g, '"')}'; WHEN undefined_table THEN RAISE NOTICE 'Skipping trigger % on %: missing table', '${gname.replace(/"/g, '"')}', '${tname.replace(/"/g, '"')}'; WHEN undefined_object THEN RAISE NOTICE 'Skipping trigger % on %: missing type/object', '${gname.replace(/"/g, '"')}', '${tname.replace(/"/g, '"')}'; END; END IF; END $$;\n`;
              }
            });
          }
        } catch {}
      }

      // Export RLS policies (guard operations with table existence)
      if (exportOptions.rlsPolicies) {
        // Ensure dependent enum and helper functions exist before creating policies
        sqlContent += "\n-- Security Helpers (enum + functions used by RLS policies)\n";
        // Create enum app_role if missing
        sqlContent += `DO $$ BEGIN IF NOT EXISTS (\n  SELECT 1\n  FROM pg_type t\n  JOIN pg_namespace n ON n.oid = t.typnamespace\n  WHERE t.typname = 'app_role' AND n.nspname = 'public'\n) THEN\n  CREATE TYPE public.app_role AS ENUM (\n    'platform_admin',\n    'tenant_admin',\n    'franchise_admin',\n    'user'\n  );\nEND IF; END $$;\n`;
        // Helper functions (CREATE OR REPLACE for idempotence), guarded on table/columns existence to avoid 42P01
        sqlContent += `DO $$\nBEGIN\n  IF EXISTS (\n    SELECT 1 FROM pg_class t JOIN pg_namespace n ON n.oid = t.relnamespace\n    WHERE t.relname = 'user_roles' AND n.nspname = 'public'\n  ) AND (\n    SELECT COUNT(*) FROM information_schema.columns\n    WHERE table_schema = 'public' AND table_name = 'user_roles'\n      AND column_name IN ('user_id','role')\n  ) = 2 THEN\n    CREATE OR REPLACE FUNCTION public.is_platform_admin(check_user_id UUID)\n    RETURNS BOOLEAN\n    LANGUAGE sql\n    STABLE\n    SECURITY DEFINER\n    SET search_path = public\n    AS $fn$\n      SELECT EXISTS (\n        SELECT 1 FROM public.user_roles\n        WHERE user_id = check_user_id\n          AND role = 'platform_admin'\n      );\n    $fn$;\n  END IF;\nEND$$;\n`;
        sqlContent += `DO $$\nBEGIN\n  IF EXISTS (\n    SELECT 1 FROM pg_class t JOIN pg_namespace n ON n.oid = t.relnamespace\n    WHERE t.relname = 'user_roles' AND n.nspname = 'public'\n  ) AND (\n    SELECT COUNT(*) FROM information_schema.columns\n    WHERE table_schema = 'public' AND table_name = 'user_roles'\n      AND column_name IN ('user_id','role')\n  ) = 2 THEN\n    CREATE OR REPLACE FUNCTION public.has_role(check_user_id UUID, check_role public.app_role)\n    RETURNS BOOLEAN\n    LANGUAGE sql\n    STABLE\n    SECURITY DEFINER\n    SET search_path = public\n    AS $fn$\n      SELECT EXISTS (\n        SELECT 1 FROM public.user_roles\n        WHERE user_id = check_user_id\n          AND role = check_role\n      );\n    $fn$;\n  END IF;\nEND$$;\n`;
        sqlContent += `DO $$\nBEGIN\n  IF EXISTS (\n    SELECT 1 FROM pg_class t JOIN pg_namespace n ON n.oid = t.relnamespace\n    WHERE t.relname = 'user_roles' AND n.nspname = 'public'\n  ) AND (\n    SELECT COUNT(*) FROM information_schema.columns\n    WHERE table_schema = 'public' AND table_name = 'user_roles'\n      AND column_name IN ('user_id','role','tenant_id')\n  ) = 3 THEN\n    CREATE OR REPLACE FUNCTION public.get_user_tenant_id(check_user_id UUID)\n    RETURNS UUID\n    LANGUAGE sql\n    STABLE\n    SECURITY DEFINER\n    SET search_path = public\n    AS $fn$\n      SELECT tenant_id FROM public.user_roles\n      WHERE user_id = check_user_id\n        AND role IN ('tenant_admin', 'franchise_admin', 'user')\n      LIMIT 1;\n    $fn$;\n  END IF;\nEND$$;\n`;
        sqlContent += `DO $$\nBEGIN\n  IF EXISTS (\n    SELECT 1 FROM pg_class t JOIN pg_namespace n ON n.oid = t.relnamespace\n    WHERE t.relname = 'user_roles' AND n.nspname = 'public'\n  ) AND (\n    SELECT COUNT(*) FROM information_schema.columns\n    WHERE table_schema = 'public' AND table_name = 'user_roles'\n      AND column_name IN ('user_id','role','franchise_id')\n  ) = 3 THEN\n    CREATE OR REPLACE FUNCTION public.get_user_franchise_id(check_user_id UUID)\n    RETURNS UUID\n    LANGUAGE sql\n    STABLE\n    SECURITY DEFINER\n    SET search_path = public\n    AS $fn$\n      SELECT franchise_id FROM public.user_roles\n      WHERE user_id = check_user_id\n        AND role IN ('franchise_admin', 'user')\n      LIMIT 1;\n    $fn$;\n  END IF;\nEND$$;\n`;

        // Stub helpers fallback when user_roles does not exist yet
        sqlContent += `DO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM pg_class t JOIN pg_namespace n ON n.oid = t.relnamespace\n    WHERE t.relname = 'user_roles' AND n.nspname = 'public'\n  ) THEN\n    CREATE OR REPLACE FUNCTION public.is_platform_admin(check_user_id UUID)\n    RETURNS BOOLEAN\n    LANGUAGE sql\n    STABLE\n    SECURITY DEFINER\n    SET search_path = public\n    AS $fn$\n      SELECT false;\n    $fn$;\n\n    CREATE OR REPLACE FUNCTION public.has_role(check_user_id UUID, check_role public.app_role)\n    RETURNS BOOLEAN\n    LANGUAGE sql\n    STABLE\n    SECURITY DEFINER\n    SET search_path = public\n    AS $fn$\n      SELECT false;\n    $fn$;\n\n    CREATE OR REPLACE FUNCTION public.get_user_tenant_id(check_user_id UUID)\n    RETURNS UUID\n    LANGUAGE sql\n    STABLE\n    SECURITY DEFINER\n    SET search_path = public\n    AS $fn$\n      SELECT NULL::uuid;\n    $fn$;\n\n    CREATE OR REPLACE FUNCTION public.get_user_franchise_id(check_user_id UUID)\n    RETURNS UUID\n    LANGUAGE sql\n    STABLE\n    SECURITY DEFINER\n    SET search_path = public\n    AS $fn$\n      SELECT NULL::uuid;\n    $fn$;\n  END IF;\nEND $$;\n`;

        const { data: policiesData, error } = await supabase.rpc("get_rls_policies");
        if (error) throw error;
        
        sqlContent += "\n-- RLS Policies\n";
        if (policiesData && Array.isArray(policiesData)) {
          const tableGroups = policiesData.reduce((acc: any, policy: any) => {
            if (!acc[policy.table_name]) {
              acc[policy.table_name] = [];
            }
            acc[policy.table_name].push(policy);
            return acc;
          }, {});

          Object.entries(tableGroups).forEach(([tableName, policies]: [string, any]) => {
            sqlContent += `\n-- Enable RLS on ${tableName}\n`;
            // Enable RLS only if the table exists
            sqlContent += `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace WHERE t.relname='${tableName.replace(/"/g, '"')}' AND n.nspname='public') THEN ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY; END IF; END $$;\n`;
            
            policies.forEach((policy: any) => {
              const pname = policy.policy_name.replace(/"/g, '"');
              const tname = tableName.replace(/"/g, '"');
              // Create policy only if table exists and policy does not already exist; wrap in exception handler
              sqlContent += `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace WHERE t.relname='${tname}' AND n.nspname='public') AND NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class t ON t.oid = p.polrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE p.polname='${pname}' AND t.relname='${tname}' AND n.nspname='public') THEN BEGIN CREATE POLICY "${policy.policy_name}" ON "${tableName}"\n`;
              // 'command' comes from get_rls_policies; default to ALL if missing
              const cmd = String(policy.command || 'ALL').toUpperCase();
              sqlContent += `  FOR ${cmd}\n`;
              // 'roles' is returned as text (e.g., "{authenticated,anon}"). Parse safely.
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
                  sqlContent += `  TO ${rolesSql}\n`;
                }
              }
              // Emit clauses valid for the command:
              // - SELECT/DELETE: USING only
              // - INSERT: WITH CHECK only
              // - UPDATE/ALL: USING and/or WITH CHECK
              const usingExpr = policy.using_expression ? String(policy.using_expression) : '';
              const checkExpr = policy.with_check_expression ? String(policy.with_check_expression) : '';
              if (cmd === 'SELECT' || cmd === 'DELETE') {
                if (usingExpr.trim()) {
                  sqlContent += `  USING (${usingExpr})\n`;
                }
                // Do not emit WITH CHECK for SELECT/DELETE
              } else if (cmd === 'INSERT') {
                if (checkExpr.trim()) {
                  sqlContent += `  WITH CHECK (${checkExpr})\n`;
                }
                // Do not emit USING for INSERT
              } else {
                // UPDATE or ALL
                if (usingExpr.trim()) {
                  sqlContent += `  USING (${usingExpr})\n`;
                }
                if (checkExpr.trim()) {
                  sqlContent += `  WITH CHECK (${checkExpr})\n`;
                }
              }
              sqlContent += `; EXCEPTION WHEN undefined_function THEN RAISE NOTICE 'Skipping policy % on %: missing function', '${policy.policy_name.replace(/"/g, '"')}', '${tableName.replace(/"/g, '"')}'; WHEN undefined_table THEN RAISE NOTICE 'Skipping policy % on %: missing table', '${policy.policy_name.replace(/"/g, '"')}', '${tableName.replace(/"/g, '"')}'; WHEN undefined_column THEN RAISE NOTICE 'Skipping policy % on %: missing column', '${policy.policy_name.replace(/"/g, '"')}', '${tableName.replace(/"/g, '"')}'; WHEN undefined_object THEN RAISE NOTICE 'Skipping policy % on %: missing type/object', '${policy.policy_name.replace(/"/g, '"')}', '${tableName.replace(/"/g, '"')}'; END; END IF; END $$;\n`;
            });
          });
        }
      }

      // Export table data as INSERT statements
      if (exportOptions.tableData) {
        try {
          const { data: enumsData } = await supabase.rpc("get_database_enums");
          if (Array.isArray(enumsData) && enumsData.length > 0) {
            enumsData.forEach((enumItem: any) => {
              const enumType = enumItem?.enum_type;
              const labelsText = (enumItem?.labels ?? '').toString();
              if (!enumType || labelsText.trim() === '') return;
              const labelArray = labelsText
                .replace(/^{|}$/g, '')
                .split(',')
                .map((l: string) => l.trim())
                .filter((l: string) => l.length > 0);
              const labelsQuotedForCreate = labelArray
                .map((l: string) => `quote_literal('${l.replace(/'/g, "''")}')`)
                .join(', ');
              const arrayLiteral = labelArray
                .map((l: string) => `'${l.replace(/'/g, "''")}'`)
                .join(', ');
              sqlContent += `DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = '${enumType}' AND n.nspname = 'public'
  ) THEN
    EXECUTE format('CREATE TYPE public.%I AS ENUM (%s)', '${enumType}', array_to_string(ARRAY[${labelsQuotedForCreate}], ', '));
  ELSE
    FOREACH lbl IN ARRAY ARRAY[${arrayLiteral}] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = '${enumType}' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE format('ALTER TYPE public.%I ADD VALUE %L', '${enumType}', lbl);
      END IF;
    END LOOP;
  END IF;
END $$;
`;
            });
          }
        } catch {}

        // If none selected, export all tables to meet full-restore requirement
        let chosen = tables.filter(t => selected[t.table_name])?.length > 0
          ? tables.filter(t => selected[t.table_name])
          : tables;

        // Build a table->column->data_type map for formatting
        const { data: schemaData, error: schemaError } = await supabase.rpc("get_database_schema");
        if (schemaError) throw schemaError;
        const resolveDataTypeForValue = (col: any) => {
          const dt = (col.data_type || '').toString();
          const udt = (col.udt_name || '').toString();
          const def = (col.column_default || '').toString();
          if (dt.toUpperCase() === 'ARRAY' && udt) {
            const base = udt.startsWith('_') ? udt.slice(1) : udt;
            return `${base}[]`;
          }
          if (dt.toUpperCase() === 'ARRAY' && !udt) {
            const arrayCastMatch = def.match(/::([a-zA-Z0-9_\.]+)\[\]/);
            if (arrayCastMatch && arrayCastMatch[1]) {
              const castType = arrayCastMatch[1];
              if (castType.includes('.')) {
                const [schema, typeName] = castType.split('.');
                return `${schema}."${typeName}"[]`;
              }
              return `${castType}[]`;
            }
            return 'text[]';
          }
          if (dt.toUpperCase() === 'USER-DEFINED' && udt) {
            return udt;
          }
          // Fallback: treat unknown user-defined types as text for safe insertion
          if (dt.toUpperCase() === 'USER-DEFINED') return 'text';
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

        // Enrich type map with schema-qualified user-defined types (enums/domains) from information_schema
        try {
          const { data: infoCols } = await supabase.rpc("execute_sql_query", {
            query_text:
              "SELECT table_schema, table_name, column_name, data_type, udt_schema, udt_name FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog','information_schema')",
          });
          (infoCols || []).forEach((r: any) => {
            const tbl = r.table_name;
            const col = r.column_name;
            const dt = (r.data_type || '').toString();
            const udtSchema = (r.udt_schema || '').toString();
            const udtName = (r.udt_name || '').toString();
            if (!tbl || !col) return;
            if (!typeMapByTable[tbl]) typeMapByTable[tbl] = {};
            // Handle scalar user-defined types
            if (dt.toUpperCase() === 'USER-DEFINED' && udtName && !udtName.startsWith('_')) {
              typeMapByTable[tbl][col] = udtSchema ? `${udtSchema}."${udtName}"` : udtName;
            }
            // Handle array user-defined types like _enumname
            if (dt.toUpperCase() === 'ARRAY' && udtName && udtName.startsWith('_')) {
              const base = udtName.slice(1);
              typeMapByTable[tbl][col] = udtSchema ? `${udtSchema}."${base}"[]` : `${base}[]`;
            }
          });
        } catch (e) {
          console.warn('Failed to enrich type map from information_schema, proceeding with base mapping', e);
        }

        let fkMapByTable: Record<string, { column_name: string; foreign_table_schema: string; foreign_table_name: string; foreign_column_name: string }[]> = {};
        try {
          const { data: fkRows } = await supabase.rpc("execute_sql_query", {
            query_text:
              "SELECT tc.table_schema, tc.table_name, kcu.column_name, ccu.table_schema AS foreign_table_schema, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema NOT IN ('pg_catalog','information_schema')",
          });
          (fkRows || []).forEach((r: any) => {
            const tbl = (r.table_name || '').toString();
            if (!tbl) return;
            if (!fkMapByTable[tbl]) fkMapByTable[tbl] = [];
            fkMapByTable[tbl].push({
              column_name: (r.column_name || '').toString(),
              foreign_table_schema: (r.foreign_table_schema || 'public').toString(),
              foreign_table_name: (r.foreign_table_name || '').toString(),
              foreign_column_name: (r.foreign_column_name || '').toString(),
            });
          });
        } catch (e) {
          console.warn('Failed to fetch foreign keys from information_schema', e);
        }

        let uniqueKeysByTable: Record<string, { table_schema: string; columns: string[] }[]> = {};
        try {
          const { data: uniqRows } = await supabase.rpc("execute_sql_query", {
            query_text:
              "SELECT tc.table_schema, tc.table_name, kcu.constraint_name, kcu.ordinal_position, kcu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema WHERE tc.constraint_type IN ('UNIQUE','PRIMARY KEY') AND tc.table_schema NOT IN ('pg_catalog','information_schema') ORDER BY tc.table_schema, tc.table_name, kcu.constraint_name, kcu.ordinal_position",
          });
          const byConstraint: Record<string, { table_schema: string; table_name: string; columns: string[] }> = {};
          (uniqRows || []).forEach((r: any) => {
            const schema = (r.table_schema || 'public').toString();
            const tbl = (r.table_name || '').toString();
            const cname = (r.constraint_name || '').toString();
            const col = (r.column_name || '').toString();
            if (!tbl || !cname || !col) return;
            const key = `${schema}.${tbl}.${cname}`;
            if (!byConstraint[key]) byConstraint[key] = { table_schema: schema, table_name: tbl, columns: [] };
            byConstraint[key].columns.push(col);
          });
          Object.values(byConstraint).forEach((c) => {
            if (!uniqueKeysByTable[c.table_name]) uniqueKeysByTable[c.table_name] = [];
            uniqueKeysByTable[c.table_name].push({ table_schema: c.table_schema, columns: c.columns });
          });
        } catch (e) {
          console.warn('Failed to fetch unique constraints from information_schema', e);
        }

        if (chosen.length > 0) {
          // Compute dependency-aware ordering using foreign keys (topological sort)
          if (exportOptions.fkOrderEnabled) {
            try {
              const { data: fkRows } = await supabase.rpc("execute_sql_query", {
                query_text:
                  "SELECT nl.nspname AS src_schema, cl.relname AS src_table, nr.nspname AS ref_schema, cr.relname AS ref_table FROM pg_constraint c JOIN pg_class cl ON cl.oid = c.conrelid JOIN pg_class cr ON cr.oid = c.confrelid JOIN pg_namespace nl ON nl.oid = cl.relnamespace JOIN pg_namespace nr ON nr.oid = cr.relnamespace WHERE c.contype = 'f' AND nl.nspname NOT IN ('pg_catalog','information_schema') AND nr.nspname NOT IN ('pg_catalog','information_schema');",
              });
              const edges: Array<{ from: string; to: string }> = [];
              (fkRows || []).forEach((r: any) => {
                const from = `${r.ref_schema}.${r.ref_table}`; // referenced table must be inserted first
                const to = `${r.src_schema}.${r.src_table}`;   // dependent table inserted after
                if (from && to) edges.push({ from, to });
              });
              const names = new Set(chosen.map((t) => `${(t as any).table_schema || 'public'}.${t.table_name}`));
              const adj: Record<string, Set<string>> = {};
              const indeg: Record<string, number> = {};
              names.forEach((n) => {
                adj[n] = new Set();
                indeg[n] = 0;
              });
              edges.forEach(({ from, to }) => {
                if (names.has(from) && names.has(to) && from !== to) {
                  if (!adj[from].has(to)) {
                    adj[from].add(to);
                    indeg[to] += 1;
                  }
                }
              });
              const queue: string[] = Array.from(names).filter((n) => indeg[n] === 0).sort();
              const ordered: string[] = [];
              while (queue.length > 0) {
                const n = queue.shift()!;
                ordered.push(n);
                adj[n].forEach((m) => {
                  indeg[m] -= 1;
                  if (indeg[m] === 0) queue.push(m);
                });
              }
              // If cycle detected, fall back to original order; otherwise use ordered
              if (ordered.length === names.size) {
                const mapByKey: Record<string, any> = {};
                chosen.forEach((t) => {
                  const key = `${(t as any).table_schema || 'public'}.${t.table_name}`;
                  mapByKey[key] = t;
                });
                chosen = ordered.map((k) => mapByKey[k]).filter(Boolean);
              }
            } catch (e) {
              console.warn('FK-based ordering failed, using default selection order', e);
            }
          }

          const split = Boolean((exportOptions as any).splitDataGroups);
          const groupSize = Math.max(1, Number((exportOptions as any).dataGroupSize) || 6);
          if (!split) {
            sqlContent += "\nBEGIN;\n";
            sqlContent += "SET row_security = off;\n";
            sqlContent += "SET session_replication_role = replica;\n";
          }

          const escapeStr = (s: string) => s.replace(/'/g, "''");

          // Encode text safely with hex to avoid comment/quoting collisions
          const toHex = (s: string): string => {
            const encoder = new TextEncoder();
            const bytes = encoder.encode(s);
            let hex = '';
            for (let i = 0; i < bytes.length; i++) {
              const h = bytes[i].toString(16).padStart(2, '0');
              hex += h;
            }
            return hex;
          };
          const asText = (s: string): string => `convert_from(decode('${toHex(s)}','hex'),'UTF8')`;

          const formatArray = (arr: any[], baseType?: string) => {
            const numericTypes = [
              "integer",
              "bigint",
              "smallint",
              "numeric",
              "real",
              "double precision",
            ];
            const items = arr
              .map((v) => {
                if (v === null) return "NULL";
                if (baseType && numericTypes.includes(baseType)) return String(v);
                if (baseType === "boolean") return v ? "true" : "false";
                const s = String(v)
                  .replace(/"/g, '\\"')
                  .replace(/\\/g, "\\\\")
                  .replace(/'/g, "''");
                return `"${s}"`;
              })
              .join(",");
            const literal = `{${items}}`;
            return baseType ? `'${literal}'::${baseType}[]` : `'${literal}'`;
          };

          const formatValue = (value: any, dataType?: string) => {
            if (value === undefined) return "NULL";
            if (value === null) return "NULL";

            if (dataType === "json" || dataType === "jsonb") {
              const json = JSON.stringify(value);
              return `${asText(json)}::${dataType}`;
            }

            if (dataType && dataType.endsWith("[]") && Array.isArray(value)) {
              const baseType = dataType.slice(0, -2);
              return formatArray(value, baseType);
            }

            if (typeof value === "string") {
              const dtRaw = (dataType || '').toString();
              const dt = dtRaw.toLowerCase();
              if (dt === 'uuid') return `${asText(value)}::uuid`;
              if (dt === 'date') return `${asText(value)}::date`;
              if (dt === 'timestamp with time zone') return `${asText(value)}::timestamptz`;
              if (dt === 'timestamp without time zone') return `${asText(value)}::timestamp`;
              if (dt === 'time with time zone') return `${asText(value)}::timetz`;
              if (dt === 'time without time zone') return `${asText(value)}::time`;
              // Treat only plain text types as text; handle enums/user-defined via explicit cast
              if (!dt || ['text','character varying','varchar','citext'].includes(dt)) {
                return `${asText(value)}`;
              }
              if (dt === 'user-defined') {
                return `${asText(value)}::${dtRaw}`;
              }
              // Use the resolved type name directly (may be schema-qualified or quoted)
              return `${asText(value)}::${dtRaw}`;
            }
            if (typeof value === "number") {
              if (!Number.isFinite(value)) return "NULL";
              return String(value);
            }
            if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
            if (value instanceof Date) {
              const iso = value.toISOString();
              const dt = (dataType || '').toLowerCase();
              if (dt === 'timestamp with time zone') return `${asText(iso)}::timestamptz`;
              if (dt === 'timestamp without time zone') return `${asText(iso)}::timestamp`;
              if (dt === 'date') return `${asText(iso.slice(0,10))}::date`;
              return `${asText(iso)}`;
            }

            if (typeof value === "object") {
              const json = JSON.stringify(value);
              return `${asText(json)}`;
            }

            return `${asText(String(value))}`;
          };

          const generateGroupSql = async (tablesForGroup: any[], withTx: boolean = true, logSkippedRows: boolean | 'file' = true, reportCollector?: string[]) => {
            let groupSql = "";
            if (withTx) {
              groupSql += "BEGIN;\n";
              groupSql += "SET row_security = off;\n";
              groupSql += "SET session_replication_role = replica;\n";
            }
            for (const table of tablesForGroup) {
              const schema = (table as any).table_schema || 'public';
              const client: any = (supabase as any).schema ? (supabase as any).schema(schema) : supabase;
              let wroteHeader = false;
              const colTypes = typeMapByTable[table.table_name] || {};
              let columns: string[] | null = Object.keys(colTypes).length > 0 ? Object.keys(colTypes) : null;
              let actualColumns: string[] = [];
              try {
                const { data: colRows } = await supabase.rpc("execute_sql_query", {
                  query_text: `SELECT column_name FROM information_schema.columns WHERE table_schema='${schema}' AND table_name='${table.table_name}' ORDER BY ordinal_position;`,
                });
                actualColumns = Array.isArray(colRows) ? colRows.map((r: any) => String(r.column_name)) : [];
                if (actualColumns.length > 0) {
                  actualColumns.forEach((c) => {
                    if (!colTypes[c]) colTypes[c] = 'text';
                  });
                } else {
                  actualColumns = columns || [];
                }
              } catch {
                actualColumns = columns || [];
              }
              const renameMapByTable: Record<string, Record<string, string>> = (exportOptions as any).columnRenameMap || {};
              const renameMapOldToNew: Record<string, string> = renameMapByTable[table.table_name] || {};
              const renameMapNewToOld: Record<string, string> = Object.keys(renameMapOldToNew).reduce((acc: Record<string,string>, oldCol: string) => {
                const newCol = renameMapOldToNew[oldCol];
                if (newCol) acc[newCol] = oldCol;
                return acc;
              }, {});
              const chunkSize = Number((exportOptions as any).dataChunkSize) || 1000;
              let offset = 0;
              const conflictClause = (exportOptions as any).skipUniqueConflicts ? ' ON CONFLICT DO NOTHING' : '';
              columns = actualColumns;
              while (true) {
                const where = String((exportOptions as any).rowFilterWhere || '').trim();
                let data: any[] | null = null;
                let error: any = null;
                if (where) {
                  const cols = (columns && columns.length > 0 ? columns : Object.keys(colTypes)).map((c) => `"${c}"`).join(", ") || "*";
                  const query_text = `SELECT ${cols} FROM "${schema}"."${table.table_name}" WHERE ${where} OFFSET ${offset} LIMIT ${chunkSize};`;
                  const { data: raw, error: rpcErr } = await supabase.rpc("execute_sql_query", { query_text });
                  data = Array.isArray(raw) ? raw : [];
                  error = rpcErr || null;
                } else {
                  const resp = await client.from(table.table_name).select("*").range(offset, offset + chunkSize - 1);
                  data = resp.data || null;
                  error = resp.error || null;
                }
                if (error) {
                  console.error(`Failed exporting ${schema}.${table.table_name}:`, error.message);
                  break;
                }
              if (!data || data.length === 0) break;
              if (!wroteHeader) {
                groupSql += `\n-- Data for table: ${schema}.${table.table_name}\n`;
                
                wroteHeader = true;
              }
              columns = actualColumns;
              const columnNames = (columns || []).map((col) => `"${renameMapOldToNew[col] || col}"`).join(", ");
              data.forEach((row: any) => {
                const valuesExprs = (columns || [])
                  .map((col) => {
                    const src = renameMapNewToOld[col] || col;
                    return formatValue(row[src], colTypes[col]);
                  })
                  .join(", ");
                const fks = fkMapByTable[table.table_name] || [];
                const uniques = uniqueKeysByTable[table.table_name] || [];
                const dupCondition = uniques.length > 0
                  ? uniques
                      .map((u) => {
                        const preds = u.columns
                          .map((c) => {
                            const src = renameMapNewToOld[c] || c;
                            return `"${c}" = ${formatValue(row[src], colTypes[c])}`;
                          })
                          .join(' AND ');
                        return `(EXISTS (SELECT 1 FROM "${schema}"."${table.table_name}" WHERE ${preds}))`;
                      })
                      .join(' OR ')
                  : '';
                const hasTenantId = (columns || []).includes('tenant_id');
                const tenantValExpr = hasTenantId ? formatValue(row['tenant_id'], colTypes['tenant_id']) : '';
                const tenantCond = hasTenantId
                  ? `(${tenantValExpr} IS NULL OR EXISTS (SELECT 1 FROM "public"."tenants" WHERE "id" = ${tenantValExpr}))`
                  : '';
                if (fks.length > 0) {
                  const conditions = fks
                    .map((fk) => {
                      const col = fk.column_name;
                      const src = renameMapNewToOld[col] || col;
                      const valExpr = formatValue(row[src], colTypes[col]);
                      const refSchema = fk.foreign_table_schema || 'public';
                      const refTbl = fk.foreign_table_name;
                      const refCol = fk.foreign_column_name;
                      return `(${valExpr} IS NULL OR EXISTS (SELECT 1 FROM "${refSchema}"."${refTbl}" WHERE "${refCol}" = ${valExpr}))`;
                    })
                    .join(" AND ");
                  groupSql += `INSERT INTO "${schema}"."${table.table_name}" (${columnNames}) SELECT ${valuesExprs} WHERE ${conditions}${conflictClause};\n`;
                  if (logSkippedRows === true || (logSkippedRows === 'file' && !Array.isArray(reportCollector))) {
                    const rowText = `${asText(JSON.stringify(row))}`;
                    groupSql += `DO $$ BEGIN IF NOT (${conditions}) THEN RAISE NOTICE 'SKIPPED row due to missing FK on %.%: %', '${schema}', '${table.table_name}', ${rowText}; END IF; END $$;\n`;
                  } else if (logSkippedRows === 'file' && Array.isArray(reportCollector)) {
                    const rowText = `${asText(JSON.stringify(row))}`;
                    reportCollector.push(`INSERT INTO "public"."import_skipped_rows" ("schema","table","row") SELECT ${asText(schema)}, ${asText(table.table_name)}, ${rowText}::jsonb WHERE NOT (${conditions});\n`);
                    if (dupCondition) {
                      reportCollector.push(`INSERT INTO "public"."import_skipped_rows" ("schema","table","row") SELECT ${asText(schema)}, ${asText(table.table_name)}, ${rowText}::jsonb WHERE (${conditions}) AND (${dupCondition});\n`);
                    }
                  }
                } else if (tenantCond) {
                  groupSql += `INSERT INTO "${schema}"."${table.table_name}" (${columnNames}) SELECT ${valuesExprs} WHERE ${tenantCond}${conflictClause};\n`;
                  if (logSkippedRows === true || (logSkippedRows === 'file' && !Array.isArray(reportCollector))) {
                    const rowText = `${asText(JSON.stringify(row))}`;
                    groupSql += `DO $$ BEGIN IF NOT (${tenantCond}) THEN RAISE NOTICE 'SKIPPED row due to missing tenant on %.%: %', '${schema}', '${table.table_name}', ${rowText}; END IF; END $$;\n`;
                  } else if (logSkippedRows === 'file' && Array.isArray(reportCollector)) {
                    const rowText = `${asText(JSON.stringify(row))}`;
                    reportCollector.push(`INSERT INTO "public"."import_skipped_rows" ("schema","table","row") SELECT ${asText(schema)}, ${asText(table.table_name)}, ${rowText}::jsonb WHERE NOT (${tenantCond});\n`);
                    if (dupCondition) {
                      reportCollector.push(`INSERT INTO "public"."import_skipped_rows" ("schema","table","row") SELECT ${asText(schema)}, ${asText(table.table_name)}, ${rowText}::jsonb WHERE (${tenantCond}) AND (${dupCondition});\n`);
                    }
                  }
                } else {
                  groupSql += `INSERT INTO "${schema}"."${table.table_name}" (${columnNames}) VALUES (${valuesExprs})${conflictClause};\n`;
                  if (logSkippedRows === 'file' && Array.isArray(reportCollector) && dupCondition) {
                    const rowText = `${asText(JSON.stringify(row))}`;
                    reportCollector.push(`INSERT INTO "public"."import_skipped_rows" ("schema","table","row") SELECT ${asText(schema)}, ${asText(table.table_name)}, ${rowText}::jsonb WHERE (${dupCondition});\n`);
                  }
                }
              });
              offset += chunkSize;
              }
              
              }
              if (withTx) {
                groupSql += "\nSET session_replication_role = origin;\n";
                groupSql += "SET row_security = on;\n";
                groupSql += "COMMIT;\n";
              }
              return groupSql;
          };

          if (split) {
            const files: Array<{ name: string; content: string; type: string }> = [];
            const ddlName = `schema-export-ddl.sql`;
            files.push({ name: ddlName, content: sqlContent, type: "text/plain" });
            const groups: any[][] = [];
            for (let i = 0; i < chosen.length; i += groupSize) {
              groups.push(chosen.slice(i, i + groupSize));
            }
            const reportParts: string[] = [];
            for (let i = 0; i < groups.length; i++) {
              const groupSql = await generateGroupSql(
                groups[i],
                true,
                (exportOptions as any).logSkippedRows,
                (exportOptions as any).logSkippedRows === 'file' ? reportParts : undefined
              );
              const idx = String(i + 1).padStart(2, '0');
              const fname = `schema-export-data-group-${idx}.sql`;
              files.push({ name: fname, content: groupSql, type: "text/plain" });
            }
            if ((exportOptions as any).logSkippedRows === 'file' && reportParts.length > 0) {
              const header = `CREATE TABLE IF NOT EXISTS "public"."import_skipped_rows" ("schema" text, "table" text, "row" jsonb, "created_at" timestamptz DEFAULT now());\n`;
              const report = header + reportParts.join("");
              files.push({ name: "skipped-rows-report.sql", content: report, type: "text/plain" });
            }
            let postSql = "";
            if (exportOptions.constraints) {
            try {
              const { data: constraintsDataAfter } = await supabase.rpc("get_table_constraints");
              const deferredChecks: { table: string; name: string; clause: string }[] = [];
              if (constraintsDataAfter && Array.isArray(constraintsDataAfter)) {
                for (const constraint of constraintsDataAfter) {
                  const type = (constraint.constraint_type || '').toString().toUpperCase();
                  if (type === 'CHECK') {
                    const tableName = String(constraint.table_name);
                    const cname = String(constraint.constraint_name);
                    const detailsRaw = (constraint.constraint_details || '').toString();
                    const clause = (() => {
                      const s = detailsRaw.trim();
                      if (s.startsWith('(') && s.endsWith(')')) return `CHECK ${s}`;
                      return `CHECK (${s})`;
                    })();
                    deferredChecks.push({ table: tableName, name: cname, clause });
                  }
                }
              }
              if (deferredChecks.length > 0) {
                postSql += "\n";
                deferredChecks.forEach((c) => {
                  postSql += `ALTER TABLE "public"."${c.table}" ADD CONSTRAINT "${c.name}" ${c.clause} NOT VALID;\n`;
                  postSql += `DO $$ BEGIN BEGIN ALTER TABLE "public"."${c.table}" VALIDATE CONSTRAINT "${c.name}"; EXCEPTION WHEN check_violation THEN RAISE NOTICE 'CHECK % failed validation on %', '${c.name}', '${c.table}'; END; END $$;\n`;
                });
              }
            } catch {}
            }
            if (exportOptions.schema) {
            try {
              const { data: seqOwners } = await supabase.rpc("execute_sql_query", {
                query_text:
                  "SELECT rel.relname AS table_name, att.attname AS column_name, regexp_replace(pg_get_expr(def.adbin, def.adrelid), 'nextval\\(''([^'']+)''::regclass\\)', '\\1') AS sequence_name FROM pg_class rel JOIN pg_namespace n ON n.oid=rel.relnamespace JOIN pg_attribute att ON att.attrelid=rel.oid AND att.attnum>0 JOIN pg_attrdef def ON def.adrelid=rel.oid AND def.adnum=att.attnum WHERE n.nspname='public' AND pg_get_expr(def.adbin, def.adrelid) LIKE 'nextval(%'",
              });
              if (Array.isArray(seqOwners)) {
                postSql += "\n";
                seqOwners.forEach((row: any) => {
                  const seq = row.sequence_name;
                  const tbl = row.table_name;
                  const col = row.column_name;
                  if (seq && tbl && col) {
                    postSql += `SELECT setval('"${seq}"', COALESCE((SELECT MAX("${col}") FROM "${tbl}"), 1));\n`;
                  }
                });
              }
            } catch {}
            }
            if (postSql.trim().length > 0) {
              files.push({ name: "schema-export-post.sql", content: postSql, type: "text/plain" });
            }
            await saveMultipleFiles(files);
            const exportedItems = Object.entries(exportOptions)
              .filter(([_, v]) => v)
              .map(([k]) => k)
              .join(", ");
            toast.success("SQL Export complete", { description: `Exported: ${exportedItems}; groups: ${Math.ceil(chosen.length / groupSize)}` });
            setLoading(false);
            return;
          }
          if (!split) {
            const dataSql = await generateGroupSql(chosen, true, (exportOptions as any).logSkippedRows);
            sqlContent += dataSql;
          }

          // Re-add deferred CHECK constraints and validate after data import
          if (exportOptions.constraints) {
          try {
            // We can only emit this if we actually collected deferred checks above.
            // Find any previously deferred checks by scanning what we appended earlier; alternatively,
            // maintain them in closure by re-querying constraints and matching TYPE=CHECK.
            const { data: constraintsDataAfter } = await supabase.rpc("get_table_constraints");
            const deferredChecks: { table: string; name: string; clause: string }[] = [];
            if (constraintsDataAfter && Array.isArray(constraintsDataAfter)) {
              for (const constraint of constraintsDataAfter) {
                const type = (constraint.constraint_type || '').toString().toUpperCase();
                if (type === 'CHECK') {
                  const tableName = String(constraint.table_name);
                  const cname = String(constraint.constraint_name);
                  const detailsRaw = (constraint.constraint_details || '').toString();
                  const clause = (() => {
                    const s = detailsRaw.trim();
                    if (s.startsWith('(') && s.endsWith(')')) return `CHECK ${s}`;
                    return `CHECK (${s})`;
                  })();
                  deferredChecks.push({ table: tableName, name: cname, clause });
                }
              }
            }

            if (deferredChecks.length > 0) {
              sqlContent += "\n-- Re-add deferred CHECK constraints and validate\n";
              deferredChecks.forEach((c) => {
                // Add NOT VALID first to avoid immediate full table scan erroring; then VALIDATE in a protected DO block
                sqlContent += `ALTER TABLE "public"."${c.table}" ADD CONSTRAINT "${c.name}" ${c.clause} NOT VALID;\n`;
                sqlContent += `DO $$ BEGIN BEGIN ALTER TABLE "public"."${c.table}" VALIDATE CONSTRAINT "${c.name}"; EXCEPTION WHEN check_violation THEN RAISE NOTICE 'CHECK % failed validation on %', '${c.name}', '${c.table}'; END; END $$;\n`;
              });
            }
          } catch {}
          }

          // Reset sequences to max values (best effort)
          if (exportOptions.schema) {
          try {
            const { data: seqOwners } = await supabase.rpc("execute_sql_query", {
              query_text:
                "SELECT rel.relname AS table_name, att.attname AS column_name, regexp_replace(pg_get_expr(def.adbin, def.adrelid), 'nextval\\(''([^'']+)''::regclass\\)', '\\1') AS sequence_name FROM pg_class rel JOIN pg_namespace n ON n.oid=rel.relnamespace JOIN pg_attribute att ON att.attrelid=rel.oid AND att.attnum>0 JOIN pg_attrdef def ON def.adrelid=rel.oid AND def.adnum=att.attnum WHERE n.nspname='public' AND pg_get_expr(def.adbin, def.adrelid) LIKE 'nextval(%'",
            });
            if (Array.isArray(seqOwners)) {
              sqlContent += "\n-- Reset sequences to current max\n";
              seqOwners.forEach((row: any) => {
                const seq = row.sequence_name;
                const tbl = row.table_name;
                const col = row.column_name;
                if (seq && tbl && col) {
                  sqlContent += `SELECT setval('"${seq}"', COALESCE((SELECT MAX("${col}") FROM "${tbl}"), 1));\n`;
                }
              });
            }
          } catch {}
          }
        }
      }

      const customSqlRaw = String((exportOptions as any).customDataSql || '').trim();
      if (customSqlRaw.length > 0) {
        const useRetry = Boolean((exportOptions as any).continuousRunOnError);
        if (useRetry) {
          const delayMs = Number((exportOptions as any).retryDelayMs) || 1000;
          const maxRetries = Number((exportOptions as any).maxRetries) || 10;
          const escaped = customSqlRaw.replace(/\\/g, "\\\\").replace(/'/g, "''");
          sqlContent += `DO $$\nDECLARE attempts int := 0; delay_ms int := ${delayMs}; max_retries int := ${maxRetries}; sql_text text := '${escaped}'; stmts text[]; stmt text;\nBEGIN\n  stmts := regexp_split_to_array(sql_text, ';');\n  LOOP\n    BEGIN\n      FOREACH stmt IN ARRAY stmts LOOP\n        stmt := btrim(stmt);\n        IF stmt <> '' THEN EXECUTE stmt; END IF;\n      END LOOP;\n      EXIT;\n    EXCEPTION WHEN OTHERS THEN\n      attempts := attempts + 1;\n      IF attempts >= max_retries THEN RAISE; END IF;\n      PERFORM pg_sleep(delay_ms::numeric / 1000.0);\n    END;\n  END LOOP;\nEND $$;\n`;
        } else {
          sqlContent += customSqlRaw.endsWith(';') ? customSqlRaw + '\n' : customSqlRaw + ';\n';
        }
      }

      await saveFile(`schema-export.sql`, sqlContent, "text/plain");
      
      const exportedItems = Object.entries(exportOptions)
        .filter(([_, v]) => v)
        .map(([k]) => k)
        .join(", ");
      toast.success("SQL Export complete", { description: `Exported: ${exportedItems}` });
    } catch (e: any) {
      toast.error("SQL Export failed", { description: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  // New: Export full restore bundle (SQL + manifest for edge/secrets)
  const exportFullRestoreBundleSQL = async () => {
    // Force-enable all options for a comprehensive export
    setExportOptions((prev) => ({
      ...prev,
      schema: true,
      constraints: true,
      indexes: true,
      dbFunctions: true,
      rlsPolicies: true,
      enums: true,
      views: true,
      materializedViews: true,
      triggers: true,
      edgeFunctions: true,
      secrets: true,
      tableData: true,
      fkOrderEnabled: true,
    }));
    setLoading(true);
    try {
      // Generate SQL using enhanced exportSchemaSQL logic
      await exportSchemaSQL();

      // Create edge/secrets manifest (names only)
      try {
        const { data: edgeResp } = await supabase.functions.invoke("list-edge-functions");
        const manifest = {
          exported_at: new Date().toISOString(),
          edge_functions: edgeResp?.edge_functions || [],
          secrets: edgeResp?.secrets || [],
          note: "Edge functions and secrets are not created via SQL. Use Supabase CLI to deploy functions and recreate secrets (names only included).",
        };
        await saveFile(`edge-manifest.json`, JSON.stringify(manifest, null, 2), "application/json");
      } catch {}

      toast.success("Full restore bundle exported", { description: "SQL + edge manifest saved" });
    } catch (e: any) {
      toast.error("Full restore export failed", { description: e.message || String(e) });
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
    startProgress('Creating full backup...');
    try {
      const timestamp = new Date().toISOString();
      const backup: any = {
        backup_type: 'full',
        timestamp,
        tables: {},
      };

      // Export all table data
      const totalTables = tables.length || 1;
      let doneTables = 0;
      for (const table of tables) {
        const { data, error } = await supabase.from(table.table_name).select("*");
        if (error) {
          console.error(`Failed to backup ${table.table_name}:`, error.message);
          doneTables++;
          updateProgress((doneTables / totalTables) * 100, `Backing up ${table.table_name} (error)`);
          continue;
        }
        backup.tables[table.table_name] = data || [];
        doneTables++;
        updateProgress((doneTables / totalTables) * 100, `Backing up ${table.table_name}`);
      }

      await saveFile(`full-backup-${timestamp}.json`, JSON.stringify(backup, null, 2), "application/json");
      endProgress();
      
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
    startProgress('Creating incremental backup...');
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
      const totalTables = tables.length || 1;
      let doneTables = 0;
      for (const table of tables) {
        const { data, error } = await supabase
          .from(table.table_name)
          .select("*")
          .or(`created_at.gte.${lastBackupTime},updated_at.gte.${lastBackupTime}`);
        
        if (error) {
          console.error(`Failed to backup ${table.table_name}:`, error.message);
          doneTables++;
          updateProgress((doneTables / totalTables) * 100, `Checking ${table.table_name} (error)`);
          continue;
        }
        
        if (data && data.length > 0) {
          backup.tables[table.table_name] = data;
          totalChanges += data.length;
        }
        doneTables++;
        updateProgress((doneTables / totalTables) * 100, `Checking ${table.table_name}`);
      }

      if (totalChanges === 0) {
        toast.message("No changes to backup", { 
          description: "Database has no changes since last backup." 
        });
        endProgress();
        setLoading(false);
        return;
      }

      await saveFile(`incremental-backup-${timestamp}.json`, JSON.stringify(backup, null, 2), "application/json");
      endProgress();
      
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

  const applyRestoreFromBackup = async (backup: any) => {
    if (!backup.backup_type || !backup.tables) {
      throw new Error('Invalid backup file format');
    }

    let totalRestored = 0;
    let errors = 0;
    const logs: Array<{ time: string; table: string; action: 'insert' | 'upsert'; status: 'success' | 'error'; message?: string }> = [];
    const now = () => new Date().toISOString();

    // Calculate total records for progress
    const totalRecords = Object.values(backup.tables).reduce((sum, records) => {
      const arr = Array.isArray(records) ? records : [];
      return sum + arr.length;
    }, 0) || 1;
    let processed = 0;
    startProgress('Restoring backup...');

    for (const [tableName, records] of Object.entries(backup.tables)) {
      const recordsArray = records as any[];
      for (const record of recordsArray) {
        if (restoreMode === 'upsert') {
          const { error } = await (supabase as any)
            .from(tableName as string)
            .upsert(record, { onConflict: 'id' });
          if (error) {
            console.error(`Error upserting to ${tableName}:`, error.message);
            errors++;
            logs.push({ time: now(), table: tableName as string, action: 'upsert', status: 'error', message: error.message });
          } else {
            totalRestored++;
            logs.push({ time: now(), table: tableName as string, action: 'upsert', status: 'success' });
          }
        } else {
          const { error } = await (supabase as any)
            .from(tableName as string)
            .insert(record);
          if (error) {
            console.error(`Error inserting to ${tableName}:`, error.message);
            errors++;
            logs.push({ time: now(), table: tableName as string, action: 'insert', status: 'error', message: error.message });
          } else {
            totalRestored++;
            logs.push({ time: now(), table: tableName as string, action: 'insert', status: 'success' });
          }
        }
        processed++;
        if (processed % 5 === 0 || processed === totalRecords) {
          updateProgress((processed / totalRecords) * 100, `Restoring ${tableName}`);
        }
      }
    }

    setRestoreLogs(logs);
    setRestoreSummary({ restored: totalRestored, errors });

    endProgress();

    if (errors > 0) {
      toast.warning('Restore completed with errors', { description: `Restored ${totalRestored} records, ${errors} failed` });
    } else {
      toast.success('Database restored successfully', { description: `Restored ${totalRestored} records from backup` });
    }
  };

  const restoreDatabase = async () => {
    if (restoreSource === 'device') {
      if (!restoreFile) {
        toast.error('No file selected', { description: 'Please select a backup file to restore.' });
        return;
      }
      // Detect file type early and route SQL dumps to CLI wizard
      const ext = getExtension(restoreFile.name);
      if (ext !== 'json') {
        // Show inline commands in Restore tab instead of switching
        if (restoreDbUrl.trim()) {
          setRestoreInlineCommands(generateInlineRestoreCommands(restoreDbUrl.trim(), restoreFile.name));
          toast.message('SQL dump detected', { description: 'Use the inline command below to restore.' });
        } else {
          setRestoreInlineCommands(null);
          toast.message('SQL dump detected', { description: 'Enter Database URL to see the exact command.' });
        }
        return;
      }
      setLoading(true);
      try {
        const fileContent = await restoreFile.text();
        let backup: any;
        try {
          backup = JSON.parse(fileContent);
        } catch (parseErr: any) {
          throw new Error('Invalid backup file format: expected JSON');
        }
        await applyRestoreFromBackup(backup);
        setRestoreFile(null);
      } catch (e: any) {
        toast.error('Restore failed', { description: e.message || String(e) });
      } finally {
        setLoading(false);
      }
    } else {
      // Cloud restore
      await downloadCloudBackupAndRestore();
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <Tabs value={dbTab} onValueChange={(v) => setDbTab(v as any)} className="w-full">
        <TabsList className="flex w-full flex-wrap gap-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
          <TabsTrigger value="restore">Restore</TabsTrigger>
          <TabsTrigger value="cli">CLI Wizard</TabsTrigger>
          <TabsTrigger value="downloads">Downloads</TabsTrigger>
        </TabsList>
      </Tabs>
      
      {/* Process Actions Toolbar */}
      {dbTab !== 'overview' && (
        <Card className="sticky top-0 z-10">
          <CardContent className="py-3">
            <TooltipProvider>
              <div className="flex flex-wrap items-center gap-3">
                {/* Import/Export group */}
                {dbTab === 'backup' && (
                  <>
                    <span className="text-xs font-medium text-muted-foreground">Import/Export</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="secondary" size="sm" onClick={exportSchemaSQL} disabled={loading}>
                          Export SQL
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Generate full SQL for schema/data based on options</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={exportSchemaMetadata} disabled={loading}>
                          Export Components
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Export selected schema components to JSON</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="outline" onClick={exportSelectedCSV} disabled={loading || selectedCount === 0}>
                          Export CSV
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{selectedCount === 0 ? 'Select tables to export as CSV' : `Export ${selectedCount} selected table(s) as CSV`}</TooltipContent>
                    </Tooltip>
                    <span className="text-[11px] text-muted-foreground">{selectedCount} selected</span>
                    <Separator orientation="vertical" className="h-5" />
                  </>
                )}

                {/* Backup group */}
                {(dbTab === 'backup' || dbTab === 'cli') && (
                  <>
                    <span className="text-xs font-medium text-muted-foreground">Backup</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" onClick={exportFullBackup} disabled={loading}>
                          Backup All Data (JSON)
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Create JSON backup of all tables</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={exportIncrementalBackup} disabled={loading || !lastBackupTime}>
                          Backup Changes (JSON)
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{lastBackupTime ? 'Export changes since last backup' : 'Create a full backup first'}</TooltipContent>
                    </Tooltip>
                  </>
                )}

                {/* Restore group */}
                {(dbTab === 'restore' || dbTab === 'cli') && (
                  <>
                    <span className="text-xs font-medium text-muted-foreground">Restore</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          size="sm"
                          onClick={restoreDatabase}
                          disabled={loading || (restoreSource === 'device' ? !restoreFile : !selectedCloudBackup)}
                        >
                          Restore from JSON Backup
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{restoreSource === 'device' ? (restoreFile ? 'Restore selected JSON backup' : 'Select a JSON backup file') : (selectedCloudBackup ? 'Restore selected cloud JSON backup' : 'Select a cloud backup file')}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={listCloudBackupsForRestore} disabled={loading}>
                          List Cloud Backups
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Refresh list of available cloud backups</TooltipContent>
                    </Tooltip>
                  </>
                )}

                {/* Run group (CLI) */}
                {dbTab === 'cli' && (
                  <>
                    <span className="text-xs font-medium text-muted-foreground">Run</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="secondary" size="sm" onClick={generateCliCommands}>
                          Generate Commands
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Build pg_dump/pg_restore/psql commands</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={async () => { 
                            try { 
                              if (!cliCommands) { 
                                toast.message('No commands to copy', { description: 'Generate commands first.' }); 
                                return; 
                              }
                              await navigator.clipboard.writeText(cliCommands); 
                              toast.success('Commands copied'); 
                            } catch (err: any) { 
                              toast.error('Copy failed', { description: err?.message || String(err) }); 
                            } 
                          }}
                          disabled={!cliCommands}
                        >
                          Copy Commands
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy generated commands to clipboard</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" onClick={runCliWithPrompt} disabled={cliRunning || !cliCommands}>
                          {cliRunning ? 'Running…' : 'Run Primary'}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Browser cannot run commands; this stages and logs the run</TooltipContent>
                    </Tooltip>
                  </>
                )}

                {/* Inline progress meter (always visible while active) */}
                {progressActive && (
                  <div className="ml-auto flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground truncate max-w-[240px]">{progressLabel}</span>
                    <Progress value={progressValue} className="w-28" />
                    <span className="text-muted-foreground">{progressValue}%</span>
                  </div>
                )}
              </div>
            </TooltipProvider>
          </CardContent>
        </Card>
      )}

      {dbTab === 'overview' && (
        <Card>
          <CardHeader>
            <CardTitle>Database Management Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">Use tabs to perform backups, restores, and CLI operations with a structured flow.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Backup: Create full or incremental backups, choose save destination.</li>
              <li>Restore: Restore JSON backups in-app; download SQL dumps and restore via CLI.</li>
              <li>CLI Wizard: Generate `pg_dump`, `pg_restore`, and `psql` commands, analyze output.</li>
              <li>Downloads: Manage manual download links staged by the app.</li>
            </ul>
            <div className="mt-3 space-y-2">
              <Label htmlFor="overview-row-filter" className="text-sm font-medium">Row filter (SQL WHERE)</Label>
              <Input id="overview-row-filter" value={(exportOptions as any).rowFilterWhere} onChange={(e) => setExportOptions(prev => ({ ...prev, rowFilterWhere: e.target.value }))} placeholder="e.g., received_at >= '2024-01-01' AND tenant_id = '...'" />
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={exportSchemaSQL} disabled={loading}>Quick Export SQL</Button>
              </div>
              <div className="mt-3 space-y-2">
                <Label className="text-sm font-medium">Custom Data SQL (optional)</Label>
                <Textarea value={(exportOptions as any).customDataSql}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, customDataSql: e.target.value }))}
                  placeholder="Enter SQL statements to insert table data. Separate statements with semicolons." />
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="flex items-center space-x-2">
                    <Switch checked={Boolean((exportOptions as any).continuousRunOnError)}
                      onCheckedChange={(v) => setExportOptions(prev => ({ ...prev, continuousRunOnError: v }))} />
                    <Label className="font-normal cursor-pointer">Continuous run on error</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Label className="font-normal">Retry delay (ms)</Label>
                    <Input type="number" value={Number((exportOptions as any).retryDelayMs) || 0}
                      onChange={(e) => setExportOptions(prev => ({ ...prev, retryDelayMs: Number(e.target.value || 0) }))} />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Label className="font-normal">Max retries</Label>
                    <Input type="number" value={Number((exportOptions as any).maxRetries) || 0}
                      onChange={(e) => setExportOptions(prev => ({ ...prev, maxRetries: Number(e.target.value || 0) }))} />
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Applies to selected tables and respects the WHERE filter.</p>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Save Settings (Backup tab) */}
      {dbTab === 'backup' && (
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
      )}

      {/* Supabase CLI Wizard (CLI tab) */}
      {dbTab === 'cli' && (
      <Card>
        <CardHeader>
          <CardTitle>Supabase CLI Wizard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Generate guided commands to backup/restore using Supabase CLI or Postgres tools.</p>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="cli-op" className="text-sm font-medium mb-2 block">Operation</Label>
              <RadioGroup value={cliOperation} onValueChange={(v) => setCliOperation(v as 'backup' | 'restore')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="backup" id="cli-op-backup" />
                  <Label htmlFor="cli-op-backup" className="font-normal cursor-pointer">Backup</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="restore" id="cli-op-restore" />
                  <Label htmlFor="cli-op-restore" className="font-normal cursor-pointer">Restore</Label>
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label htmlFor="cli-preset" className="text-sm font-medium mb-2 block">Preset</Label>
              <RadioGroup value={cliPreset} onValueChange={(v) => applyPreset(v as 'full' | 'incremental')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="full" id="cli-preset-full" />
                  <Label htmlFor="cli-preset-full" className="font-normal cursor-pointer">Full (schema + data)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="incremental" id="cli-preset-incremental" />
                  <Label htmlFor="cli-preset-incremental" className="font-normal cursor-pointer">Incremental (data-first)</Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground mt-1">Presets auto-select flags and generate minimal commands.</p>
            </div>
            <div>
              <Label htmlFor="cli-project-ref" className="text-sm font-medium mb-2 block">Project Ref (optional)</Label>
              <Input id="cli-project-ref" value={cliProjectRef} onChange={(e) => setCliProjectRef(e.target.value)} placeholder="e.g., abcd1234" className="max-w-md" />
              <p className="text-xs text-muted-foreground mt-1">Used by <code>supabase link</code> for project context.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="cli-db-url" className="text-sm font-medium mb-2 block">Database URL (required)</Label>
              <Input id="cli-db-url" value={cliDbUrl} onChange={(e) => setCliDbUrl(e.target.value)} placeholder="postgres://..." className="max-w-md" />
              <p className="text-xs text-muted-foreground mt-1">Find in Supabase Project → Settings → Database → Connection string.</p>
              {cliDbUrl && (() => {
                const parsed = parsePostgresUrl(cliDbUrl);
                if (!parsed) return (
                  <p className="text-xs text-destructive mt-1">Invalid URL. Expected format like postgresql://user:pass@host:5432/db?sslmode=require</p>
                );
                const preflight = buildPreflightCommands(parsed.host, parsed.port || 5432);
                const pooling = isSupabasePoolerHostname(parsed.host);
                return (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-muted-foreground">Host: {parsed.host} · Port: {parsed.port || 5432} · Database: {parsed.database}</p>
                    {pooling && (
                      <p className="text-xs text-amber-600">Pooling host detected (PgBouncer). Prefer the Direct host for full restores.</p>
                    )}
                    {preflight && (
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Preflight (DNS/TCP)</Label>
                        <Textarea readOnly value={preflight} className="font-mono text-[11px] min-h-[84px]" />
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(preflight); toast.success('Preflight copied'); } catch { toast.error('Copy failed'); } }}>
                            Copy Preflight
                          </Button>
                          <Button variant="secondary" size="sm" onClick={testDbConnection} disabled={connTesting}>
                            {connTesting ? 'Testing…' : 'Test Connection'}
                          </Button>
                        </div>
                        {connResult && (
                          <div className="text-[11px] space-y-1">
                            <p className={"mt-1 " + (connResult.dns?.ok ? 'text-green-700' : 'text-destructive')}>DNS: {connResult.dns?.ok ? 'Pass' : 'Fail'}{connResult.dns?.addresses?.length ? ` (${connResult.dns.addresses.join(', ')})` : ''}</p>
                            <p className="text-muted-foreground">{connResult.dns?.message}</p>
                            <p className="text-muted-foreground">TCP: {connResult.tcp?.message}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
            <div>
              <Label htmlFor="cli-output-file" className="text-sm font-medium mb-2 block">Output/Input File</Label>
              <Input id="cli-output-file" value={cliOutputFile} onChange={(e) => setCliOutputFile(e.target.value)} placeholder={cliOperation === 'backup' ? 'backup.sql' : 'backup-to-restore.sql'} className="max-w-md" />
              <p className="text-xs text-muted-foreground mt-1">For backup: destination file. For restore: source file.</p>
            </div>
          </div>

          {cliOperation === 'restore' && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cli-dump-file" className="text-sm font-medium">Select Dump File (.sql/.dump)</Label>
                <Input id="cli-dump-file" type="file" accept=".sql,.dump,.tar" onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setCliDumpFile(f);
                  if (f) setCliOutputFile(f.name);
                }} />
                <p className="text-xs text-muted-foreground">Pick a local dump to stage for restore.</p>
                {cliOutputFile && (
                  <p className="text-xs text-muted-foreground">
                    Detected: {getExtension(cliOutputFile) || 'file'}{getExtension(cliOutputFile) === 'sql' ? ' — plain SQL restores schema objects and table data via psql.' : ' — custom dumps support selective schema/data restore via pg_restore.'}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cli-cloud-path" className="text-sm font-medium">Cloud Path</Label>
                <Input id="cli-cloud-path" value={cliCloudPath} onChange={(e) => setCliCloudPath(e.target.value)} placeholder="e.g., db-exports" className="max-w-md" />
                <p className="text-xs text-muted-foreground">Uploads to: db-backups/your-user/{cliCloudPath || '(root)'}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cli-signed-ttl" className="text-sm font-medium">Signed URL TTL (seconds)</Label>
                <Input id="cli-signed-ttl" type="number" min={60} value={cliSignedTtl} onChange={(e) => setCliSignedTtl(Number(e.target.value) || 3600)} className="max-w-md" />
                <p className="text-xs text-muted-foreground">Default 3600 (1 hour). Increase for longer restores.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  disabled={!cliDumpFile || cliRunning}
                  onClick={async () => {
                    if (!cliDumpFile) return;
                    try {
                      startProgress('Uploading dump to cloud...');
                      const blob = cliDumpFile;
                      const type = cliDumpFile.type || 'application/octet-stream';
                      const finalPath = await uploadBlobToCloud(cliDumpFile.name, blob, type, cliCloudPath);
                      if (!finalPath) {
                        endProgress();
                        return;
                      }
                      setCliUploadedPath(finalPath);
                      endProgress();
                      toast.success('Dump uploaded', { description: finalPath });
                      addCliActivity('upload_dump', finalPath);
                    } catch (err: any) {
                      endProgress();
                      toast.error('Upload failed', { description: err?.message || String(err) });
                      addCliActivity('upload_error', String(err?.message || err));
                    }
                  }}
                >
                  Upload Dump to Cloud
                </Button>
                <Button
                  onClick={generateSignedRestoreScript}
                  disabled={!cliUploadedPath || !cliDbUrl}
                >
                  Generate Signed Restore Script
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      if (!cliCommands) {
                        toast.message('No script to copy', { description: 'Generate the signed restore script first.' });
                        return;
                      }
                      await navigator.clipboard.writeText(cliCommands);
                      toast.success('Signed script copied');
                      addCliActivity('copy_script', 'Copied signed restore script to clipboard');
                    } catch (err: any) {
                      toast.error('Copy failed', { description: err?.message || String(err) });
                      addCliActivity('copy_script_error', String(err?.message || err));
                    }
                  }}
                  disabled={!cliCommands}
                >
                  Copy Signed Script
                </Button>
              </div>
              {cliUploadedPath && (
                <p className="text-xs text-muted-foreground">Uploaded path: {cliUploadedPath}</p>
              )}
              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm font-medium">Activity</Label>
                <div className="border rounded-md p-2 max-h-40 overflow-auto text-xs">
                  {cliActivity.length === 0 ? (
                    <p className="text-muted-foreground">No activity yet</p>
                  ) : (
                    cliActivity.slice(-10).map((a, idx) => (
                      <div key={`${a.time}-${idx}`} className="flex gap-2">
                        <span className="text-muted-foreground">{new Date(a.time).toLocaleString()}</span>
                        <span className="font-medium">{a.action}</span>
                        <span className="break-all">{a.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {cliOperation === 'backup' && (
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="cli-format" className="text-sm font-medium mb-2 block">Dump Format</Label>
                <RadioGroup value={cliFormat} onValueChange={(v) => setCliFormat(v as 'plain' | 'custom')}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="plain" id="cli-format-plain" />
                    <Label htmlFor="cli-format-plain" className="font-normal cursor-pointer">Plain SQL</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custom" id="cli-format-custom" />
                    <Label htmlFor="cli-format-custom" className="font-normal cursor-pointer">Custom (pg_restore)</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="cli-schema-only" checked={cliSchemaOnly} onCheckedChange={(v) => setCliSchemaOnly(Boolean(v))} />
                <Label htmlFor="cli-schema-only" className="font-normal cursor-pointer">Schema only</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="cli-data-only" checked={cliDataOnly} onCheckedChange={(v) => setCliDataOnly(Boolean(v))} />
                <Label htmlFor="cli-data-only" className="font-normal cursor-pointer">Data only</Label>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={generateCliCommands}>Generate Commands</Button>
            {cliCommands && (
              <Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(cliCommands); toast.success('Commands copied'); } catch { toast.error('Failed to copy'); } }}>
                Copy Commands
              </Button>
            )}
            {cliCommands && (
              <Button onClick={runCliWithPrompt} disabled={cliRunning}>
                {cliRunning ? 'Running…' : 'Run Primary Command'}
              </Button>
            )}
          </div>

          {cliCommands && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">CLI Commands</Label>
              <Textarea value={cliCommands} readOnly className="min-h-40 font-mono text-xs" />
              <p className="text-xs text-muted-foreground">Run these in your terminal. Use Option B if your Supabase CLI version doesn’t support remote DB flags.</p>
              {cliLastRunAt && (
                <p className="text-xs text-muted-foreground">Last staged run: {new Date(cliLastRunAt).toLocaleString()}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="cli-logs" className="text-sm font-medium">Paste CLI Output (optional)</Label>
            <Textarea id="cli-logs" value={cliLogs} onChange={(e) => setCliLogs(e.target.value)} placeholder="Paste output from supabase/pg_dump/psql here to analyze for errors" className="min-h-40 font-mono text-xs" />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={analyzeCliLogs}>Analyze Logs</Button>
              {cliAnalysis && (
                <p className="text-xs text-muted-foreground">Errors: {cliAnalysis.errors}, Fatals: {cliAnalysis.fatals}, Warnings: {cliAnalysis.warnings}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {dbTab === 'downloads' && (
        <Card>
          <CardHeader>
            <CardTitle>Manual Downloads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Your browser may block automatic downloads. Use the links below to save files staged by the app.</p>
            <div className="space-y-2">
              {pendingDownloads.length === 0 ? (
                <p className="text-sm text-muted-foreground">No staged downloads yet.</p>
              ) : (
                pendingDownloads.map((d, i) => (
                  <div key={`${d.name}-${i}`} className="flex items-center justify-between gap-2">
                    <a href={d.url} download={d.name} className="text-primary underline break-all">{d.name}</a>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={clearPendingDownloads}>Clear</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {dbTab === 'backup' && (
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
                Backup All Data (JSON)
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
                Backup Changes (JSON)
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Full Restore Bundle (SQL)</h3>
                <p className="text-sm text-muted-foreground">
                  Generate SQL to recreate all objects (IF NOT EXISTS) then data,
                  plus edge/secrets manifest for Supabase restore
                </p>
              </div>
              <Button 
                variant="secondary" 
                onClick={exportFullRestoreBundleSQL} 
                disabled={loading}
              >
                Export Full Restore SQL
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {dbTab === 'restore' && (
      <Card>
        <CardHeader>
          <CardTitle>Database Restore</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Restore Source</label>
                <RadioGroup value={restoreSource} onValueChange={(v) => setRestoreSource(v as 'device' | 'cloud')} className="mt-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="device" id="restore-device" />
                    <Label htmlFor="restore-device" className="font-normal cursor-pointer">Device (Local File)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cloud" id="restore-cloud" />
                    <Label htmlFor="restore-cloud" className="font-normal cursor-pointer">Cloud Storage (Supabase)</Label>
                  </div>
                </RadioGroup>
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
            </div>

            {restoreSource === 'device' && (
              <div>
                <label className="text-sm font-medium">Select Backup File</label>
                <input
                  type="file"
                  accept=".json,.sql,.dump,.tar"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setRestoreFile(f);
                    if (f && getExtension(f.name) !== 'json') {
                      // Generate inline commands if DB URL is provided
                      if (restoreDbUrl.trim()) {
                        setRestoreInlineCommands(generateInlineRestoreCommands(restoreDbUrl.trim(), f.name));
                      } else {
                        setRestoreInlineCommands(null);
                      }
                    } else {
                      setRestoreInlineCommands(null);
                    }
                  }}
                  className="mt-2 block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
                {restoreFile && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Selected: {restoreFile.name}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Restores JSON backups here. For .sql/.dump files, use the CLI Wizard tab.
                </p>

                {restoreFile && getExtension(restoreFile.name) !== 'json' && (
                  <div className="mt-3 space-y-2">
                    <Label htmlFor="restore-db-url" className="text-sm font-medium">Database URL (optional, for SQL restore)</Label>
                    <Input
                      id="restore-db-url"
                      value={restoreDbUrl}
                      onChange={(e) => {
                        const next = e.target.value;
                        setRestoreDbUrl(next);
                        if (restoreFile && getExtension(restoreFile.name) !== 'json') {
                          if (next.trim()) {
                            setRestoreInlineCommands(generateInlineRestoreCommands(next.trim(), restoreFile.name));
                          } else {
                            setRestoreInlineCommands(null);
                          }
                        }
                      }}
                      placeholder="postgres://..."
                      className="max-w-md"
                    />
                    <p className="text-xs text-muted-foreground">Use Supabase Postgres URL. Include `sslmode=require` if needed.</p>

                    {restoreInlineCommands ? (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Restore Command</Label>
                        <pre className="text-xs bg-muted rounded p-3 overflow-auto"><code>{restoreInlineCommands}</code></pre>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(restoreInlineCommands || '')}>Copy Commands</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Enter Database URL to see command.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {restoreSource === 'cloud' && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="cloud-restore-path" className="text-sm font-medium mb-2 block">Cloud Path</Label>
                  <Input
                    id="cloud-restore-path"
                    value={cloudRestorePath}
                    onChange={(e) => setCloudRestorePath(e.target.value)}
                    placeholder="e.g., db-exports"
                    className="max-w-md"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Listing from: db-backups/{cloudRestorePath || '(root)'} under your user folder</p>
                  <p className="text-xs text-muted-foreground mt-1">Note: JSON backups can be restored here. For .sql/.dump files, enter your Database URL below to generate restore commands.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={listCloudBackupsForRestore} disabled={loading}>Refresh List</Button>
                </div>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File</TableHead>
                        <TableHead className="hidden md:table-cell">Updated</TableHead>
                        <TableHead className="hidden md:table-cell">Size</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cloudRestoreFiles.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-sm text-muted-foreground">No files found</TableCell>
                        </TableRow>
                      ) : (
                        cloudRestoreFiles.map((f) => (
                          <TableRow key={f.name} className={selectedCloudBackup === f.name ? 'bg-muted/40' : ''} onClick={() => setSelectedCloudBackup(f.name)}>
                            <TableCell className="break-all">
                              {f.name}
                              <span className="ml-2 inline-block text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                {getExtension(f.name) || 'file'}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="ml-2 h-6 px-2 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCloudBackup(f.name);
                                  // Focus DB URL and generate commands immediately if URL is present
                                  setTimeout(() => {
                                    restoreDbUrlRef.current?.focus();
                                    restoreDbUrlRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    if (restoreDbUrl && restoreDbUrl.trim()) {
                                      setRestoreInlineCommands(generateInlineRestoreCommands(restoreDbUrl.trim(), f.name));
                                    } else {
                                      setRestoreInlineCommands(null);
                                    }
                                  }, 0);
                                }}
                              >
                                Generate Command
                              </Button>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">{f.updated_at ? new Date(f.updated_at).toLocaleString() : '-'}</TableCell>
                            <TableCell className="hidden md:table-cell">{typeof f.size === 'number' ? `${f.size} B` : '-'}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {selectedCloudBackup && (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Selected: {selectedCloudBackup}
                      <span className="ml-2 inline-block text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {getExtension(selectedCloudBackup) || 'file'}
                      </span>
                    </p>

                    {getExtension(selectedCloudBackup) === 'json' ? (
                      <p className="text-xs text-muted-foreground">
                        JSON backups can be restored in-app using “Restore Selected (JSON only)”.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="cloud-restore-db-url" className="text-sm font-medium">Database URL (optional, for SQL restore)</Label>
                        <Input
                          id="cloud-restore-db-url"
                          ref={restoreDbUrlRef}
                          value={restoreDbUrl}
                          onChange={(e) => {
                            const next = e.target.value;
                            setRestoreDbUrl(next);
                            if (next.trim()) {
                              setRestoreInlineCommands(generateInlineRestoreCommands(next.trim(), selectedCloudBackup));
                            } else {
                              setRestoreInlineCommands(null);
                            }
                          }}
                          placeholder="postgres://..."
                          className="max-w-md"
                        />
                        <p className="text-xs text-muted-foreground">Use Supabase Postgres URL. Include `sslmode=require` if needed.</p>

                        {restoreInlineCommands ? (
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Restore Command</Label>
                            <pre className="text-xs bg-muted rounded p-3 overflow-auto"><code>{restoreInlineCommands}</code></pre>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(restoreInlineCommands || '')}>Copy Commands</Button>
                              <Button variant="secondary" size="sm" onClick={() => setRunLocallyOpen(true)}>Run Locally Guide</Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">Enter Database URL to see command.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" onClick={downloadSelectedCloudFile} disabled={loading || !selectedCloudBackup}>
                    Download Selected
                  </Button>
                  <Button onClick={downloadCloudBackupAndRestore} disabled={loading || !selectedCloudBackup}>
                    Restore Selected (JSON only)
                  </Button>
                </div>
                {/* Run Locally Guide Modal */}
                <Dialog open={runLocallyOpen} onOpenChange={setRunLocallyOpen}>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Run Locally Guide</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 text-sm">
                      <p className="text-muted-foreground">Use these steps to install tools and run the generated commands.</p>
                      <div>
                        <p className="font-medium">macOS</p>
                        <pre className="text-xs bg-muted rounded p-3 overflow-auto"><code>brew install postgresql
psql --version
pg_restore --version</code></pre>
                      </div>
                      <div>
                        <p className="font-medium">Linux (Debian/Ubuntu)</p>
                        <pre className="text-xs bg-muted rounded p-3 overflow-auto"><code>sudo apt-get update
sudo apt-get install postgresql-client
psql --version
pg_restore --version</code></pre>
                      </div>
                      <div>
                        <p className="font-medium">Windows</p>
                        <p className="text-xs text-muted-foreground">Install PostgreSQL from the official installer and ensure `psql.exe` and `pg_restore.exe` are in PATH.</p>
                      </div>
                      {restoreInlineCommands && (
                        <div>
                          <p className="font-medium">Your Command</p>
                          <pre className="text-xs bg-muted rounded p-3 overflow-auto"><code>{restoreInlineCommands}</code></pre>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(restoreInlineCommands || '')}>Copy Commands</Button>
                            <Button size="sm" onClick={() => setRunLocallyOpen(false)}>Close</Button>
                          </div>
                        </div>
                      )}
                      {!restoreInlineCommands && (
                        <div>
                          <p className="text-xs text-muted-foreground">Enter a valid Database URL and select a .sql/.dump/.tar file to generate commands.</p>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => setRunLocallyOpen(false)}>Close</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {/* Restore button moved to Process toolbar above for better visibility */}

            {/* Restore Logs */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Restore Logs</h3>
              {restoreSummary && (
                <p className="text-xs text-muted-foreground">Restored {restoreSummary.restored} record(s); {restoreSummary.errors} error(s)</p>
              )}
              <div className="max-h-64 overflow-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {restoreLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-sm text-muted-foreground">No restore activity yet</TableCell>
                      </TableRow>
                    ) : (
                      restoreLogs.map((l, idx) => (
                        <TableRow key={`${l.time}-${idx}`}>
                          <TableCell className="text-xs">{new Date(l.time).toLocaleString()}</TableCell>
                          <TableCell className="text-xs">{l.table}</TableCell>
                          <TableCell className="text-xs">{l.action}</TableCell>
                          <TableCell className="text-xs">{l.status}</TableCell>
                          <TableCell className="text-xs break-all">{l.message || ''}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="fk-order-enabled" 
                    checked={(exportOptions as any).fkOrderEnabled}
                    onCheckedChange={(v: any) => setExportOptions(prev => ({ ...prev, fkOrderEnabled: Boolean(v) }))}
                  />
                  <label htmlFor="fk-order-enabled" className="text-sm">Enable FK-based insert order</label>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="data-chunk-size" className="text-sm">Chunk size</Label>
                  <Input 
                    id="data-chunk-size" 
                    type="number" 
                    min={100} 
                    step={100} 
                    className="w-28"
                    value={(exportOptions as any).dataChunkSize}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, dataChunkSize: Number(e.target.value) || 1000 }))}
                  />
                </div>
                <div className="flex items-center gap-2 w-full">
                  <Label htmlFor="row-filter-where" className="text-sm">Row filter (SQL WHERE)</Label>
                  <Input
                    id="row-filter-where"
                    className="flex-1"
                    placeholder="e.g., received_at >= '2024-01-01' AND tenant_id = '..." 
                    value={(exportOptions as any).rowFilterWhere}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, rowFilterWhere: e.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="split-data-groups" 
                    checked={(exportOptions as any).splitDataGroups}
                    onCheckedChange={(v: any) => setExportOptions(prev => ({ ...prev, splitDataGroups: Boolean(v) }))}
                  />
                  <label htmlFor="split-data-groups" className="text-sm">Split data into groups</label>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="data-group-size" className="text-sm">Tables per group</Label>
                  <Input 
                    id="data-group-size" 
                    type="number" 
                    min={1} 
                    step={1} 
                    className="w-28"
                    value={(exportOptions as any).dataGroupSize}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, dataGroupSize: Math.max(1, Number(e.target.value) || 6) }))}
                    disabled={!(exportOptions as any).splitDataGroups}
                  />
                </div>
              </div>
              {dbTab === 'backup' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-medium">Select tables to export:</div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Checkbox id="select-all-tables" checked={allSelected} onCheckedChange={(v: any) => toggleAll(Boolean(v))} />
                        <label htmlFor="select-all-tables" className="text-sm">Select all tables</label>
                      </div>
                    </div>
                  </div>
                  <div className="border rounded-md max-h-72 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead style={{ width: 50 }}></TableHead>
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
                            <TableCell>{t.rls_enabled ? 'On' : 'Off'}</TableCell>
                            <TableCell>{t.policy_count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : null}
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

      {dbTab === 'overview' && (
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
      )}
    </div>
  );
}
  const dnsResolveHost = async (host: string): Promise<{ status: number; addresses: string[]; provider?: string }> => {
    const providers = [
      { name: 'Google', base: 'https://dns.google/resolve' },
      { name: 'Cloudflare', base: 'https://cloudflare-dns.com/dns-query' },
      { name: 'Quad9', base: 'https://dns.quad9.net/dns-query' },
    ];

    const resolveWithProvider = async (provider: { name: string; base: string }) => {
      const url = `${provider.base}?name=${encodeURIComponent(host)}&type=A`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        const res = await fetch(url, { headers: { Accept: 'application/dns-json' }, signal: controller.signal });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = await res.json();
        const answers = Array.isArray(json.Answer) ? json.Answer : [];
        const addresses = answers.filter((a: any) => a && a.type === 1 && a.data).map((a: any) => String(a.data));
        const status = Number(json.Status ?? 2);
        return { status, addresses, provider: provider.name };
      } finally {
        clearTimeout(timeout);
      }
    };

    const errors: string[] = [];
    for (const p of providers) {
      try {
        const result = await resolveWithProvider(p);
        if (result.status === 0 && result.addresses.length > 0) return result;
        errors.push(`${p.name}: status ${result.status}, addresses ${result.addresses.length}`);
      } catch (e: any) {
        errors.push(`${p.name}: ${e?.message || String(e)}`);
      }
    }
    throw new Error(errors.join(' | '));
  };

  const testDbConnection = async () => {
    const dbUrl = (cliDbUrl || '').trim();
    const parsed = parsePostgresUrl(dbUrl);
    if (!parsed) {
      toast.error('Invalid Database URL');
      return;
    }
    setConnTesting(true);
    setConnResult(null);
    try {
      const dns = await dnsResolveHost(parsed.host);
      const dnsOk = dns.status === 0 && dns.addresses.length > 0;
      const pooling = isSupabasePoolerHostname(parsed.host);
      setConnResult({
        dns: { ok: dnsOk, addresses: dns.addresses, message: dnsOk ? `Resolved via ${dns.provider} DNS` : 'No A records found or non-zero DNS status' },
        tcp: { ok: undefined, message: 'TCP port check is not possible from browser. Use Preflight in terminal.' },
        pooling,
      });
      toast.success('Connection test completed');
    } catch (err: any) {
      setConnResult({
        dns: { ok: false, addresses: [], message: err?.message || String(err) },
        tcp: { ok: undefined, message: 'TCP port check is not possible from browser. Use Preflight in terminal.' },
        pooling: parsed ? isSupabasePoolerHostname(parsed.host) : undefined,
      });
      toast.error('Connection test failed', { description: err?.message || String(err) });
    } finally {
      setConnTesting(false);
    }
  };
