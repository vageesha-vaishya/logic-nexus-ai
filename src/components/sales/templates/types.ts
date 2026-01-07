export interface QuoteTemplate {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  category: string | null;
  content: Record<string, any>;
  is_active: boolean;
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateQuoteTemplateDTO {
  name: string;
  description?: string;
  category?: string;
  content: Record<string, any>;
  is_active?: boolean;
}

export interface UpdateQuoteTemplateDTO {
  name?: string;
  description?: string;
  category?: string;
  content?: Record<string, any>;
  is_active?: boolean;
}
