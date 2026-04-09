import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { AmroKpiGrid, AmroModuleSurface, AmroStandardToolbar } from './AmroPartsUiStandards';
import { AmroCrudDialogFooter, AmroCrudMessageBanner } from './AmroCrudPrimitives';
import { AmroModuleGridDetailPanel } from './AmroModuleGridDetailPanel';
import {
  createItemMasterRecord,
  deleteItemMasterRecord,
  getItemMasterRecord,
  listItemMasterRecords,
  updateItemMasterRecord,
  type ItemMasterCrossReference,
  type ItemMasterMutationPayload,
  type ItemMasterRecord,
  type ItemMasterUomConversion,
} from './itemMasterCatalogApi';
import type { AmroApiScope } from './livePartsCatalogApi';

type Props = {
  apiScope?: AmroApiScope;
  onCreatePart?: () => void;
  onCreatePartFromItemMaster?: (record: ItemMasterRecord) => void;
};

const DEFAULT_FORM: ItemMasterMutationPayload = {
  partNumber: '',
  description: '',
  itemType: 'part',
  category: '',
  subcategory: '',
  status: 'active',
  lifecycleStatus: 'serviceable',
  specification: {},
  manufacturerName: '',
  manufacturerPartNumber: '',
  oemPartNumber: '',
  unitOfMeasure: 'EA',
  baseUnitOfMeasure: 'EA',
  uomConversionFactor: 1,
  currency: 'USD',
  isActive: true,
  metadata: {},
  crossReferences: [],
  uomConversions: [],
};

function cloneFormValue(record?: ItemMasterRecord | null): ItemMasterMutationPayload {
  if (!record) return { ...DEFAULT_FORM };
  return {
    id: record.id,
    partNumber: record.partNumber,
    description: record.description || '',
    itemType: record.itemType,
    category: record.category || '',
    subcategory: record.subcategory || '',
    status: record.status,
    lifecycleStatus: record.lifecycleStatus,
    specification: record.specification || {},
    manufacturerName: record.manufacturerName || '',
    manufacturerPartNumber: record.manufacturerPartNumber || '',
    oemPartNumber: record.oemPartNumber || '',
    unitOfMeasure: record.unitOfMeasure || 'EA',
    baseUnitOfMeasure: record.baseUnitOfMeasure || 'EA',
    uomConversionFactor: record.uomConversionFactor || 1,
    currency: record.currency || 'USD',
    isActive: record.isActive !== false,
    metadata: record.metadata || {},
    crossReferences: record.crossReferences || [],
    uomConversions: record.uomConversions || [],
  };
}

