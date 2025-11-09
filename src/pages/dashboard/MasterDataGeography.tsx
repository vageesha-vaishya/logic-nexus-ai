import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import * as XLSX from 'xlsx';

export default function MasterDataGeography() {
  const { toast } = useToast();
  const [tab, setTab] = useState('continents');
  const [continents, setContinents] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
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
  const [bulkContFile, setBulkContFile] = useState<File | null>(null);
  const [bulkCountryFile, setBulkCountryFile] = useState<File | null>(null);
  const [bulkStateFile, setBulkStateFile] = useState<File | null>(null);
  const [bulkCityFile, setBulkCityFile] = useState<File | null>(null);

  const parseRows = async (file: File): Promise<string[][]> => {
    const name = file.name.toLowerCase();
    if (name.endsWith('.csv')) {
      const text = await file.text();
      return text.split(/\r?\n/).map(l => l.split(',')).filter(r => r.some(v => v && v.trim().length));
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[];
      return (json || []).filter((r: any) => Array.isArray(r) && r.some((v: any) => v && String(v).trim().length)).map((r: any) => r.map((v: any) => String(v)));
    }
    throw new Error('Unsupported file type');
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [contRes, countryRes, stateRes, cityRes] = await Promise.all([
        (supabase as any).from('continents').select('*').order('name'),
        (supabase as any).from('countries').select('*').order('name'),
        (supabase as any).from('states').select('*').order('name'),
        (supabase as any).from('cities').select('*').order('name'),
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
      const { error } = await (supabase as any).from(table).insert(values);
      if (error) throw error;
      toast({ title: 'Created', description: 'Row created successfully' });
      loadData();
    } catch (err: any) {
      toast({ title: 'Create failed', description: err?.message || 'Error creating row', variant: 'destructive' });
    }
  };

  const updateRow = async (table: string, id: string, values: any) => {
    try {
      const { error } = await (supabase as any).from(table).update(values).eq('id', id);
      if (error) throw error;
      toast({ title: 'Updated', description: 'Row updated successfully' });
      loadData();
    } catch (err: any) {
      toast({ title: 'Update failed', description: err?.message || 'Error updating row', variant: 'destructive' });
    }
  };

  const deleteRow = async (table: string, id: string) => {
    try {
      const { error } = await (supabase as any).from(table).delete().eq('id', id);
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
                <div className="flex items-center gap-2 mb-2">
                  <Dialog open={showAddContinent} onOpenChange={setShowAddContinent}>
                    <DialogTrigger asChild>
                      <Button size="sm">Add Continent</Button>
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
                          if (!name) return toast({ title: 'Name required', variant: 'destructive' });
                          addRow('continents', { name, code_international: continentForm.intl || null, code_national: continentForm.nat || null });
                          setShowAddContinent(false);
                          setContinentForm({ name: '', intl: '', nat: '' });
                        }}>Save</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <input type="file" accept=".csv,.xlsx" onChange={(e) => setBulkContFile(e.target.files?.[0] || null)} />
                  <Button variant="outline" disabled={!bulkContFile} onClick={async () => {
                    if (!bulkContFile) return;
                    try {
                      const rows = await parseRows(bulkContFile);
                      const payload = rows.map(r => ({ name: r[0]?.trim(), code_international: r[1]?.trim() || null, code_national: r[2]?.trim() || null })).filter(p => p.name);
                      if (payload.length === 0) return toast({ title: 'No valid rows found', variant: 'destructive' });
                      const { error } = await (supabase as any).from('continents').insert(payload);
                      if (error) throw error;
                      toast({ title: 'Imported', description: `Imported ${payload.length} continents` });
                      setBulkContFile(null);
                      loadData();
                    } catch (err: any) {
                      toast({ title: 'Import failed', description: err?.message || 'Error importing data', variant: 'destructive' });
                    }
                  }}>Import CSV/Excel</Button>
                </div>
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
                          <Button size="sm" variant="outline" onClick={() => updateRow('continents', r.id, { is_active: !r.is_active })}>{r.is_active ? 'Disable' : 'Enable'}</Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteRow('continents', r.id)}>Delete</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {/* Inline add retained if you prefer quick adds; modal provided above */}
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
                <div className="flex items-center gap-2 mb-2">
                  <Dialog open={showAddCountry} onOpenChange={setShowAddCountry}>
                    <DialogTrigger asChild>
                      <Button size="sm">Add Country</Button>
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
                </div>
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
                          <Button size="sm" variant="destructive" onClick={() => deleteRow('countries', r.id)}>Delete</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {/* Inline add removed in favor of modal above for better UX */}
                <div className="flex items-center gap-2 mt-4">
                  <input type="file" accept=".csv,.xlsx" onChange={(e) => setBulkCountryFile(e.target.files?.[0] || null)} />
                  <Button variant="outline" disabled={!bulkCountryFile} onClick={async () => {
                    if (!bulkCountryFile) return;
                    try {
                      const rows = await parseRows(bulkCountryFile);
                      // Expected columns: name, iso2, iso3, phone_code, continent_code
                      const indexCont = new Map<string, string>(continents.map((c: any) => [String(c.code_international || '').toUpperCase(), String(c.id)]));
                      const payload = rows.map(r => {
                        const name = r[0]?.trim();
                        const iso2 = r[1]?.trim();
                        const iso3 = r[2]?.trim();
                        const phone = r[3]?.trim();
                        const cont = (r[4]?.trim() || '').toUpperCase();
                        const continent_id = indexCont.get(cont) || null;
                        if (!name || !iso2) return null;
                        return { name, code_iso2: iso2, code_iso3: iso3 || null, phone_code: phone || null, continent_id };
                      }).filter(Boolean);
                      if (payload.length === 0) return toast({ title: 'No valid rows found', variant: 'destructive' });
                      const { error } = await (supabase as any).from('countries').upsert(payload, { onConflict: 'code_iso2' });
                      if (error) throw error;
                      toast({ title: 'Imported', description: `Imported ${payload.length} countries` });
                      setBulkCountryFile(null);
                      loadData();
                    } catch (err: any) {
                      toast({ title: 'Import failed', description: err?.message || 'Error importing countries', variant: 'destructive' });
                    }
                  }}>Import CSV/Excel</Button>
                </div>
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
              </CardContent>
              <div className="flex items-center gap-2 mb-2">
                <Dialog open={showAddState} onOpenChange={setShowAddState}>
                  <DialogTrigger asChild>
                    <Button size="sm">Add State</Button>
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
                        if (!name || !country_id) return toast({ title: 'Name and country required', variant: 'destructive' });
                        addRow('states', { name, country_id, code_iso: stateForm.iso || null });
                        setShowAddState(false);
                        setStateForm({ name: '', country_id: '', iso: '', nat: '' });
                      }}>Save</Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <input type="file" accept=".csv,.xlsx" onChange={(e) => setBulkStateFile(e.target.files?.[0] || null)} />
                <Button variant="outline" disabled={!bulkStateFile} onClick={async () => {
                  if (!bulkStateFile) return;
                  try {
                    const rows = await parseRows(bulkStateFile);
                    // Expected columns: name, state_code_iso, country_iso2
                    const indexCountry = new Map<string, string>(countries.map((c: any) => [String(c.code_iso2 || '').toUpperCase(), String(c.id)]));
                    const payload = rows.map(r => {
                      const name = r[0]?.trim();
                      const iso = r[1]?.trim();
                      const ciso2 = (r[2]?.trim() || '').toUpperCase();
                      const country_id = indexCountry.get(ciso2) || null;
                      if (!name || !country_id) return null;
                      return { name, country_id, code_iso: iso || null };
                    }).filter(Boolean);
                    if (payload.length === 0) return toast({ title: 'No valid rows found', variant: 'destructive' });
                    const { error } = await (supabase as any).from('states').insert(payload);
                    if (error) throw error;
                    toast({ title: 'Imported', description: `Imported ${payload.length} states` });
                    setBulkStateFile(null);
                    loadData();
                  } catch (err: any) {
                    toast({ title: 'Import failed', description: err?.message || 'Error importing states', variant: 'destructive' });
                  }
                }}>Import CSV/Excel</Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="cities" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Cities</CardTitle>
                <CardDescription>National codes and coordinates</CardDescription>
              </CardHeader>
              <CardContent>
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
                          <Button size="sm" variant="destructive" onClick={() => deleteRow('cities', r.id)}>Delete</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4 grid grid-cols-6 gap-2">
                  <Input id="city_name" placeholder="Name" />
                  <Select onValueChange={(v) => (document.getElementById('city_country') as HTMLInputElement).value = v}>
                    <SelectTrigger><SelectValue placeholder="Country" /></SelectTrigger>
                    <SelectContent>
                      {countries.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input id="city_country" type="hidden" />
                  <Select onValueChange={(v) => (document.getElementById('city_state') as HTMLInputElement).value = v}>
                    <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
                    <SelectContent>
                      {states.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input id="city_state" type="hidden" />
                  <Input id="city_nat" placeholder="National Code" />
                  <Input id="city_lat" placeholder="Latitude" />
                  <Input id="city_lng" placeholder="Longitude" />
                  <Button onClick={() => {
                    const name = (document.getElementById('city_name') as HTMLInputElement).value.trim();
                    const country_id = (document.getElementById('city_country') as HTMLInputElement).value.trim();
                    const state_id = (document.getElementById('city_state') as HTMLInputElement).value.trim();
                    const code_national = (document.getElementById('city_nat') as HTMLInputElement).value.trim();
                    const latitude = parseFloat((document.getElementById('city_lat') as HTMLInputElement).value.trim());
                    const longitude = parseFloat((document.getElementById('city_lng') as HTMLInputElement).value.trim());
                    if (!name || !country_id) return toast({ title: 'Name and country required', variant: 'destructive' });
                    addRow('cities', { name, country_id, state_id: state_id || null, code_national: code_national || null, latitude: isNaN(latitude) ? null : latitude, longitude: isNaN(longitude) ? null : longitude });
                  }}>Add</Button>
                </div>
              </CardContent>
              <div className="flex items-center gap-2 mb-2">
                <Dialog open={showAddCity} onOpenChange={setShowAddCity}>
                  <DialogTrigger asChild>
                    <Button size="sm">Add City</Button>
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
                <input type="file" accept=".csv,.xlsx" onChange={(e) => setBulkCityFile(e.target.files?.[0] || null)} />
                <Button variant="outline" disabled={!bulkCityFile} onClick={async () => {
                  if (!bulkCityFile) return;
                  try {
                    const rows = await parseRows(bulkCityFile);
                    // Expected columns: name, country_iso2, state_code_iso, national_code, lat, lng
                    const indexCountry = new Map<string, string>(countries.map((c: any) => [String(c.code_iso2 || '').toUpperCase(), String(c.id)]));
                    const indexStateKey = new Map<string, string>(states.map((s: any) => [String(s.code_iso || '').toUpperCase() + '|' + String(s.country_id), String(s.id)]));
                    const payload = rows.map(r => {
                      const name = r[0]?.trim();
                      const ciso2 = (r[1]?.trim() || '').toUpperCase();
                      const siso = (r[2]?.trim() || '').toUpperCase();
                      const nat = r[3]?.trim();
                      const lat = parseFloat(r[4] || '');
                      const lng = parseFloat(r[5] || '');
                      const country_id = indexCountry.get(ciso2) || null;
                      const state_id = country_id ? (indexStateKey.get(siso + '|' + String(country_id)) || null) : null;
                      if (!name || !country_id) return null;
                      return { name, country_id, state_id, code_national: nat || null, latitude: isNaN(lat) ? null : lat, longitude: isNaN(lng) ? null : lng };
                    }).filter(Boolean);
                    if (payload.length === 0) return toast({ title: 'No valid rows found', variant: 'destructive' });
                    const { error } = await (supabase as any).from('cities').insert(payload);
                    if (error) throw error;
                    toast({ title: 'Imported', description: `Imported ${payload.length} cities` });
                    setBulkCityFile(null);
                    loadData();
                  } catch (err: any) {
                    toast({ title: 'Import failed', description: err?.message || 'Error importing cities', variant: 'destructive' });
                  }
                }}>Import CSV/Excel</Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}