export interface CreateInvoiceDTO {
  customerId: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    taxCodeId?: string;
  }[];
  currency: string;
  dueDate: Date;
}

export class InvoiceService {
  /**
   * Creates a draft invoice.
   * Delegates tax calculation to TaxEngine.
   */
  static async createDraft(tenantId: string, dto: CreateInvoiceDTO): Promise<any> {
    // TODO: Implement actual DB persistence
    // TODO: Call TaxEngine.calculate()
    
    console.log(`Creating draft invoice for tenant ${tenantId}`);
    
    return {
      id: 'mock-invoice-id',
      status: 'DRAFT',
      ...dto
    };
  }
}