export function AmroItemMasterCatalogPanel({ apiScope = {}, onCreatePart, onCreatePartFromItemMaster }: Props): JSX.Element {
  const [records, setRecords] = useState<ItemMasterRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [refreshTick, setRefreshTick] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('core');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formValue, setFormValue] = useState<ItemMasterMutationPayload>({ ...DEFAULT_FORM });
  const [deleteCandidate, setDeleteCandidate] = useState<ItemMasterRecord | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listItemMasterRecords({
        page: 1,
        pageSize: 50,
        search,
        status: statusFilter,
        itemType: typeFilter,
      }, fetch, apiScope);
      setRecords(data.records);
      setSelectedRecordId((current) => current || data.records[0]?.id || null);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load item master records';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apiScope, search, statusFilter, typeFilter]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords, refreshTick]);

  const openCreateDialog = useCallback(() => {
    setEditingId(null);
    setFormValue({ ...DEFAULT_FORM });
    setActiveTab('core');
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback(async (id: string) => {
    setDialogLoading(true);
    setDialogOpen(true);
    setActiveTab('core');
    try {
      const record = await getItemMasterRecord(id, fetch, apiScope);
      setEditingId(id);
      setFormValue(cloneFormValue(record));
    } catch (detailError) {
      toast.error(detailError instanceof Error ? detailError.message : 'Failed to load item master detail');
      setDialogOpen(false);
    } finally {
      setDialogLoading(false);
    }
  }, [apiScope]);

  const setField = useCallback(<K extends keyof ItemMasterMutationPayload>(field: K, value: ItemMasterMutationPayload[K]) => {
    setFormValue((previous) => ({ ...previous, [field]: value }));
  }, []);

  const upsertRecord = useCallback(async () => {
    setDialogLoading(true);
    try {
      if (!formValue.partNumber.trim()) {
        throw new Error('Part Number is required');
      }
      const payload = { ...formValue };
      if (editingId) {
        await updateItemMasterRecord(editingId, payload, fetch, apiScope);
        toast.success('Item master updated');
      } else {
        await createItemMasterRecord(payload, fetch, apiScope);
        toast.success('Item master created');
      }
      setDialogOpen(false);
      setRefreshTick((value) => value + 1);
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Failed to save item master');
    } finally {
      setDialogLoading(false);
    }
  }, [apiScope, editingId, formValue]);

  const removeRecord = useCallback(async (id: string) => {
    try {
      await deleteItemMasterRecord(id, fetch, apiScope);
      toast.success('Item master deleted');
      setRefreshTick((value) => value + 1);
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'Failed to delete item master');
    }
  }, [apiScope]);

  const crossReferences = useMemo(() => formValue.crossReferences || [], [formValue.crossReferences]);
  const uomConversions = useMemo(() => formValue.uomConversions || [], [formValue.uomConversions]);
  const activeRecords = useMemo(() => records.filter((record) => record.isActive).length, [records]);
  const inactiveRecords = useMemo(() => Math.max(0, records.length - activeRecords), [activeRecords, records.length]);

  return (
    <div className="mt-4 space-y-3">
      <AmroModuleSurface
        title="Item Master Catalog"
        subtitle="Canonical part definitions with cross-reference and UOM governance."
        moduleId="inventory-core.item-master"
        status={error ? 'warning' : loading ? 'loading' : 'ready'}
      >
        <AmroStandardToolbar
          searchValue={search}
          onSearchChange={setSearch}
          placeholder="Search part number or description"
          leftActions={(
            <>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="deprecated">Deprecated</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 w-[140px]"><SelectValue placeholder="Item Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="part">Part</SelectItem>
                  <SelectItem value="tool">Tool</SelectItem>
                  <SelectItem value="consumable">Consumable</SelectItem>
                  <SelectItem value="kit">Kit</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" variant="secondary" size="sm" className="h-8" onClick={() => setRefreshTick((value) => value + 1)}>
                Apply Filters
              </Button>
            </>
          )}
          rightActions={(
            <>
              {onCreatePart ? (
                <Button type="button" size="sm" variant="outline" className="h-8" onClick={onCreatePart}>
                  Create Inventory Part
                </Button>
              ) : null}
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setRefreshTick((value) => value + 1)}>
                <RefreshCw className="mr-1 h-4 w-4" />
                Refresh
              </Button>
              <Button type="button" size="sm" className="h-8" onClick={openCreateDialog}>
                <Plus className="mr-1 h-4 w-4" />
                New Item
              </Button>
            </>
          )}
        />
        <AmroKpiGrid
          items={[
            { label: 'Total Records', value: String(records.length) },
            { label: 'Active', value: String(activeRecords), tone: activeRecords > 0 ? 'success' : 'default' },
            { label: 'Inactive', value: String(inactiveRecords), tone: inactiveRecords > 0 ? 'warning' : 'default' },
          ]}
        />
        <AmroCrudMessageBanner message={error} tone="error" />
        <AmroModuleGridDetailPanel
          rows={records}
          loading={loading}
          emptyMessage="No item master records found."
          selectedId={selectedRecordId}
          onSelect={setSelectedRecordId}
          detailTitle="Item Master Detail"
          columns={[
            { key: 'partNumber', label: 'Part Number', render: (record) => record.partNumber },
            { key: 'description', label: 'Description', render: (record) => record.description || '-' },
            { key: 'itemType', label: 'Type', render: (record) => record.itemType },
            { key: 'lifecycleStatus', label: 'Lifecycle', render: (record) => record.lifecycleStatus },
            { key: 'uom', label: 'UOM', render: (record) => record.unitOfMeasure },
          ]}
          renderDetail={(record) => (
            !record ? <p className="text-xs text-muted-foreground">Select an item to inspect details.</p> : (
              <div className="space-y-2 text-xs">
                <p><span className="font-semibold">Part Number:</span> {record.partNumber}</p>
                <p><span className="font-semibold">Description:</span> {record.description || '-'}</p>
                <p><span className="font-semibold">Type:</span> {record.itemType}</p>
                <p><span className="font-semibold">Lifecycle:</span> {record.lifecycleStatus}</p>
                <p><span className="font-semibold">Unit:</span> {record.unitOfMeasure}</p>
                <p><span className="font-semibold">Status:</span> {record.status}</p>
                <div className="pt-1">
                  <div className="flex flex-wrap gap-1">
                    {onCreatePartFromItemMaster ? (
                      <Button type="button" size="sm" variant="secondary" onClick={() => onCreatePartFromItemMaster(record)}>
                        Create Part
                      </Button>
                    ) : null}
                    <Button type="button" size="sm" variant="outline" onClick={() => { void openEditDialog(record.id); }}>
                      Edit
                    </Button>
                    <Button type="button" size="sm" variant="destructive" onClick={() => setDeleteCandidate(record)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          )}
        />
      </AmroModuleSurface>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!dialogLoading) setDialogOpen(open); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Item Master' : 'Create Item Master'}</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="core">Core</TabsTrigger>
              <TabsTrigger value="cross">Cross-References</TabsTrigger>
              <TabsTrigger value="uom">UOM Conversions</TabsTrigger>
            </TabsList>
            <TabsContent value="core" className="space-y-3 pt-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Part Number</Label>
                  <Input value={formValue.partNumber} onChange={(event) => setField('partNumber', event.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Item Type</Label>
                  <Select value={formValue.itemType} onValueChange={(value) => setField('itemType', value as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="part">part</SelectItem>
                      <SelectItem value="tool">tool</SelectItem>
                      <SelectItem value="consumable">consumable</SelectItem>
                      <SelectItem value="kit">kit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea rows={2} value={formValue.description || ''} onChange={(event) => setField('description', event.target.value)} />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={formValue.status} onValueChange={(value) => setField('status', value as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">active</SelectItem>
                      <SelectItem value="inactive">inactive</SelectItem>
                      <SelectItem value="deprecated">deprecated</SelectItem>
                      <SelectItem value="retired">retired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Lifecycle</Label>
                  <Select value={formValue.lifecycleStatus} onValueChange={(value) => setField('lifecycleStatus', value as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="serviceable">serviceable</SelectItem>
                      <SelectItem value="inspection_due">inspection_due</SelectItem>
                      <SelectItem value="needs_repair">needs_repair</SelectItem>
                      <SelectItem value="repair_in_progress">repair_in_progress</SelectItem>
                      <SelectItem value="ready_for_install">ready_for_install</SelectItem>
                      <SelectItem value="replaced">replaced</SelectItem>
                      <SelectItem value="retired">retired</SelectItem>
                      <SelectItem value="quarantined">quarantined</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Currency</Label>
                  <Input value={formValue.currency} onChange={(event) => setField('currency', event.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-1"><Label>UOM</Label><Input value={formValue.unitOfMeasure} onChange={(event) => setField('unitOfMeasure', event.target.value)} /></div>
                <div className="space-y-1"><Label>Base UOM</Label><Input value={formValue.baseUnitOfMeasure} onChange={(event) => setField('baseUnitOfMeasure', event.target.value)} /></div>
                <div className="space-y-1"><Label>Conversion Factor</Label><Input type="number" step="0.000001" value={String(formValue.uomConversionFactor || 1)} onChange={(event) => setField('uomConversionFactor', Number(event.target.value || 1))} /></div>
              </div>
            </TabsContent>

            <TabsContent value="cross" className="space-y-3 pt-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setField('crossReferences', [...crossReferences, { referenceType: 'alternate', referencePartNumber: '', referenceDescription: '', isActive: true } as ItemMasterCrossReference])}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Cross Reference
              </Button>
              <div className="space-y-2">
                {crossReferences.length === 0 ? <p className="text-sm text-slate-600">No cross references added.</p> : crossReferences.map((entry, index) => (
                  <div key={`cross-${index}`} className="grid grid-cols-1 gap-2 rounded-md border p-2 md:grid-cols-4">
                    <Select value={entry.referenceType} onValueChange={(value) => setField('crossReferences', crossReferences.map((item, itemIndex) => itemIndex === index ? { ...item, referenceType: value as any } : item))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alternate">alternate</SelectItem>
                        <SelectItem value="superseded_by">superseded_by</SelectItem>
                        <SelectItem value="supersedes">supersedes</SelectItem>
                        <SelectItem value="vendor">vendor</SelectItem>
                        <SelectItem value="oem">oem</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Reference part number" value={entry.referencePartNumber} onChange={(event) => setField('crossReferences', crossReferences.map((item, itemIndex) => itemIndex === index ? { ...item, referencePartNumber: event.target.value } : item))} />
                    <Input placeholder="Description" value={entry.referenceDescription || ''} onChange={(event) => setField('crossReferences', crossReferences.map((item, itemIndex) => itemIndex === index ? { ...item, referenceDescription: event.target.value } : item))} />
                    <Button type="button" variant="destructive" onClick={() => setField('crossReferences', crossReferences.filter((_, itemIndex) => itemIndex !== index))}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="uom" className="space-y-3 pt-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setField('uomConversions', [...uomConversions, { fromUom: 'EA', toUom: 'BOX', factor: 1, roundingMode: 'half_up', isActive: true } as ItemMasterUomConversion])}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add UOM Conversion
              </Button>
              <div className="space-y-2">
                {uomConversions.length === 0 ? <p className="text-sm text-slate-600">No UOM conversions added.</p> : uomConversions.map((entry, index) => (
                  <div key={`uom-${index}`} className="grid grid-cols-1 gap-2 rounded-md border p-2 md:grid-cols-5">
                    <Input placeholder="From UOM" value={entry.fromUom} onChange={(event) => setField('uomConversions', uomConversions.map((item, itemIndex) => itemIndex === index ? { ...item, fromUom: event.target.value } : item))} />
                    <Input placeholder="To UOM" value={entry.toUom} onChange={(event) => setField('uomConversions', uomConversions.map((item, itemIndex) => itemIndex === index ? { ...item, toUom: event.target.value } : item))} />
                    <Input type="number" step="0.000001" placeholder="Factor" value={String(entry.factor || 1)} onChange={(event) => setField('uomConversions', uomConversions.map((item, itemIndex) => itemIndex === index ? { ...item, factor: Number(event.target.value || 1) } : item))} />
                    <Select value={entry.roundingMode || 'half_up'} onValueChange={(value) => setField('uomConversions', uomConversions.map((item, itemIndex) => itemIndex === index ? { ...item, roundingMode: value as any } : item))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="half_up">half_up</SelectItem>
                        <SelectItem value="up">up</SelectItem>
                        <SelectItem value="down">down</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="destructive" onClick={() => setField('uomConversions', uomConversions.filter((_, itemIndex) => itemIndex !== index))}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          <AmroCrudDialogFooter
            saving={dialogLoading}
            onCancel={() => setDialogOpen(false)}
            onConfirm={() => { void upsertRecord(); }}
            confirmLabel={editingId ? 'Save Item' : 'Create Item'}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteCandidate)} onOpenChange={(open) => { if (!open) setDeleteCandidate(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item Master Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {deleteCandidate?.partNumber || 'this record'} from item master.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteCandidate) return;
                void removeRecord(deleteCandidate.id);
                setDeleteCandidate(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
