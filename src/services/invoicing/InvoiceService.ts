
import { supabase } from '@/integrations/supabase/client';
import { Invoice, CreateInvoiceRequest, InvoiceLineItem } from './types';

export const InvoiceService = {
  /**
   * Lists all invoices for the current tenant.
   */
  async listInvoices(): Promise<Invoice[]> {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        customer:customer_id (
          id,
          name,
          email
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Invoice[];
  },

  /**
   * Gets a single invoice by ID with line items.
   */
  async getInvoice(id: string): Promise<Invoice | null> {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        invoice_line_items (*),
        customer:customer_id (
          id,
          name,
          email
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data as Invoice;
  },

  /**
   * Creates a new invoice manually (without shipment).
   * Note: This assumes the user has permission to create invoices.
   */
  async createInvoice(request: CreateInvoiceRequest): Promise<Invoice> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('User not authenticated');

    // Get Tenant ID
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('tenant_id')
      .eq('user_id', userData.user.id)
      .single();

    if (!userRole?.tenant_id) throw new Error('Tenant ID not found');
    const tenantId = userRole.tenant_id;

    // 1. Get next invoice number
    const { data: nextDocNum, error: seqError } = await supabase
      .rpc('get_next_document_number', {
        p_tenant_id: tenantId,
        p_type: 'invoice'
      });
    
    if (seqError) throw seqError;

    // 2. Create Invoice Header
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .insert({
        tenant_id: tenantId,
        invoice_number: nextDocNum,
        customer_id: request.customer_id,
        shipment_id: request.shipment_id,
        issue_date: request.issue_date.toISOString(),
        due_date: request.due_date.toISOString(),
        currency: request.currency,
        created_by: userData.user.id
      })
      .select()
      .single();

    if (invError) throw invError;

    // 3. Create Line Items and Calculate Totals
    let subtotal = 0;
    
    if (request.items.length > 0) {
      const itemsToInsert = request.items.map(item => {
        const amount = item.quantity * item.unit_price;
        subtotal += amount;
        return {
          invoice_id: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          charge_id: item.charge_id
        };
      });

      const { error: itemsError } = await supabase
        .from('invoice_line_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;
    }

    // 4. Update Invoice Totals (since no trigger on line_items yet)
    // Note: tax_total is 0 for now until tax engine is integrated
    const { error: updateError } = await supabase
        .from('invoices')
        .update({
            subtotal: subtotal,
            tax_total: 0,
            total: subtotal,
            balance_due: subtotal
        })
        .eq('id', invoice.id);
    
    if (updateError) throw updateError;
    
    return this.getInvoice(invoice.id) as Promise<Invoice>;
  }
};
