export type QuotationEnvironmentName = 'dev' | 'staging' | 'production';

export interface QuotationEnvironmentConfig {
  name: QuotationEnvironmentName;
  baseUrl: string;
  apiUrlPattern: string;
  useMockApi: boolean;
  adminEmail: string;
  adminPassword: string;
}

const envName = (process.env.PLAYWRIGHT_ENV as QuotationEnvironmentName) || 'dev';

const resolveBaseUrl = () => {
  if (process.env.PLAYWRIGHT_BASE_URL) return process.env.PLAYWRIGHT_BASE_URL;
  if (process.env.BASE_URL) return process.env.BASE_URL;
  return 'http://localhost:8081';
};

const configs: Record<QuotationEnvironmentName, QuotationEnvironmentConfig> = {
  dev: {
    name: 'dev',
    baseUrl: resolveBaseUrl(),
    apiUrlPattern: '**/rest/v1/**',
    useMockApi: process.env.PLAYWRIGHT_USE_MOCK_API !== 'false',
    adminEmail: process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com',
    adminPassword: process.env.E2E_ADMIN_PASSWORD ?? 'changeme',
  },
  staging: {
    name: 'staging',
    baseUrl: resolveBaseUrl(),
    apiUrlPattern: '**/rest/v1/**',
    useMockApi: process.env.PLAYWRIGHT_USE_MOCK_API === 'true',
    adminEmail: process.env.E2E_ADMIN_EMAIL ?? '',
    adminPassword: process.env.E2E_ADMIN_PASSWORD ?? '',
  },
  production: {
    name: 'production',
    baseUrl: resolveBaseUrl(),
    apiUrlPattern: '**/rest/v1/**',
    useMockApi: process.env.PLAYWRIGHT_USE_MOCK_API === 'true',
    adminEmail: process.env.E2E_ADMIN_EMAIL ?? '',
    adminPassword: process.env.E2E_ADMIN_PASSWORD ?? '',
  },
};

export const quotationEnvConfig = configs[envName];
