import { useEffect, useState, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCRM } from '@/hooks/useCRM';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import * as XLSX from 'xlsx';
import { parseFileRows, downloadErrorsCsv, exportCsv, exportExcel, exportJsonTemplate } from '@/lib/import-export';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Info } from 'lucide-react';
import ActionsToolbar from '@/components/ui/ActionsToolbar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Upload, Download, FileText, AlertCircle } from 'lucide-react';

export default function MasterDataGeography() {
  const { scopedDb } = useCRM();
  const { toast } = useToast();
  const [tab, setTab] = useState('continents');
  const [continents, setContinents] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEditState, setShowEditState] = useState(false);
  const [editStateForm, setEditStateForm] = useState<any>({ id: '', name: '', country_id: '', iso: '', nat: '', is_active: true });
  const [showEditCity, setShowEditCity] = useState(false);
  const [editCityForm, setEditCityForm] = useState<any>({ id: '', name: '', country_id: '', state_id: '', nat: '', lat: '', lng: '', is_active: true });
  const [showEditContinent, setShowEditContinent] = useState(false);
  const [editContinentForm, setEditContinentForm] = useState<any>({ id: '', name: '', intl: '', nat: '', is_active: true });
  const [showEditCountry, setShowEditCountry] = useState(false);
  const [editCountryForm, setEditCountryForm] = useState<any>({ id: '', name: '', continent_id: '', iso2: '', iso3: '', nat: '', phone: '', is_active: true });
  // Modal form states
  const [showAddContinent, setShowAddContinent] = useState(false);
  const [continentForm, setContinentForm] = useState<any>({ name: '', intl: '', nat: '' });
  const [showAddCountry, setShowAddCountry] = useState(false);
  const [countryForm, setCountryForm] = useState<any>({ name: '', continent_id: '', iso2: '', iso3: '', nat: '', phone: '' });
  const [showAddState, setShowAddState] = useState(false);
  const [stateForm, setStateForm] = useState<any>({ name: '', country_id: '', iso: '', nat: '' });
  const [showAddCity, setShowAddCity] = useState(false);
  const [cityForm, setCityForm] = useState<any>({ name: '', country_id: '', state_id: '', nat: '', lat: '', lng: '' });
  // Bulk import
  const contFileRef = useRef<HTMLInputElement>(null);
  const countryFileRef = useRef<HTMLInputElement>(null);
  const stateFileRef = useRef<HTMLInputElement>(null);
  const cityFileRef = useRef<HTMLInputElement>(null);
  const [bulkContFile, setBulkContFile] = useState<File | null>(null);
  const [bulkCountryFile, setBulkCountryFile] = useState<File | null>(null);
  const [bulkStateFile, setBulkStateFile] = useState<File | null>(null);
  const [bulkCityFile, setBulkCityFile] = useState<File | null>(null);
  const [countryImportErrors, setCountryImportErrors] = useState<any[]>([]);
  const [stateImportErrors, setStateImportErrors] = useState<any[]>([]);
  const [cityImportErrors, setCityImportErrors] = useState<any[]>([]);

  // Import/Export helpers moved to shared module

  const loadData = async () => {
    setLoading(true);
    try {
      const [contRes, countryRes, stateRes, cityRes] = await Promise.all([
        scopedDb.from('continents', true).select('*').order('name'),
        scopedDb.from('countries', true).select('*').order('name'),
        scopedDb.from('states', true).select('*').order('name'),
        scopedDb.from('cities', true).select('*').order('name'),
      ]);
      setContinents(contRes.data || []);
      setCountries(countryRes.data || []);
      setStates(stateRes.data || []);
      setCities(cityRes.data || []);
    } catch (err: any) {
      toast({ title: 'Load failed', description: err?.message || 'Error loading master data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = (rows: any[]) => rows.filter(r => String(r.name || '').toLowerCase().includes(search.toLowerCase()));

  const addRow = async (table: string, values: any) => {
    try {
      const { error } = await scopedDb.from(table, true).insert(values);
      if (error) throw error;
      toast({ title: 'Created', description: 'Row created successfully' });
      loadData();
    } catch (err: any) {
      toast({ title: 'Create failed', description: err?.message || 'Error creating row', variant: 'destructive' });
    }
  };

  const updateRow = async (table: string, id: string, values: any) => {
    try {
      const { error } = await scopedDb.from(table, true).update(values).eq('id', id);
      if (error) throw error;
      toast({ title: 'Updated', description: 'Row updated successfully' });
      loadData();
    } catch (err: any) {
      toast({ title: 'Update failed', description: err?.message || 'Error updating row', variant: 'destructive' });
    }
  };

  const deleteRow = async (table: string, id: string) => {
    try {
      const { error } = await scopedDb.from(table, true).delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Deleted', description: 'Row deleted successfully' });
      loadData();
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err?.message || 'Error deleting row', variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Master Data Management</h1>
          <p className="text-muted-foreground">Manage geographical demographic data</p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="continents">Continents</TabsTrigger>
            <TabsTrigger value="countries">Countries</TabsTrigger>
            <TabsTrigger value="states">States</TabsTrigger>
            <TabsTrigger value="cities">Cities</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 mt-4">
            <Input placeholder="Search by name" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button variant="outline" onClick={loadData} disabled={loading}>Refresh</Button>
          </div>

          <TabsContent value="continents" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Continents</CardTitle>
                <CardDescription>International and national codes</CardDescription>
              </CardHeader>
              <CardContent>
                <ActionsToolbar>
                  <Dialog open={showAddContinent} onOpenChange={setShowAddContinent}>
                    <DialogTrigger asChild>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Add Continent</Button>
                        </TooltipTrigger>
                        <TooltipContent>Add a single continent</TooltipContent>
                      </Tooltip>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Continent</DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-3 gap-2">
                        <Input placeholder="Name" value={continentForm.name} onChange={e => setContinentForm({ ...continentForm, name: e.target.value })} />
                        <Input placeholder="International Code" value={continentForm.intl} onChange={e => setContinentForm({ ...continentForm, intl: e.target.value })} />
                        <Input placeholder="National Code" value={continentForm.nat} onChange={e => setContinentForm({ ...continentForm, nat: e.target.value })} />
                      </div>
                      <div className="flex justify-end gap-2 mt-3">
                        <Button variant="outline" onClick={() => setShowAddContinent(false)}>Cancel</Button>
                        <Button onClick={() => {
                          const name = String(continentForm.name || '').trim();
                          const intl = String(continentForm.intl || '').trim();
                          const nat = String(continentForm.nat || '').trim();
                          if (!name) return toast({ title: 'Name required', variant: 'destructive' });
                          if (intl && intl.length !== 2) return toast({ title: 'International code must be 2 characters', variant: 'destructive' });
                          addRow('continents', { name, code_international: intl ? intl.toUpperCase() : null, code_national: nat || null });
                          setShowAddContinent(false);
                          setContinentForm({ name: '', intl: '', nat: '' });
                        }}>Save</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <input ref={contFileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const rows = await parseFileRows(file);
                      const payload = rows.map(r => ({ name: r[0]?.trim(), code_international: r[1]?.trim() || null, code_national: r[2]?.trim() || null })).filter(p => p.name);
                      if (payload.length === 0) return toast({ title: 'No valid rows found', variant: 'destructive' });
                      const { error } = await scopedDb.from('continents', true).insert(payload);
                      if (error) throw error;
                      toast({ title: 'Imported', description: `Imported ${payload.length} continents` });
                      if (contFileRef.current) contFileRef.current.value = '';
                      loadData();
                    } catch (err: any) {
                      toast({ title: 'Import failed', description: err?.message || 'Error importing data', variant: 'destructive' });
                    }
                  }} />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" onClick={() => contFileRef.current?.click()}>
                        <Upload className="mr-1 h-4 w-4" /> Import CSV/Excel
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Import continents via CSV or Excel</TooltipContent>
                  </Tooltip>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Import help"><Info className="h-4 w-4" /></Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64" align="start">
                      <div className="text-sm">
                        <div className="font-semibold mb-1">Expected columns</div>
                        <div>name, international_code, national_code</div>
                        <div className="font-semibold mt-2">Sample CSV</div>
                        <pre className="text-xs bg-muted p-2 rounded">{`name,international_code,national_code\nEurope,EU,N/A`}</pre>
                        <div className="mt-2">
                          <Button variant="outline" size="sm" onClick={() => exportCsv('continents_template.csv', ['name','international_code','national_code'], [])}>
                            Download CSV Template
                          </Button>
                          <Button variant="outline" size="sm" className="ml-2" onClick={() => exportExcel('continents_template.xlsx', ['name','international_code','national_code'], [])}>
                            Download XLSX Template
                          </Button>
                          <Button variant="outline" size="sm" className="ml-2" onClick={() => exportJsonTemplate('continents_template.json', ['name','international_code','national_code'])}>
                            Download JSON Template
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" onClick={() => {
                    const headers = ['id','name','code_international','code_national','is_active'];
                    const rows = filtered(continents).map((r: any) => ({
                      id: r.id, name: r.name, code_international: r.code_international || '', code_national: r.code_national || '', is_active: r.is_active ? 'true' : 'false'
                    }));
                      exportCsv('continents.csv', headers, rows);
                    }}>
                        <Download className="mr-1 h-4 w-4" /> Export CSV
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export current list to CSV</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" onClick={() => {
                    const headers = ['id','name','code_international','code_national','is_active'];
                    const rows = filtered(continents).map((r: any) => ({
                      id: r.id, name: r.name, code_international: r.code_international || '', code_national: r.code_national || '', is_active: r.is_active ? 'true' : 'false'
                    }));
                      exportExcel('continents.xlsx', headers, rows);
                    }}>
                        <FileText className="mr-1 h-4 w-4" /> Export Excel
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export current list to Excel</TooltipContent>
                  </Tooltip>
                </ActionsToolbar>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>International Code</TableHead>
                      <TableHead>National Code</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered(continents).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.name}</TableCell>
                        <TableCell>{r.code_international || '-'}</TableCell>
                        <TableCell>{r.code_national || '-'}</TableCell>
                        <TableCell>{r.is_active ? 'Yes' : 'No'}</TableCell>
                        <TableCell className="space-x-2">
                          <Button size="sm" variant="outline" onClick={() => {
                            setEditContinentForm({ id: r.id, name: r.name || '', intl: r.code_international || '', nat: r.code_national || '', is_active: !!r.is_active });
                            setShowEditContinent(true);
                          }}>Edit</Button>
                          <Button size="sm" variant="outline" onClick={() => updateRow('continents', r.id, { is_active: !r.is_active })}>{r.is_active ? 'Disable' : 'Enable'}</Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteRow('continents', r.id)}>Delete</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {/* Inline add retained if you prefer quick adds; modal provided above */}
                {/* Edit Continent Modal */}
                <Dialog open={showEditContinent} onOpenChange={setShowEditContinent}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Continent</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="Name" value={editContinentForm.name} onChange={e => setEditContinentForm({ ...editContinentForm, name: e.target.value })} />
                      <Input placeholder="International Code" value={editContinentForm.intl} onChange={e => setEditContinentForm({ ...editContinentForm, intl: e.target.value })} />
                      <Input placeholder="National Code" value={editContinentForm.nat} onChange={e => setEditContinentForm({ ...editContinentForm, nat: e.target.value })} />
                    </div>
                    <div className="flex justify-end gap-2 mt-3">
                      <Button variant="outline" onClick={() => setShowEditContinent(false)}>Cancel</Button>
                      <Button onClick={() => {
                        const name = String(editContinentForm.name || '').trim();
                        const intl = String(editContinentForm.intl || '').trim();
                        const nat = String(editContinentForm.nat || '').trim();
                        if (!name) return toast({ title: 'Name required', variant: 'destructive' });
                        if (intl && intl.length !== 2) return toast({ title: 'International code must be 2 characters', variant: 'destructive' });
                        updateRow('continents', editContinentForm.id, { name, code_international: intl ? intl.toUpperCase() : null, code_national: nat || null });
                        setShowEditContinent(false);
                      }}>Save</Button>
                    </div>
                  </DialogContent>
                </Dialog>
                
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="countries" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Countries</CardTitle>
                <CardDescription>ISO2, ISO3 and national codes</CardDescription>
              </CardHeader>
              <CardContent>
                <ActionsToolbar>
                  <Dialog open={showAddCountry} onOpenChange={setShowAddCountry}>
                    <DialogTrigger asChild>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Add Country</Button>
                        </TooltipTrigger>
                        <TooltipContent>Add a single country</TooltipContent>
                      </Tooltip>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Country</DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-3 gap-2">
                        <Input placeholder="Name" value={countryForm.name} onChange={e => setCountryForm({ ...countryForm, name: e.target.value })} />
                        <Select onValueChange={(v) => setCountryForm({ ...countryForm, continent_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Continent" /></SelectTrigger>
                          <SelectContent>
                            {continents.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input placeholder="ISO2" value={countryForm.iso2} onChange={e => setCountryForm({ ...countryForm, iso2: e.target.value })} />
                        <Input placeholder="ISO3" value={countryForm.iso3} onChange={e => setCountryForm({ ...countryForm, iso3: e.target.value })} />
                        <Input placeholder="National Code" value={countryForm.nat} onChange={e => setCountryForm({ ...countryForm, nat: e.target.value })} />
                        <Input placeholder="Phone Code" value={countryForm.phone} onChange={e => setCountryForm({ ...countryForm, phone: e.target.value })} />
                      </div>
                      <div className="flex justify-end gap-2 mt-3">
                        <Button variant="outline" onClick={() => setShowAddCountry(false)}>Cancel</Button>
                        <Button onClick={() => {
                          const name = String(countryForm.name || '').trim();
                          if (!name) return toast({ title: 'Name required', variant: 'destructive' });
                          addRow('countries', { name, continent_id: countryForm.continent_id || null, code_iso2: countryForm.iso2 || null, code_iso3: countryForm.iso3 || null, code_national: countryForm.nat || null, phone_code: countryForm.phone || null });
                          setShowAddCountry(false);
                          setCountryForm({ name: '', continent_id: '', iso2: '', iso3: '', nat: '', phone: '' });
                        }}>Save</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <input ref={countryFileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const rows = await parseFileRows(file);
                      const indexCont = new Map<string, string>(continents.map((c: any) => [String(c.code_international || '').toUpperCase(), String(c.id)]));
                      const errors: any[] = [];
                      const payload = rows.map((r, idx) => {
                        const name = r[0]?.trim();
                        const iso2 = r[1]?.trim();
                        const iso3 = r[2]?.trim();
                        const phone = r[3]?.trim();
                        const cont = (r[4]?.trim() || '').toUpperCase();
                        const continent_id = indexCont.get(cont) || null;
                        if (!name) { errors.push({ row: idx + 1, reason: 'Missing name', name, iso2, iso3, phone, cont }); return null; }
                        if (!iso2 || iso2.length !== 2) { errors.push({ row: idx + 1, reason: 'ISO2 must be 2 characters', name, iso2, iso3, phone, cont }); return null; }
                        return { name, code_iso2: iso2.toUpperCase(), code_iso3: iso3 ? iso3.toUpperCase() : null, phone_code: phone || null, continent_id };
                      }).filter(Boolean);
                      if (payload.length === 0) return toast({ title: 'No valid rows found', variant: 'destructive' });
                      const { error } = await scopedDb.from('countries', true).upsert(payload, { onConflict: 'code_iso2' });
                      if (error) throw error;
                      toast({ title: 'Imported', description: `Imported ${payload.length} countries` });
                      setCountryImportErrors(errors);
                      if (countryFileRef.current) countryFileRef.current.value = '';
                      loadData();
                    } catch (err: any) {
                      toast({ title: 'Import failed', description: err?.message || 'Error importing countries', variant: 'destructive' });
                    }
                  }} />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" onClick={() => countryFileRef.current?.click()}>
                        <Upload className="mr-1 h-4 w-4" /> Import CSV/Excel
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Import countries via CSV or Excel</TooltipContent>
                  </Tooltip>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Import help"><Info className="h-4 w-4" /></Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72" align="start">
                      <div className="text-sm">
                        <div className="font-semibold mb-1">Expected columns</div>
                        <div>name, iso2, iso3, phone_code, continent_code</div>
                        <div className="font-semibold mt-2">Sample CSV</div>
                        <pre className="text-xs bg-muted p-2 rounded">{`name,iso2,iso3,phone_code,continent_code\nUnited States,US,USA,1,NA`}</pre>
                        <div className="mt-2">
                          <Button variant="outline" size="sm" onClick={() => exportCsv('countries_template.csv', ['name','iso2','iso3','phone_code','continent_code'], [])}>
                            Download CSV Template
                          </Button>
                          <Button variant="outline" size="sm" className="ml-2" onClick={() => exportExcel('countries_template.xlsx', ['name','iso2','iso3','phone_code','continent_code'], [])}>
                            Download XLSX Template
                          </Button>
                          <Button variant="outline" size="sm" className="ml-2" onClick={() => exportJsonTemplate('countries_template.json', ['name','iso2','iso3','phone_code','continent_code'])}>
                            Download JSON Template
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  {countryImportErrors.length > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" onClick={() => downloadErrorsCsv('country_import_errors.csv', ['row','reason','name','iso2','iso3','phone','cont'], countryImportErrors)}>
                          <AlertCircle className="mr-1 h-4 w-4" /> Errors ({countryImportErrors.length})
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Download rejected rows</TooltipContent>
                    </Tooltip>
                  )}
                  {/* Export buttons for countries */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" onClick={() => {
                    const contIndex = new Map<string, string>(continents.map((c: any) => [String(c.id), String(c.code_international || '')]));
                    const headers = ['id','name','continent_code','iso2','iso3','phone_code','is_active'];
                    const rows = filtered(countries).map((r: any) => ({
                      id: r.id, name: r.name, continent_code: contIndex.get(String(r.continent_id)) || '', iso2: r.code_iso2 || '', iso3: r.code_iso3 || '', phone_code: r.phone_code || '', is_active: r.is_active ? 'true' : 'false'
                    }));
                      exportCsv('countries.csv', headers, rows);
                    }}>
                        <Download className="mr-1 h-4 w-4" /> Export CSV
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export current list to CSV</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" onClick={() => {
                    const contIndex = new Map<string, string>(continents.map((c: any) => [String(c.id), String(c.code_international || '')]));
                    const headers = ['id','name','continent_code','iso2','iso3','phone_code','is_active'];
                    const rows = filtered(countries).map((r: any) => ({
                      id: r.id, name: r.name, continent_code: contIndex.get(String(r.continent_id)) || '', iso2: r.code_iso2 || '', iso3: r.code_iso3 || '', phone_code: r.phone_code || '', is_active: r.is_active ? 'true' : 'false'
                    }));
                      exportExcel('countries.xlsx', headers, rows);
                    }}>
                        <FileText className="mr-1 h-4 w-4" /> Export Excel
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export current list to Excel</TooltipContent>
                  </Tooltip>
                </ActionsToolbar>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Continent</TableHead>
                      <TableHead>ISO2</TableHead>
                      <TableHead>ISO3</TableHead>
                      <TableHead>National Code</TableHead>
                      <TableHead>Phone Code</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered(countries).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.name}</TableCell>
                        <TableCell>{continents.find(c => c.id === r.continent_id)?.name || '-'}</TableCell>
                        <TableCell>{r.code_iso2 || '-'}</TableCell>
                        <TableCell>{r.code_iso3 || '-'}</TableCell>
                        <TableCell>{r.code_national || '-'}</TableCell>
                        <TableCell>{r.phone_code || '-'}</TableCell>
                        <TableCell className="space-x-2">
                          <Button size="sm" variant="outline" onClick={() => {
                            setEditCountryForm({ id: r.id, name: r.name || '', continent_id: r.continent_id || '', iso2: r.code_iso2 || '', iso3: r.code_iso3 || '', nat: r.code_national || '', phone: r.phone_code || '', is_active: !!r.is_active });
                            setShowEditCountry(true);
                          }}>Edit</Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteRow('countries', r.id)}>Delete</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {/* Inline add removed in favor of modal above for better UX */}
                {/* Edit Country Modal */}
                <Dialog open={showEditCountry} onOpenChange={setShowEditCountry}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Country</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="Name" value={editCountryForm.name} onChange={e => setEditCountryForm({ ...editCountryForm, name: e.target.value })} />
                      <Select value={String(editCountryForm.continent_id || '')} onValueChange={(v) => setEditCountryForm({ ...editCountryForm, continent_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Continent" /></SelectTrigger>
                        <SelectContent>
                          {continents.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input placeholder="ISO2" value={editCountryForm.iso2} onChange={e => setEditCountryForm({ ...editCountryForm, iso2: e.target.value })} />
                      <Input placeholder="ISO3" value={editCountryForm.iso3} onChange={e => setEditCountryForm({ ...editCountryForm, iso3: e.target.value })} />
                      <Input placeholder="National Code" value={editCountryForm.nat} onChange={e => setEditCountryForm({ ...editCountryForm, nat: e.target.value })} />
                      <Input placeholder="Phone Code" value={editCountryForm.phone} onChange={e => setEditCountryForm({ ...editCountryForm, phone: e.target.value })} />
                    </div>
                    <div className="flex justify-end gap-2 mt-3">
                      <Button variant="outline" onClick={() => setShowEditCountry(false)}>Cancel</Button>
                      <Button onClick={() => {
                        const name = String(editCountryForm.name || '').trim();
                        const iso2 = String(editCountryForm.iso2 || '').trim().toUpperCase();
                        const iso3 = String(editCountryForm.iso3 || '').trim().toUpperCase();
                        if (!name) return toast({ title: 'Name required', variant: 'destructive' });
                        if (iso2 && iso2.length !== 2) return toast({ title: 'ISO2 must be 2 letters', variant: 'destructive' });
                        if (iso3 && iso3.length !== 3) return toast({ title: 'ISO3 must be 3 letters', variant: 'destructive' });
                        updateRow('countries', editCountryForm.id, { name, continent_id: editCountryForm.continent_id || null, code_iso2: iso2 || null, code_iso3: iso3 || null, code_national: editCountryForm.nat || null, phone_code: editCountryForm.phone || null });
                        setShowEditCountry(false);
                      }}>Save</Button>
                    </div>
                  </DialogContent>
                </Dialog>
                {/* Countries bottom import block removed; import is now in top Actions toolbar */}
                </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="states" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>States / Provinces</CardTitle>
                <CardDescription>ISO-3166-2 / national codes</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Unified Actions toolbar for States */}
                <ActionsToolbar>
                  {/* Add State placed immediately after Actions label */}
                  <Dialog open={showAddState} onOpenChange={setShowAddState}>
                    <DialogTrigger asChild>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Add State</Button>
                        </TooltipTrigger>
                        <TooltipContent>Add a single state</TooltipContent>
                      </Tooltip>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add State / Province</DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-3 gap-2">
                        <Input placeholder="Name" value={stateForm.name} onChange={e => setStateForm({ ...stateForm, name: e.target.value })} />
                        <Select onValueChange={(v) => setStateForm({ ...stateForm, country_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Country" /></SelectTrigger>
                          <SelectContent>
                            {countries.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input placeholder="ISO Code" value={stateForm.iso} onChange={e => setStateForm({ ...stateForm, iso: e.target.value })} />
                      </div>
                      <div className="flex justify-end gap-2 mt-3">
                        <Button variant="outline" onClick={() => setShowAddState(false)}>Cancel</Button>
                        <Button onClick={() => {
                          const name = String(stateForm.name || '').trim();
                          const country_id = String(stateForm.country_id || '').trim();
                          const iso = String(stateForm.iso || '').trim();
                          if (!name || !country_id) return toast({ title: 'Name and country required', variant: 'destructive' });
                          if (iso && iso.length > 5) return toast({ title: 'ISO code too long', variant: 'destructive' });
                          addRow('states', { name, country_id, code_iso: iso || null });
                          setShowAddState(false);
                          setStateForm({ name: '', country_id: '', iso: '', nat: '' });
                        }}>Save</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <input ref={stateFileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const rows = await parseFileRows(file);
                      const indexCountry = new Map<string, string>(countries.map((c: any) => [String(c.code_iso2 || '').toUpperCase(), String(c.id)]));
                      const errors: any[] = [];
                      const payload = rows.map((r, idx) => {
                        const name = r[0]?.trim();
                        const iso = r[1]?.trim();
                        const ciso2 = (r[2]?.trim() || '').toUpperCase();
                        const country_id = indexCountry.get(ciso2) || null;
                        if (!name) { errors.push({ row: idx + 1, reason: 'Missing name', name, iso, ciso2 }); return null; }
                        if (!country_id) { errors.push({ row: idx + 1, reason: 'Unknown country ISO2', name, iso, ciso2 }); return null; }
                        return { name, country_id, code_iso: iso || null };
                      }).filter(Boolean);
                      if (payload.length === 0) return toast({ title: 'No valid rows found', variant: 'destructive' });
                      const { error } = await scopedDb.from('states', true).upsert(payload, { onConflict: 'country_id,code_iso' });
                      if (error) throw error;
                      toast({ title: 'Imported', description: `Imported ${payload.length} states` });
                      setStateImportErrors(errors);
                      if (stateFileRef.current) stateFileRef.current.value = '';
                      loadData();
                    } catch (err: any) {
                      toast({ title: 'Import failed', description: err?.message || 'Error importing states', variant: 'destructive' });
                    }
                  }} />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" onClick={() => stateFileRef.current?.click()}>
                        <Upload className="mr-1 h-4 w-4" /> Import CSV/Excel
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Import states via CSV or Excel</TooltipContent>
                  </Tooltip>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Import help"><Info className="h-4 w-4" /></Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72" align="start">
                      <div className="text-sm">
                        <div className="font-semibold mb-1">Expected columns</div>
                        <div>name, state_code_iso, country_iso2</div>
                        <div className="font-semibold mt-2">Sample CSV</div>
                        <pre className="text-xs bg-muted p-2 rounded">{`name,state_code_iso,country_iso2\nCalifornia,CA,US`}</pre>
                        <div className="mt-2">
                          <Button variant="outline" size="sm" onClick={() => exportCsv('states_template.csv', ['name','state_code_iso','country_iso2'], [])}>
                            Download CSV Template
                          </Button>
                          <Button variant="outline" size="sm" className="ml-2" onClick={() => exportExcel('states_template.xlsx', ['name','state_code_iso','country_iso2'], [])}>
                            Download XLSX Template
                          </Button>
                          <Button variant="outline" size="sm" className="ml-2" onClick={() => exportJsonTemplate('states_template.json', ['name','state_code_iso','country_iso2'])}>
                            Download JSON Template
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  {stateImportErrors.length > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" onClick={() => downloadErrorsCsv('state_import_errors.csv', ['row','reason','name','iso','ciso2'], stateImportErrors)}>
                          <AlertCircle className="mr-1 h-4 w-4" /> Errors ({stateImportErrors.length})
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Download rejected rows</TooltipContent>
                    </Tooltip>
                  )}
                  {/* Export actions moved after Import and Errors for consistency */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" onClick={() => {
                        const countryIndex = new Map<string, string>(countries.map((c: any) => [String(c.id), String(c.code_iso2 || '')]));
                        const headers = ['id','name','country_iso2','code_iso','is_active'];
                        const rows = filtered(states).map((r: any) => ({
                          id: r.id, name: r.name, country_iso2: countryIndex.get(String(r.country_id)) || '', code_iso: r.code_iso || '', is_active: r.is_active ? 'true' : 'false'
                        }));
                        exportCsv('states.csv', headers, rows);
                      }}>
                        <Download className="mr-1 h-4 w-4" /> Export CSV
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export current list to CSV</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" onClick={() => {
                        const countryIndex = new Map<string, string>(countries.map((c: any) => [String(c.id), String(c.code_iso2 || '')]));
                        const headers = ['id','name','country_iso2','code_iso','is_active'];
                        const rows = filtered(states).map((r: any) => ({
                          id: r.id, name: r.name, country_iso2: countryIndex.get(String(r.country_id)) || '', code_iso: r.code_iso || '', is_active: r.is_active ? 'true' : 'false'
                        }));
                        exportExcel('states.xlsx', headers, rows);
                      }}>
                        <FileText className="mr-1 h-4 w-4" /> Export Excel
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export current list to Excel</TooltipContent>
                  </Tooltip>
                </ActionsToolbar>
                {/* Removed duplicate bottom quick-add grid in States */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>ISO Code</TableHead>
                      <TableHead>National Code</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered(states).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.name}</TableCell>
                        <TableCell>{countries.find(c => c.id === r.country_id)?.name || '-'}</TableCell>
                        <TableCell>{r.code_iso || '-'}</TableCell>
                        <TableCell>{r.code_national || '-'}</TableCell>
                        <TableCell className="space-x-2">
                          <Button size="sm" variant="outline" onClick={() => {
                            setEditStateForm({ id: r.id, name: r.name || '', country_id: r.country_id || '', iso: r.code_iso || '', nat: r.code_national || '', is_active: !!r.is_active });
                            setShowEditState(true);
                          }}>Edit</Button>
                          <Button size="sm" variant="outline" onClick={() => updateRow('states', r.id, { is_active: !r.is_active })}>{r.is_active ? 'Disable' : 'Enable'}</Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteRow('states', r.id)}>Delete</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4 grid grid-cols-5 gap-2">
                  <Input id="state_name" placeholder="Name" />
                  <Select onValueChange={(v) => (document.getElementById('state_country') as HTMLInputElement).value = v}>
                    <SelectTrigger><SelectValue placeholder="Country" /></SelectTrigger>
                    <SelectContent>
                      {countries.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input id="state_country" type="hidden" />
                  <Input id="state_iso" placeholder="ISO Code" />
                  <Input id="state_nat" placeholder="National Code" />
                  <Button onClick={() => {
                    const name = (document.getElementById('state_name') as HTMLInputElement).value.trim();
                    const country_id = (document.getElementById('state_country') as HTMLInputElement).value.trim();
                    const code_iso = (document.getElementById('state_iso') as HTMLInputElement).value.trim();
                    const code_national = (document.getElementById('state_nat') as HTMLInputElement).value.trim();
                    if (!name || !country_id) return toast({ title: 'Name and country required', variant: 'destructive' });
                    addRow('states', { name, country_id, code_iso: code_iso || null, code_national: code_national || null });
                  }}>Add</Button>
                </div>
                {/* Edit State Modal */}
                <Dialog open={showEditState} onOpenChange={setShowEditState}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit State / Province</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="Name" value={editStateForm.name} onChange={e => setEditStateForm({ ...editStateForm, name: e.target.value })} />
                      <Select value={String(editStateForm.country_id || '')} onValueChange={(v) => setEditStateForm({ ...editStateForm, country_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Country" /></SelectTrigger>
                        <SelectContent>
                          {countries.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input placeholder="ISO Code" value={editStateForm.iso} onChange={e => setEditStateForm({ ...editStateForm, iso: e.target.value })} />
                    </div>
                    <div className="flex justify-end gap-2 mt-3">
                      <Button variant="outline" onClick={() => setShowEditState(false)}>Cancel</Button>
                      <Button onClick={() => {
                        const name = String(editStateForm.name || '').trim();
                        const country_id = String(editStateForm.country_id || '').trim();
                        const iso = String(editStateForm.iso || '').trim();
                        if (!name || !country_id) return toast({ title: 'Name and country required', variant: 'destructive' });
                        if (iso && iso.length > 5) return toast({ title: 'ISO code too long', variant: 'destructive' });
                        updateRow('states', editStateForm.id, { name, country_id, code_iso: iso || null });
                        setShowEditState(false);
                      }}>Save</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cities" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Cities</CardTitle>
                <CardDescription>National codes and coordinates</CardDescription>
              </CardHeader>
              <CardContent>
                <ActionsToolbar>
                  <Dialog open={showAddCity} onOpenChange={setShowAddCity}>
                    <DialogTrigger asChild>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Add City</Button>
                        </TooltipTrigger>
                        <TooltipContent>Add a single city</TooltipContent>
                      </Tooltip>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add City</DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-3 gap-2">
                        <Input placeholder="Name" value={cityForm.name} onChange={e => setCityForm({ ...cityForm, name: e.target.value })} />
                        <Select onValueChange={(v) => setCityForm({ ...cityForm, country_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Country" /></SelectTrigger>
                          <SelectContent>
                            {countries.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select onValueChange={(v) => setCityForm({ ...cityForm, state_id: v })}>
                          <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
                          <SelectContent>
                            {states.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input placeholder="National Code" value={cityForm.nat} onChange={e => setCityForm({ ...cityForm, nat: e.target.value })} />
                        <Input placeholder="Latitude" value={cityForm.lat} onChange={e => setCityForm({ ...cityForm, lat: e.target.value })} />
                        <Input placeholder="Longitude" value={cityForm.lng} onChange={e => setCityForm({ ...cityForm, lng: e.target.value })} />
                      </div>
                      <div className="flex justify-end gap-2 mt-3">
                        <Button variant="outline" onClick={() => setShowAddCity(false)}>Cancel</Button>
                        <Button onClick={() => {
                          const name = String(cityForm.name || '').trim();
                          const country_id = String(cityForm.country_id || '').trim();
                          const state_id = String(cityForm.state_id || '').trim();
                          if (!name || !country_id) return toast({ title: 'Name and country required', variant: 'destructive' });
                          const latitude = parseFloat(String(cityForm.lat || '').trim());
                          const longitude = parseFloat(String(cityForm.lng || '').trim());
                          addRow('cities', { name, country_id, state_id: state_id || null, code_national: cityForm.nat || null, latitude: isNaN(latitude) ? null : latitude, longitude: isNaN(longitude) ? null : longitude });
                          setShowAddCity(false);
                          setCityForm({ name: '', country_id: '', state_id: '', nat: '', lat: '', lng: '' });
                        }}>Save</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <input ref={cityFileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const rows = await parseFileRows(file);
                      const indexCountry = new Map<string, string>(countries.map((c: any) => [String(c.code_iso2 || '').toUpperCase(), String(c.id)]));
                      const indexStateKey = new Map<string, string>(states.map((s: any) => [String(s.code_iso || '').toUpperCase() + '|' + String(s.country_id), String(s.id)]));
                      const errors: any[] = [];
                      const payload = rows.map((r, idx) => {
                        const name = r[0]?.trim();
                        const ciso2 = (r[1]?.trim() || '').toUpperCase();
                        const siso = (r[2]?.trim() || '').toUpperCase();
                        const nat = r[3]?.trim();
                        const lat = parseFloat(r[4] || '');
                        const lng = parseFloat(r[5] || '');
                        const country_id = indexCountry.get(ciso2) || null;
                        const state_id = country_id ? (indexStateKey.get(siso + '|' + String(country_id)) || null) : null;
                        if (!name) { errors.push({ row: idx + 1, reason: 'Missing name', name, ciso2, siso, nat, lat, lng }); return null; }
                        if (!country_id) { errors.push({ row: idx + 1, reason: 'Unknown country ISO2', name, ciso2, siso, nat, lat, lng }); return null; }
                        if (Number.isFinite(lat) && (lat < -90 || lat > 90)) { errors.push({ row: idx + 1, reason: 'Latitude out of range', name, ciso2, siso, nat, lat, lng }); }
                        if (Number.isFinite(lng) && (lng < -180 || lng > 180)) { errors.push({ row: idx + 1, reason: 'Longitude out of range', name, ciso2, siso, nat, lat, lng }); }
                        return { name, country_id, state_id, code_national: nat || null, latitude: isNaN(lat) ? null : lat, longitude: isNaN(lng) ? null : lng };
                      }).filter(Boolean);
                      if (payload.length === 0) return toast({ title: 'No valid rows found', variant: 'destructive' });
                      const { error } = await scopedDb.from('cities', true).upsert(payload, { onConflict: 'country_id,state_id,name' });
                      if (error) throw error;
                      toast({ title: 'Imported', description: `Imported ${payload.length} cities` });
                      setCityImportErrors(errors);
                      if (cityFileRef.current) cityFileRef.current.value = '';
                      loadData();
                    } catch (err: any) {
                      toast({ title: 'Import failed', description: err?.message || 'Error importing cities', variant: 'destructive' });
                    }
                  }} />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" onClick={() => cityFileRef.current?.click()}>
                        <Upload className="mr-1 h-4 w-4" /> Import CSV/Excel
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Import cities via CSV or Excel</TooltipContent>
                  </Tooltip>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Import help"><Info className="h-4 w-4" /></Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="start">
                      <div className="text-sm">
                        <div className="font-semibold mb-1">Expected columns</div>
                        <div>name, country_iso2, state_code_iso, national_code, lat, lng</div>
                        <div className="font-semibold mt-2">Sample CSV</div>
                        <pre className="text-xs bg-muted p-2 rounded">{`name,country_iso2,state_code_iso,national_code,lat,lng\nSan Francisco,US,CA,94103,37.7749,-122.4194`}</pre>
                        <div className="mt-2">
                          <Button variant="outline" size="sm" onClick={() => exportCsv('cities_template.csv', ['name','country_iso2','state_code_iso','national_code','lat','lng'], [])}>
                            Download CSV Template
                          </Button>
                          <Button variant="outline" size="sm" className="ml-2" onClick={() => exportExcel('cities_template.xlsx', ['name','country_iso2','state_code_iso','national_code','lat','lng'], [])}>
                            Download XLSX Template
                          </Button>
                          <Button variant="outline" size="sm" className="ml-2" onClick={() => exportJsonTemplate('cities_template.json', ['name','country_iso2','state_code_iso','national_code','lat','lng'])}>
                            Download JSON Template
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  {cityImportErrors.length > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" onClick={() => downloadErrorsCsv('city_import_errors.csv', ['row','reason','name','ciso2','siso','nat','lat','lng'], cityImportErrors)}>
                          <AlertCircle className="mr-1 h-4 w-4" /> Errors ({cityImportErrors.length})
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Download rejected rows</TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" onClick={() => {
                        const countryIndex = new Map<string, string>(countries.map((c: any) => [String(c.id), String(c.code_iso2 || '')]));
                        const stateIndexKey = new Map<string, string>(states.map((s: any) => [String(s.id), String(s.code_iso || '')]));
                        const headers = ['id','name','country_iso2','state_code_iso','national_code','lat','lng','is_active'];
                        const rows = filtered(cities).map((r: any) => ({
                          id: r.id, name: r.name, country_iso2: countryIndex.get(String(r.country_id)) || '', state_code_iso: stateIndexKey.get(String(r.state_id)) || '', national_code: r.code_national || '', lat: r.latitude ?? '', lng: r.longitude ?? '', is_active: r.is_active ? 'true' : 'false'
                        }));
                        exportCsv('cities.csv', headers, rows);
                      }}>
                        <Download className="mr-1 h-4 w-4" /> Export CSV
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export current list to CSV</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" onClick={() => {
                        const countryIndex = new Map<string, string>(countries.map((c: any) => [String(c.id), String(c.code_iso2 || '')]));
                        const stateIndexKey = new Map<string, string>(states.map((s: any) => [String(s.id), String(s.code_iso || '')]));
                        const headers = ['id','name','country_iso2','state_code_iso','national_code','lat','lng','is_active'];
                        const rows = filtered(cities).map((r: any) => ({
                          id: r.id, name: r.name, country_iso2: countryIndex.get(String(r.country_id)) || '', state_code_iso: stateIndexKey.get(String(r.state_id)) || '', national_code: r.code_national || '', lat: r.latitude ?? '', lng: r.longitude ?? '', is_active: r.is_active ? 'true' : 'false'
                        }));
                        exportExcel('cities.xlsx', headers, rows);
                      }}>
                        <FileText className="mr-1 h-4 w-4" /> Export Excel
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export current list to Excel</TooltipContent>
                  </Tooltip>
                </ActionsToolbar>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>National Code</TableHead>
                      <TableHead>Lat</TableHead>
                      <TableHead>Lng</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered(cities).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.name}</TableCell>
                        <TableCell>{countries.find(c => c.id === r.country_id)?.name || '-'}</TableCell>
                        <TableCell>{states.find(s => s.id === r.state_id)?.name || '-'}</TableCell>
                        <TableCell>{r.code_national || '-'}</TableCell>
                        <TableCell>{r.latitude ?? '-'}</TableCell>
                        <TableCell>{r.longitude ?? '-'}</TableCell>
                        <TableCell className="space-x-2">
                          <Button size="sm" variant="outline" onClick={() => {
                            setEditCityForm({ id: r.id, name: r.name || '', country_id: r.country_id || '', state_id: r.state_id || '', nat: r.code_national || '', lat: r.latitude ?? '', lng: r.longitude ?? '', is_active: !!r.is_active });
                            setShowEditCity(true);
                          }}>Edit</Button>
                          <Button size="sm" variant="outline" onClick={() => updateRow('cities', r.id, { is_active: !r.is_active })}>{r.is_active ? 'Disable' : 'Enable'}</Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteRow('cities', r.id)}>Delete</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {/* Toolbar-only pattern: no inline quick-add forms for Cities; use Add modal above */}
                {/* Edit City Modal */}
                <Dialog open={showEditCity} onOpenChange={setShowEditCity}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit City</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="Name" value={editCityForm.name} onChange={e => setEditCityForm({ ...editCityForm, name: e.target.value })} />
                      <Select value={String(editCityForm.country_id || '')} onValueChange={(v) => setEditCityForm({ ...editCityForm, country_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Country" /></SelectTrigger>
                        <SelectContent>
                          {countries.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={String(editCityForm.state_id || '')} onValueChange={(v) => setEditCityForm({ ...editCityForm, state_id: v })}>
                        <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
                        <SelectContent>
                          {states.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input placeholder="National Code" value={editCityForm.nat} onChange={e => setEditCityForm({ ...editCityForm, nat: e.target.value })} />
                      <Input placeholder="Latitude" value={editCityForm.lat} onChange={e => setEditCityForm({ ...editCityForm, lat: e.target.value })} />
                      <Input placeholder="Longitude" value={editCityForm.lng} onChange={e => setEditCityForm({ ...editCityForm, lng: e.target.value })} />
                    </div>
                    <div className="flex justify-end gap-2 mt-3">
                      <Button variant="outline" onClick={() => setShowEditCity(false)}>Cancel</Button>
                      <Button onClick={() => {
                        const name = String(editCityForm.name || '').trim();
                        const country_id = String(editCityForm.country_id || '').trim();
                        const state_id = String(editCityForm.state_id || '').trim();
                        if (!name || !country_id) return toast({ title: 'Name and country required', variant: 'destructive' });
                        const latitude = parseFloat(String(editCityForm.lat || '').trim());
                        const longitude = parseFloat(String(editCityForm.lng || '').trim());
                        updateRow('cities', editCityForm.id, { name, country_id, state_id: state_id || null, code_national: editCityForm.nat || null, latitude: isNaN(latitude) ? null : latitude, longitude: isNaN(longitude) ? null : longitude });
                        setShowEditCity(false);
                      }}>Save</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
              {/* Cities bottom add/import section removed; unified in top Actions toolbar */}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}