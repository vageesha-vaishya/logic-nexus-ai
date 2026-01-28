
import { Address } from '../taxation/types';

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'VOID' | 'OVERDUE';

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_code_id?: string | null;
  tax_amount: number;
  total_amount: number;
  created_at?: string;
}

export interface Invoice {
  id: string;
  tenant_id: string;
  customer_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  currency: string;
  subtotal: number;
  tax_total: number;
  total_amount: number;
  metadata?: Record<string, any> | null;
  items?: InvoiceItem[];
  created_at?: string;
  updated_at?: string;
}

export interface CreateInvoiceRequest {
  customer_id: string;
  origin_address: Address;
  destination_address: Address;
  issue_date: Date;
  due_date: Date;
  currency: string;
  items: {
    description: string;
    quantity: number;
    unit_price: number;
    tax_code_id?: string;
  }[];
  metadata?: Record<string, any>;
}
