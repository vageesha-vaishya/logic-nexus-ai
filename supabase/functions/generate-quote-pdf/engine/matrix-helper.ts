
export interface MatrixGroup {
  key: string;
  carrier: string;
  transit: string;
  frequency: string;
  options: any[];
  containerTypes: string[];
  chargeMap: Map<string, Map<string, number>>;
  chargeNoteMap: Map<string, string>;
  routing: any[];
}

export function groupOptionsForMatrix(options: any[]): MatrixGroup[] {
    const groups = new Map<string, any[]>();
    const hasOptionScopedGrouping = options.some((opt: any) =>
      Boolean(opt?.rate_option_id || opt?.option_group_key || opt?.option_name || opt?.rate_option_name)
    );
    
    // 1. Group by Carrier + Service Level
    options.forEach((opt: any) => {
        // Safe access for Carrier
        let carrier = opt.carrier;
        if (!carrier && opt.carriers && typeof opt.carriers === 'object') {
            carrier = opt.carriers.carrier_name; // From relation
        }
        if (!carrier && Array.isArray(opt.legs) && opt.legs.length > 0) {
            // Try to find first leg with carrier
            const mainLeg = opt.legs.find((l: any) => l.mode === 'Ocean' || l.mode === 'Air') || opt.legs[0];
            carrier = mainLeg.carrier_name || mainLeg.carrier;
        }
        carrier = carrier || "Multi-Carrier";

        // Safe access for Transit Time
        let transit = opt.transit_time;
        if (!transit && Array.isArray(opt.legs) && opt.legs.length > 0) {
             const mainLeg = opt.legs.find((l: any) => l.mode === 'Ocean' || l.mode === 'Air') || opt.legs[0];
             transit = mainLeg.transit_time;
        }
        transit = transit || "";

        // Safe access for Frequency
        let freq = opt.frequency;
        if (!freq && Array.isArray(opt.legs) && opt.legs.length > 0) {
             const mainLeg = opt.legs.find((l: any) => l.mode === 'Ocean' || l.mode === 'Air') || opt.legs[0];
             freq = mainLeg.frequency;
        }
        freq = freq || "";

        const optionScope =
          opt.rate_option_id ||
          opt.option_group_key ||
          opt.option_name ||
          opt.rate_option_name ||
          "";
        const key = hasOptionScopedGrouping
          ? `${optionScope}|${carrier}|${transit}|${freq}`
          : `${carrier}|${transit}|${freq}`;
        
        // Store derived values on the option for later use if needed, 
        // or just rely on the group key. 
        // We'll attach them to the option temporarily to ensure consistency in step 2.
        opt._derived_carrier = carrier;
        opt._derived_transit = transit;
        opt._derived_frequency = freq;
        
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(opt);
    });

    const result: MatrixGroup[] = [];

    for (const [key, opts] of groups) {
        const firstOpt = opts[0];
        const carrier = firstOpt._derived_carrier || "Multi-Carrier";
        const transit = firstOpt._derived_transit || "";
        const frequency = firstOpt._derived_frequency || "";
        const routing = firstOpt.legs || [];

        // 2. Collect Container Types
        const containerTypes = new Set<string>();
        opts.forEach((o: any) => {
            let ct = o.container_size || o.container_type;
            
            // Fallback to relations
            if (!ct && o.container_sizes && typeof o.container_sizes === 'object') {
                ct = o.container_sizes.code || o.container_sizes.name;
            }
            if (!ct && o.container_types && typeof o.container_types === 'object') {
                ct = o.container_types.code || o.container_types.name;
            }
            
            ct = ct || "Standard";
            containerTypes.add(ct);
            
            // Store derived container type for step 3
            o._derived_container_type = ct;
        });
        
        // Custom Sort Order for MGL
        const sortOrder = [
            "Standard - 20'",
            "Open Top - 40'",
            "Flat Rack - 40'",
            "Flat Rack collapsible - 20'",
            "Platform - 20'",
            "High Cube - 45"
        ];
        
        const sortedContainers = Array.from(containerTypes).sort((a, b) => {
            const idxA = sortOrder.indexOf(a);
            const idxB = sortOrder.indexOf(b);
            
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            
            return a.localeCompare(b);
        });

        // 3. Map Charges
        const chargeMap = new Map<string, Map<string, number>>(); 
        const chargeNoteMap = new Map<string, string>();

        opts.forEach((o: any) => {
            const ct = o._derived_container_type || "Standard";
            const charges = o.charges || [];
            charges.forEach((c: any) => {
                const desc = c.description || c.charge_name || c.name || c.desc || "Charge";
                if (!chargeMap.has(desc)) chargeMap.set(desc, new Map());
                const current = chargeMap.get(desc)!.get(ct) || 0;
                
                const amount = Number(c.amount) || Number(c.total) || 0;
                chargeMap.get(desc)!.set(ct, current + amount);
                
                if (c.note) {
                     chargeNoteMap.set(desc, c.note);
                }
            });
        });

        result.push({
            key,
            carrier,
            transit,
            frequency,
            options: opts,
            containerTypes: sortedContainers,
            chargeMap,
            chargeNoteMap,
            routing
        });
    }

    return result;
}
