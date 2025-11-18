import { useEffect, useState, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { BasisConfigModal } from '@/components/sales/composer/BasisConfigModal';
 
import { supabase } from '@/integrations/supabase/client';
import { useCRM } from '@/hooks/useCRM';
import { useToast } from '@/hooks/use-toast';
import { listCarrierRatesForQuote } from '@/integrations/supabase/carrierRatesActions';

export default function QuoteComposer({ quoteId, versionId, autoScroll }: { quoteId: string; versionId: string; autoScroll?: boolean }) {
  // Local helper to ensure unique items by id when rendering selects
  const uniqueById = (arr: any[]) => {
    try {
      const map: Record<string, any> = {};
      for (const item of arr || []) {
        const id = (item as any)?.id;
        if (id != null) map[String(id)] = item;
      }
      return Object.values(map);
    } catch {
      return arr || [];
    }
  };
  // Dedupe carriers by normalized name; prefer tenant-scoped rows when available
  const uniqueByCarrierName = (arr: any[], preferredTenantId?: string | null) => {
    try {
      const map: Record<string, any> = {};
      for (const item of arr || []) {
        const key = String((item as any)?.carrier_name || '').trim().toLowerCase();
        if (!key) continue;
        const existing = map[key];
        if (!existing) {
          map[key] = item;
        } else {
          const existingTenant = (existing as any)?.tenant_id ?? null;
          const currentTenant = (item as any)?.tenant_id ?? null;
          if (preferredTenantId && existingTenant !== preferredTenantId && currentTenant === preferredTenantId) {
            map[key] = item;
          }
        }
      }
      return Object.values(map);
    } catch {
      return arr || [];
    }
  };
  const { toast } = useToast();
  const { context } = useCRM();
  const composerRef = useRef<HTMLDivElement | null>(null);
  const [optionId, setOptionId] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [serviceTypeId, setServiceTypeId] = useState<string | null>(null); // leg-level
  const [serviceId, setServiceId] = useState<string | null>(null); // leg-level
  const [containerTypeId, setContainerTypeId] = useState<string | null>(null); // leg-level
  const [containerSizeId, setContainerSizeId] = useState<string | null>(null); // leg-level
  const [currencyId, setCurrencyId] = useState<string | null>(null); // quote currency
  const [validUntil, setValidUntil] = useState<string>('');
  const [validFrom, setValidFrom] = useState<string>('');
  const [importExport, setImportExport] = useState<string>('');
  const [originLocation, setOriginLocation] = useState<string>('');
  const [destinationLocation, setDestinationLocation] = useState<string>('');
  const [autoMarginEnabled, setAutoMarginEnabled] = useState<boolean>(false);
  const [marginMethod, setMarginMethod] = useState<'fixed'|'percent'|'none'>('none');
  const [marginValue, setMarginValue] = useState<number>(0);
  const [minMargin, setMinMargin] = useState<number>(0);
  const [roundingRule, setRoundingRule] = useState<string>('');

  const [charges, setCharges] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [filteredCarriers, setFilteredCarriers] = useState<any[]>([]);
  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [containerTypes, setContainerTypes] = useState<any[]>([]);
  const [containerSizes, setContainerSizes] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [chargeCategories, setChargeCategories] = useState<any[]>([]);
  const [chargeBases, setChargeBases] = useState<any[]>([]);
  const [sides, setSides] = useState<any[]>([]);
  const isHydratingRef = useRef<boolean>(false);
  const [tradeDirections, setTradeDirections] = useState<any[]>([]);
  const [ports, setPorts] = useState<any[]>([]);
  const [portFilterTypes, setPortFilterTypes] = useState<string[]>([]);
  // Legs management
  const [legs, setLegs] = useState<any[]>([]);
  const [currentLegId, setCurrentLegId] = useState<string | null>(null);
  const [legNames, setLegNames] = useState<Record<string, string>>({});
  const [legLabels, setLegLabels] = useState<Record<string, string>>({});
  const [legServiceTypeIds, setLegServiceTypeIds] = useState<Record<string, string | null>>({});
  const [chargesByLeg, setChargesByLeg] = useState<Record<string, any[]>>({});
  const [combinedCharges, setCombinedCharges] = useState<any[]>([]);
  const [basisDialog, setBasisDialog] = useState<any | null>(null);
  const [editingLegId, setEditingLegId] = useState<string | null>(null);
  const [legDialog, setLegDialog] = useState<any | null>(null);
  const [basisConfigOpen, setBasisConfigOpen] = useState<boolean>(false);
  const [basisConfig, setBasisConfig] = useState<{ tradeDirection: string; containerType: string; containerSize: string; quantity: number }>({ tradeDirection: '', containerType: '', containerSize: '', quantity: 1 });
  const [basisConfigTarget, setBasisConfigTarget] = useState<{ type: 'combined' | 'leg'; row?: any; rowIdx?: number } | null>(null);
  const [quoteNumber, setQuoteNumber] = useState<string | null>(null);
  const creatingLegRef = useRef<boolean>(false);

  const formatPortLabel = (p: any) => {
    const name = String(p?.location_name || '').trim();
    const code = String(p?.location_code || '').trim();
    return code ? `${name} (${code})` : name;
  };

  // Resolve tenant_id from context or parent quote/version
  const getTenantId = async (): Promise<string | null> => {
    try {
      if (context?.tenantId) return context.tenantId;
      // Try version -> tenant
      if (versionId) {
        const { data: v } = await (supabase as any)
          .from('quotation_versions')
          .select('tenant_id, quote_id')
          .eq('id', versionId)
          .maybeSingle();
        const vt = v?.tenant_id ?? null;
        if (vt) return vt;
        const vq = v?.quote_id ?? null;
        if (vq) {
          const { data: q } = await (supabase as any)
            .from('quotes')
            .select('tenant_id')
            .eq('id', vq)
            .maybeSingle();
          if (q?.tenant_id) return q.tenant_id;
        }
      }
      // Fallback from quoteId directly
      if (quoteId) {
        const { data: q2 } = await (supabase as any)
          .from('quotes')
          .select('tenant_id')
          .eq('id', quoteId)
          .maybeSingle();
        if (q2?.tenant_id) return q2.tenant_id;
      }
      return null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    (async () => {
      // Ensure an initial leg exists to bind origin/destination
      await ensureOptionAndLeg();
      // Load quote number for header subtitle
      try {
        if (quoteId) {
          const { data: q } = await (supabase as any)
            .from('quotes')
            .select('quote_number')
            .eq('id', quoteId)
            .maybeSingle();
          setQuoteNumber(q?.quote_number ?? null);
        }
      } catch {}
      const { data: c } = await supabase.from('carriers').select('id, carrier_name').order('carrier_name');
      setCarriers(c ?? []);
      const { data: st } = await supabase.from('service_types').select('id, name').order('name');
      setServiceTypes(st ?? []);
      // Services will be populated based on selected service type via mapping table
      setServices([]);
      // Fetch container types/sizes for current tenant, including global (tenant_id NULL)
      const tenantId = await getTenantId();
      const { data: ct } = await (supabase as any)
        .from('container_types')
        .select('id, name, tenant_id')
        .or(tenantId ? `tenant_id.eq.${tenantId},tenant_id.is.null` : 'tenant_id.is.null')
        .order('name');
      setContainerTypes(ct ?? []);
      const { data: cs } = await (supabase as any)
        .from('container_sizes')
        .select('id, name, tenant_id')
        .or(tenantId ? `tenant_id.eq.${tenantId},tenant_id.is.null` : 'tenant_id.is.null')
        .order('name');
      setContainerSizes(cs ?? []);
      const { data: cur } = await supabase.from('currencies').select('id, code').order('code');
      setCurrencies(cur ?? []);
      if (!currencyId) setCurrencyId((cur ?? [])[0]?.id ?? null);
      const { data: cc } = await (supabase as any).from('charge_categories').select('id, name').order('name');
      setChargeCategories(cc ?? []);
      const { data: bb } = await (supabase as any).from('charge_bases').select('id, name').order('name');
      setChargeBases(bb ?? []);
      const { data: ss } = await (supabase as any).from('charge_sides').select('id, code');
      setSides(ss ?? []);
      const { data: td } = await (supabase as any).from('trade_directions').select('id, name, code');
      setTradeDirections(td ?? []);
      // Fetch ports/locations for current tenant (and global if available)
      try {
        const { data: pr } = await (supabase as any)
          .from('ports_locations')
          .select('id, location_name, location_code, location_type, tenant_id, is_active')
          .eq('is_active', true)
          .or(tenantId ? `tenant_id.eq.${tenantId},tenant_id.is.null` : 'tenant_id.is.null')
          .order('location_name');
        setPorts(pr ?? []);
      } catch (e) {
        console.warn('[QuoteComposer] Failed to load ports/locations', e);
        setPorts([]);
      }
      // Defaults for dates
      try {
        const today = new Date();
        const plus30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
        const fmt = (d: Date) => d.toISOString().slice(0, 10);
        setValidFrom(prev => prev || fmt(today));
        setValidUntil(prev => prev || fmt(plus30));
      } catch {}
    })();
  }, []);

  // Populate Services based on selected Service Type via mapping table (TEXT-based service_type)
  useEffect(() => {
    (async () => {
      if (!serviceTypeId) {
        setServices([]);
        return;
      }
      
      // Get the service_type code from service_types table
      const { data: serviceTypeData } = await supabase
        .from('service_types')
        .select('code')
        .eq('id', serviceTypeId)
        .maybeSingle();
      
      if (!serviceTypeData?.code) {
        console.warn('[QuoteComposer] No service type code found for id', serviceTypeId);
        toast({
          title: 'Service type unavailable',
          description: 'Could not resolve service type code. Try reselecting the service type.',
        });
        setServices([]);
        return;
      }
      
      // Extract base code (e.g., "ocean_freight" -> "ocean")
      const baseCode = serviceTypeData.code.split('_')[0].toLowerCase();
      // Restrict visible ports by service type
      switch (baseCode) {
        case 'ocean':
          setPortFilterTypes(['seaport']);
          break;
        case 'air':
          setPortFilterTypes(['airport']);
          break;
        case 'trucking':
          setPortFilterTypes(['inland_port', 'warehouse', 'terminal']);
          break;
        case 'courier':
          setPortFilterTypes(['terminal', 'warehouse']);
          break;
        default:
          setPortFilterTypes([]); // no restriction
      }
      
      // Fetch mappings using FK service_type_id when available; fallback to text baseCode
      let mappingsQuery = (supabase as any)
        .from('service_type_mappings')
        .select('service_id')
        .eq('is_active', true)
        .order('priority');
      // Prefer FK column; if not present, fallback to text key
      try {
        const { data: fkMappings } = await mappingsQuery.eq('service_type_id', serviceTypeId);
        if (fkMappings && fkMappings.length > 0) {
          var mappings = fkMappings;
          console.debug('[QuoteComposer] Mapping lookup by FK', { serviceTypeId, count: (mappings ?? []).length });
        } else {
          const { data: txtMappings } = await (supabase as any)
            .from('service_type_mappings')
            .select('service_id')
            .eq('service_type', baseCode)
            .eq('is_active', true)
            .order('priority');
          var mappings = txtMappings ?? [];
          console.debug('[QuoteComposer] Mapping lookup by text', { baseCode, count: (mappings ?? []).length });
        }
      } catch (e) {
        const { data: txtMappings } = await (supabase as any)
          .from('service_type_mappings')
          .select('service_id')
          .eq('service_type', baseCode)
          .eq('is_active', true)
          .order('priority');
        var mappings = txtMappings ?? [];
        console.debug('[QuoteComposer] Mapping lookup by text (catch)', { baseCode, count: (mappings ?? []).length });
      }
      
      const serviceIds = (mappings ?? []).map((m: any) => m.service_id).filter(Boolean);
      if (!serviceIds.length) {
        console.warn('[QuoteComposer] No service mappings found for service_type_id', serviceTypeId);
        toast({
          title: 'No mapped services',
          description: `No active services found for selected service type. Check Service Type Mappings module.`,
        });
        setServices([]);
        return;
      }
      const { data: sv } = await supabase
        .from('services')
        .select('id, service_name')
        .in('id', serviceIds)
        .order('service_name');
      const combined = (sv ?? []).map((s: any) => ({ id: s.id, name: s.service_name }));
      setServices(combined);
      // Reset provider selection when service type changes
      setServiceId(null);
      setProviderId(null);
    })();
  }, [serviceTypeId]);

  // Filter carriers (service providers) by selected service type via mappings → services.mode
  useEffect(() => {
    (async () => {
      try {
        setFilteredCarriers([]);
        if (!serviceTypeId) return;
        
        // Get tenantId
        const { data: userData } = await supabase.auth.getUser();
        const tenantId = (userData?.user as any)?.user_metadata?.tenant_id ?? null;
        
        // 1) Find mapped services for this service type (prefer FK service_type_id)
        let mappedServiceIds: string[] = [];
        try {
          const { data: m1 } = await (supabase as any)
            .from('service_type_mappings')
            .select('service_id')
            .eq('service_type_id', serviceTypeId)
            .eq('is_active', true)
            .order('priority');
          mappedServiceIds = (m1 ?? []).map((m: any) => String(m.service_id)).filter(Boolean);
        } catch {}

        // Fallback to text-based mapping if FK isn’t available
        if (!mappedServiceIds.length) {
          const { data: stData } = await supabase
            .from('service_types')
            .select('code, name')
            .eq('id', serviceTypeId)
            .maybeSingle();
          const rawKey = stData?.code ?? stData?.name;
          if (!rawKey) {
            setFilteredCarriers([]);
            return;
          }
          const norm = String(rawKey).toLowerCase().replace(/\s+/g, '_');
          const baseCode = norm.split('_')[0];
          const { data: m2 } = await (supabase as any)
            .from('service_type_mappings')
            .select('service_id')
            .eq('service_type', baseCode)
            .eq('is_active', true)
            .order('priority');
          mappedServiceIds = (m2 ?? []).map((m: any) => String(m.service_id)).filter(Boolean);
        }

        if (!mappedServiceIds.length) {
          setFilteredCarriers([]);
          return;
        }

        // 2) Load services to detect their transport mode (service_type only, no 'mode' column)
        const { data: svcs } = await (supabase as any)
          .from('services')
          .select('id, service_type, is_active')
          .in('id', mappedServiceIds);
        const activeSvcs = (svcs ?? []).filter((s: any) => s.is_active !== false);

        // Normalize to carrier_service_types.service_type values
        const toCstType = (st?: string) => {
          const raw = (st || '').toLowerCase();
          // Normalize common service names to carrier_service_types.service_type values
          switch (raw) {
            case 'ocean':
            case 'ocean_freight':
              return 'ocean';
            case 'air':
            case 'air_freight':
              return 'air';
            case 'inland_trucking':
            case 'trucking':
            case 'road':
              return 'trucking';
            case 'courier':
              return 'courier';
            case 'railway_transport':
            case 'rail':
              return 'railway_transport';
            case 'movers_packers':
            case 'moving':
              return 'moving';
            default:
              // Fallback to base segment if given compound like "ocean_lcl"
              return raw.split('_')[0] || 'ocean';
          }
        };
        const cstTypes = Array.from(new Set(activeSvcs.map((s: any) => toCstType(s.service_type)).filter(Boolean)));
        if (!cstTypes.length) {
          setFilteredCarriers([]);
          return;
        }

        // 3) Query carrier_service_types for those types and dedupe carriers (tenant+global)
        const { data: rows } = await (supabase as any)
          .from('carrier_service_types')
          .select('carrier_id, service_type, is_active, carriers:carrier_id(id, carrier_name, tenant_id, is_active)')
          .or(tenantId ? `tenant_id.eq.${tenantId},tenant_id.is.null` : 'tenant_id.is.null')
          .eq('is_active', true)
          .in('service_type', cstTypes);

        const mappedRaw = (rows || [])
          .map((row: any) => row.carriers)
          .filter((c: any) => !!c && c.is_active !== false);
        const byId: Record<string, any> = {};
        for (const c of mappedRaw) byId[String(c.id)] = c;
        let result = Object.values(byId);

        // Fallback: if no mappings found, look up carriers by mode/carrier_type
        if (result.length === 0) {
          const { data: allCarriers } = await (supabase as any)
            .from('carriers')
            .select('id, carrier_name, is_active, carrier_type, mode, tenant_id')
            .order('carrier_name');
          const normalizeCarrierType = (mode?: string, type?: string) => {
            const m = String(mode || '').toLowerCase();
            const t = String(type || '').toLowerCase();
            const key = m || t;
            switch (key) {
              case 'ocean':
                return 'ocean';
              case 'air':
              case 'air_cargo':
                return 'air';
              case 'inland_trucking':
              case 'trucking':
              case 'road':
                return 'trucking';
              case 'courier':
                return 'courier';
              case 'movers_packers':
              case 'movers_and_packers':
              case 'moving':
                return 'moving';
              case 'railway_transport':
              case 'rail':
                return 'railway_transport';
              default:
                return key.split('_')[0];
            }
          };
          const fallbacks = (allCarriers || [])
            .filter((c: any) => c && c.is_active !== false)
            .filter((c: any) => cstTypes.includes(normalizeCarrierType(c.mode, c.carrier_type)));
          const fbById: Record<string, any> = {};
          for (const c of fallbacks) fbById[String(c.id)] = c;
          result = Object.values(fbById);
        }

        // Dedupe by name to avoid global + tenant duplicates; prefer tenant entry
        const deduped = uniqueByCarrierName(result, tenantId);
        // Sort for stable UI order
        deduped.sort((a: any, b: any) => String(a.carrier_name || '').localeCompare(String(b.carrier_name || '')));
        setFilteredCarriers(deduped);
      } catch (e) {
        console.warn('[QuoteComposer] Failed to filter carriers by service type', e);
        setFilteredCarriers([]);
      }
    })();
  }, [serviceTypeId]);

  // Removed tenant overlay for service mappings; Service Type Mappings module drives scoping.

  useEffect(() => {
    if (autoScroll !== false) {
      composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [autoScroll]);

  useEffect(() => {
    (async () => {
      const tenantId = await getTenantId();
      if (!tenantId) {
        toast({ title: 'Failed to create option', description: 'Missing tenant scope. Open this screen from a tenant-scoped quote or select a tenant.' });
        return;
      }
      // Try inserting option without carrier_rate_id; fallback if schema requires it
      let createdOptionId: string | null = null;
      try {
        let defaultCurrencyId = currencyId;
        if (!defaultCurrencyId) {
          try {
            const { data: cur1 } = await supabase.from('currencies').select('id').order('code').limit(1);
            defaultCurrencyId = (cur1 ?? [])[0]?.id ?? null;
            if (defaultCurrencyId) setCurrencyId(defaultCurrencyId);
          } catch {}
        }
        const { data, error } = await (supabase as any)
          .from('quotation_version_options')
          .insert({
            tenant_id: tenantId,
            quotation_version_id: versionId,
            quote_currency_id: defaultCurrencyId,
          })
          .select('id')
          .single();
        if (!error && data?.id) {
          createdOptionId = data.id;
          setOptionId(data.id);
        } else if (error) {
          const msg = String(error.message || error);
          if (msg.includes('carrier_rate_id') && msg.includes('not-null')) {
            const rates = await listCarrierRatesForQuote(quoteId, supabase as any);
            const rid = rates?.[0]?.id || null;
            if (rid) {
              const { data: dataWithRate, error: rateInsertErr } = await (supabase as any)
                .from('quotation_version_options')
                .insert({
                  tenant_id: tenantId,
                  quotation_version_id: versionId,
                  carrier_rate_id: rid,
                  quote_currency_id: defaultCurrencyId,
                })
                .select('id')
                .single();
              if (!rateInsertErr && dataWithRate?.id) {
                createdOptionId = dataWithRate.id;
                setOptionId(dataWithRate.id);
              } else {
                toast({ title: 'Failed to create option', description: String(rateInsertErr?.message || rateInsertErr || 'Unknown error while inserting with carrier_rate_id') });
                return;
              }
            } else {
              toast({ title: 'Failed to create option', description: 'Schema requires carrier_rate_id, but no carrier rates exist for this quote. Hydrate rates or apply the migration to allow NULL.' });
              return;
            }
          } else {
            toast({ title: 'Failed to create option', description: msg });
            return;
          }
        }
      } catch (e: any) {
        toast({ title: 'Failed to create option', description: String(e?.message || e) });
        return;
      }
      // Initialize first leg
      if (createdOptionId) {
        const { data: leg } = await (supabase as any)
          .from('quotation_version_option_legs')
          .insert({ tenant_id: tenantId, quotation_version_option_id: createdOptionId, leg_order: 1 })
          .select('id')
          .single();
        if (leg?.id) {
          setLegs([{ id: leg.id, leg_order: 1 }]);
          setCurrentLegId(leg.id);
          setChargesByLeg({ [leg.id]: [] });
        }
      }
    })();
  }, [versionId]);

  // Helper to patch option when user changes fields
  const patchOption = async (patch: Record<string, any>) => {
    if (!optionId) return;
    await (supabase as any)
      .from('quotation_version_options')
      .update(patch)
      .eq('id', optionId);
  };

  const optionPatchTimerRef = useRef<any>(null);
  useEffect(() => {
    if (!optionId) return;
    if (optionPatchTimerRef.current) clearTimeout(optionPatchTimerRef.current);
    const patch: any = {
      quote_currency_id: currencyId,
      auto_margin_enabled: autoMarginEnabled,
      margin_value: marginValue,
    };
    if (validUntil) patch.valid_until = validUntil;
    if (roundingRule) patch.rounding_rule = roundingRule;
    if (minMargin) patch.min_margin = minMargin;
    optionPatchTimerRef.current = setTimeout(async () => {
      await patchOption(patch);
    }, 400);
    return () => { if (optionPatchTimerRef.current) clearTimeout(optionPatchTimerRef.current); };
  }, [optionId, currencyId, autoMarginEnabled, marginValue, validUntil, roundingRule, minMargin]);

  useEffect(() => {
    (async () => {
      if (sides.length) return;
      const { data } = await supabase.from('charge_sides').select('id, code');
      setSides(data ?? []);
    })();
  }, [sides.length]);

  

  useEffect(() => {
    (async () => {
      if (!quoteId || !validUntil) return;
      await (supabase as any)
        .from('quotes')
        .update({ valid_until: validUntil })
        .eq('id', quoteId);
    })();
  }, [quoteId, validUntil]);

  useEffect(() => {
    setMarginMethod(autoMarginEnabled ? 'percent' : 'none');
  }, [autoMarginEnabled]);

  // Persist current leg details on change
  useEffect(() => {
    (async () => {
      if (!currentLegId) return;
      // Map import/export to leg trade_direction
      let tradeDirectionId: string | null = null;
      if (importExport) {
        const tenantId = await getTenantId();
        const { data: dir } = await (supabase as any)
          .from('trade_directions')
          .select('id, code, tenant_id')
          .eq('code', importExport)
          .or(tenantId ? `tenant_id.eq.${tenantId},tenant_id.is.null` : 'tenant_id.is.null')
          .limit(1);
        tradeDirectionId = Array.isArray(dir) && dir.length ? dir[0].id : null;
      }
      await (supabase as any)
        .from('quotation_version_option_legs')
        .update({
          service_id: serviceId,
          provider_id: providerId,
          origin_location: originLocation,
          destination_location: destinationLocation,
          service_type_id: serviceTypeId,
          container_type_id: containerTypeId,
          container_size_id: containerSizeId,
          trade_direction_id: tradeDirectionId,
          leg_name: legNames[currentLegId!] ?? null,
        })
        .eq('id', currentLegId);
    })();
  }, [serviceTypeId, serviceId, providerId, importExport, containerTypeId, containerSizeId, originLocation, destinationLocation, legNames]);

  // Populate leg fields when selecting a leg
  useEffect(() => {
    (async () => {
      if (!currentLegId) return;
      const { data: legRow } = await (supabase as any)
        .from('quotation_version_option_legs')
        .select('service_id, provider_id, origin_location, destination_location, service_type_id, container_type_id, container_size_id, trade_direction_id, leg_name')
        .eq('id', currentLegId)
        .maybeSingle();
      if (!legRow) return;
      setServiceTypeId(legRow.service_type_id ?? null);
      setLegServiceTypeIds(prev => ({ ...prev, [currentLegId]: legRow.service_type_id ?? null }));
      setServiceId(legRow.service_id ?? null);
      setProviderId(legRow.provider_id ?? null);
      setOriginLocation(legRow.origin_location ?? '');
      setDestinationLocation(legRow.destination_location ?? '');
      setContainerTypeId(legRow.container_type_id ?? null);
      setContainerSizeId(legRow.container_size_id ?? null);
      if (legRow.trade_direction_id) {
        const dir = (tradeDirections ?? []).find((d: any) => String(d.id) === String(legRow.trade_direction_id));
        setImportExport(dir?.code ?? '');
      }
      if (typeof legRow.leg_name === 'string' && legRow.leg_name.trim().length) {
        setLegNames(prev => ({ ...prev, [currentLegId]: legRow.leg_name }));
      }
      if (legRow.service_type_id) {
        const stName = (serviceTypes ?? []).find((st: any) => String(st.id) === String(legRow.service_type_id))?.name;
        if (stName) setLegLabels(prev => ({ ...prev, [currentLegId]: stName }));
      }
    })();
  }, [currentLegId]);

  // Populate leg dropdown labels from service type for all legs
  useEffect(() => {
    (async () => {
      if (!legs.length) return;
      const { data: legRows } = await (supabase as any)
        .from('quotation_version_option_legs')
        .select('id, service_type_id')
        .in('id', legs.map((l) => l.id));

      const stIds = Array.from(new Set((legRows ?? []).map((r: any) => r.service_type_id).filter(Boolean).map((x: any) => String(x))));
      let stMap: Record<string, string> = {};
      if (stIds.length) {
        const { data: stRows } = await supabase
          .from('service_types')
          .select('id, name')
          .in('id', stIds as string[]);
        stMap = (stRows ?? []).reduce((acc: Record<string, string>, r: any) => {
          acc[String(r.id)] = String(r.name || '');
          return acc;
        }, {});
      }

      const map: Record<string, string> = {};
      (legRows ?? []).forEach((row: any) => {
        const name = stMap[String(row.service_type_id)] || '';
        if (name) map[row.id] = name;
      });
      if (Object.keys(map).length) setLegLabels(prev => ({ ...prev, ...map }));
      const idMap: Record<string, string | null> = {};
      (legRows ?? []).forEach((row: any) => { idMap[row.id] = row.service_type_id ?? null; });
      if (Object.keys(idMap).length) setLegServiceTypeIds(prev => ({ ...prev, ...idMap }));
    })();
  }, [legs, serviceTypes]);

  // Keep label updated when current leg's service type changes
  useEffect(() => {
    if (!currentLegId) return;
    setLegServiceTypeIds(prev => ({ ...prev, [currentLegId]: serviceTypeId ?? null }));
    const stName = (serviceTypes ?? []).find((st: any) => String(st.id) === String(serviceTypeId))?.name;
    if (stName) {
      setLegLabels(prev => ({ ...prev, [currentLegId]: stName }));
      setLegNames(prev => ({ ...prev, [currentLegId]: stName }));
    }
  }, [serviceTypeId, currentLegId, serviceTypes]);

  const saveCharges = async () => {
    if (!optionId || !currentLegId) {
      const ensuredLegId = await ensureOptionAndLeg();
      if (!optionId || !ensuredLegId) return;
      setCurrentLegId(ensuredLegId);
    }
    const tenantId = await getTenantId();
    if (!tenantId) {
      toast({ title: 'Failed to save charges', description: 'Missing tenant scope. Please ensure a tenant is selected.' });
      return;
    }
    const legCharges = chargesByLeg[currentLegId!] ?? [];
    const quoteLegId = await getOrCreateQuoteLegId(currentLegId!);
    let buySideId: string | null = null;
    let sellSideId: string | null = null;
    try {
      const { data: sidesData } = await supabase.from('charge_sides').select('id, code');
      buySideId = (sidesData ?? []).find((s: any) => s.code === 'buy')?.id ?? null;
      sellSideId = (sidesData ?? []).find((s: any) => s.code === 'sell')?.id ?? null;
    } catch {}
    if (optionId) {
      if (quoteLegId) {
        await (supabase as any)
          .from('quote_charges')
          .delete()
          .eq('quote_option_id', optionId)
          .eq('leg_id', quoteLegId);
      }
      if (currentLegId) {
        await (supabase as any)
          .from('quote_charges')
          .delete()
          .eq('quote_option_id', optionId)
          .eq('leg_id', currentLegId);
      }
    }
    const payload = legCharges.map((c: any) => ({
      tenant_id: tenantId,
      quote_option_id: optionId,
      leg_id: quoteLegId,
      charge_side_id: c.charge_side_id ?? (c.side === 'buy' ? buySideId : sellSideId),
      category_id: c.category_id,
      basis_id: c.basis_id,
      quantity: c.quantity ?? 1,
      unit: c.unit ?? null,
      rate: c.rate ?? 0,
      amount: c.amount ?? (c.rate ?? 0) * (c.quantity ?? 1),
      currency_id: c.currency_id ?? currencyId,
      note: c.note ?? null,
      sort_order: c.sort_order ?? 1000,
    }));
    const { error } = await (supabase as any).from('quote_charges').insert(payload);
    if (error) {
      const msg = String(error?.message || error || '');
      if (msg.includes('fk_quote_charges_leg') || msg.includes('quote_charges_leg_id_fkey')) {
        // Retry with leg_id equal to composer leg id to satisfy FK to quotation_version_option_legs
        const retry = payload.map((p: any) => ({ ...p, leg_id: currentLegId }));
        const { error: errRetry } = await (supabase as any).from('quote_charges').insert(retry);
        if (errRetry) {
          // Final fallback: allow saving without leg linkage
          const fallback = payload.map((p: any) => ({ ...p, leg_id: null }));
          const { error: err2 } = await (supabase as any).from('quote_charges').insert(fallback);
          if (err2) {
            toast({ title: 'Failed to save charges', description: String(err2?.message || err2) });
            return;
          }
        }
      } else {
        toast({ title: 'Failed to save charges', description: msg });
        return;
      }
    }

    const all = Object.values(chargesByLeg).flat();
    const buy = all.filter((x: any) => x.side === 'buy').reduce((s: number, c: any) => s + (c.amount ?? (c.rate ?? 0) * (c.quantity ?? 1)), 0);
    let sell = all.filter((x: any) => x.side === 'sell').reduce((s: number, c: any) => s + (c.amount ?? (c.rate ?? 0) * (c.quantity ?? 1)), 0);
    if (autoMarginEnabled) {
      if (marginMethod === 'percent') {
        sell = buy * (1 + (marginValue / 100));
      } else if (marginMethod === 'fixed') {
        sell = buy + marginValue;
      }
      const marginAmt = sell - buy;
      if (minMargin && marginAmt < minMargin) {
        sell = buy + minMargin;
      }
      if (roundingRule?.startsWith('nearest_')) {
        const step = Number(roundingRule.replace('nearest_', '')) || 1;
        sell = Math.round(sell / step) * step;
      }
    }
    await (supabase as any).from('quotation_version_options').update({
      buy_subtotal: buy,
      sell_subtotal: sell,
      margin_amount: sell - buy,
      total_amount: sell,
      auto_margin_enabled: autoMarginEnabled,
      margin_value: marginValue,
      rounding_rule: roundingRule,
      min_margin: minMargin,
    }).eq('id', optionId);
    await loadChargesForOption();
  };

  const saveChargesForLeg = async (legId: string) => {
    if (!optionId || !legId) {
      const ensuredLegId = await ensureOptionAndLeg();
      if (!optionId || !ensuredLegId) return;
      legId = ensuredLegId;
      setCurrentLegId(ensuredLegId);
    }
    const tenantId = await getTenantId();
    if (!tenantId) return;
    const legCharges = chargesByLeg[legId] ?? [];
    const quoteLegId = await getOrCreateQuoteLegId(legId);
    let buySideId: string | null = null;
    let sellSideId: string | null = null;
    try {
      const { data: sidesData } = await supabase.from('charge_sides').select('id, code');
      buySideId = (sidesData ?? []).find((s: any) => s.code === 'buy')?.id ?? null;
      sellSideId = (sidesData ?? []).find((s: any) => s.code === 'sell')?.id ?? null;
    } catch {}
    if (optionId) {
      if (quoteLegId) {
        await (supabase as any)
          .from('quote_charges')
          .delete()
          .eq('quote_option_id', optionId)
          .eq('leg_id', quoteLegId);
      }
      await (supabase as any)
        .from('quote_charges')
        .delete()
        .eq('quote_option_id', optionId)
        .eq('leg_id', legId);
    }
    const payload = legCharges.map((c: any) => ({
      tenant_id: tenantId,
      quote_option_id: optionId,
      leg_id: quoteLegId,
      charge_side_id: c.charge_side_id ?? (c.side === 'buy' ? buySideId : sellSideId),
      category_id: c.category_id,
      basis_id: c.basis_id,
      quantity: c.quantity ?? 1,
      unit: c.unit ?? null,
      rate: c.rate ?? 0,
      amount: c.amount ?? (c.rate ?? 0) * (c.quantity ?? 1),
      currency_id: c.currency_id ?? currencyId,
      note: c.note ?? null,
      sort_order: c.sort_order ?? 1000,
    }));
    await (supabase as any).from('quote_charges').insert(payload);
  };

  const autoSaveTimerRef = useRef<any>(null);
  const isAutoSavingRef = useRef<boolean>(false);
  useEffect(() => {
    if (!currentLegId) return;
    const rows = chargesByLeg[currentLegId] ?? [];
    if (!rows.length) return;
    if (isHydratingRef.current) return;
    if (isAutoSavingRef.current) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      isAutoSavingRef.current = true;
      try {
        await saveChargesForLeg(currentLegId!);
      } finally {
        isAutoSavingRef.current = false;
      }
    }, 800);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [currentLegId, chargesByLeg[currentLegId!]]);

  const saveCombinedChargesAuto = async () => {
    const tenantId = await getTenantId();
    if (!tenantId || !optionId) return;
    const buySide = (sides ?? []).find((s: any) => s.code === 'buy');
    const sellSide = (sides ?? []).find((s: any) => s.code === 'sell');
    const payload = combinedCharges.flatMap((c: any) => [
      {
        tenant_id: tenantId,
        quote_option_id: optionId,
        leg_id: null,
        charge_side_id: buySide?.id,
        category_id: c.category_id,
        basis_id: c.basis_id,
        quantity: c.buyQty ?? 1,
        unit: c.unit ?? null,
        rate: c.buyRate ?? 0,
        amount: c.buyAmount ?? ((c.buyRate ?? 0) * (c.buyQty ?? 1)),
        currency_id: c.currency_id ?? currencyId,
        note: c.note ?? null,
        sort_order: c.sort_order ?? 1000,
      },
      {
        tenant_id: tenantId,
        quote_option_id: optionId,
        leg_id: null,
        charge_side_id: sellSide?.id,
        category_id: c.category_id,
        basis_id: c.basis_id,
        quantity: c.sellQty ?? 1,
        unit: c.unit ?? null,
        rate: c.sellRate ?? 0,
        amount: c.sellAmount ?? ((c.sellRate ?? 0) * (c.sellQty ?? 1)),
        currency_id: c.currency_id ?? currencyId,
        note: c.note ?? null,
        sort_order: c.sort_order ?? 1000,
      },
    ]);
    if (payload.length) {
      await (supabase as any)
        .from('quote_charges')
        .delete()
        .eq('quote_option_id', optionId)
        .is('leg_id', null);
      await (supabase as any).from('quote_charges').insert(payload);
    }
  };

  const combinedAutoSaveTimerRef = useRef<any>(null);
  const isCombinedAutoSavingRef = useRef<boolean>(false);
  useEffect(() => {
    if (!optionId) return;
    if (!combinedCharges.length) return;
    if (isHydratingRef.current) return;
    if (isCombinedAutoSavingRef.current) return;
    if (combinedAutoSaveTimerRef.current) clearTimeout(combinedAutoSaveTimerRef.current);
    combinedAutoSaveTimerRef.current = setTimeout(async () => {
      isCombinedAutoSavingRef.current = true;
      try {
        await saveCombinedChargesAuto();
        await loadChargesForOption();
      } finally {
        isCombinedAutoSavingRef.current = false;
      }
    }, 800);
    return () => {
      if (combinedAutoSaveTimerRef.current) clearTimeout(combinedAutoSaveTimerRef.current);
    };
  }, [optionId, combinedCharges]);

  const combinedRowsMemo = useMemo(() => {
    const data = currentLegId ? (chargesByLeg[currentLegId] ?? []) : [];
    const groupKey = (c: any) => [c.category_id ?? '', c.basis_id ?? '', c.currency_id ?? '', c.unit ?? '', c.note ?? ''].join('|');
    const map = new Map<string, any>();
    data.forEach((c: any, idx: number) => {
      const key = groupKey(c);
      const entry = map.get(key) ?? {
        key,
        category_id: c.category_id,
        basis_id: c.basis_id,
        unit: c.unit ?? '',
        currency_id: c.currency_id,
        note: c.note ?? '',
        buy: undefined as any,
        sell: undefined as any,
      };
      const sideRef = { idx, quantity: c.quantity, rate: c.rate, amount: c.amount, charge_side_id: c.charge_side_id, derived: c.derived };
      if (c.side === 'buy') entry.buy = sideRef; else if (c.side === 'sell') entry.sell = sideRef;
      map.set(key, entry);
    });
    return Array.from(map.values());
  }, [currentLegId, chargesByLeg[currentLegId!]]);

  // Virtualization refs and instances for leg and combined charge lists
  const legListParentRef = useRef<HTMLDivElement>(null);
  const legListVirtualizer = useVirtualizer({
    count: combinedRowsMemo.length,
    getScrollElement: () => legListParentRef.current,
    estimateSize: () => 180,
    overscan: 5,
  });

  const combinedListParentRef = useRef<HTMLDivElement>(null);
  const combinedListVirtualizer = useVirtualizer({
    count: combinedCharges.length,
    getScrollElement: () => combinedListParentRef.current,
    estimateSize: () => 180,
    overscan: 5,
  });

  // Helper views data for current leg
  const legData = currentLegId ? (chargesByLeg[currentLegId] ?? []) : [];

  const updateRowsForLeg = (next: any[]) => {
    if (!currentLegId) return;
    setChargesByLeg((prev: any) => ({ ...prev, [currentLegId!]: next }));
  };

  const updateSharedForLeg = (row: any, patch: any) => {
    const next = legData.slice();
    [row.buy?.idx, row.sell?.idx].forEach((i: any) => {
      if (typeof i === 'number') {
        next[i] = { ...next[i], ...patch };
        const q = next[i].quantity ?? 1;
        const rate = next[i].rate ?? 0;
        next[i].amount = Number(next[i].amount ?? rate * q);
      }
    });
    updateRowsForLeg(next);
  };

  const updateSideForLeg = (rowRef: any, sideIdx: any, patch: any) => {
    if (typeof sideIdx !== 'number') return;
    const next = legData.slice();
    next[sideIdx] = { ...next[sideIdx], ...patch };
    const q = next[sideIdx].quantity ?? 1;
    const rate = next[sideIdx].rate ?? 0;
    next[sideIdx].amount = Number(next[sideIdx].amount ?? rate * q);
    if (autoMarginEnabled) {
      const buyIdx = rowRef.buy?.idx;
      const sellIdx = rowRef.sell?.idx;
      // Only auto-derive sell when BUY side is edited; respect manual SELL edits
      if (typeof buyIdx === 'number' && typeof sellIdx === 'number' && sideIdx === buyIdx) {
        const br = next[buyIdx].rate ?? 0;
        const bq = next[buyIdx].quantity ?? 1;
        if (marginMethod === 'percent') {
          next[sellIdx].rate = br * (1 + (marginValue / 100));
          next[sellIdx].quantity = bq;
        } else if (marginMethod === 'fixed') {
          next[sellIdx].rate = br + (marginValue ?? 0);
          next[sellIdx].quantity = bq;
        }
        next[sellIdx].amount = (next[sellIdx].rate ?? 0) * (next[sellIdx].quantity ?? 1);
        next[sellIdx].derived = true;
      }
    }
    const sellIdxDirect = rowRef.sell?.idx;
    if (typeof sellIdxDirect === 'number' && sideIdx === sellIdxDirect) {
      next[sellIdxDirect].derived = false;
    }
    updateRowsForLeg(next);
  };

  const removeCombinedLegRow = (row: any) => {
    const next = legData.slice();
    const indexes = [row.buy?.idx, row.sell?.idx]
      .filter((x: any) => typeof x === 'number')
      .sort((a: number, b: number) => b - a);
    indexes.forEach((i: number) => next.splice(i, 1));
    updateRowsForLeg(next);
  };

  // Ensure an option and an initial leg exist; return leg id
  const ensureOptionAndLeg = async (): Promise<string | null> => {
    let legId = currentLegId;
    let optId = optionId;
    try {
      const tenantId = await getTenantId();
      if (!tenantId) {
        toast({ title: 'Failed to create option', description: 'Missing tenant scope. Select a tenant or open via a tenant-scoped quote.' });
        return null;
      }
      // Create option if missing
      if (!optId) {
        let defaultCurrencyId = currencyId;
        if (!defaultCurrencyId) {
          try {
            const { data: cur1 } = await supabase.from('currencies').select('id').order('code').limit(1);
            defaultCurrencyId = (cur1 ?? [])[0]?.id ?? null;
            if (defaultCurrencyId) setCurrencyId(defaultCurrencyId);
          } catch {}
        }
        const { data: opt, error: optErr } = await (supabase as any)
          .from('quotation_version_options')
          .insert({ tenant_id: tenantId, quotation_version_id: versionId, quote_currency_id: defaultCurrencyId })
          .select('id')
          .single();
        if (optErr) {
          const msg = String(optErr.message || optErr);
          if (msg.includes('carrier_rate_id') && msg.includes('not-null')) {
            const rates = await listCarrierRatesForQuote(quoteId, supabase as any);
            const rid = rates?.[0]?.id || null;
            if (rid) {
              const { data: opt2, error: optErr2 } = await (supabase as any)
                .from('quotation_version_options')
                .insert({ tenant_id: tenantId, quotation_version_id: versionId, carrier_rate_id: rid, quote_currency_id: defaultCurrencyId })
                .select('id')
                .single();
              if (optErr2) {
                toast({ title: 'Failed to create option', description: String(optErr2.message || optErr2) });
                return null;
              }
              optId = opt2?.id ?? null;
              if (optId) setOptionId(optId);
            } else {
              toast({ title: 'Failed to create option', description: 'No carrier rates found for this quote. Please hydrate carrier rates or update schema to allow NULL carrier_rate_id.' });
              return null;
            }
          } else {
            toast({ title: 'Failed to create option', description: msg });
            return null;
          }
        } else {
          optId = opt?.id ?? null;
          if (optId) setOptionId(optId);
        }
      }
      // Create leg if missing (guard against concurrent inserts)
      if (!legId && optId) {
        if (creatingLegRef.current) return null;
        creatingLegRef.current = true;
        const nextOrder = (legs[legs.length - 1]?.leg_order ?? 0) + 1;
        const createLegWithRetry = async (): Promise<any | null> => {
          const start = Date.now();
          for (let attempt = 0; attempt < 2; attempt++) {
            const { data: leg, error: legErr } = await (supabase as any)
              .from('quotation_version_option_legs')
              .insert({ tenant_id: tenantId, quotation_version_option_id: optId, leg_order: nextOrder })
              .select('id, leg_order')
              .single();
            if (!legErr && leg?.id) return leg;
            const msg = String(legErr?.message || legErr || '');
            if (msg.toLowerCase().includes('statement timeout')) {
              await new Promise(r => setTimeout(r, 400));
              continue;
            }
            toast({ title: 'Failed to create leg', description: msg });
            return null;
          }
          const elapsed = Date.now() - start;
          toast({ title: 'Failed to create leg', description: `Timeout after ${elapsed}ms` });
          return null;
        };
        const leg = await createLegWithRetry();
        creatingLegRef.current = false;
        if (!leg) return null;
        legId = leg.id;
        setLegs(prev => [...prev, { id: leg.id, leg_order: leg.leg_order }]);
        setCurrentLegId(leg.id);
        setChargesByLeg(prev => ({ ...prev, [leg.id]: prev[leg.id] ?? [] }));
        setLegNames(prev => ({ ...prev, [leg.id]: `Leg ${leg.leg_order}` }));
      }
      return legId ?? null;
    } catch (e: any) {
      toast({ title: 'Setup error', description: String(e?.message || e) });
      return null;
    }
  };

  const hydrateCharges = async () => {
    if (!providerId || !serviceId || !currentLegId) return;
    // Capture context for carrier rates: valid until, service type & id, direction, origin/destination, carrier
    await captureCarrierRates({
      providerId,
      serviceTypeId,
      serviceId,
      validUntil,
      importExport,
      originLocation,
      destinationLocation,
    });

    const { data: sides } = await supabase.from('charge_sides').select('id, code');
    const buySide = (sides ?? []).find((s: any) => s.code === 'buy');
    const buySideId = buySide?.id;
    const { data: rateCharges } = await (supabase as any)
      .from('carrier_rate_charges')
      .select('*')
      .eq('carrier_id', providerId)
      .eq('service_id', serviceId);
    const mapped = (rateCharges ?? []).map((rc: any) => ({
      side: 'buy' as const,
      charge_side_id: buySideId,
      category_id: rc.category_id ?? null,
      basis_id: rc.basis_id ?? null,
      quantity: rc.quantity ?? 1,
      unit: rc.unit ?? null,
      rate: rc.rate ?? 0,
      amount: rc.amount ?? ((rc.rate ?? 0) * (rc.quantity ?? 1)),
      currency_id: rc.currency_id ?? currencyId,
      note: rc.note ?? null,
      sort_order: rc.sort_order ?? 1000,
    }));
    setChargesByLeg(prev => ({ ...prev, [currentLegId]: [ ...(prev[currentLegId] ?? []), ...mapped ] }));
  };

  const loadChargesForOption = async () => {
    if (!optionId) return;
    try {
      isHydratingRef.current = true;
      const tenantId = await getTenantId();
      if (!tenantId) return;
      let localSides = sides;
      if (!localSides || localSides.length === 0) {
        const { data: sdata } = await supabase.from('charge_sides').select('id, code');
        localSides = sdata ?? [];
      }
      const sideById: Record<string, 'buy' | 'sell' | 'unknown'> = {};
      (localSides ?? []).forEach((s: any) => { sideById[String(s.id)] = (s.code === 'buy' ? 'buy' : (s.code === 'sell' ? 'sell' : 'unknown')); });

      const { data: allCharges } = await (supabase as any)
        .from('quote_charges')
        .select('leg_id, charge_side_id, category_id, basis_id, quantity, unit, rate, amount, currency_id, note, sort_order')
        .eq('quote_option_id', optionId)
        .order('sort_order', { ascending: true });
      const combinedRaw = (allCharges ?? []).filter((c: any) => !c.leg_id);
      const makeKey = (c: any) => [
        String(c.category_id ?? ''),
        String(c.basis_id ?? ''),
        String(c.unit ?? ''),
        String(c.currency_id ?? ''),
        String(c.note ?? ''),
        String(c.sort_order ?? 1000)
      ].join('|');
      const groupedCombined = new Map<string, any>();
      combinedRaw.forEach((c: any) => {
        const key = makeKey(c);
        const existing = groupedCombined.get(key) ?? {
          id: key + ':' + String(Date.now()) + Math.random(),
          category_id: c.category_id ?? null,
          basis_id: c.basis_id ?? null,
          unit: c.unit ?? '',
          currency_id: c.currency_id ?? null,
          buyQty: 1,
          buyRate: 0,
          buyAmount: 0,
          sellQty: 1,
          sellRate: 0,
          sellAmount: 0,
          note: c.note ?? '',
          sort_order: c.sort_order ?? 1000,
        };
        const side = sideById[String(c.charge_side_id)];
        if (side === 'buy') {
          existing.buyQty = c.quantity ?? 1;
          existing.buyRate = c.rate ?? 0;
          existing.buyAmount = c.amount ?? 0;
        } else if (side === 'sell') {
          existing.sellQty = c.quantity ?? 1;
          existing.sellRate = c.rate ?? 0;
          existing.sellAmount = c.amount ?? 0;
        }
        groupedCombined.set(key, existing);
      });
      setCombinedCharges(Array.from(groupedCombined.values()));

      const byLeg = (allCharges ?? []).filter((c: any) => !!c.leg_id);
      // Build mapping from quote_legs.id -> composer leg id by leg number
      const { data: quoteLegs } = await (supabase as any)
        .from('quote_legs')
        .select('id, leg_number')
        .eq('quote_option_id', optionId);
      const { data: compLegs } = await (supabase as any)
        .from('quotation_version_option_legs')
        .select('id, leg_order')
        .eq('quotation_version_option_id', optionId);
      const compByOrder = new Map<number, string>((compLegs ?? []).map((l: any) => [Number(l.leg_order ?? 0), String(l.id)]));
      const toComposerId: Record<string, string> = {};
      (quoteLegs ?? []).forEach((l: any) => {
        const cid = compByOrder.get(Number(l.leg_number ?? 0));
        if (cid) toComposerId[String(l.id)] = cid;
      });
      const legIdSet = new Set<string>((legs ?? []).map(l => String(l.id)));
      const grouped: Record<string, any[]> = {};
      byLeg.forEach((c: any) => {
        const lid = String(c.leg_id);
        const mapped = toComposerId[lid];
        const key = mapped ?? (legIdSet.has(lid) ? lid : lid);
        const arr = grouped[key] ?? [];
        arr.push({
          side: sideById[String(c.charge_side_id)] === 'buy' ? 'buy' : 'sell',
          charge_side_id: c.charge_side_id,
          category_id: c.category_id ?? null,
          basis_id: c.basis_id ?? null,
          quantity: c.quantity ?? 1,
          unit: c.unit ?? null,
          rate: c.rate ?? 0,
          amount: c.amount ?? ((c.rate ?? 0) * (c.quantity ?? 1)),
          currency_id: c.currency_id ?? null,
          note: c.note ?? null,
          sort_order: c.sort_order ?? 1000,
        });
        grouped[key] = arr;
      });
      setChargesByLeg(prev => ({ ...prev, ...grouped }));
    } catch {} finally {
      isHydratingRef.current = false;
    }
  };

  useEffect(() => {
    loadChargesForOption();
  }, [optionId]);

  useEffect(() => {
    (async () => {
      if (!optionId) return;
      const { data: legRows } = await (supabase as any)
        .from('quotation_version_option_legs')
        .select('id, leg_order')
        .eq('quotation_version_option_id', optionId)
        .order('leg_order');
      if (Array.isArray(legRows) && legRows.length) {
        setLegs(legRows.map((r: any) => ({ id: r.id, leg_order: r.leg_order })));
        if (!currentLegId) setCurrentLegId(legRows[0].id);
      }
    })();
  }, [optionId]);

  const getOrCreateQuoteLegId = async (composerLegId: string): Promise<string | null> => {
    try {
      const tenantId = await getTenantId();
      if (!tenantId || !optionId) return null;
      const { data: legRow } = await (supabase as any)
        .from('quotation_version_option_legs')
        .select('leg_order, service_type_id, origin_location, destination_location, provider_id')
        .eq('id', composerLegId)
        .maybeSingle();
      const legNumber = legRow?.leg_order ?? 1;
      // Try find existing quote leg by option and leg number
      const { data: existingByOrder } = await (supabase as any)
        .from('quote_legs')
        .select('id')
        .eq('quote_option_id', optionId)
        .eq('leg_number', legNumber)
        .limit(1);
      const existId = Array.isArray(existingByOrder) && existingByOrder[0]?.id ? existingByOrder[0].id : null;
      if (existId) return existId;
      // Create quote leg (allow DB to generate id)
      const { data: newLeg, error } = await (supabase as any)
        .from('quote_legs')
        .insert({
          tenant_id: tenantId,
          quote_option_id: optionId,
          leg_number: legNumber,
          service_type_id: legRow?.service_type_id ?? null,
          origin_location: legRow?.origin_location ?? null,
          destination_location: legRow?.destination_location ?? null,
          carrier_id: legRow?.provider_id ?? null,
        })
        .select('id')
        .single();
      if (error) return null;
      return newLeg?.id ?? null;
    } catch {
      return null;
    }
  };

  const basisRequiresConfig = (basisId?: string) => {
    const name = (chargeBases.find((x: any) => String(x.id) === String(basisId))?.name || '').toLowerCase();
    return name.includes('container');
  };

  const captureCarrierRates = async (ctx: {
    providerId: string | null;
    serviceTypeId: string | null;
    serviceId: string | null;
    validUntil: string;
    importExport: string;
    originLocation: string;
    destinationLocation: string;
  }) => {
    // Central place to handle carrier rates capture; currently acts as a no-op
    // for storage and serves as a single choke point to extend later.
    // If your schema supports persisting this context (e.g., carrier_rates table),
    // we can upsert here using (supabase as any).from('carrier_rates').insert({...}).
    // For now, we just validate presence and return.
    if (!ctx.providerId || !ctx.serviceId) return;
    return;
  };

  return (
    <Card ref={composerRef}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Quotation Composer</CardTitle>
            {quoteNumber ? (
              <div className="text-xs text-muted-foreground mt-1">{quoteNumber}</div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                const tenantId = await getTenantId();
                if (!tenantId) {
                  toast({ title: 'Failed to create leg', description: 'Missing tenant scope. Open via a tenant-scoped quote.' });
                  return;
                }
                if (creatingLegRef.current) return;
                creatingLegRef.current = true;
                const nextOrder = (legs[legs.length - 1]?.leg_order ?? 0) + 1;
                const { data: leg, error: legErr } = await (supabase as any)
                  .from('quotation_version_option_legs')
                  .insert({ tenant_id: tenantId, quotation_version_option_id: optionId, leg_order: nextOrder })
                  .select('id, leg_order')
                  .single();
                creatingLegRef.current = false;
                if (legErr) {
                  const msg = String(legErr?.message || legErr || '');
                  if (msg.toLowerCase().includes('statement timeout')) {
                    toast({ title: 'Failed to create leg', description: 'Timed out. Please try again.' });
                    return;
                  }
                  toast({ title: 'Failed to create leg', description: msg });
                  return;
                }
                if (!leg?.id) return;
                setLegs([...legs, { id: leg.id, leg_order: leg.leg_order }]);
                setCurrentLegId(leg.id);
                setChargesByLeg(prev => ({ ...prev, [leg.id]: [] }));
                setLegNames(prev => ({ ...prev, [leg.id]: `Leg ${leg.leg_order}` }));
                const defStId = serviceTypes?.[0]?.id;
                const defStName = (serviceTypes ?? []).find((s: any) => String(s.id) === String(defStId))?.name;
                if (defStId) {
                  await (supabase as any)
                    .from('quotation_version_option_legs')
                    .update({ service_type_id: defStId, leg_name: defStName ?? null })
                    .eq('id', leg.id);
                  setServiceTypeId(String(defStId));
                  setLegServiceTypeIds(prev => ({ ...prev, [leg.id]: String(defStId) }));
                  if (defStName) {
                    setLegLabels(prev => ({ ...prev, [leg.id]: defStName }));
                    setLegNames(prev => ({ ...prev, [leg.id]: defStName }));
                  }
                }
              }}
            >Add Leg</Button>
            <Select value={currentLegId ?? ''} onValueChange={setCurrentLegId}>
              <SelectTrigger className="w-48" tabIndex={6}><SelectValue placeholder="Select Service Type" /></SelectTrigger>
              <SelectContent>
                {legs.map((l) => {
                  const stId = legServiceTypeIds[l.id];
                  const stName = (serviceTypes ?? []).find((st: any) => String(st.id) === String(stId))?.name;
                  const label = stName || legLabels[l.id] || 'Select Service Type';
                  return <SelectItem key={l.id} value={l.id}>{label}</SelectItem>;
                })}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                if (!currentLegId) return;
                setLegDialog({
                  original: {
                    serviceTypeId,
                    serviceId,
                    providerId,
                    importExport,
                    originLocation,
                    destinationLocation,
                  },
                });
              }}
              disabled={!currentLegId}
            >Modify</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!currentLegId) return;
                const id = currentLegId;
                const qLegId = await getOrCreateQuoteLegId(id);
                if (qLegId) await (supabase as any).from('quote_charges').delete().eq('leg_id', qLegId);
                await (supabase as any).from('quotation_version_option_legs').delete().eq('id', id);
                const nextLegs = legs.filter(l => l.id !== id);
                setLegs(nextLegs);
                setChargesByLeg(prev => { const n = { ...prev }; delete n[id]; return n; });
                setCurrentLegId(nextLegs[0]?.id ?? null);
                if (editingLegId === id) setEditingLegId(null);
              }}
              disabled={!currentLegId}
            >Remove</Button>
          </div>
          </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Header fields per screenshot */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-xs font-medium">Origin Port/Location</div>
            <Input placeholder="e.g., Los Angeles, USA" value={originLocation} onChange={e => setOriginLocation(e.target.value)} tabIndex={10} />
          </div>
          <div>
            <div className="text-xs font-medium">Destination Port/Location</div>
            <Input placeholder="e.g., Mumbai, India" value={destinationLocation} onChange={e => setDestinationLocation(e.target.value)} tabIndex={20} />
          </div>
          <div>
            <div className="text-xs font-medium">Quote Currency</div>
            <Select value={currencyId ?? ''} onValueChange={setCurrencyId}>
              <SelectTrigger tabIndex={30}><SelectValue /></SelectTrigger>
              <SelectContent>
                {(currencies ?? []).map((cur) => <SelectItem key={cur.id} value={cur.id}>{cur.code}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs font-medium">Valid From</div>
            <Input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} tabIndex={40} />
          </div>
          <div>
            <div className="text-xs font-medium">Valid Until</div>
            <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} tabIndex={50} />
          </div>
          <div>
            <div className="text-xs font-medium">Auto Margin</div>
            <Select value={autoMarginEnabled ? 'on' : 'off'} onValueChange={(v) => setAutoMarginEnabled(v === 'on')}>
              <SelectTrigger tabIndex={60}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off</SelectItem>
                <SelectItem value="on">On</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select value={autoMarginEnabled ? 'on' : 'off'} onValueChange={(v) => setAutoMarginEnabled(v === 'on')}>
            <SelectTrigger><SelectValue placeholder="Auto Margin" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="off">Auto Margin Off</SelectItem>
              <SelectItem value="on">Auto Margin On</SelectItem>
            </SelectContent>
          </Select>
          <Input type="number" value={marginValue} onChange={e => setMarginValue(Number(e.target.value))} placeholder="Margin Percent" />
        </div>

        {false && currentLegId && (
          <div className="grid grid-cols-2 gap-2">
            <Select value={serviceId ?? ''} onValueChange={setServiceId}>
              <SelectTrigger><SelectValue placeholder="Leg Service" /></SelectTrigger>
              <SelectContent>
                {(services ?? []).map((sv) => (
                  <SelectItem key={sv.id} value={sv.id}>{sv.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={providerId ?? ''} onValueChange={setProviderId} disabled={!serviceTypeId}>
              <SelectTrigger tabIndex={70}><SelectValue placeholder="Leg Provider" /></SelectTrigger>
              <SelectContent>
                {(filteredCarriers ?? []).length > 0
                  ? (filteredCarriers ?? []).map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.carrier_name}</SelectItem>
                    ))
                  : (<SelectItem disabled value="__no_providers__">No providers for selected type</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={originLocation} onValueChange={setOriginLocation}>
              <SelectTrigger tabIndex={80}><SelectValue placeholder="Leg Origin" /></SelectTrigger>
              <SelectContent>
                {uniqueById(ports).filter((p: any) => portFilterTypes.length ? portFilterTypes.includes(p.location_type) : true).map((p: any) => (
                  <SelectItem key={String(p.id)} value={formatPortLabel(p)}>{formatPortLabel(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={destinationLocation} onValueChange={setDestinationLocation}>
              <SelectTrigger tabIndex={90}><SelectValue placeholder="Leg Destination" /></SelectTrigger>
              <SelectContent>
                {uniqueById(ports).filter((p: any) => portFilterTypes.length ? portFilterTypes.includes(p.location_type) : true).map((p: any) => (
                  <SelectItem key={String(p.id)} value={formatPortLabel(p)}>{formatPortLabel(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">Leg Charges</div>
            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  if (!currentLegId) return;
                  let buySide = (sides ?? []).find((s: any) => s.code === 'buy');
                  let sellSide = (sides ?? []).find((s: any) => s.code === 'sell');
                  if (!buySide || !sellSide) {
                    const { data: sidesData } = await supabase.from('charge_sides').select('id, code');
                    buySide = (sidesData ?? []).find((s: any) => s.code === 'buy');
                    sellSide = (sidesData ?? []).find((s: any) => s.code === 'sell');
                    setSides(sidesData ?? []);
                  }
                const existing = chargesByLeg[currentLegId] ?? [];
                const next = [
                  ...existing,
                  {
                    side: 'buy',
                    charge_side_id: buySide?.id,
                    category_id: null,
                    basis_id: null,
                    quantity: 1,
                    unit: null,
                    rate: 0,
                    amount: 0,
                    currency_id: currencyId,
                    note: null,
                    sort_order: 1000,
                  },
                  {
                    side: 'sell',
                    charge_side_id: sellSide?.id,
                    category_id: null,
                    basis_id: null,
                    quantity: 1,
                    unit: null,
                    rate: 0,
                    amount: 0,
                    currency_id: currencyId,
                    note: null,
                    sort_order: 1000,
                    derived: true,
                  },
                ];
                  setChargesByLeg(prev => ({ ...prev, [currentLegId]: next }));
                }}
              >+ Add Charge</Button>
              <Button onClick={saveCharges} disabled={!optionId || !currentLegId} tabIndex={110}>Save Charges</Button>
            </div>
          </div>
            <div className="space-y-4">
                  <div ref={legListParentRef} className="h-[480px] overflow-auto border rounded-md">
                    <div style={{ height: legListVirtualizer.getTotalSize(), position: 'relative' }}>
                      {legListVirtualizer.getVirtualItems().map((vi) => {
                        const row = combinedRowsMemo[vi.index];
                        const idx = vi.index;
                        return (
                          <div key={row.key} style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vi.start}px)` }} className="p-3 space-y-3">
                            <div className="grid grid-cols-1 lg:grid-cols-7 gap-3">
                              <div>
                                <div className="text-xs font-medium">Charge</div>
                                <Select value={row.category_id ?? ''} onValueChange={(val) => updateSharedForLeg(row, { category_id: val })}>
                                  <SelectTrigger tabIndex={120 + idx * 20}><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {(chargeCategories ?? []).map((cat: any) => <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <div className="text-xs font-medium">Basis</div>
                                <Select value={row.basis_id ?? ''} onValueChange={(val) => updateSharedForLeg(row, { basis_id: val })}>
                                  <SelectTrigger tabIndex={121 + idx * 20}><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {(chargeBases ?? []).map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <div className="text-xs font-medium">Unit</div>
                                <Input value={row.unit ?? ''} onChange={(e) => updateSharedForLeg(row, { unit: e.target.value })} tabIndex={122 + idx * 20} />
                              </div>
                              <div>
                                <div className="text-xs font-medium">Currency</div>
                                <Select value={row.currency_id ?? ''} onValueChange={(val) => updateSharedForLeg(row, { currency_id: val })}>
                                  <SelectTrigger tabIndex={123 + idx * 20}><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {(currencies ?? []).map((cur: any) => <SelectItem key={cur.id} value={String(cur.id)}>{cur.code}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <div className="text-xs font-medium">Buy Qty</div>
                                <Input className="text-right" type="number" value={row.buy?.quantity ?? 1} onChange={(e) => updateSideForLeg(row, row.buy?.idx, { quantity: Number(e.target.value) })} tabIndex={124 + idx * 20} />
                              </div>
                              <div>
                                <div className="text-xs font-medium">Buy Rate</div>
                                <Input className="text-right" type="number" value={row.buy?.rate ?? 0} onChange={(e) => updateSideForLeg(row, row.buy?.idx, { rate: Number(e.target.value), amount: Number(e.target.value) * (row.buy?.quantity || 1) })} tabIndex={125 + idx * 20} />
                              </div>
                              <div>
                                <div className="text-xs font-medium">Buy Amount</div>
                                <Input className="text-right" type="number" value={row.buy?.amount ?? 0} onChange={(e) => updateSideForLeg(row, row.buy?.idx, { amount: Number(e.target.value) })} tabIndex={126 + idx * 20} />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-7 gap-3 items-end">
                              <div>
                                <div className="text-xs font-medium">Sell Qty</div>
                                <Input className="text-right" type="number" value={row.sell?.quantity ?? 1} onChange={(e) => updateSideForLeg(row, row.sell?.idx, { quantity: Number(e.target.value) })} tabIndex={127 + idx * 20} />
                              </div>
                              <div>
                                <div className="text-xs font-medium flex items-center gap-2">Sell Rate {row.sell?.derived ? <Badge variant="outline" className="text-[10px]">auto</Badge> : <Badge variant="secondary" className="text-[10px]">manual</Badge>}</div>
                                <Input className="text-right" type="number" value={row.sell?.rate ?? 0} onChange={(e) => updateSideForLeg(row, row.sell?.idx, { rate: Number(e.target.value), amount: Number(e.target.value) * (row.sell?.quantity || 1) })} tabIndex={128 + idx * 20} />
                              </div>
                              <div>
                                <div className="text-xs font-medium">Sell Amount</div>
                                <Input className="text-right" type="number" value={row.sell?.amount ?? 0} onChange={(e) => updateSideForLeg(row, row.sell?.idx, { amount: Number(e.target.value) })} tabIndex={129 + idx * 20} />
                              </div>
                              <div className="lg:col-span-3">
                                <div className="text-xs font-medium">Remark Note</div>
                                <Input value={row.note ?? ''} onChange={(e) => updateSharedForLeg(row, { note: e.target.value })} tabIndex={130 + idx * 20} />
                              </div>
                              <div className="flex gap-2 justify-end">
                                <Button variant="outline" size="sm" onClick={() => setBasisDialog({ type: 'leg', rowIdx: row.buy?.idx })} tabIndex={131 + idx * 20}>Modify</Button>
                                <Button variant="secondary" size="sm" onClick={() => setBasisDialog({ type: 'leg', rowIdx: row.buy?.idx })} tabIndex={132 + idx * 20}>Set Basis</Button>
                                {basisRequiresConfig(row.basis_id) && (
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      const tdId = String((tradeDirections ?? []).find((d: any) => String(d.code) === String(importExport))?.id ?? (tradeDirections?.[0]?.id ?? ''));
                                      const ctId = String((containerTypes?.[0]?.id ?? ''));
                                      const csId = String((containerSizes?.[0]?.id ?? ''));
                                      setBasisConfigTarget({ type: 'leg', rowIdx: row.buy?.idx });
                                      setBasisConfig({
                                        tradeDirection: tdId,
                                        containerType: ctId,
                                        containerSize: csId,
                                        quantity: Number(row.buy?.quantity ?? 1) || 1,
                                      });
                                      setBasisConfigOpen(true);
                                    }}
                                  tabIndex={133 + idx * 20}>Configure</Button>
                                )}
                                <Button variant="destructive" size="sm" onClick={() => removeCombinedLegRow(row)} tabIndex={134 + idx * 20}>Remove</Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
              
            </div>
          </div>
          <div className="flex items-center justify-end gap-6 text-sm">
            <div>Buy: <span className="font-semibold">{
              legData.filter((c: any) => c.side === 'buy').reduce((s: number, c: any) => s + (c.amount || (c.rate ?? 0) * (c.quantity ?? 1)), 0).toFixed(2)
            }</span></div>
            <div>Sell: <span className="font-semibold">{
              legData.filter((c: any) => c.side === 'sell').reduce((s: number, c: any) => s + (c.amount || (c.rate ?? 0) * (c.quantity ?? 1)), 0).toFixed(2)
            }</span></div>
            <div>Margin: <span className="font-semibold">{
              (
                legData.filter((c: any) => c.side === 'sell').reduce((s: number, c: any) => s + (c.amount || (c.rate ?? 0) * (c.quantity ?? 1)), 0) -
                legData.filter((c: any) => c.side === 'buy').reduce((s: number, c: any) => s + (c.amount || (c.rate ?? 0) * (c.quantity ?? 1)), 0)
              ).toFixed(2)
            }</span></div>
            <Button onClick={saveCharges} disabled={!optionId || !currentLegId}>Save Charges</Button>
          </div>

        

        {false && (<div />)}

        {/* Summary by legs */}
        <div className="space-y-6">
          {legs.map((l) => {
            const data = chargesByLeg[l.id] ?? [];
            const buy = data.filter((c: any) => c.side === 'buy').reduce((s: number, c: any) => s + (c.amount ?? (c.rate ?? 0) * (c.quantity ?? 1)), 0);
            const sell = data.filter((c: any) => c.side === 'sell').reduce((s: number, c: any) => s + (c.amount ?? (c.rate ?? 0) * (c.quantity ?? 1)), 0);
            const margin = sell - buy;
            const groupKey = (c: any) => [c.category_id ?? '', c.basis_id ?? '', c.currency_id ?? '', c.unit ?? '', c.note ?? ''].join('|');
            const map = new Map<string, any>();
            data.forEach((c: any) => {
              const key = groupKey(c);
              const e = map.get(key) ?? { key, category_id: c.category_id, basis_id: c.basis_id, unit: c.unit ?? null, currency_id: c.currency_id, note: c.note ?? null, buy: null as any, sell: null as any };
              if (c.side === 'buy') e.buy = { quantity: c.quantity, rate: c.rate, amount: c.amount };
              if (c.side === 'sell') e.sell = { quantity: c.quantity, rate: c.rate, amount: c.amount };
              map.set(key, e);
            });
            const rows = Array.from(map.values());
            const catName = (id?: string) => (chargeCategories.find((x: any) => String(x.id) === String(id))?.name ?? id ?? '');
            const basisName = (id?: string) => (chargeBases.find((x: any) => String(x.id) === String(id))?.name ?? id ?? '');
            const currencyCode = (id?: string) => (currencies.find((x: any) => String(x.id) === String(id))?.code ?? id ?? '');
            return (
              <div key={l.id} className="space-y-2">
                <div className="font-semibold flex items-center gap-2">
                  <span>Leg</span>
                  <Input
                    className="w-48"
                    value={legNames[l.id] ?? `Leg ${l.leg_order}`}
                    onChange={(e) => setLegNames(prev => ({ ...prev, [l.id]: e.target.value }))}
                  />
                </div>
                <div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left p-2">Category</th>
                        <th className="text-left p-2">Basis</th>
                        <th className="text-left p-2">Unit</th>
                        <th className="text-left p-2">Currency</th>
                        <th className="text-right p-2">Buy Qty</th>
                        <th className="text-right p-2">Buy Rate</th>
                        <th className="text-right p-2">Buy Amount</th>
                        <th className="text-right p-2">Sell Qty</th>
                        <th className="text-right p-2">Sell Rate</th>
                        <th className="text-right p-2">Sell Amount</th>
                        <th className="text-left p-2">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r: any) => (
                        <tr key={r.key}>
                          <td className="p-2">{catName(r.category_id)}</td>
                          <td className="p-2">{basisName(r.basis_id)}</td>
                          <td className="p-2">{r.unit ?? ''}</td>
                          <td className="p-2">{currencyCode(r.currency_id)}</td>
                          <td className="p-2 text-right">{r.buy?.quantity ?? ''}</td>
                          <td className="p-2 text-right">{r.buy?.rate ?? ''}</td>
                          <td className="p-2 text-right">{(r.buy?.amount ?? 0).toFixed ? r.buy?.amount?.toFixed(2) : (r.buy?.amount ?? '')}</td>
                          <td className="p-2 text-right">{r.sell?.quantity ?? ''}</td>
                          <td className="p-2 text-right">{r.sell?.rate ?? ''}</td>
                          <td className="p-2 text-right">{(r.sell?.amount ?? 0).toFixed ? r.sell?.amount?.toFixed(2) : (r.sell?.amount ?? '')}</td>
                          <td className="p-2">{r.note ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-end gap-6 text-sm">
                  <div>Buy: <span className="font-semibold">{buy.toFixed(2)}</span></div>
                  <div>Sell: <span className="font-semibold">{sell.toFixed(2)}</span></div>
                  <div>Margin: <span className="font-semibold">{margin.toFixed(2)}</span></div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => {}} disabled={!optionId}>Cancel</Button>
          <Button onClick={async () => {
            await saveCharges();
            const tenantId = await getTenantId();
            if (!tenantId || !optionId) return;
            const { data: sidesData } = await supabase.from('charge_sides').select('id, code');
            const buySide = (sidesData ?? []).find((s: any) => s.code === 'buy');
            const sellSide = (sidesData ?? []).find((s: any) => s.code === 'sell');
          const payload = combinedCharges.flatMap((c: any) => [
            {
              tenant_id: tenantId,
              quote_option_id: optionId,
              leg_id: null,
              charge_side_id: buySide?.id,
                category_id: c.category_id,
                basis_id: c.basis_id,
                quantity: c.buyQty ?? 1,
                unit: c.unit ?? null,
                rate: c.buyRate ?? 0,
                amount: c.buyAmount ?? ((c.buyRate ?? 0) * (c.buyQty ?? 1)),
                currency_id: c.currency_id ?? currencyId,
                note: c.note ?? null,
              sort_order: c.sort_order ?? 1000,
            },
            {
              tenant_id: tenantId,
              quote_option_id: optionId,
              leg_id: null,
              charge_side_id: sellSide?.id,
                category_id: c.category_id,
                basis_id: c.basis_id,
                quantity: c.sellQty ?? 1,
                unit: c.unit ?? null,
                rate: c.sellRate ?? 0,
                amount: c.sellAmount ?? ((c.sellRate ?? 0) * (c.sellQty ?? 1)),
                currency_id: c.currency_id ?? currencyId,
                note: c.note ?? null,
              sort_order: c.sort_order ?? 1000,
            },
          ]);
            if (payload.length) {
              await (supabase as any)
                .from('quote_charges')
                .delete()
                .eq('quote_option_id', optionId)
                .is('leg_id', null);
              const { error } = await (supabase as any).from('quote_charges').insert(payload);
              if (error) return;
            }
            await loadChargesForOption();
            const allLeg = Object.values(chargesByLeg).flat();
            const legBuy = allLeg.filter((x: any) => x.side === 'buy').reduce((s: number, c: any) => s + (c.amount ?? (c.rate ?? 0) * (c.quantity ?? 1)), 0);
            let legSell = allLeg.filter((x: any) => x.side === 'sell').reduce((s: number, c: any) => s + (c.amount ?? (c.rate ?? 0) * (c.quantity ?? 1)), 0);
            const combBuy = combinedCharges.reduce((s, c) => s + (c.buyAmount || 0), 0);
            let combSell = combinedCharges.reduce((s, c) => s + (c.sellAmount || 0), 0);
            if (autoMarginEnabled && marginMethod === 'percent') {
              combSell = combBuy * (1 + (marginValue / 100));
            } else if (autoMarginEnabled && marginMethod === 'fixed') {
              combSell = combBuy + marginValue;
            }
            const buyTotal = legBuy + combBuy;
            const sellTotal = legSell + combSell;
            const marginTotal = sellTotal - buyTotal;
            await (supabase as any)
              .from('quotation_version_options')
              .update({ total_cost: buyTotal, total_price: sellTotal, margin: marginTotal })
              .eq('id', optionId);
          }} disabled={!optionId}>Save Quotation</Button>
          <Button variant="default" onClick={async () => {
            await saveCharges();
            const tenantId = await getTenantId();
            if (!tenantId || !optionId) return;
            const allLeg = Object.values(chargesByLeg).flat();
            const legBuy = allLeg.filter((x: any) => x.side === 'buy').reduce((s: number, c: any) => s + (c.amount ?? (c.rate ?? 0) * (c.quantity ?? 1)), 0);
            let legSell = allLeg.filter((x: any) => x.side === 'sell').reduce((s: number, c: any) => s + (c.amount ?? (c.rate ?? 0) * (c.quantity ?? 1)), 0);
            const combBuy = combinedCharges.reduce((s, c) => s + (c.buyAmount || 0), 0);
            let combSell = combinedCharges.reduce((s, c) => s + (c.sellAmount || 0), 0);
            if (autoMarginEnabled && marginMethod === 'percent') {
              combSell = combBuy * (1 + (marginValue / 100));
            } else if (autoMarginEnabled && marginMethod === 'fixed') {
              combSell = combBuy + marginValue;
            }
            const buyTotal = legBuy + combBuy;
            const sellTotal = legSell + combSell;
            const marginTotal = sellTotal - buyTotal;
            await (supabase as any)
              .from('quotation_version_options')
              .update({ total_cost: buyTotal, total_price: sellTotal, margin: marginTotal })
              .eq('id', optionId);
            if (quoteId) {
              await (supabase as any)
                .from('quotes')
                .update({ status: 'sent' })
                .eq('id', quoteId);
            }
          }} disabled={!optionId}>Save & Send</Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Combined Charges</div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  const base = {
                    id: String(Date.now()),
                    category_id: chargeCategories[0]?.id,
                    basis_id: chargeBases[0]?.id,
                    unit: '',
                    currency_id: currencyId,
                    buyQty: 1,
                    buyRate: 0,
                    buyAmount: 0,
                    sellQty: 1,
                    sellRate: 0,
                    sellAmount: 0,
                    note: '',
                    sort_order: 1000,
                    basisDetails: null,
                  };
                  setCombinedCharges(prev => [...prev, base]);
                }}
              >Add Combined Charge</Button>
              <Button
                onClick={async () => {
                  const tenantId = await getTenantId();
                  if (!tenantId || !optionId) return;
                  const { data: sidesData } = await supabase.from('charge_sides').select('id, code');
                  const buySide = (sidesData ?? []).find((s: any) => s.code === 'buy');
                  const sellSide = (sidesData ?? []).find((s: any) => s.code === 'sell');
                const payload = combinedCharges.flatMap((c: any) => [
                  {
                    tenant_id: tenantId,
                    quote_option_id: optionId,
                    leg_id: null,
                    charge_side_id: buySide?.id,
                      category_id: c.category_id,
                      basis_id: c.basis_id,
                      quantity: c.buyQty ?? 1,
                      unit: c.unit ?? null,
                      rate: c.buyRate ?? 0,
                      amount: c.buyAmount ?? ((c.buyRate ?? 0) * (c.buyQty ?? 1)),
                      currency_id: c.currency_id ?? currencyId,
                      note: c.note ?? null,
                    sort_order: c.sort_order ?? 1000,
                  },
                  {
                    tenant_id: tenantId,
                    quote_option_id: optionId,
                    leg_id: null,
                    charge_side_id: sellSide?.id,
                      category_id: c.category_id,
                      basis_id: c.basis_id,
                      quantity: c.sellQty ?? 1,
                      unit: c.unit ?? null,
                      rate: c.sellRate ?? 0,
                      amount: c.sellAmount ?? ((c.sellRate ?? 0) * (c.sellQty ?? 1)),
                      currency_id: c.currency_id ?? currencyId,
                      note: c.note ?? null,
                    sort_order: c.sort_order ?? 1000,
                  },
                ]);
                  if (payload.length) {
                    await (supabase as any)
                      .from('quote_charges')
                      .delete()
                      .eq('quote_option_id', optionId)
                      .is('leg_id', null);
                    await (supabase as any).from('quote_charges').insert(payload);
                  }
                  await loadChargesForOption();
                }}
                disabled={!optionId}
              >Save Combined Charges</Button>
            </div>
          </div>
          {(() => {
            const updateRowAt = (id: string, patch: any) => {
              setCombinedCharges(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x));
            };
            const recompute = (row: any) => {
              row.buyAmount = (row.buyQty || 0) * (row.buyRate || 0);
              row.sellAmount = (row.sellQty || 0) * (row.sellRate || 0);
            };
            return (
              <div ref={combinedListParentRef} className="h-[480px] overflow-auto border rounded-md">
                <div style={{ height: combinedListVirtualizer.getTotalSize(), position: 'relative' }}>
                  {combinedListVirtualizer.getVirtualItems().map((vi) => {
                    const row = combinedCharges[vi.index];
                    const idx = vi.index;
                    const setRow = (patch: any) => { const next = { ...row, ...patch }; recompute(next); updateRowAt(row.id, next); };
                    const updateBuy = (patch: any) => {
                      const next = { ...row, ...patch };
                      recompute(next);
                      if (autoMarginEnabled) {
                        if (marginMethod === 'percent') {
                          next.sellRate = (next.buyRate || 0) * (1 + (marginValue / 100));
                          next.sellQty = next.buyQty;
                          next.sellAuto = true;
                          recompute(next);
                        } else if (marginMethod === 'fixed') {
                          next.sellRate = (next.buyRate || 0) + (marginValue || 0);
                          next.sellQty = next.buyQty;
                          next.sellAuto = true;
                          recompute(next);
                        }
                      }
                      updateRowAt(row.id, next);
                    };
                    const updateSell = (patch: any) => { const next = { ...row, ...patch, sellAuto: false }; recompute(next); updateRowAt(row.id, next); };
                    return (
                      <div key={row.id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vi.start}px)` }} className="p-3 space-y-3">
                        <div className="grid grid-cols-1 lg:grid-cols-7 gap-3">
                          <div>
                            <div className="text-xs font-medium">Charge</div>
                            <Select value={row.category_id ?? ''} onValueChange={(val) => setRow({ category_id: val })}>
                              <SelectTrigger tabIndex={320 + idx * 20}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(chargeCategories ?? []).map((cat: any) => <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <div className="text-xs font-medium">Basis</div>
                            <Select value={row.basis_id ?? ''} onValueChange={(val) => setRow({ basis_id: val })}>
                              <SelectTrigger tabIndex={321 + idx * 20}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(chargeBases ?? []).map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <div className="text-xs font-medium">Unit</div>
                            <Input value={row.unit ?? ''} onChange={(e) => setRow({ unit: e.target.value })} tabIndex={322 + idx * 20} />
                          </div>
                          <div>
                            <div className="text-xs font-medium">Currency</div>
                            <Select value={row.currency_id ?? ''} onValueChange={(val) => setRow({ currency_id: val })}>
                              <SelectTrigger tabIndex={323 + idx * 20}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(currencies ?? []).map((cur: any) => <SelectItem key={cur.id} value={String(cur.id)}>{cur.code}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <div className="text-xs font-medium">Buy Qty</div>
                            <Input className="text-right" type="number" value={row.buyQty ?? 0} onChange={(e) => updateBuy({ buyQty: Number(e.target.value) })} tabIndex={324 + idx * 20} />
                          </div>
                          <div>
                            <div className="text-xs font-medium">Buy Rate</div>
                            <Input className="text-right" type="number" value={row.buyRate ?? 0} onChange={(e) => updateBuy({ buyRate: Number(e.target.value) })} tabIndex={325 + idx * 20} />
                          </div>
                          <div>
                            <div className="text-xs font-medium">Buy Amount</div>
                            <Input className="text-right" type="number" value={row.buyAmount ?? 0} onChange={(e) => updateBuy({ buyAmount: Number(e.target.value) })} tabIndex={326 + idx * 20} />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-7 gap-3 items-end">
                          <div>
                            <div className="text-xs font-medium">Sell Qty</div>
                            <Input className="text-right" type="number" value={row.sellQty ?? 0} onChange={(e) => updateSell({ sellQty: Number(e.target.value) })} tabIndex={327 + idx * 20} />
                          </div>
                          <div>
                            <div className="text-xs font-medium flex items-center gap-2">Sell Rate {row.sellAuto ? <Badge variant="outline" className="text-[10px]">auto</Badge> : <Badge variant="secondary" className="text-[10px]">manual</Badge>}</div>
                            <Input className="text-right" type="number" value={row.sellRate ?? 0} onChange={(e) => updateSell({ sellRate: Number(e.target.value) })} tabIndex={328 + idx * 20} />
                          </div>
                          <div>
                            <div className="text-xs font-medium">Sell Amount</div>
                            <Input className="text-right" type="number" value={row.sellAmount ?? 0} onChange={(e) => updateSell({ sellAmount: Number(e.target.value) })} tabIndex={329 + idx * 20} />
                          </div>
                          <div className="lg:col-span-3">
                            <div className="text-xs font-medium">Remark Note</div>
                            <Input value={row.note ?? ''} onChange={(e) => setRow({ note: e.target.value })} tabIndex={330 + idx * 20} />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={() => setBasisDialog({ type: 'combined', row })} tabIndex={331 + idx * 20}>Modify</Button>
                            <Button variant="secondary" size="sm" onClick={() => setBasisDialog({ type: 'combined', row })} tabIndex={332 + idx * 20}>Set Basis</Button>
                            {basisRequiresConfig(row.basis_id) && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  const tdId = String((tradeDirections?.[0]?.id ?? ''));
                                  const ctId = String((containerTypes?.[0]?.id ?? ''));
                                  const csId = String((containerSizes?.[0]?.id ?? ''));
                                  setBasisConfigTarget({ type: 'combined', row });
                                  setBasisConfig({
                                    tradeDirection: tdId,
                                    containerType: ctId,
                                    containerSize: csId,
                                    quantity: Number(row.buyQty ?? 1) || 1,
                                  });
                                  setBasisConfigOpen(true);
                                }}
                              tabIndex={333 + idx * 20}>Configure</Button>
                            )}
                            <Button variant="destructive" size="sm" onClick={() => setCombinedCharges(prev => prev.filter(x => x.id !== row.id))} tabIndex={334 + idx * 20}>Remove</Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          </div>
          <div className="flex items-center justify-end gap-6 text-sm">
            <div>
              Buy: <span className="font-semibold">{
                (
                  (legData.filter((c: any) => c.side === 'buy').reduce((s: number, c: any) => s + (c.amount || (c.rate ?? 0) * (c.quantity ?? 1)), 0)) +
                  (combinedCharges.reduce((s: number, c: any) => s + (c.buyAmount || 0), 0))
                ).toFixed(2)
              }</span>
            </div>
            <div>
              Sell: <span className="font-semibold">{
                (
                  (legData.filter((c: any) => c.side === 'sell').reduce((s: number, c: any) => s + (c.amount || (c.rate ?? 0) * (c.quantity ?? 1)), 0)) +
                  (combinedCharges.reduce((s: number, c: any) => s + (c.sellAmount || 0), 0))
                ).toFixed(2)
              }</span>
            </div>
            <div>
              Margin: <span className="font-semibold">{
                (
                  (
                    (legData.filter((c: any) => c.side === 'sell').reduce((s: number, c: any) => s + (c.amount || (c.rate ?? 0) * (c.quantity ?? 1)), 0)) +
                    (combinedCharges.reduce((s: number, c: any) => s + (c.sellAmount || 0), 0))
                  ) - (
                    (legData.filter((c: any) => c.side === 'buy').reduce((s: number, c: any) => s + (c.amount || (c.rate ?? 0) * (c.quantity ?? 1)), 0)) +
                    (combinedCharges.reduce((s: number, c: any) => s + (c.buyAmount || 0), 0))
                  )
                ).toFixed(2)
              }</span>
            </div>
          </div>
        </CardContent>

        {basisDialog && (
          <div>
            <div className="fixed inset-0 bg-black/50" onClick={() => setBasisDialog(null)} />
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-neutral-900 rounded-md p-4 w-full max-w-lg space-y-3">
                <div className="font-semibold">Set Basis</div>
                <Select value={basisDialog?.current?.tradeDirection ?? ''} onValueChange={(val) => setBasisDialog((prev: any) => ({ ...prev, current: { ...(prev?.current ?? {}), tradeDirection: val } }))}>
                  <SelectTrigger><SelectValue placeholder="Trade Direction" /></SelectTrigger>
                  <SelectContent>
                    {(tradeDirections ?? []).map((d: any) => <SelectItem key={d.id} value={String(d.code)}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={basisDialog?.current?.containerType ?? ''} onValueChange={(val) => setBasisDialog((prev: any) => ({ ...prev, current: { ...(prev?.current ?? {}), containerType: val } }))}>
                  <SelectTrigger><SelectValue placeholder="Container Type" /></SelectTrigger>
                  <SelectContent>
                    {(containerTypes ?? []).map((ct: any) => <SelectItem key={ct.id} value={String(ct.id)}>{ct.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={basisDialog?.current?.containerSize ?? ''} onValueChange={(val) => setBasisDialog((prev: any) => ({ ...prev, current: { ...(prev?.current ?? {}), containerSize: val } }))}>
                  <SelectTrigger><SelectValue placeholder="Container Size" /></SelectTrigger>
                  <SelectContent>
                    {(containerSizes ?? []).map((cs: any) => <SelectItem key={cs.id} value={String(cs.id)}>{cs.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="number" value={basisDialog?.current?.quantity ?? 1} onChange={(e) => setBasisDialog((prev: any) => ({ ...prev, current: { ...(prev?.current ?? {}), quantity: Number(e.target.value) } }))} placeholder="Quantity" />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setBasisDialog(null)}>Cancel</Button>
                  <Button onClick={() => {
                    if (!basisDialog?.current) return;
                    const qty = basisDialog.current.quantity ?? 1;
                    const sizeId = basisDialog.current.containerSize;
                    const sizeName = (containerSizes.find((s: any) => String(s.id) === String(sizeId))?.name ?? '') || String(sizeId ?? '');
                    const unitText = `${qty}x${sizeName}`;
                    if (basisDialog.type === 'combined') {
                      setCombinedCharges(prev => prev.map(x => x.id === basisDialog.row.id ? { ...x, basisDetails: basisDialog.current, unit: unitText, buyQty: qty, sellQty: qty } : x));
                    } else if (basisDialog.type === 'leg' && typeof basisDialog.rowIdx === 'number') {
                      const legId = currentLegId;
                      if (!legId) return;
                      setChargesByLeg(prev => {
                        const data = prev[legId] ?? [];
                        const next = data.slice();
                        next[basisDialog.rowIdx] = { ...next[basisDialog.rowIdx], unit: unitText, quantity: qty };
                        return { ...prev, [legId]: next };
                      });
                    }
                    setBasisDialog(null);
                  }}>Save</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {legDialog && (
          <div>
            <div className="fixed inset-0 bg-black/50" onClick={() => setLegDialog(null)} />
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-neutral-900 rounded-md p-4 w-full max-w-lg space-y-3">
                <div className="font-semibold">Edit Leg</div>
                <Select value={serviceTypeId ?? ''} onValueChange={setServiceTypeId}>
                  <SelectTrigger><SelectValue placeholder="Service Type" /></SelectTrigger>
                  <SelectContent>
                    {(serviceTypes ?? []).map((st: any) => <SelectItem key={st.id} value={String(st.id)}>{st.name ?? st.code}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={providerId ?? ''} onValueChange={setProviderId} disabled={!serviceTypeId}>
                  <SelectTrigger><SelectValue placeholder="Provider" /></SelectTrigger>
                  <SelectContent>
                    {(filteredCarriers ?? []).length > 0
                      ? (filteredCarriers ?? []).map((c: any) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.carrier_name}</SelectItem>
                        ))
                      : (<SelectItem disabled value="__no_providers__">No providers</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input placeholder="Origin" value={originLocation} onChange={(e) => setOriginLocation(e.target.value)} />
                <Input placeholder="Destination" value={destinationLocation} onChange={(e) => setDestinationLocation(e.target.value)} />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const o = legDialog?.original || {};
                      setServiceTypeId(o.serviceTypeId ?? null);
                      setProviderId(o.providerId ?? null);
                      setOriginLocation(o.originLocation ?? '');
                      setDestinationLocation(o.destinationLocation ?? '');
                      setLegDialog(null);
                    }}
                  >Cancel</Button>
                  <Button onClick={() => setLegDialog(null)}>Save</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <BasisConfigModal
          open={basisConfigOpen}
          onClose={() => setBasisConfigOpen(false)}
          onSave={(config) => {
            const qty = Number(config.quantity || 1);
            const sizeId = config.containerSize;
            const sizeName = (containerSizes.find((s: any) => String(s.id) === String(sizeId))?.name ?? '') || String(sizeId ?? '');
            const unitText = `${qty}x${sizeName}`;
            if (basisConfigTarget?.type === 'combined' && basisConfigTarget.row) {
              setCombinedCharges(prev => prev.map(x => x.id === basisConfigTarget.row?.id ? { ...x, basisDetails: config, unit: unitText, buyQty: qty, sellQty: qty } : x));
            } else if (basisConfigTarget?.type === 'leg' && typeof basisConfigTarget.rowIdx === 'number') {
              const legId = currentLegId;
              if (!legId) return;
              setChargesByLeg(prev => {
                const data = prev[legId] ?? [];
                const next = data.slice();
                next[basisConfigTarget.rowIdx!] = { ...next[basisConfigTarget.rowIdx!], unit: unitText, quantity: qty };
                return { ...prev, [legId]: next };
              });
            }
            setBasisConfigOpen(false);
          }}
          config={basisConfig}
          onChange={(updates) => setBasisConfig(prev => ({ ...prev, ...updates }))}
          tradeDirections={tradeDirections}
          containerTypes={containerTypes}
          containerSizes={containerSizes}
        />
    </Card>
  );
}