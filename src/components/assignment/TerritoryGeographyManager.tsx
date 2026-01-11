import { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Plus, AlertTriangle, Globe, Map } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Props {
  territoryId: string;
}

export function TerritoryGeographyManager({ territoryId }: Props) {
  const { scopedDb, supabase } = useCRM();
  const [mappings, setMappings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  
  // Master data
  const [continents, setContinents] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  
  // Form
  const [type, setType] = useState<'continent' | 'country' | 'state' | 'city'>('country');
  const [selectedContinent, setSelectedContinent] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');

  useEffect(() => {
    const init = async () => {
      await fetchMasterData();
      await fetchMappings();
    };
    init();
  }, [territoryId]);

  const fetchMasterData = async () => {
      try {
        const [contRes, countRes, stateRes, cityRes] = await Promise.all([
          scopedDb.from('continents', true).select('id, name').eq('is_active', true).order('name'),
          scopedDb.from('countries', true).select('id, name, continent_id').eq('is_active', true).order('name'),
          scopedDb.from('states', true).select('id, name, country_id').eq('is_active', true).order('name'),
          scopedDb.from('cities', true).select('id, name, country_id, state_id').eq('is_active', true).order('name')
        ]);

        if (contRes.error) throw contRes.error;
        if (countRes.error) throw countRes.error;
        if (stateRes.error) throw stateRes.error;
        if (cityRes.error) throw cityRes.error;

        setContinents(contRes.data || []);
        setCountries(countRes.data || []);
        setStates(stateRes.data || []);
        setCities(cityRes.data || []);
      } catch (error) {
        console.error('Error fetching master data:', error);
        toast.error('Failed to load geographical data');
      }
    };

  const fetchMappings = async () => {
    try {
      setLoading(true);
      const { data, error } = await sb
        .from('territory_geographies')
        .select('id, territory_id, continent_id, country_id, state_id, city_id')
        .eq('territory_id', territoryId);

      if (error) {
        const status = (error as any)?.status ?? (error as any)?.code;
        const message = String((error as any)?.message || '').toLowerCase();
        if (status === 404 || message.includes('not found')) {
          setUnavailable(true);
          return;
        }
        throw error;
      }
      setMappings(data || []);
    } catch (error) {
      console.error('Error fetching mappings:', error);
      toast.error('Failed to load geography mappings');
    } finally {
      setLoading(false);
    }
  };

  const validateMapping = (
    newType: 'continent' | 'country' | 'state' | 'city',
    newId: string
  ): { valid: boolean; message?: string } => {
    // 1. Check if already exists
    const exists = mappings.some(m => 
      (newType === 'continent' && m.continent_id === newId) ||
      (newType === 'country' && m.country_id === newId) ||
      (newType === 'state' && m.state_id === newId) ||
      (newType === 'city' && m.city_id === newId)
    );
    if (exists) return { valid: false, message: 'This geography is already added.' };

    // 2. Check Parent Redundancy (If I add a child, is the parent already there?)
    if (newType === 'country') {
      const country = countries.find(c => c.id === newId);
      if (country) {
        const parentMapped = mappings.some(m => m.continent_id === country.continent_id);
        if (parentMapped) return { valid: false, message: 'The continent for this country is already mapped. Adding the country is redundant.' };
      }
    }
    if (newType === 'state') {
      const state = states.find(s => s.id === newId);
      if (state) {
        const parentCountryMapped = mappings.some(m => m.country_id === state.country_id);
        if (parentCountryMapped) return { valid: false, message: 'The country for this state is already mapped. Adding the state is redundant.' };
        
        // Also check continent
        const parentCountry = countries.find(c => c.id === state.country_id);
        if (parentCountry) {
            const parentContinentMapped = mappings.some(m => m.continent_id === parentCountry.continent_id);
            if (parentContinentMapped) return { valid: false, message: 'The continent for this state is already mapped.' };
        }
      }
    }
    if (newType === 'city') {
      const city = cities.find(ci => ci.id === newId);
      if (city) {
        const parentStateMapped = city.state_id ? mappings.some(m => m.state_id === city.state_id) : false;
        if (parentStateMapped) return { valid: false, message: 'The state for this city is already mapped. Adding the city is redundant.' };
        const parentCountryMapped = mappings.some(m => m.country_id === city.country_id);
        if (parentCountryMapped) return { valid: false, message: 'The country for this city is already mapped. Adding the city is redundant.' };
        const parentCountry = countries.find(c => c.id === city.country_id);
        if (parentCountry) {
          const parentContinentMapped = mappings.some(m => m.continent_id === parentCountry.continent_id);
          if (parentContinentMapped) return { valid: false, message: 'The continent for this city is already mapped.' };
        }
      }
    }

    // 3. Check Child Redundancy (If I add a parent, are there children already there?)
    if (newType === 'continent') {
      // Check if any mapped countries belong to this continent
      const childCountry = mappings.find(m => m.country_id && countries.find(c => c.id === m.country_id)?.continent_id === newId);
      if (childCountry) {
        const cn = countries.find(c => c.id === childCountry.country_id);
        return { valid: false, message: `A country (${cn?.name || 'Unknown'}) in this continent is already mapped. Remove it first to add the whole continent.` };
      }
      
      // Check if any mapped states belong to a country in this continent
      const childState = mappings.find(m => {
          if (!m.state_id) return false;
          const s = states.find(st => st.id === m.state_id);
          if (!s) return false;
          const c = countries.find(cn => cn.id === s.country_id);
          return c?.continent_id === newId;
      });
      if (childState) {
        const st = states.find(s => s.id === childState.state_id);
        return { valid: false, message: `A state (${st?.name || 'Unknown'}) in this continent is already mapped. Remove it first.` };
      }
      const childCity = mappings.find(m => {
        if (!m.city_id) return false;
        const ci = cities.find(ct => ct.id === m.city_id);
        if (!ci) return false;
        const c = countries.find(cn => cn.id === ci.country_id);
        return c?.continent_id === newId;
      });
      if (childCity) {
        const ct = cities.find(c => c.id === childCity.city_id);
        return { valid: false, message: `A city (${ct?.name || 'Unknown'}) in this continent is already mapped. Remove it first.` };
      }
    }

    if (newType === 'country') {
      const childState = mappings.find(m => m.state_id && states.find(s => s.id === m.state_id)?.country_id === newId);
      if (childState) {
        const st = states.find(s => s.id === childState.state_id);
        return { valid: false, message: `A state (${st?.name || 'Unknown'}) in this country is already mapped. Remove it first to add the whole country.` };
      }
      const childCity = mappings.find(m => m.city_id && cities.find(c => c.id === m.city_id)?.country_id === newId);
      if (childCity) {
        const ct = cities.find(c => c.id === childCity.city_id);
        return { valid: false, message: `A city (${ct?.name || 'Unknown'}) in this country is already mapped. Remove it first.` };
      }
    }

    return { valid: true };
  };

  const handleAdd = async () => {
    try {
      if (unavailable) {
        return toast.error('Geography mapping is unavailable');
      }
      const payload: any = { territory_id: territoryId };
      let validation: { valid: boolean; message?: string } = { valid: true };

      if (type === 'continent') {
        if (!selectedContinent) return toast.error('Select a continent');
        validation = validateMapping('continent', selectedContinent);
        payload.continent_id = selectedContinent;
      } else if (type === 'country') {
        if (!selectedCountry) return toast.error('Select a country');
        validation = validateMapping('country', selectedCountry);
        payload.country_id = selectedCountry;
      } else if (type === 'state') {
        if (!selectedState) return toast.error('Select a state');
        validation = validateMapping('state', selectedState);
        payload.state_id = selectedState;
      } else if (type === 'city') {
        if (!selectedCity) return toast.error('Select a city');
        validation = validateMapping('city', selectedCity);
        payload.city_id = selectedCity;
      }

      if (!validation.valid) {
        toast.error('Validation Error', { description: validation.message });
        return;
      }

      const { error } = await scopedDb
        .from('territory_geographies')
        .insert(payload);

      if (error) {
        const status = (error as any)?.status ?? (error as any)?.code;
        const message = String((error as any)?.message || '').toLowerCase();
        if (status === 404 || message.includes('not found')) {
          setUnavailable(true);
          toast.error('Geography mapping is unavailable');
          return;
        }
        throw error;
      }
      
      toast.success('Geography added');
      // Reset selection
      if (type === 'state') setSelectedState('');
      else if (type === 'country') setSelectedCountry('');
      else if (type === 'continent') setSelectedContinent('');
      else if (type === 'city') setSelectedCity('');
      
      fetchMappings();
    } catch (error: any) {
      console.error('Error adding geography:', error);
      toast.error(error.message || 'Failed to add geography');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (unavailable) {
        return toast.error('Geography mapping is unavailable');
      }
      const { error } = await scopedDb
        .from('territory_geographies')
        .delete()
        .eq('id', id);

      if (error) {
        const status = (error as any)?.status ?? (error as any)?.code;
        const message = String((error as any)?.message || '').toLowerCase();
        if (status === 404 || message.includes('not found')) {
          setUnavailable(true);
          toast.error('Geography mapping is unavailable');
          return;
        }
        throw error;
      }
      toast.success('Geography removed');
      fetchMappings();
    } catch (error) {
      console.error('Error removing geography:', error);
      toast.error('Failed to remove geography');
    }
  };

  // Filtered lists based on selection
  const filteredCountries = selectedContinent 
    ? countries.filter(c => c.continent_id === selectedContinent)
    : countries;

  const filteredStates = selectedCountry
    ? states.filter(s => s.country_id === selectedCountry)
    : states;
  
  const filteredCities = selectedState
    ? cities.filter(ci => ci.state_id === selectedState)
    : selectedCountry
      ? cities.filter(ci => ci.country_id === selectedCountry)
      : cities;

  const getMappingLabel = (m: any) => {
    if (m.continent_id) {
      const cont = continents.find((c) => c.id === m.continent_id);
      return { type: 'Continent', name: cont?.name || 'Unknown', icon: Globe };
    }
    if (m.country_id) {
      const cn = countries.find((c) => c.id === m.country_id);
      return { type: 'Country', name: cn?.name || 'Unknown', icon: Map };
    }
    if (m.state_id) {
      const st = states.find((s) => s.id === m.state_id);
      return { type: 'State', name: st?.name || 'Unknown', icon: Map };
    }
    if (m.city_id) {
      const ct = cities.find((c) => c.id === m.city_id);
      return { type: 'City', name: ct?.name || 'Unknown', icon: Map };
    }
    return { type: 'Unknown', name: 'Unknown', icon: AlertTriangle };
  };

  return (
    <div className="space-y-6">
      {unavailable && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Geography mapping is unavailable</AlertTitle>
          <AlertDescription>
            Apply the latest database migration to enable territory-geography definitions.
          </AlertDescription>
        </Alert>
      )}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="continent">Continent</SelectItem>
                <SelectItem value="country">Country</SelectItem>
                <SelectItem value="state">State</SelectItem>
                <SelectItem value="city">City</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Entity</Label>
            {type === 'continent' && (
              <Select value={selectedContinent} onValueChange={setSelectedContinent}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Continent" />
                </SelectTrigger>
                <SelectContent>
                  {continents.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {type === 'country' && (
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Country" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCountries.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {type === 'state' && (
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger>
                  <SelectValue placeholder="Select State" />
                </SelectTrigger>
                <SelectContent>
                  {filteredStates.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {type === 'city' && (
              <div className="space-y-2">
                <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Country (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={selectedState} onValueChange={setSelectedState}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select State (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredStates.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={selectedCity} onValueChange={setSelectedCity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select City" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCities.map(ci => <SelectItem key={ci.id} value={ci.id}>{ci.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
        
        <Button onClick={handleAdd} className="w-full" disabled={unavailable}>
          <Plus className="mr-2 h-4 w-4" /> Add Geography
        </Button>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Defined Geographies</h4>
        <ScrollArea className="h-[200px] border rounded-md p-2">
          {mappings.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No geographies defined. This territory has no geographical boundaries.
            </div>
          ) : (
            <div className="space-y-2">
              {mappings.map((m) => {
                const { type: labelType, name, icon: Icon } = getMappingLabel(m);
                return (
                  <Card key={m.id} className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{name}</p>
                        <p className="text-xs text-muted-foreground">{labelType}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)} disabled={unavailable}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Note</AlertTitle>
        <AlertDescription>
          Adding a broader region (e.g., Country) automatically includes all sub-regions (e.g., States).
          Be careful not to create conflicting or redundant definitions.
        </AlertDescription>
      </Alert>
    </div>
  );
}
