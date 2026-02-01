import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DebugConsole from '../DebugConsole';
import { debugStore } from '@/lib/debug-store';

// Mock dependencies
vi.mock('@/lib/debug-store', () => ({
  debugStore: {
    getConfig: vi.fn(() => ({
      enabled: true,
      logs: [],
      network: {
        captureRequestHeaders: true,
        captureRequestBody: true,
        captureResponseHeaders: true,
        captureResponseBody: true,
        maxPayloadSize: 5000,
        urlPatterns: [],
        ignoredUrls: []
      },
      scopes: {}
    })),
    getLogs: vi.fn(() => []),
    subscribe: vi.fn(() => () => {}),
    updateConfig: vi.fn(),
    updateNetworkConfig: vi.fn(),
    clearLogs: vi.fn(),
    toggleScope: vi.fn()
  }
}));

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>
}));
vi.mock('@/components/ui/switch', () => ({
  Switch: ({ onCheckedChange, checked, ...props }: any) => (
    <input 
      type="checkbox" 
      checked={checked} 
      onChange={(e) => onCheckedChange && onCheckedChange(e.target.checked)} 
      {...props} 
    />
  )
}));
vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />
}));
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>
}));
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>
}));
vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: React.forwardRef(({ children, className }: any, ref: any) => (
    <div ref={ref} className={className}>{children}</div>
  ))
}));
vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, onValueChange }: any) => <div onClick={() => onValueChange && onValueChange('data')}>{children}</div>, // Mock simple interaction
  TabsContent: ({ children }: any) => <div>{children}</div>,
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ children }: any) => <div>{children}</div>
}));

describe('DebugConsole', () => {
  it('renders without crashing', () => {
    render(<DebugConsole />);
    expect(screen.getByText('System Debug Console')).toBeInTheDocument();
  });

  it('handles malformed logs without crashing', () => {
    // Mock scrollIntoView
    window.HTMLElement.prototype.scrollIntoView = vi.fn();

    // Override the mock for this test
    vi.mocked(debugStore.getLogs).mockReturnValue([
        { type: 'app', module: { bad: 'object' }, message: 'Bad log', level: 'info', timestamp: new Date().toISOString() }, // Object as module
        { type: 'app', module: 'Test', message: null, level: 'info', timestamp: new Date().toISOString() }, 
        { type: 'app', module: 'Test', message: 'Ok', level: undefined, timestamp: new Date().toISOString() } 
    ]);

    render(<DebugConsole />);
    expect(screen.getByText('System Debug Console')).toBeInTheDocument();
  });

  it('renders data flow logs correctly', () => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.mocked(debugStore.getLogs).mockReturnValue([
        { 
            type: 'data-flow', 
            flowType: 'inbound', 
            source: 'database', 
            operation: 'SELECT', 
            target: 'users', 
            status: 'success', 
            timestamp: new Date().toISOString() 
        }
    ]);

    render(<DebugConsole />);
    // Since filteredLogs depends on activeTab, and we default to 'all', it should show.
    // However, LogDetail for data-flow might be rendered.
    expect(screen.getByText('SELECT')).toBeInTheDocument();
    expect(screen.getByText('users')).toBeInTheDocument();
    expect(screen.getByText('database')).toBeInTheDocument();
  });
});
