import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock localStorage
const localStorageMock = (function() {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    length: 0,
    key: vi.fn((index: number) => "")
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock ResizeObserver
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver;

// ---------------------------------------------------------------------------
// Global mocks for hooks and services used pervasively across components.
// Individual test files can override these with their own vi.mock() calls.
// ---------------------------------------------------------------------------

const mockSupabaseChain = () => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  abortSignal: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  then: vi.fn((cb: any) => cb({ data: [], error: null })),
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => mockSupabaseChain()),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: vi.fn().mockResolvedValue({ data: null, error: null }),
      signUp: vi.fn().mockResolvedValue({ data: null, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
  isSupabaseConfigured: true,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    session: { access_token: 'test-token' },
    profile: { id: 'test-user-id', first_name: 'Test', last_name: 'User', email: 'test@example.com' },
    roles: [],
    permissions: [],
    loading: false,
    signIn: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    hasRole: vi.fn().mockReturnValue(false),
    hasPermission: vi.fn().mockReturnValue(false),
    isPlatformAdmin: vi.fn().mockReturnValue(false),
    isTenantAdmin: vi.fn().mockReturnValue(false),
    isFranchiseAdmin: vi.fn().mockReturnValue(false),
    refreshProfile: vi.fn().mockResolvedValue(undefined),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    context: {
      userId: 'test-user-id',
      tenantId: 'test-tenant-id',
      franchiseId: null,
      isPlatformAdmin: false,
      isTenantAdmin: false,
      adminOverrideEnabled: false,
    },
    supabase: {
      from: vi.fn(() => mockSupabaseChain()),
      channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
      removeChannel: vi.fn(),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    scopedDb: {
      from: vi.fn(() => mockSupabaseChain()),
    },
    preferences: { tenant_id: 'test-tenant-id', franchise_id: null, admin_override_enabled: false },
    loadingPreferences: false,
    setScopePreference: vi.fn().mockResolvedValue(undefined),
    setAdminOverride: vi.fn().mockResolvedValue(undefined),
    setFranchisePreference: vi.fn().mockResolvedValue(undefined),
  }),
  CRMProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/contexts/DomainContext', () => ({
  useDomain: () => ({
    currentDomain: { id: 'test-domain', code: 'LOGISTICS', name: 'Logistics', description: 'Logistics domain' },
    setDomain: vi.fn().mockResolvedValue(undefined),
    availableDomains: [{ id: 'test-domain', code: 'LOGISTICS', name: 'Logistics', description: 'Logistics domain' }],
    isLoading: false,
  }),
  DomainContextProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (str: string) => str,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

afterEach(() => {
  cleanup();
});
