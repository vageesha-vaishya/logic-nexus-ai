
export interface BankingAccount {
  accountId: string;
  accountNumber: string;
  type: 'CHECKING' | 'SAVINGS' | 'LOAN';
  currency: string;
  balance: number;
  status: 'ACTIVE' | 'FROZEN' | 'CLOSED';
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  type: 'DEBIT' | 'CREDIT';
}

export interface LoanApplication {
  id: string;
  applicantName: string;
  amount: number;
  termMonths: number;
  purpose: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  interestRate?: number;
}

// Tenant Configuration Types
export interface BankingTenantConfig {
  riskThresholds: {
    minCreditScore: number;
    maxLoanAmount: number;
  };
  supportedCurrencies: string[];
  features: {
    instantTransfer: boolean;
    internationalWire: boolean;
  };
}

// Mock Data Store per Tenant
const TENANT_DATA: Record<string, { accounts: BankingAccount[]; transactions: Transaction[] }> = {
  'tenant-banking-1': { // Retail Bank
    accounts: [
      { accountId: 'acc-1', accountNumber: '1001001', type: 'CHECKING', currency: 'USD', balance: 5000, status: 'ACTIVE' },
      { accountId: 'acc-2', accountNumber: '1001002', type: 'SAVINGS', currency: 'USD', balance: 12000, status: 'ACTIVE' },
    ],
    transactions: [
      { id: 'tx-1', date: '2023-10-01', amount: 1000, description: 'Direct Deposit', type: 'CREDIT' },
      { id: 'tx-2', date: '2023-10-02', amount: 50, description: 'Grocery Store', type: 'DEBIT' },
    ]
  },
  'tenant-banking-2': { // Investment Bank
    accounts: [
      { accountId: 'acc-3', accountNumber: '9001001', type: 'CHECKING', currency: 'EUR', balance: 150000, status: 'ACTIVE' },
    ],
    transactions: []
  }
};

const TENANT_CONFIGS: Record<string, BankingTenantConfig> = {
  'tenant-banking-1': {
    riskThresholds: { minCreditScore: 600, maxLoanAmount: 50000 },
    supportedCurrencies: ['USD'],
    features: { instantTransfer: true, internationalWire: false }
  },
  'tenant-banking-2': {
    riskThresholds: { minCreditScore: 750, maxLoanAmount: 1000000 },
    supportedCurrencies: ['USD', 'EUR', 'GBP'],
    features: { instantTransfer: true, internationalWire: true }
  }
};

export class BankingMockService {
  /**
   * Simulates network delay and random failures
   */
  private static async simulateNetwork(tenantId: string): Promise<void> {
    console.log(`[BankingMockService] Processing request for Tenant: ${tenantId}`);
    const delay = Math.random() * 500 + 100; // 100-600ms delay
    await new Promise(resolve => setTimeout(resolve, delay));

    if (Math.random() < 0.05) { // 5% failure rate
      throw new Error('Banking Core System Timeout');
    }
  }

  static async getAccountBalance(tenantId: string, accountId: string): Promise<BankingAccount> {
    await this.simulateNetwork(tenantId);
    
    const data = TENANT_DATA[tenantId];
    if (!data) throw new Error('Tenant Banking System Not Found');

    const account = data.accounts.find(a => a.accountId === accountId);
    if (!account) throw new Error('Account not found');

    return account;
  }

  static async applyForLoan(tenantId: string, application: Omit<LoanApplication, 'id' | 'status'>): Promise<LoanApplication> {
    await this.simulateNetwork(tenantId);

    const config = TENANT_CONFIGS[tenantId] || TENANT_CONFIGS['tenant-banking-1'];
    
    // Simulate Risk Engine
    let status: LoanApplication['status'] = 'APPROVED';
    let interestRate = 5.5;

    if (application.amount > config.riskThresholds.maxLoanAmount) {
      status = 'REJECTED';
      console.warn(`[BankingMockService] Loan rejected: Amount ${application.amount} exceeds tenant limit ${config.riskThresholds.maxLoanAmount}`);
    } else {
      // Basic mock logic: Higher amount = higher rate
      interestRate += (application.amount / 10000) * 0.1;
    }

    return {
      id: `loan-${Date.now()}`,
      ...application,
      status,
      interestRate: status === 'APPROVED' ? Number(interestRate.toFixed(2)) : undefined
    };
  }

  static async transferFunds(tenantId: string, fromId: string, toId: string, amount: number): Promise<boolean> {
    await this.simulateNetwork(tenantId);

    const data = TENANT_DATA[tenantId];
    if (!data) throw new Error('Tenant System Not Initialized');

    const fromAcc = data.accounts.find(a => a.accountId === fromId);
    if (!fromAcc) throw new Error('Source Account Invalid');

    if (fromAcc.balance < amount) {
      throw new Error('Insufficient Funds');
    }

    fromAcc.balance -= amount;
    // In a real mock, we'd update the destination too if it exists in the same tenant
    // or simulate an external transfer
    
    return true;
  }
}
