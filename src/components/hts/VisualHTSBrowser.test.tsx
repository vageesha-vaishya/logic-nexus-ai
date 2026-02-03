import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VisualHTSBrowser } from './VisualHTSBrowser';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn()
  }
}));

// Mock UI components to simplify DOM
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, onClick, className }: any) => <div className={className} onClick={onClick}>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: any) => <div>{children}</div>
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('VisualHTSBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders chapters initially calling get_global_hs_hierarchy', async () => {
    const mockData = [
      { code: '01', description: 'Live Animals', child_count: 10, has_children: true }
    ];
    
    vi.mocked(supabase.rpc).mockImplementation((): any => Promise.resolve({ data: mockData, error: null, count: null, status: 200, statusText: 'OK' }));

    render(<VisualHTSBrowser />, { wrapper: createWrapper() });

    expect(supabase.rpc).toHaveBeenCalledWith('get_global_hs_hierarchy', {
      level_type: 'chapter',
      parent_code: null
    });

    await waitFor(() => {
      expect(screen.getByText('01')).toBeInTheDocument();
      expect(screen.getByText('Live Animals')).toBeInTheDocument();
    });
  });

  it('drills down to heading when chapter is clicked', async () => {
    // Initial load (Chapters)
    vi.mocked(supabase.rpc).mockImplementation((method: string, params: any): any => {
      if (params.level_type === 'chapter') {
        return Promise.resolve({ 
          data: [{ code: '01', description: 'Live Animals', child_count: 10, has_children: true }], 
          error: null, count: null, status: 200, statusText: 'OK' 
        });
      }
      if (params.level_type === 'heading') {
        return Promise.resolve({ 
          data: [{ code: '0101', description: 'Live horses', child_count: 5, has_children: true }], 
          error: null, count: null, status: 200, statusText: 'OK' 
        });
      }
      return Promise.resolve({ data: [], error: null });
    });

    render(<VisualHTSBrowser />, { wrapper: createWrapper() });

    // Wait for chapter to load
    await waitFor(() => screen.getByText('01'));

    // Click chapter
    fireEvent.click(screen.getByText('01'));

    // Expect drill down call
    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('get_global_hs_hierarchy', {
        level_type: 'heading',
        parent_code: '01'
      });
      expect(screen.getByText('0101')).toBeInTheDocument();
      expect(screen.getByText('Browsing Headings')).toBeInTheDocument();
    });
  });

  it('calls onSelect when leaf node is clicked', async () => {
    const onSelect = vi.fn();
    
    // Simulate being at subheading level and clicking a root to see codes
    // But wait, the component handles navigation internally.
    // To test leaf click, we need to be at 'code' level (extension).
    
    // Let's mock a sequence
    vi.mocked(supabase.rpc).mockImplementation((method: string, params: any): any => {
       // Assume we are already at the bottom for brevity? 
       // No, we have to navigate down or mock the state. 
       // Since state is internal, we must navigate.
       
       if (params.level_type === 'chapter') return Promise.resolve({ data: [{ code: '01', has_children: true }], error: null });
       if (params.level_type === 'heading') return Promise.resolve({ data: [{ code: '0101', has_children: true }], error: null });
       if (params.level_type === 'subheading') return Promise.resolve({ data: [{ code: '010121', has_children: true }], error: null }); // 6-digit root
       if (params.level_type === 'code') return Promise.resolve({ 
         data: [{ code: '0101210000', description: 'Pure-bred horses', has_children: false, id: 'uuid-123' }], 
         error: null 
       });
       return Promise.resolve({ data: [], error: null });
    });

    render(<VisualHTSBrowser onSelect={onSelect} />, { wrapper: createWrapper() });

    // Click Chapter 01
    await waitFor(() => screen.getByText('01'));
    fireEvent.click(screen.getByText('01'));

    // Click Heading 0101
    await waitFor(() => screen.getByText('0101'));
    fireEvent.click(screen.getByText('0101'));

    // Click Subheading 010121
    await waitFor(() => screen.getByText('010121'));
    fireEvent.click(screen.getByText('010121'));

    // Click Code 0101210000 (Leaf)
    await waitFor(() => screen.getByText('0101210000'));
    fireEvent.click(screen.getByText('0101210000'));

    expect(onSelect).toHaveBeenCalledWith({
      code: '0101210000',
      description: 'Pure-bred horses',
      id: 'uuid-123'
    });
  });
});
