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

export default function MasterDataGeography() {
  const { toast } = useToast();
  const [tab, setTab] = useState('continents');
  const [continents, setContinents] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

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
                <div className="mt-4 grid grid-cols-4 gap-2">
                  <Input id="c_name" placeholder="Name" />
                  <Input id="c_int" placeholder="International Code" />
                  <Input id="c_nat" placeholder="National Code" />
                  <Button onClick={() => {
                    const name = (document.getElementById('c_name') as HTMLInputElement).value.trim();
                    const intl = (document.getElementById('c_int') as HTMLInputElement).value.trim();
                    const nat = (document.getElementById('c_nat') as HTMLInputElement).value.trim();
                    if (!name) return toast({ title: 'Name required', variant: 'destructive' });
                    addRow('continents', { name, code_international: intl || null, code_national: nat || null });
                  }}>Add</Button>
                </div>
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
                <div className="mt-4 grid grid-cols-6 gap-2">
                  <Input id="country_name" placeholder="Name" />
                  <Select onValueChange={(v) => (document.getElementById('country_cont') as HTMLInputElement).value = v}>
                    <SelectTrigger><SelectValue placeholder="Continent" /></SelectTrigger>
                    <SelectContent>
                      {continents.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input id="country_cont" type="hidden" />
                  <Input id="country_iso2" placeholder="ISO2" />
                  <Input id="country_iso3" placeholder="ISO3" />
                  <Input id="country_nat" placeholder="National Code" />
                  <Input id="country_phone" placeholder="Phone Code" />
                  <Button onClick={() => {
                    const name = (document.getElementById('country_name') as HTMLInputElement).value.trim();
                    const continent_id = (document.getElementById('country_cont') as HTMLInputElement).value.trim();
                    const code_iso2 = (document.getElementById('country_iso2') as HTMLInputElement).value.trim();
                    const code_iso3 = (document.getElementById('country_iso3') as HTMLInputElement).value.trim();
                    const code_national = (document.getElementById('country_nat') as HTMLInputElement).value.trim();
                    const phone_code = (document.getElementById('country_phone') as HTMLInputElement).value.trim();
                    if (!name) return toast({ title: 'Name required', variant: 'destructive' });
                    addRow('countries', { name, continent_id: continent_id || null, code_iso2: code_iso2 || null, code_iso3: code_iso3 || null, code_national: code_national || null, phone_code: phone_code || null });
                  }}>Add</Button>
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
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}