
export type DebugLevel = 'platform' | 'app' | 'module' | 'form';
export type Environment = 'development' | 'staging' | 'production';

export interface NetworkDebugConfig {
  captureRequestHeaders: boolean;
  captureRequestBody: boolean;
  captureResponseHeaders: boolean;
  captureResponseBody: boolean;
  maxPayloadSize: number; // Max characters to capture
  urlPatterns: string[]; // Regex strings
  ignoredUrls: string[]; // Regex strings
}

export interface DebugConfig {
  enabled: boolean;
  environment: Environment;
  modules: Record<string, boolean>; // Deprecated: Use scopes
  forms: Record<string, boolean>;   // Deprecated: Use scopes
  scopes: Record<string, boolean>;  // Unified hierarchy: "Module:SubModule:Form:Section"
  network: NetworkDebugConfig;
  logRetention: number; // in entries, for in-memory log
}

const DEFAULT_CONFIG: DebugConfig = {
  enabled: false, // Default to false for performance
  environment: 'production',
  modules: {},
  forms: {},
  scopes: {},
  network: {
    captureRequestHeaders: false,
    captureRequestBody: false,
    captureResponseHeaders: false,
    captureResponseBody: false,
    maxPayloadSize: 5000, // Default 5KB limit
    urlPatterns: ['.*'], // Match all by default if enabled
    ignoredUrls: ['system_logs', 'ingest.sentry.io', 'heartbeat'],
  },
  logRetention: 1000,
};

class DebugStore {
  private static instance: DebugStore;
  private config: DebugConfig;
  private listeners: Set<() => void> = new Set();
  private memoryLogs: any[] = [];

  private constructor() {
    // Load from localStorage if available
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('debug_config') : null;
    this.config = saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG;
    
    // Ensure scopes object exists (migration)
    if (!this.config.scopes) {
      this.config.scopes = {};
      // Migrate legacy modules/forms
      Object.entries(this.config.modules || {}).forEach(([k, v]) => {
        this.config.scopes[k] = v;
      });
      Object.entries(this.config.forms || {}).forEach(([k, v]) => {
        // Try to find if this form belongs to a module? No context here.
        // Just add as top level or we rely on new registrations.
        // We'll leave it flat for now.
        if (!this.config.scopes[k]) this.config.scopes[k] = v;
      });
    }

    // Auto-detect environment
    if (typeof window !== 'undefined') {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      this.config.environment = isLocal ? 'development' : 'production';
      
      // Auto-enable in development if no config was saved OR if explicitly requested to force enable for dev
      if (isLocal) {
        // Force enable in development to ensure logs are captured from boot
        // This fixes the issue where logs generated before opening the console are lost
        // if the previous session had disabled logging.
        // UPDATE: User requested disabled by default. 
        // We only enable if it was explicitly saved as enabled previously.
        // this.config.enabled = true; 
        
        // If no saved config, ensure it is DISABLED by default
        if (!saved) {
             this.config.enabled = false;
        }
      }
    }
  }

  static getInstance(): DebugStore {
    if (!DebugStore.instance) {
      DebugStore.instance = new DebugStore();
    }
    return DebugStore.instance;
  }

  getConfig(): DebugConfig {
    return this.config;
  }

  updateConfig(updates: Partial<DebugConfig>) {
    this.config = { ...this.config, ...updates };
    this.save();
    this.notify();
  }

  updateNetworkConfig(updates: Partial<NetworkDebugConfig>) {
    this.config = {
      ...this.config,
      network: { ...this.config.network, ...updates }
    };
    this.save();
    this.notify();
  }

  registerScope(path: string) {
    const parts = path.split(':');
    let currentPath = '';
    let hasChanges = false;

    // Register path and all parents
    parts.forEach((part, index) => {
      currentPath = index === 0 ? part : `${currentPath}:${part}`;
      if (this.config.scopes[currentPath] === undefined) {
        this.config.scopes[currentPath] = true;
        hasChanges = true;
      }
    });

    if (hasChanges) {
      this.config = { ...this.config, scopes: { ...this.config.scopes } };
      this.save();
      this.notify();
    }
  }

  toggleScope(path: string, enabled: boolean) {
    this.config = {
      ...this.config,
      scopes: { ...this.config.scopes, [path]: enabled }
    };
    this.save();
    this.notify();
  }

  isModuleEnabled(moduleName: string): boolean {
    if (!this.config.enabled) return false;
    return this.config.modules[moduleName] ?? false; // Default to false if not explicitly enabled
  }

  // Legacy support wrappers
  registerModule(moduleName: string) {
    this.registerScope(moduleName);
    // Keep legacy sync
    if (this.config.modules[moduleName] === undefined) {
      this.config = { ...this.config, modules: { ...this.config.modules, [moduleName]: true } };
    }
  }

  registerForm(formName: string) {
    this.registerScope(formName);
    // Keep legacy sync
    if (this.config.forms[formName] === undefined) {
      this.config = { ...this.config, forms: { ...this.config.forms, [formName]: true } };
    }
  }

  toggleModule(moduleName: string, enabled: boolean) {
    this.toggleScope(moduleName, enabled);
    // Keep legacy sync
    this.config = { ...this.config, modules: { ...this.config.modules, [moduleName]: enabled } };
  }

  toggleForm(formName: string, enabled: boolean) {
    this.toggleScope(formName, enabled);
    // Keep legacy sync
    this.config = { ...this.config, forms: { ...this.config.forms, [formName]: enabled } };
  }

  private save() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('debug_config', JSON.stringify(this.config));
    }
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  // In-memory log management for live dashboard
  addLog(entry: any) {
    if (!this.config.enabled) return;
    
    this.memoryLogs.unshift(entry);
    if (this.memoryLogs.length > this.config.logRetention) {
      this.memoryLogs.pop();
    }
    this.notify();
  }

  getLogs() {
    return this.memoryLogs;
  }
  
  clearLogs() {
    this.memoryLogs = [];
    this.notify();
  }
}

export const debugStore = DebugStore.getInstance();
