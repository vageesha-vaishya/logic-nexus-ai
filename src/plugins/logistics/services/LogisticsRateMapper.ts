export interface MasterData {
  categories: any[];
  sides: any[];
  bases: any[];
  currencies: any[];
  serviceTypes: any[];
  serviceModes: any[];
  carriers: any[];
}

export class LogisticsRateMapper {
  constructor(private masterData: MasterData) {}

  getCatId(code: string) {
    const { categories } = this.masterData;
    if (!categories) return null;
    const normalizedCode = code.toUpperCase().replace(/_/g, ' ');
    const exact = categories.find((c: any) => c.code === code || c.name.toUpperCase() === normalizedCode)?.id;
    if (exact) return exact;
    
    const mappings: Record<string, string> = {
        'BASE_FARE': 'FREIGHT', 'FREIGHT': 'FREIGHT', 'TAXES': 'TAXES',
        'SURCHARGES': 'SURCHARGE', 'FUEL': 'FUEL_SURCHARGE',
        'PICKUP': 'PICKUP', 'DELIVERY': 'DELIVERY',
        'DOCUMENTATION': 'DOCUMENTATION', 'CUSTOMS': 'CUSTOMS_CLEARANCE',
        'INSURANCE': 'INSURANCE', 'HANDLING': 'HANDLING',
        'THC': 'TERMINAL_HANDLING', 'BUNKER': 'BUNKER_ADJUSTMENT'
    };
    const mappedCode = mappings[code] || mappings[normalizedCode];
    if (mappedCode) {
         const mapped = categories.find((c: any) => c.code === mappedCode || c.name.toUpperCase() === mappedCode)?.id;
         if (mapped) return mapped;
    }
    const keywordMatch = categories.find((c: any) => c.name.toUpperCase().includes(normalizedCode) || c.code.includes(code))?.id;
    if (keywordMatch) return keywordMatch;
    return categories.find((c: any) => c.code === 'SURCHARGE')?.id || categories?.[0]?.id;
  }

  getSideId(code: string) {
    const { sides } = this.masterData;
    return sides?.find((s: any) => s.code?.toLowerCase() === code.toLowerCase() || s.name?.toLowerCase() === code.toLowerCase())?.id;
  }

  getBasisId(code: string) {
    const { bases } = this.masterData;
    return bases?.find((b: any) => b.code?.toLowerCase() === code.toLowerCase())?.id || bases?.find((b: any) => b.code === 'shipment' || b.name === 'Per Shipment')?.id;
  }

  getCurrId(code: string) {
    const { currencies } = this.masterData;
    return currencies?.find((c: any) => c.code === code)?.id || currencies?.find((c: any) => c.code === 'USD')?.id;
  }

  getServiceTypeId(mode: string, tier?: string) {
    const { serviceTypes } = this.masterData;
    if (!serviceTypes) return null;
    
    const modeKey = (mode || '').toLowerCase();
    const tierKey = (tier || '').toLowerCase();

    if (tierKey) {
        const tierMatch = serviceTypes.find((st: any) => 
            st.code?.toLowerCase() === tierKey || 
            st.name?.toLowerCase() === tierKey
        );
        if (tierMatch) return tierMatch.id;
    }

    // Try exact mode match
    let modeMatch = serviceTypes.find((st: any) => st.transport_modes?.code?.toLowerCase() === modeKey);
    if (modeMatch) return modeMatch.id;

    // Try split mode match (e.g. "Ocean - FCL" -> "sea")
    const splitMode = modeKey.split(/[\s-]+/)[0];
    const map: Record<string, string> = { 'ocean': 'sea', 'truck': 'road' };
    const target = map[splitMode] || splitMode;

    modeMatch = serviceTypes.find((st: any) => st.transport_modes?.code?.toLowerCase() === target);
    return modeMatch?.id || serviceTypes[0]?.id;
  }

  getModeId(modeName: string) {
     const { serviceModes } = this.masterData;
     if (!modeName) return null;
     const normalized = modeName.toLowerCase();
    // Map common terms
    const map: Record<string, string> = { 'ocean': 'sea', 'truck': 'road', 'air': 'air', 'rail': 'rail' };
    
    // 1. Try exact/mapped match
     let target = map[normalized] || normalized;
     let match = serviceModes?.find((m: any) => m.code.toLowerCase() === target || m.name.toLowerCase() === target);
     if (match) return match.id;
     
     // 2. Try split match
     const split = normalized.split(/[\s-]+/)[0];
     target = map[split] || split;
     match = serviceModes?.find((m: any) => m.code.toLowerCase() === target || m.name.toLowerCase() === target);
     if (match) return match.id;

     // 3. Fallback to sea/ocean if reasonable default needed, or null
     return serviceModes?.find((m: any) => m.code.toLowerCase() === 'sea')?.id || null;
  }

  getProviderId(carrierName: string) {
     const { carriers } = this.masterData;
     if (!carrierName || !carriers) return null;
     
     const normalizedSearch = carrierName.toLowerCase().trim();
     if (!normalizedSearch) return null;

     // 1. Exact Name Match (case-insensitive)
     let match = carriers.find((c: any) => c.carrier_name.toLowerCase() === normalizedSearch);

     // 2. SCAC Match
     if (!match) {
         match = carriers.find((c: any) => c.scac?.toLowerCase() === normalizedSearch);
     }

     // 3. Includes Check (Bidirectional) - Prioritize explicit name match over generic
     if (!match) {
         // Try to find where DB name contains search name (e.g. "Evergreen Marine" contains "Evergreen")
         match = carriers.find((c: any) => c.carrier_name.toLowerCase().includes(normalizedSearch));
     }
     
     if (!match) {
         // Try reverse: Search name contains DB name (e.g. "Evergreen Line" contains "Evergreen")
         // Be careful with short names like "ONE" matching "None" etc.
         match = carriers.find((c: any) => normalizedSearch.includes(c.carrier_name.toLowerCase()) && c.carrier_name.length > 2);
     }

     // 4. Hardcoded Aliases for common mismatches
     if (!match) {
         const aliases: Record<string, string[]> = {
             'evergreen': ['evergreen line', 'evergreen marine', 'emc'],
             'maersk': ['maersk line', 'maersk sealand'],
             'msc': ['mediterranean shipping company'],
             'cma cgm': ['cma', 'cgm'],
             'cosco': ['cosco shipping'],
             'one': ['ocean network express'],
             'zim': ['zim integrated shipping services'],
             'hmm': ['hyundai merchant marine'],
             'yang ming': ['yang ming marine transport'],
             'apl': ['american president lines']
         };

         for (const [key, variants] of Object.entries(aliases)) {
             if (normalizedSearch.includes(key) || variants.some(v => normalizedSearch.includes(v))) {
                 // Find the canonical carrier in masterData
                 match = carriers.find((c: any) => 
                     c.carrier_name.toLowerCase().includes(key) || 
                     (c.scac && c.scac.toLowerCase() === key)
                 );
                 if (match) break;
             }
         }
     }

     return match ? match.id : null;
  }
}
