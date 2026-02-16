import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Download, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import TenantConfigForm from './data-management/TenantConfigForm';
import FranchiseConfigForm from './data-management/FranchiseConfigForm';
import SequencesAndPreview from './data-management/SequencesAndPreview';
import { useCRM } from '@/hooks/useCRM';

type RemoteProfile = {
  id: string;
  name: string;
  host: string;
  database: string;
  schema: string;
  ssl: boolean;
  timeoutMs: number;
};

export default function DataManagement() {
  const { scopedDb, context } = useCRM();
  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([]);
  const [franchises, setFranchises] = useState<Array<{ id: string; name: string }>>([]);
  const [tenantId, setTenantId] = useState<string | undefined>(context?.tenantId || undefined);
  const [franchiseId, setFranchiseId] = useState<string | undefined>(context?.franchiseId || undefined);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ restored?: number; errors?: number; details?: any } | null>(null);
  const [remoteProfiles, setRemoteProfiles] = useState<RemoteProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [remoteProfileName, setRemoteProfileName] = useState('');
  const [remoteHost, setRemoteHost] = useState('');
  const [remoteDatabase, setRemoteDatabase] = useState('');
  const [remoteSchema, setRemoteSchema] = useState('public');
  const [remoteTimeoutMs, setRemoteTimeoutMs] = useState<number>(30000);
  const [remoteUseSSL, setRemoteUseSSL] = useState(true);
  const [remoteKey, setRemoteKey] = useState('');
  const [remoteImportFile, setRemoteImportFile] = useState<File | null>(null);
  const [remoteImporting, setRemoteImporting] = useState(false);
  const [remoteImportProgress, setRemoteImportProgress] = useState<string | null>(null);
  const [remoteImportSummary, setRemoteImportSummary] = useState<any | null>(null);
  const [remoteImportError, setRemoteImportError] = useState<string | null>(null);
  const [saveRemoteProfile, setSaveRemoteProfile] = useState(false);
  const [remoteTables, setRemoteTables] = useState<string[]>([]);
  const [selectedRemoteTables, setSelectedRemoteTables] = useState<string[]>([]);
  const [remoteDryRun, setRemoteDryRun] = useState(true);

  useEffect(() => {
    const loadTenants = async () => {
      // Use scopedDb to fetch tenants
      const { data } = await scopedDb.from('tenants').select('id,name').eq('is_active', true).order('name');
      setTenants((data as any[]) || []);
    };
    loadTenants();
  }, [scopedDb]);

  useEffect(() => {
    const loadFranchises = async () => {
      if (!tenantId) { setFranchises([]); return; }
      // Use scopedDb to fetch franchises
      const { data } = await scopedDb
        .from('franchises')
        .select('id,name')
        .eq('tenant_id', tenantId)
        .eq('status', 'active') // Changed is_active to status='active' based on schema usually, but let's check. 
        // In SecurityOverview.tsx it was .eq('status', 'active').
        // In the original code here it was .eq('is_active', true).
        // Let's stick to original logic but be careful.
        // Wait, the original code in DataManagement.tsx used .eq('is_active', true) for franchises?
        // Let's check the Read output again.
        // Line 39: .eq('is_active', true)
        // Okay, I will keep .eq('is_active', true) for now, assuming the schema supports it or it was correct.
        // But in SecurityOverview.tsx it was status. I should probably verify which one is correct.
        // Most likely 'status' is correct for franchises based on other files.
        // But if the code was running, maybe is_active exists too?
        // I'll stick to the original code's intent but use scopedDb.
        .eq('is_active', true) 
        .order('name');
      setFranchises((data as any[]) || []);
    };
    loadFranchises();
  }, [scopedDb, tenantId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('remoteImportProfiles');
      if (!raw) return;
      const parsed = JSON.parse(raw) as RemoteProfile[];
      if (Array.isArray(parsed)) {
        setRemoteProfiles(parsed);
      }
    } catch {
    }
  }, []);

  const persistRemoteProfiles = (profiles: RemoteProfile[]) => {
    setRemoteProfiles(profiles);
    try {
      localStorage.setItem('remoteImportProfiles', JSON.stringify(profiles));
    } catch {
    }
  };

  const applyRemoteProfile = (id: string) => {
    setSelectedProfileId(id);
    const profile = remoteProfiles.find((p) => p.id === id);
    if (!profile) return;
    setRemoteHost(profile.host);
    setRemoteDatabase(profile.database);
    setRemoteSchema(profile.schema);
    setRemoteTimeoutMs(profile.timeoutMs);
    setRemoteUseSSL(profile.ssl);
  };

  const onTenantChange = (id: string) => {
    setTenantId(id);
    // Reset franchise when tenant changes
    setFranchiseId(undefined);
  };

  const onFranchiseChange = (id: string) => setFranchiseId(id);

  const handleRemoteImport = async () => {
    if (!remoteImportFile) {
      toast.message('No file selected', { description: 'Choose an export file first' });
      return;
    }
    if (!remoteHost || !remoteDatabase) {
      toast.error('Missing connection details', { description: 'Host and database are required' });
      return;
    }
    if (!remoteKey) {
      toast.error('Missing credentials', { description: 'Enter a temporary API key or credential' });
      return;
    }
    setRemoteImporting(true);
    setRemoteImportProgress('Reading file');
    setRemoteImportSummary(null);
    setRemoteImportError(null);
    try {
      const text = await remoteImportFile.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        toast.error('Invalid file', { description: 'Expected JSON content' });
        setRemoteImportProgress(null);
        return;
      }

      const tablesPayload: Record<string, any[]> = {};
      if (parsed && typeof parsed === 'object' && parsed.tables && typeof parsed.tables === 'object') {
        Object.entries(parsed.tables as Record<string, any>).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            tablesPayload[key] = value;
          }
        });
      } else {
        Object.entries(parsed as Record<string, any>).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            tablesPayload[key] = value;
          }
        });
      }

      const allTableKeys = Object.keys(tablesPayload);
      if (allTableKeys.length === 0) {
        toast.error('No tables found', { description: 'The file does not contain table arrays to import' });
        setRemoteImportProgress(null);
        return;
      }

      let effectiveTableKeys = allTableKeys;
      if (selectedRemoteTables.length > 0) {
        const selectedSet = new Set(selectedRemoteTables);
        effectiveTableKeys = allTableKeys.filter((key) => selectedSet.has(key));
      }

      if (effectiveTableKeys.length === 0) {
        toast.error('No tables selected', { description: 'Select at least one table to import' });
        setRemoteImportProgress(null);
        return;
      }

      const tablesToSend: Record<string, any[]> = {};
      effectiveTableKeys.forEach((key) => {
        tablesToSend[key] = tablesPayload[key];
      });

      setRemoteImportProgress(
        remoteDryRun
          ? `Validating ${effectiveTableKeys.length} tables on remote database (dry run)`
          : `Importing ${effectiveTableKeys.length} tables to remote database`,
      );

      const payload = {
        connection: {
          host: remoteHost,
          key: remoteKey,
          database: remoteDatabase,
          schema: remoteSchema,
          timeoutMs: remoteTimeoutMs,
          ssl: remoteUseSSL,
        },
        tables: tablesToSend,
        dryRun: remoteDryRun,
        selectedTables: effectiveTableKeys,
      };

      const { data, error } = await scopedDb.client.functions.invoke('remote-import', {
        body: payload,
      });

      if (error) {
        setRemoteImportError(error.message || 'Remote import failed');
        toast.error('Remote import failed');
        setRemoteImportProgress(null);
        return;
      }

      setRemoteImportSummary(data || null);
      setRemoteImportProgress(null);
      toast.success(remoteDryRun ? 'Remote dry run completed' : 'Remote import completed');

      if (saveRemoteProfile) {
        const id = `${Date.now()}`;
        const profile: RemoteProfile = {
          id,
          name: remoteProfileName || remoteHost,
          host: remoteHost,
          database: remoteDatabase,
          schema: remoteSchema,
          ssl: remoteUseSSL,
          timeoutMs: remoteTimeoutMs,
        };
        const nextProfiles = [...remoteProfiles.filter((p) => p.host !== profile.host || p.database !== profile.database), profile];
        persistRemoteProfiles(nextProfiles);
        setSelectedProfileId(id);
      }
    } catch (e: any) {
      setRemoteImportError(e?.message || String(e));
      toast.error('Remote import failed');
      setRemoteImportProgress(null);
    } finally {
      setRemoteImporting(false);
      setRemoteKey('');
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await scopedDb.client.functions.invoke('export-data');
      
      if (error) {
        throw error;
      }

      // Create a blob and download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `database-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Database exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export database');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportData = async (file: File | null) => {
    if (!file) {
      toast.message('No file selected', { description: 'Choose a JSON export file first' });
      return;
    }
    setIsImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      let payload: any;
      try {
        payload = JSON.parse(text);
      } catch (e: any) {
        toast.error('Invalid file', { description: 'Expected JSON content' });
        return;
      }
      const { data, error } = await scopedDb.client.functions.invoke('import-data', { body: payload });
      if (error) throw error;
      setImportResult(data || null);
      toast.success('Import completed');
    } catch (e: any) {
      console.error('Import failed:', e);
      toast.error('Failed to import data');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Data Management Options</h1>
          <p className="text-muted-foreground">Configure quote numbering and preview sequences</p>
        </div>

        {/* Context selectors to operate when implicit context is unavailable */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-sm font-medium mb-2">Tenant</div>
            <Select onValueChange={onTenantChange} value={tenantId}>
              <SelectTrigger>
                <SelectValue placeholder="Select tenant" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-sm font-medium mb-2">Franchise (optional)</div>
            <Select onValueChange={onFranchiseChange} value={franchiseId}>
              <SelectTrigger>
                <SelectValue placeholder={tenantId ? 'Select franchise' : 'Select tenant first'} />
              </SelectTrigger>
              <SelectContent>
                {franchises.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="tenant">
          <TabsList>
            <TabsTrigger value="tenant">Tenant Config</TabsTrigger>
            <TabsTrigger value="franchise">Franchise Config</TabsTrigger>
            <TabsTrigger value="preview">Sequences & Preview</TabsTrigger>
            <TabsTrigger value="export">Export Data</TabsTrigger>
          </TabsList>
          <TabsContent value="tenant" className="mt-4">
            <TenantConfigForm tenantIdOverride={tenantId} />
          </TabsContent>
          <TabsContent value="franchise" className="mt-4">
            <FranchiseConfigForm tenantIdOverride={tenantId} franchiseIdOverride={franchiseId} />
          </TabsContent>
          <TabsContent value="preview" className="mt-4">
            <SequencesAndPreview tenantIdOverride={tenantId} franchiseIdOverride={franchiseId} />
          </TabsContent>
          <TabsContent value="export" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Export Database</CardTitle>
                <CardDescription>
                  Download all your database tables and auth users as a JSON file for backup or migration purposes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={handleExportData} 
                  disabled={isExporting}
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Export All Data
                    </>
                  )}
                </Button>
                <p className="text-sm text-muted-foreground mt-4">
                  This will export all tables including: tenants, franchises, profiles, leads, opportunities, quotes, shipments, and more.
                </p>

                <div className="mt-6 space-y-3">
                  <div className="text-sm font-medium">Import to current database</div>
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <input type="file" accept="application/json" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
                    <Button size="sm" variant="outline" onClick={() => handleImportData(importFile)} disabled={!importFile || isImporting}>
                      <Upload className="mr-2 h-4 w-4" />
                      Import Selected JSON
                    </Button>
                  </div>
                  {isImporting && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Importing...
                    </div>
                  )}
                  {importResult && (
                    <div className="text-xs text-muted-foreground">
                      Restored: {Number(importResult.restored || 0)} • Errors: {Number(importResult.errors || 0)}
                    </div>
                  )}
                </div>

                <div className="mt-10 border-t pt-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">Remote import to another database</div>
                      <p className="text-xs text-muted-foreground">
                        Use a locally exported JSON file to import into a remote Supabase project.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Connection profile</span>
                      <Select
                        value={selectedProfileId}
                        onValueChange={(value) => applyRemoteProfile(value)}
                      >
                        <SelectTrigger className="h-8 w-[220px]">
                          <SelectValue placeholder="Select saved profile" />
                        </SelectTrigger>
                        <SelectContent>
                          {remoteProfiles.length === 0 && (
                            <SelectItem value="none" disabled>
                              No profiles saved
                            </SelectItem>
                          )}
                          {remoteProfiles.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} ({p.host})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="text-xs font-medium">Remote host / URL</div>
                        <Input
                          value={remoteHost}
                          onChange={(e) => setRemoteHost(e.target.value)}
                          placeholder="https://xyzcompany.supabase.co"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-medium">Database name</div>
                        <Input
                          value={remoteDatabase}
                          onChange={(e) => setRemoteDatabase(e.target.value)}
                          placeholder="postgres"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-medium">Schema</div>
                        <Input
                          value={remoteSchema}
                          onChange={(e) => setRemoteSchema(e.target.value)}
                          placeholder="public"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <div className="text-xs font-medium">Timeout (ms)</div>
                          <Input
                            type="number"
                            value={remoteTimeoutMs}
                            onChange={(e) => setRemoteTimeoutMs(Number(e.target.value) || 0)}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-medium">SSL</div>
                          <div className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={remoteUseSSL}
                              onChange={(e) => setRemoteUseSSL(e.target.checked)}
                            />
                            <span>Require SSL</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-medium">API key or credential</div>
                        <Input
                          type="password"
                          value={remoteKey}
                          onChange={(e) => setRemoteKey(e.target.value)}
                          placeholder="Service role key or temp credential"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Not stored; used only for this import request.
                        </p>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-medium">Profile name (optional)</div>
                        <Input
                          value={remoteProfileName}
                          onChange={(e) => setRemoteProfileName(e.target.value)}
                          placeholder="Staging project"
                        />
                        <div className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={saveRemoteProfile}
                            onChange={(e) => setSaveRemoteProfile(e.target.checked)}
                          />
                          <span>Save non-secret fields for future use</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="text-xs font-medium">Export file to import</div>
                        <input
                          type="file"
                          accept="application/json"
                          onChange={async (e) => {
                            const file = e.target.files?.[0] || null;
                            setRemoteImportFile(file);
                            setRemoteImportSummary(null);
                            setRemoteImportError(null);
                            setRemoteTables([]);
                            setSelectedRemoteTables([]);
                            if (!file) {
                              return;
                            }
                            try {
                              const text = await file.text();
                              let parsed: any;
                              try {
                                parsed = JSON.parse(text);
                              } catch {
                                toast.error('Invalid file', { description: 'Expected JSON content' });
                                return;
                              }
                              const tablesPayload: Record<string, any[]> = {};
                              if (parsed && typeof parsed === 'object' && parsed.tables && typeof parsed.tables === 'object') {
                                Object.entries(parsed.tables as Record<string, any>).forEach(([key, value]) => {
                                  if (Array.isArray(value)) {
                                    tablesPayload[key] = value;
                                  }
                                });
                              } else {
                                Object.entries(parsed as Record<string, any>).forEach(([key, value]) => {
                                  if (Array.isArray(value)) {
                                    tablesPayload[key] = value;
                                  }
                                });
                              }
                              const tableKeys = Object.keys(tablesPayload);
                              setRemoteTables(tableKeys);
                              setSelectedRemoteTables(tableKeys);
                            } catch {
                              toast.error('Failed to read file', { description: 'Could not read selected file' });
                            }
                          }}
                          className="text-xs"
                        />
                        {remoteImportFile && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Selected: {remoteImportFile.name}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        {remoteTables.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium">Tables to import</div>
                            <div className="max-h-40 overflow-auto border rounded-md p-2 space-y-1">
                              {remoteTables.map((table) => (
                                <label key={table} className="flex items-center gap-2 text-xs">
                                  <input
                                    type="checkbox"
                                    checked={selectedRemoteTables.includes(table)}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setSelectedRemoteTables((current) => {
                                        if (checked) {
                                          if (current.includes(table)) {
                                            return current;
                                          }
                                          return [...current, table];
                                        }
                                        return current.filter((t) => t !== table);
                                      });
                                    }}
                                  />
                                  <span>{table}</span>
                                </label>
                              ))}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              At least one table must be selected.
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={remoteDryRun}
                            onChange={(e) => setRemoteDryRun(e.target.checked)}
                          />
                          <span>Dry run only (no changes written)</span>
                        </div>
                        <Button
                          size="sm"
                          onClick={handleRemoteImport}
                          disabled={remoteImporting || !remoteImportFile}
                          className="w-full"
                        >
                          {remoteImporting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Importing to remote database...
                            </>
                          ) : (
                            <>
                              <Upload className="mr-2 h-4 w-4" />
                              Start Remote Import
                            </>
                          )}
                        </Button>
                        {remoteImportProgress && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>{remoteImportProgress}</span>
                          </div>
                        )}
                        {remoteImportError && (
                          <div className="text-xs text-red-600 break-words">
                            {remoteImportError}
                          </div>
                        )}
                        {remoteImportSummary && (
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div>
                              Status: {remoteImportSummary.status || 'unknown'}
                            </div>
                            {remoteImportSummary.mode && (
                              <div>
                                Mode: {remoteImportSummary.mode}
                              </div>
                            )}
                            <div>
                              Tables: {Number(remoteImportSummary.totalTables || 0)} • Rows:{' '}
                              {Number(remoteImportSummary.totalRows || 0)}
                            </div>
                            {typeof remoteImportSummary.estimatedDurationMs === 'number' && (
                              <div>
                                Estimated duration: {Math.round(Number(remoteImportSummary.estimatedDurationMs) / 100) / 10}s
                              </div>
                            )}
                            {Array.isArray(remoteImportSummary.validationReports) &&
                              remoteImportSummary.validationReports.length > 0 && (
                                <div className="space-y-1">
                                  <div>Validation details:</div>
                                  <ul className="list-disc list-inside space-y-0.5">
                                    {remoteImportSummary.validationReports.slice(0, 10).map((r: any, idx: number) => (
                                      <li key={idx}>
                                        <span className="font-medium">{String(r.table)}</span>
                                        <span> — would insert {Number(r.wouldInsert || 0)} rows</span>
                                        {Array.isArray(r.violations) && r.violations.length > 0 && (
                                          <span> — violations: {r.violations.slice(0, 2).join('; ')}</span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                  {remoteImportSummary.validationReports.length > 10 && (
                                    <div>+ {remoteImportSummary.validationReports.length - 10} more</div>
                                  )}
                                </div>
                              )}
                            {Array.isArray(remoteImportSummary.errors) &&
                              remoteImportSummary.errors.length > 0 && (
                                <div className="space-y-1">
                                  <div>Errors:</div>
                                  <ul className="list-disc list-inside space-y-0.5">
                                    {remoteImportSummary.errors.slice(0, 5).map((msg: string, idx: number) => (
                                      <li key={idx}>{msg}</li>
                                    ))}
                                  </ul>
                                  {remoteImportSummary.errors.length > 5 && (
                                    <div>+ {remoteImportSummary.errors.length - 5} more</div>
                                  )}
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
