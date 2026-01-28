
export interface TelecomPlan {
  id: string;
  name: string;
  type: 'POSTPAID' | 'PREPAID' | 'ENTERPRISE';
  dataLimitGB: number;
  voiceMinutes: number;
  price: number;
  currency: string;
}

export interface Subscriber {
  id: string;
  name: string;
  msisdn: string; // Mobile number
  status: 'ACTIVE' | 'SUSPENDED' | 'BARRED';
  currentPlanId: string;
  dataUsageGB: number;
  voiceUsageMin: number;
}

export interface Device {
  id: string;
  model: string;
  imei: string;
  status: 'IN_USE' | 'IN_STOCK' | 'LOST';
}

export interface TelecomTenantConfig {
  roamingEnabled: boolean;
  fairUsagePolicyGB: number;
  networkPartners: string[];
}

const TENANT_CATALOGS: Record<string, TelecomPlan[]> = {
  'tenant-telecom-1': [ // Consumer Telco
    { id: 'p1', name: 'Basic Starter', type: 'PREPAID', dataLimitGB: 5, voiceMinutes: 100, price: 10, currency: 'USD' },
    { id: 'p2', name: 'Unlimited 5G', type: 'POSTPAID', dataLimitGB: 100, voiceMinutes: 9999, price: 50, currency: 'USD' }
  ],
  'tenant-telecom-2': [ // Enterprise IoT Provider
    { id: 'p3', name: 'IoT Sensor Low', type: 'ENTERPRISE', dataLimitGB: 0.1, voiceMinutes: 0, price: 2, currency: 'EUR' },
    { id: 'p4', name: 'Fleet Tracker', type: 'ENTERPRISE', dataLimitGB: 1, voiceMinutes: 0, price: 5, currency: 'EUR' }
  ]
};

const TENANT_SUBSCRIBERS: Record<string, Subscriber[]> = {
  'tenant-telecom-1': [
    { id: 'sub-1', name: 'Alice', msisdn: '+15550101', status: 'ACTIVE', currentPlanId: 'p2', dataUsageGB: 45.2, voiceUsageMin: 120 },
  ]
};

export class TelecomMockService {
  private static async simulateNetwork(tenantId: string): Promise<void> {
    console.log(`[TelecomMockService] Processing request for Tenant: ${tenantId}`);
    const delay = Math.random() * 300 + 50; 
    await new Promise(resolve => setTimeout(resolve, delay));
    
    if (Math.random() < 0.02) { // 2% packet loss / error
      throw new Error('Network Gateway Unreachable');
    }
  }

  static async getAvailablePlans(tenantId: string): Promise<TelecomPlan[]> {
    await this.simulateNetwork(tenantId);
    return TENANT_CATALOGS[tenantId] || TENANT_CATALOGS['tenant-telecom-1'];
  }

  static async getSubscriberUsage(tenantId: string, msisdn: string): Promise<Subscriber> {
    await this.simulateNetwork(tenantId);
    
    const subscribers = TENANT_SUBSCRIBERS[tenantId] || [];
    const sub = subscribers.find(s => s.msisdn === msisdn);
    
    if (!sub) throw new Error('Subscriber not found');
    return sub;
  }

  static async activateService(tenantId: string, planId: string, msisdn: string): Promise<boolean> {
    await this.simulateNetwork(tenantId);
    
    const plans = await this.getAvailablePlans(tenantId);
    const plan = plans.find(p => p.id === planId);
    if (!plan) throw new Error('Invalid Plan ID for this Tenant');

    console.log(`[TelecomMockService] Activating Plan ${plan.name} for ${msisdn}`);
    return true;
  }
}
