
import { supabase } from '@/integrations/supabase/client';
import { ScopedDataAccess } from '@/lib/db/access';
import { Invoice, CreateInvoiceRequest, InvoiceLineItem } from './types';

export const InvoiceService = {
  /**
   * Lists all invoices for the current tenant/franchise scope.
   */
  async listInvoices(
    scopedDb: ScopedDataAccess,
    options?: { pageIndex?: number; pageSize?: number; sortField?: string; sortDirection?: 'asc' | 'desc' }
  ): Promise<{ data: Invoice[]; totalCount: number }> {
    const { pageIndex = 1, pageSize = 10, sortField = 'created_at', sortDirection = 'desc' } = options || {};
    const from = (pageIndex - 1) * pageSize;
    const to = from + pageSize - 1;

    const query = scopedDb
      .from('invoices')
      .select(`
        *,
        customer:customer_id (
          id,
          name,
          email
        )
      `, { count: 'exact' })
      .order(sortField, { ascending: sortDirection === 'asc' })
      .range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;
    return { data: data as Invoice[], totalCount: count || 0 };
  },

  /**
   * Gets a single invoice by ID with line items.
   */
  async getInvoice(id: string, scopedDb: ScopedDataAccess): Promise<Invoice | null> {
    const { data, error } = await scopedDb
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
   * Uses ScopedDataAccess for automatic tenant_id/franchise_id injection.
   */
  async createInvoice(request: CreateInvoiceRequest, scopedDb: ScopedDataAccess): Promise<Invoice> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('User not authenticated');

    const ctx = scopedDb.accessContext;
    const tenantId = ctx.tenantId;
    if (!tenantId) throw new Error('Tenant ID not found in scope context');

    // 1. Get next invoice number
    const { data: nextDocNum, error: seqError } = await scopedDb
      .rpc('get_next_document_number', {
        p_tenant_id: tenantId,
        p_type: 'invoice'
      });

    if (seqError) throw seqError;

    // 2. Create Invoice Header (tenant_id/franchise_id auto-injected by ScopedDataAccess)
    const { data: invoice, error: invError } = await scopedDb
      .from('invoices')
      .insert({
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

      const { error: itemsError } = await scopedDb
        .from('invoice_line_items' as any)
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;
    }

    // 4. Update Invoice Totals
    const { error: updateError } = await scopedDb
        .from('invoices')
        .update({
            subtotal: subtotal,
            tax_total: 0,
            total: subtotal,
            balance_due: subtotal
        })
        .eq('id', invoice.id);

    if (updateError) throw updateError;

    return this.getInvoice(invoice.id, scopedDb) as Promise<Invoice>;
  }
};
