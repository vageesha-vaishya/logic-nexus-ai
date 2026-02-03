
import { Address } from '../taxation/types';

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'partial' | 'void' | 'overdue' | 'cancelled';
export type InvoiceType = 'standard' | 'proforma' | 'credit_note' | 'debit_note';

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number; // Generated in DB, read-only
  type?: string;
  tax_rate: number;
  tax_amount: number;
  charge_id?: string | null;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface Invoice {
  id: string;
  tenant_id: string;
  invoice_number: string;
  customer_id?: string | null;
  shipment_id?: string | null;
  status: InvoiceStatus;
  type: InvoiceType;
  issue_date: string; // YYYY-MM-DD
  due_date?: string | null; // YYYY-MM-DD
  currency: string;
  exchange_rate: number;
  
  subtotal: number;
  tax_total: number;
  total: number;
  balance_due: number;
  
  notes?: string | null;
  terms?: string | null;
  
  billing_address?: Record<string, any> | null;
  shipping_address?: Record<string, any> | null;
  
  metadata?: Record<string, any> | null;
  
  // Relations
  invoice_line_items?: InvoiceLineItem[];
  customer?: {
    id: string;
    name: string;
    email?: string;
  };
  
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateInvoiceRequest {
  customer_id: string;
  shipment_id?: string;
  issue_date: Date;
  due_date: Date;
  currency: string;
  items: {
    description: string;
    quantity: number;
    unit_price: number;
    tax_code_id?: string;
    charge_id?: string;
    metadata?: Record<string, any>;
  }[];
  metadata?: Record<string, any>;
}
