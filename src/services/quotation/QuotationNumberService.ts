export type QuoteNumberConfig = {
  prefix: string;        // e.g., "QT-"
  dateFormat: 'YYYYMM' | 'YYYYMMDD' | 'YYMM' | 'YYYY' | 'NONE';
  separator: '-' | '' | '/' | '.';
  padLength: number;     // e.g., 4 so 0001
  suffix?: string;       // optional suffix like "-A"
};

function pad(n: number, len: number) {
  return String(n).padStart(len, '0');
}

function formatDate(date: Date, fmt: QuoteNumberConfig['dateFormat']) {
  const y = date.getFullYear();
  const yy = String(y).slice(-2);
  const m = pad(date.getMonth() + 1, 2);
  const d = pad(date.getDate(), 2);
  switch (fmt) {
    case 'YYYYMM': return `${y}${m}`;
    case 'YYYYMMDD': return `${y}${m}${d}`;
    case 'YYMM': return `${yy}${m}`;
    case 'YYYY': return `${y}`;
    case 'NONE': default: return '';
  }
}

export const DEFAULT_CONFIG: QuoteNumberConfig = {
  prefix: 'QT',
  dateFormat: 'YYYYMM',
  separator: '-',
  padLength: 4,
};

export class QuotationNumberService {
  static async getConfig(scopedDb: any, tenantId: string): Promise<QuoteNumberConfig> {
    try {
      // Use maybeSingle to avoid 406 on empty result set (PostgREST quirk)
      const { data } = await scopedDb
        .from('quote_number_config_tenant')
        .select('prefix, reset_policy')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (data) {
        return {
          prefix: data.prefix || DEFAULT_CONFIG.prefix,
          // Map legacy/different column names if necessary
          dateFormat: DEFAULT_CONFIG.dateFormat, // Table doesn't store format currently
          separator: DEFAULT_CONFIG.separator,
          padLength: DEFAULT_CONFIG.padLength,
          suffix: '', // Table doesn't store suffix
        };
      }
    } catch {
      // ignore and fall back
    }
    return DEFAULT_CONFIG;
  }

  static preview(config: QuoteNumberConfig, seq: number, at: Date = new Date()): string {
    const parts: string[] = [];
    if (config.prefix) parts.push(config.prefix.replace(/[-/.\s]+$/, ''));
    const datePart = formatDate(at, config.dateFormat);
    if (datePart) parts.push(datePart);
    parts.push(pad(seq, config.padLength));
    const core = parts.join(config.separator);
    return config.suffix ? `${core}${config.suffix}` : core;
  }

  static async isUnique(scopedDb: any, tenantId: string, quoteNumber: string): Promise<boolean> {
    // Try RPC first
    try {
      const { data, error } = await scopedDb.rpc('check_quote_number_availability', { p_quote_number: quoteNumber });
      if (!error && typeof data === 'boolean') return data;
    } catch {
      // ignore
    }

    // Fallback: check count
    const { count, error } = await scopedDb
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('quote_number', quoteNumber);
    
    if (error) {
       // If error on head request, try regular select
       const { data: rows } = await scopedDb
        .from('quotes')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('quote_number', quoteNumber)
        .limit(1);
       return !rows || rows.length === 0;
    }
    
    return count === 0;
  }

  static async generateNext(scopedDb: any, tenantId: string, config: QuoteNumberConfig): Promise<string> {
    const date = new Date();
    // Try server RPC first (for concurrency safety)
    try {
      const { data, error } = await scopedDb.rpc('generate_quote_number', { 
        p_prefix: config.prefix, 
        p_date: date 
      });
      if (!error && data) return data as string;
    } catch {
      // ignore and fallback
    }

    // Fallback: find max existing for this period (not concurrency-safe; use only if RPC not available)
    const datePart = formatDate(date, config.dateFormat);
    const basePrefix = [
      config.prefix.replace(/[-/.\s]+$/, ''),
      datePart,
    ].filter(Boolean).join(config.separator);

    const likePattern = `${basePrefix}${config.separator}%${config.suffix || ''}`;
    const { data: rows } = await scopedDb
      .from('quotes')
      .select('quote_number')
      .eq('tenant_id', tenantId)
      .ilike('quote_number', likePattern)
      .limit(1000);

    let maxSeq = 0;
    for (const r of rows || []) {
      const qn: string = r.quote_number || '';
      // Extract trailing sequence before optional suffix
      const suffix = config.suffix || '';
      const withoutSuffix = suffix && qn.endsWith(suffix) ? qn.slice(0, -suffix.length) : qn;
      const parts = withoutSuffix.split(config.separator);
      const last = parts[parts.length - 1];
      const n = parseInt(last, 10);
      if (!isNaN(n) && n > maxSeq) maxSeq = n;
    }
    const nextSeq = maxSeq + 1;
    return this.preview(config, nextSeq);
  }
}

