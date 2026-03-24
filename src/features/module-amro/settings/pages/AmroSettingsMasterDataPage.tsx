import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useCRM } from '@/hooks/useCRM';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type MasterEntity =
  | 'aircraft'
  | 'parts_inventory'
  | 'suppliers'
  | 'maintenance_facilities'
  | 'work_centers'
  | 'skill_codes'
  | 'regulator_profiles'
  | 'shift_calendars'
  | 'work_package_templates';

const ENTITY_LABEL: Record<MasterEntity, string> = {
  aircraft: 'Aircraft',
  parts_inventory: 'Parts Inventory',
  suppliers: 'Suppliers',
  maintenance_facilities: 'Maintenance Facilities',
  work_centers: 'Work Centers',
  skill_codes: 'Skill Codes',
  regulator_profiles: 'Regulator Profiles',
  shift_calendars: 'Shift Calendars',
  work_package_templates: 'Work Package Templates',
};

type RecordRow = {
  id: string;
  [key: string]: unknown;
};

function createDefaultForm(entity: MasterEntity): string {
  if (entity === 'aircraft') {
    return JSON.stringify(
      {
        tail_number: '',
        serial_number: '',
        aircraft_type: '',
        aircraft_model: '',
        configuration_code: '',
        maintenance_program: '',
        status: 'active',
      },
      null,
      2,
    );
  }
  if (entity === 'parts_inventory') {
    return JSON.stringify(
      {
        part_number: '',
        description: '',
        category: '',
        unit_of_measure: 'EA',
        min_stock_level: 0,
        warehouse_location: '',
        quantity_on_hand: 0,
      },
      null,
      2,
    );
  }
  if (entity === 'suppliers') {
    return JSON.stringify(
      {
        supplier_code: '',
        name: '',
        contact_name: '',
        email: '',
        phone: '',
      },
      null,
      2,
    );
  }
  if (entity === 'maintenance_facilities') {
    return JSON.stringify(
      {
        facility_code: '',
        name: '',
        facility_type: 'line',
        station_code: '',
        location_city: '',
        location_country: '',
      },
      null,
      2,
    );
  }
  if (entity === 'work_centers') {
    return JSON.stringify(
      {
        work_center_code: '',
        name: '',
        center_type: 'airframe',
        station_code: '',
        capacity_hours_per_day: 8,
      },
      null,
      2,
    );
  }
  if (entity === 'regulator_profiles') {
    return JSON.stringify(
      {
        regulator_code: '',
        regulator_name: '',
        jurisdiction: '',
        policy_version: '',
        effective_from: new Date().toISOString().slice(0, 10),
        is_active: true,
      },
      null,
      2,
    );
  }
  if (entity === 'shift_calendars') {
    return JSON.stringify(
      {
        station_code: '',
        shift_name: '',
        shift_start_time: '08:00:00',
        shift_end_time: '16:00:00',
        capacity: 1,
        effective_from: new Date().toISOString().slice(0, 10),
        is_active: true,
      },
      null,
      2,
    );
  }
  if (entity === 'work_package_templates') {
    return JSON.stringify(
      {
        template_code: '',
        version: 1,
        active: true,
        template_name: '',
        maintenance_type: 'line',
        scope_json: [],
        tasks_json: [],
      },
      null,
      2,
    );
  }
  return JSON.stringify(
    {
      skill_code: '',
      description: '',
      skill_family: '',
      license_authority: '',
      is_certification_required: false,
    },
    null,
    2,
  );
}

async function buildApiHeaders(scope: { tenantId?: string | null; franchiseId?: string | null; userId?: string | null }) {
  const { data: sessionData } = await supabase.auth.getSession();
  let token = sessionData?.session?.access_token || '';
  if (!token) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    token = refreshed?.session?.access_token || '';
  }
  const headers = new Headers({
    'Content-Type': 'application/json',
  });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (scope.tenantId) headers.set('x-tenant-id', scope.tenantId);
  if (scope.franchiseId) headers.set('x-franchise-id', scope.franchiseId);
  if (scope.userId) headers.set('x-user-id', scope.userId);
  headers.set('x-domain-id', 'AMRO');
  return headers;
}

