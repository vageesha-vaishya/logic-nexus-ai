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
