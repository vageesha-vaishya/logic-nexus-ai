import { BillingDocument, InvoiceRecord } from '../../types/crm.types';

type BillingFormatter = {
  readonly format: string;
  readonly templateVersion: string;
  supports: (domainCode: string) => boolean;
  build: (invoice: InvoiceRecord) => BillingDocument;
};

class LogisticsBillingFormatter implements BillingFormatter {
  readonly format = 'logistics';
  readonly templateVersion = 'v1';

  supports(domainCode: string): boolean {
    return domainCode === 'LOGISTICS';
  }

  build(invoice: InvoiceRecord): BillingDocument {
    const metadata = (invoice.metadata || {}) as Record<string, unknown>;
    return {
      format: this.format,
      templateVersion: this.templateVersion,
      summary: {
        invoiceNumber: invoice.invoice_number,
        status: invoice.status,
        issueDate: invoice.issue_date,
        dueDate: invoice.due_date
      },
      sections: [
        {
          title: 'Freight Charges',
          fields: {
            shipmentId: typeof metadata.shipment_id === 'string' ? metadata.shipment_id : null,
            mode: typeof metadata.mode === 'string' ? metadata.mode : null,
            incoterm: typeof metadata.incoterm === 'string' ? metadata.incoterm : null
          }
        }
      ]
    };
  }
}

class BankingBillingFormatter implements BillingFormatter {
  readonly format = 'banking';
  readonly templateVersion = 'v1';

  supports(domainCode: string): boolean {
    return domainCode === 'BANKING';
  }

  build(invoice: InvoiceRecord): BillingDocument {
    const metadata = (invoice.metadata || {}) as Record<string, unknown>;
    return {
      format: this.format,
      templateVersion: this.templateVersion,
      summary: {
        invoiceNumber: invoice.invoice_number,
        status: invoice.status,
        issueDate: invoice.issue_date,
        dueDate: invoice.due_date
      },
      sections: [
        {
          title: 'Loan Charges',
          fields: {
            loanAccountId: typeof metadata.loan_account_id === 'string' ? metadata.loan_account_id : null,
            billingCycle: typeof metadata.billing_cycle === 'string' ? metadata.billing_cycle : null,
            interestPlan: typeof metadata.interest_plan === 'string' ? metadata.interest_plan : null
          }
        }
      ]
    };
  }
}

class TelecomBillingFormatter implements BillingFormatter {
  readonly format = 'telecom';
  readonly templateVersion = 'v1';

  supports(domainCode: string): boolean {
    return domainCode === 'TELECOM';
  }

  build(invoice: InvoiceRecord): BillingDocument {
    const metadata = (invoice.metadata || {}) as Record<string, unknown>;
    return {
      format: this.format,
      templateVersion: this.templateVersion,
      summary: {
        invoiceNumber: invoice.invoice_number,
        status: invoice.status,
        issueDate: invoice.issue_date,
        dueDate: invoice.due_date
      },
      sections: [
        {
          title: 'Subscription Charges',
          fields: {
            subscriptionId: typeof metadata.subscription_id === 'string' ? metadata.subscription_id : null,
            planCode: typeof metadata.plan_code === 'string' ? metadata.plan_code : null,
            usageWindow: typeof metadata.usage_window === 'string' ? metadata.usage_window : null
          }
        }
      ]
    };
  }
}

class GenericBillingFormatter implements BillingFormatter {
  readonly format = 'generic';
  readonly templateVersion = 'v1';

  supports(): boolean {
    return true;
  }

  build(invoice: InvoiceRecord): BillingDocument {
    return {
      format: this.format,
      templateVersion: this.templateVersion,
      summary: {
        invoiceNumber: invoice.invoice_number,
        status: invoice.status,
        issueDate: invoice.issue_date,
        dueDate: invoice.due_date
      },
      sections: [
        {
          title: 'General Charges',
          fields: {
            tenantId: invoice.tenant_id,
            franchiseId: invoice.franchise_id
          }
        }
      ]
    };
  }
}

export class BillingEngineService {
  private formatters: BillingFormatter[] = [];

  constructor() {
    this.registerFormatter(new LogisticsBillingFormatter());
    this.registerFormatter(new BankingBillingFormatter());
    this.registerFormatter(new TelecomBillingFormatter());
    this.registerFormatter(new GenericBillingFormatter());
  }

  registerFormatter(formatter: BillingFormatter): void {
    this.formatters.push(formatter);
  }

  generate(domainCode: string, invoice: InvoiceRecord): BillingDocument {
    const normalizedDomainCode = domainCode.toUpperCase();
    const formatter =
      this.formatters.find((candidate) => candidate.supports(normalizedDomainCode)) ||
      this.formatters[this.formatters.length - 1];
    return formatter.build(invoice);
  }
}