export function AmroSettingsMasterDataPage() {
  const { context } = useCRM();
  const [entity, setEntity] = useState<MasterEntity>('aircraft');
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorText, setEditorText] = useState(createDefaultForm('aircraft'));
  const [bulkText, setBulkText] = useState('[\n  {}\n]');
  const [pageSize, setPageSize] = useState('25');
  const [page, setPage] = useState(1);

  const scope = useMemo(
    () => ({
      tenantId: context.tenantId,
      franchiseId: context.franchiseId,
      userId: context.userId,
    }),
    [context.franchiseId, context.tenantId, context.userId],
  );

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await buildApiHeaders(scope);
      const query = new URLSearchParams({
        search,
        page: String(page),
        page_size: pageSize,
        sort_by: 'updated_at',
        sort_dir: 'desc',
      });
      const response = await fetch(`/api/v2/amro/master-data/${entity}?${query.toString()}`, { method: 'GET', headers });
      const payload = await response.json();
      if (!response.ok) throw new Error(String(payload.error || 'Failed to load records'));
      let records = Array.isArray(payload?.output?.records) ? payload.output.records : [];
      if (statusFilter !== 'all') {
        records = records.filter(
          (record: Record<string, unknown>) =>
            String(record.status ?? record.is_active ?? record.active).toLowerCase() === statusFilter.toLowerCase(),
        );
      }
      setRows(records);
    } catch (error) {
      toast.error(String((error as Error).message || 'Failed to load records'));
    } finally {
      setLoading(false);
    }
  }, [entity, page, pageSize, scope, search, statusFilter]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    setSelectedId(null);
    setEditorText(createDefaultForm(entity));
    setBulkText('[\n  {}\n]');
  }, [entity]);

  const handleCreate = useCallback(async () => {
    try {
      const body = JSON.parse(editorText);
      const headers = await buildApiHeaders(scope);
      const response = await fetch(`/api/v2/amro/master-data/${entity}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(String(payload.error || 'Create failed'));
      toast.success(`${ENTITY_LABEL[entity]} record created`);
      await loadRecords();
    } catch (error) {
      toast.error(String((error as Error).message || 'Create failed'));
    }
  }, [editorText, entity, loadRecords, scope]);

  const handleUpdate = useCallback(async () => {
    if (!selectedId) {
      toast.error('Select a record first');
      return;
    }
    try {
      const body = JSON.parse(editorText);
      const headers = await buildApiHeaders(scope);
      const response = await fetch(`/api/v2/amro/master-data/${entity}/${selectedId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(String(payload.error || 'Update failed'));
      toast.success(`${ENTITY_LABEL[entity]} record updated`);
      await loadRecords();
    } catch (error) {
      toast.error(String((error as Error).message || 'Update failed'));
    }
  }, [editorText, entity, loadRecords, scope, selectedId]);

  const handleDelete = useCallback(async () => {
    if (!selectedId) {
      toast.error('Select a record first');
      return;
    }
    try {
      const headers = await buildApiHeaders(scope);
      const response = await fetch(`/api/v2/amro/master-data/${entity}/${selectedId}`, {
        method: 'DELETE',
        headers,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(String(payload.error || 'Delete failed'));
      toast.success(`${ENTITY_LABEL[entity]} record deleted`);
      setSelectedId(null);
      await loadRecords();
    } catch (error) {
      toast.error(String((error as Error).message || 'Delete failed'));
    }
  }, [entity, loadRecords, scope, selectedId]);

  const handleBulkImport = useCallback(async () => {
    try {
      const records = JSON.parse(bulkText);
      if (!Array.isArray(records)) throw new Error('Bulk payload must be a JSON array');
      const headers = await buildApiHeaders(scope);
      const response = await fetch(`/api/v2/amro/master-data/${entity}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          operation: 'bulk_import',
          records,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(String(payload.error || 'Bulk import failed'));
      toast.success(`${payload?.output?.imported_count || 0} records imported`);
      await loadRecords();
    } catch (error) {
      toast.error(String((error as Error).message || 'Bulk import failed'));
    }
  }, [bulkText, entity, loadRecords, scope]);

  const handleExport = useCallback(async () => {
    try {
      const headers = await buildApiHeaders(scope);
      const query = new URLSearchParams({
        search,
        export: 'csv',
        page: '1',
        page_size: '5000',
      });
      const response = await fetch(`/api/v2/amro/master-data/${entity}?${query.toString()}`, { method: 'GET', headers });
      const csvText = await response.text();
      if (!response.ok) throw new Error(csvText || 'Export failed');
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `amro-${entity}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${ENTITY_LABEL[entity]} CSV`);
    } catch (error) {
      toast.error(String((error as Error).message || 'Export failed'));
    }
  }, [entity, scope, search]);

  const tableColumns = useMemo(() => {
    if (!rows.length) return [] as string[];
    return Object.keys(rows[0]).slice(0, 8);
  }, [rows]);

  return (
    <DashboardLayout>
      <div className="space-y-4 p-4 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">AMRO Settings · Master Data</h1>
            <p className="text-sm text-muted-foreground">
              Tenant-scoped CRUD management for fleet, inventory, suppliers, facilities, workforce, compliance profiles, shift
              capacity, and work package templates.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Tenant: {context.tenantId || 'unscoped'}</Badge>
            <Button variant="outline" asChild>
              <Link to="/dashboard/amro/settings">Settings Dashboard</Link>
            </Button>
            <Button variant="outline" onClick={() => void loadRecords()} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</Button>
            <Button variant="outline" onClick={() => void handleExport()}>Export CSV</Button>
          </div>
        </div>

        <Tabs value={entity} onValueChange={(next) => setEntity(next as MasterEntity)}>
          <TabsList className="flex h-auto flex-wrap gap-2">
            {Object.entries(ENTITY_LABEL).map(([key, label]) => (
              <TabsTrigger key={key} value={key}>{label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>{ENTITY_LABEL[entity]} Search and Filter</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="amro-master-search">Search</Label>
              <Input id="amro-master-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search..." />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Page Size</Label>
              <Select value={pageSize} onValueChange={setPageSize}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{ENTITY_LABEL[entity]} Records</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {tableColumns.map((column) => (
                      <TableHead key={column}>{column}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.id === selectedId ? 'selected' : undefined}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedId(row.id);
                        setEditorText(JSON.stringify(row, null, 2));
                      }}
                    >
                      {tableColumns.map((column) => (
                        <TableCell key={column}>{String(row[column] ?? '')}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Selected: {selectedId || 'none'} | Records: {rows.length}</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setPage((previous) => Math.max(1, previous - 1))}>Previous</Button>
                <Badge variant="secondary">Page {page}</Badge>
                <Button variant="outline" onClick={() => setPage((previous) => previous + 1)}>Next</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{ENTITY_LABEL[entity]} Create and Update</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={editorText} onChange={(event) => setEditorText(event.target.value)} rows={14} />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void handleCreate()}>Create</Button>
                <Button variant="outline" onClick={() => void handleUpdate()}>Update Selected</Button>
                <Button variant="destructive" onClick={() => void handleDelete()}>Delete Selected</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{ENTITY_LABEL[entity]} Bulk Import</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={bulkText} onChange={(event) => setBulkText(event.target.value)} rows={14} />
              <Button onClick={() => void handleBulkImport()}>Run Bulk Import</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default AmroSettingsMasterDataPage;
