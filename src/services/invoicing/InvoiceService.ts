
import { supabase } from '@/integrations/supabase/client';
import { Invoice, CreateInvoiceRequest, InvoiceItem, InvoiceStatus } from './types';
import { TaxEngine } from '../taxation/TaxEngine';
import { GLSyncService } from '../gl/GLSyncService';

export const InvoiceService = {
  /**
   * Generates a unique invoice number.
   * Format: INV-{YYYYMMDD}-{RANDOM}
   */
  generateInvoiceNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INV-${date}-${random}`;
  },

  /**
   * Creates a new invoice with line items.
   * Calculates totals and taxes automatically.
   */
  async createInvoice(request: CreateInvoiceRequest): Promise<Invoice> {
    // 0. Authenticate and get Tenant ID
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) throw new Error('User not authenticated');

    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('tenant_id')
      .eq('user_id', userData.user.id)
      .single();

    if (roleError || !userRole) {
       throw new Error('Could not determine tenant_id for user');
    }
    const tenantId = userRole.tenant_id;

    // 1. Calculate items and totals
    let subtotal = 0;
    
    // Prepare items for tax calculation
    const itemsWithIds = request.items.map((item, index) => ({
      ...item,
      tempId: index.toString(),
      amount: item.quantity * item.unit_price
    }));

    // Calculate Subtotal
    subtotal = itemsWithIds.reduce((sum, item) => sum + item.amount, 0);

    // 2. Determine Nexus & Calculate Tax
    let taxTotal = 0;
    const itemTaxMap: Record<string, number> = {}; // tempId -> totalTax

    // Initialize tax map
    itemsWithIds.forEach(item => itemTaxMap[item.tempId] = 0);

    const nexusResult = await TaxEngine.determineNexus({
      origin: request.origin_address,
      destination: request.destination_address,
      tenantId: tenantId
    });

    if (nexusResult.hasNexus) {
      for (const jurisdiction of nexusResult.jurisdictions) {
        const taxResult = await TaxEngine.calculate({
          jurisdictionCode: jurisdiction,
          items: itemsWithIds.map(item => ({
            id: item.tempId,
            amount: item.amount,
            taxCode: item.tax_code_id
          }))
        });

        // Accumulate taxes per item
        if (taxResult.lineItems) {
            taxResult.lineItems.forEach(lineItem => {
                if (lineItem.id && itemTaxMap[lineItem.id] !== undefined) {
                    itemTaxMap[lineItem.id] += lineItem.taxAmount;
                }
            });
        }
      }
    }

    // Sum up total tax from items
    taxTotal = Object.values(itemTaxMap).reduce((sum, tax) => sum + tax, 0);

    // 3. Prepare Invoice Items for Insertion
    const calculatedItems = itemsWithIds.map(item => {
      const taxAmount = itemTaxMap[item.tempId];
      const totalAmount = item.amount + taxAmount;
      
      return {
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_code_id: item.tax_code_id || null,
        tax_amount: taxAmount,
        total_amount: totalAmount
      };
    });

    const totalAmount = subtotal + taxTotal;
    const invoiceNumber = this.generateInvoiceNumber();

    const invoiceInsert = {
      tenant_id: tenantId,
      customer_id: request.customer_id,
      invoice_number: invoiceNumber,
      status: 'DRAFT' as InvoiceStatus,
      issue_date: request.issue_date.toISOString(),
      due_date: request.due_date.toISOString(),
      currency: request.currency,
      subtotal,
      tax_total: taxTotal,
      total_amount: totalAmount,
      metadata: request.metadata || {}
    };

    const { data: invoice, error: invoiceError } = await supabase
      .schema('finance')
      .from('invoices')
      .insert(invoiceInsert)
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    // 3. Insert Invoice Items
    const itemsInsert = calculatedItems.map(item => ({
      invoice_id: invoice.id,
      ...item
    }));

    const { data: items, error: itemsError } = await supabase
      .schema('finance')
      .from('invoice_items')
      .insert(itemsInsert)
      .select();

    if (itemsError) {
      // Rollback invoice? Supabase doesn't support transactions in JS client easily.
      // We would log error.
      console.error('Failed to insert invoice items', itemsError);
      throw itemsError;
    }

    return {
      ...invoice,
      items: items as InvoiceItem[]
    } as Invoice;
  },

  /**
   * Get a single invoice by ID
   */
  async getInvoice(id: string): Promise<Invoice | null> {
    const { data, error } = await supabase
      .schema('finance')
      .from('invoices')
      .select(`
        *,
        items:invoice_items(*)
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
   * List invoices for the current tenant
   */
  async listInvoices(limit = 20, offset = 0): Promise<Invoice[]> {
    const { data, error } = await supabase
      .schema('finance')
      .from('invoices')
      .select('*')
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Invoice[];
  },

  /**
   * Finalizes an invoice (Draft -> Sent) and triggers GL sync.
   */
  async finalizeInvoice(id: string): Promise<Invoice> {
    // 1. Update status
    const { data: invoice, error } = await supabase
      .schema('finance')
      .from('invoices')
      .update({ status: 'SENT' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // 2. Trigger Async GL Sync
    // Note: We don't await this so it runs in background
    GLSyncService.syncTransaction(invoice.tenant_id, invoice.id, 'INVOICE')
        .catch(err => console.error('Background GL Sync failed', err));

    return invoice as Invoice;
  }
};
