import type { LeadFormData } from "@/components/crm/LeadForm";
import { cleanEmail } from "@/lib/data-cleaning";

export function sanitizeLeadDataForInsert(data: LeadFormData) {
  const { attachments, service_id, ...rest } = data;
  
  // Handle numeric fields that might be empty strings
  // Convert empty string to null, otherwise parse as float (removing commas)
  let estimated_value = null;
  if (rest.estimated_value !== "" && rest.estimated_value !== undefined && rest.estimated_value !== null) {
    const valStr = String(rest.estimated_value).replace(/,/g, '');
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed)) {
      estimated_value = parsed;
    }
  }

  return {
    ...rest,
    estimated_value,
  };
}

export function extractEmailAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = raw.match(/(?:^"?(.*?)"?\s+)?<?([^<\s]+@[^>\s]+)>?/);
  const email = match ? match[2] : raw.trim();
  const cleaned = cleanEmail(email);
  if (cleaned.value) return cleaned.value;
  return null;
}

export interface TransportOption {
  seqNo: string;
  mode: string;
  price: string;
  transitTime: string;
  bestFor: string;
  interchangePoints: string;
  logic: string;
}

export function parseTransportOptionsJSON(text: string): TransportOption[] {
    text = text.trim();
    // Try to extract JSON if it's wrapped in code blocks
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
    if (jsonMatch) {
        text = jsonMatch[1];
    }

    let parsedData;
    try {
        parsedData = JSON.parse(text);
    } catch (e) {
        // Fallback: try to find the first [ and last ]
        const firstBracket = text.indexOf('[');
        const lastBracket = text.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket !== -1) {
            const jsonArray = text.substring(firstBracket, lastBracket + 1);
            try {
                parsedData = { options: JSON.parse(jsonArray) };
            } catch (innerErr) {
                 // Try finding { "options": ... }
                 const firstBrace = text.indexOf('{');
                 const lastBrace = text.lastIndexOf('}');
                 if (firstBrace !== -1 && lastBrace !== -1) {
                     const jsonObject = text.substring(firstBrace, lastBrace + 1);
                     parsedData = JSON.parse(jsonObject);
                 } else {
                     throw new Error("Could not parse JSON response");
                 }
            }
        } else {
             // Try finding { "options": ... }
             const firstBrace = text.indexOf('{');
             const lastBrace = text.lastIndexOf('}');
             if (firstBrace !== -1 && lastBrace !== -1) {
                 const jsonObject = text.substring(firstBrace, lastBrace + 1);
                 parsedData = JSON.parse(jsonObject);
             } else {
                 throw new Error("Could not parse JSON response");
             }
        }
    }

    const options = Array.isArray(parsedData) ? parsedData : (parsedData.options || []);
    
    if (Array.isArray(options)) {
        return options;
    } else {
        throw new Error("Response format invalid: expected array of options");
    }
}

export function extractMaxPrice(priceText: string): number | null {
  if (!priceText) return null;
  const normalized = priceText.replace(/[,₹\s]/g, '');
  const parts = normalized.split(/–|-|to/i);
  const numbers = parts
    .map(p => parseFloat(p.replace(/[^\d.]/g, '')))
    .filter(n => !isNaN(n));
  if (numbers.length === 0) return null;
  return Math.max(...numbers);
}

export function computeLeadScoreClient(input: {
  status?: string;
  estimated_value?: number | null;
  source?: string;
  last_activity_date?: string | null;
}): number {
  let total = 0;
  const status = (input.status || '').toLowerCase();
  switch (status) {
    case 'qualified': total += 30; break;
    case 'contacted': total += 20; break;
    case 'proposal': total += 40; break;
    case 'negotiation': total += 50; break;
    case 'new': total += 10; break;
    default: total += 0;
  }
  const val = input.estimated_value ?? null;
  if (val !== null) {
    if (val >= 100000) total += 30;
    else if (val >= 50000) total += 20;
    else if (val >= 10000) total += 10;
    else total += 5;
  }
  const source = (input.source || '').toLowerCase();
  switch (source) {
    case 'referral': total += 15; break;
    case 'website': total += 10; break;
    case 'event': total += 12; break;
    default: total += 5;
  }
  if (input.last_activity_date) {
    try {
      const last = new Date(input.last_activity_date);
      const now = new Date();
      const diffDays = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays <= 7) total += 15;
      else if (diffDays <= 30) total += 10;
    } catch {
      // ignore parse errors
    }
  }
  return total;
}
