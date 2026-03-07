
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
    
    // 1. Group by Carrier + Service Level
    options.forEach((opt: any) => {
        const carrier = opt.carrier || "Multi-Carrier";
        const transit = opt.transit_time || "N/A";
        const freq = opt.frequency || "N/A";
        const key = `${carrier}|${transit}|${freq}`;
        
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(opt);
    });

    const result: MatrixGroup[] = [];

    for (const [key, opts] of groups) {
        const firstOpt = opts[0];
        const carrier = firstOpt.carrier || "Multi-Carrier";
        const transit = firstOpt.transit_time || "N/A";
        const frequency = firstOpt.frequency || "N/A";
        const routing = firstOpt.legs || [];

        // 2. Collect Container Types
        const containerTypes = new Set<string>();
        opts.forEach((o: any) => {
            const ct = o.container_size || o.container_type || "Standard";
            containerTypes.add(ct);
        });
        const sortedContainers = Array.from(containerTypes).sort();

        // 3. Map Charges
        const chargeMap = new Map<string, Map<string, number>>(); 
        const chargeNoteMap = new Map<string, string>();

        opts.forEach((o: any) => {
            const ct = o.container_size || o.container_type || "Standard";
            const charges = o.charges || [];
            charges.forEach((c: any) => {
                const desc = c.description || c.charge_name || c.name || "Charge";
                if (!chargeMap.has(desc)) chargeMap.set(desc, new Map());
                const current = chargeMap.get(desc)!.get(ct) || 0;
                chargeMap.get(desc)!.set(ct, current + (Number(c.amount) || 0));
                
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
