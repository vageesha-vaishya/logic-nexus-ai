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
