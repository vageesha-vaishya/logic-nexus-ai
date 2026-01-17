import type { LeadFormData } from "@/components/crm/LeadForm";
import { cleanEmail } from "@/lib/data-cleaning";

export function sanitizeLeadDataForInsert(data: LeadFormData) {
  const { attachments, service_id, ...rest } = data;
  return rest;
}

export function extractEmailAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = raw.match(/(?:^"?(.*?)"?\s+)?<?([^<\s]+@[^>\s]+)>?/);
  const email = match ? match[2] : raw.trim();
  const cleaned = cleanEmail(email);
  if (cleaned.value) return cleaned.value;
  return null;
}
