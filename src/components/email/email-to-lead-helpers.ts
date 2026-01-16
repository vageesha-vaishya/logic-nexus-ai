import type { LeadFormData } from "@/components/crm/LeadForm";

export function sanitizeLeadDataForInsert(data: LeadFormData) {
  const { attachments, service_id, ...rest } = data;
  return rest;
}

