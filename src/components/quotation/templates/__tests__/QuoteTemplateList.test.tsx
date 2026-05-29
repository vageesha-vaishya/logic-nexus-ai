import { render, screen, fireEvent } from '@testing-library/react';
import { QuoteTemplateList } from '../QuoteTemplateList';
import { useQuoteTemplates } from '../useQuoteTemplates';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the hook
vi.mock('../useQuoteTemplates', () => ({
  useQuoteTemplates: vi.fn()
}));

describe('QuoteTemplateList', () => {
  const mockTemplates = [
    {
      id: 'template-1',
      name: 'Ocean Standard',
      description: 'Standard ocean freight template',
      category: 'Ocean',
      version: 1,
      updated_at: '2024-01-01T10:00:00Z',
      content: {}
    },
    {
      id: 'template-2',
      name: 'Air Express',
      description: 'Fast air freight',
      category: 'Air',
      version: 2,
      updated_at: '2024-01-02T10:00:00Z',
      content: {}
    }
  ];

  const mockDeleteTemplate = {
    mutate: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useQuoteTemplates as any).mockReturnValue({
      templates: mockTemplates,
      isLoading: false,
      deleteTemplate: mockDeleteTemplate
    });
  });

  it('renders loading state', () => {
    (useQuoteTemplates as any).mockReturnValue({
      templates: [],
      isLoading: true
    });
    render(<QuoteTemplateList />);
    expect(screen.getByText('Loading templates...')).toBeInTheDocument();
  });

  it('renders list of templates', () => {
    render(<QuoteTemplateList />);
    expect(screen.getByText('Ocean Standard')).toBeInTheDocument();
    expect(screen.getByText('Air Express')).toBeInTheDocument();
    expect(screen.getByText('Standard ocean freight template')).toBeInTheDocument();
  });

  it('filters templates by search', () => {
    render(<QuoteTemplateList />);
    const searchInput = screen.getByPlaceholderText('Search templates...');
    
    fireEvent.change(searchInput, { target: { value: 'Ocean' } });
    
    expect(screen.getByText('Ocean Standard')).toBeInTheDocument();
    expect(screen.queryByText('Air Express')).not.toBeInTheDocument();
  });

  it('calls onSelect when "Use Template" is clicked', () => {
    const onSelect = vi.fn();
    render(<QuoteTemplateList onSelect={onSelect} />);
    
    const useButtons = screen.getAllByText('Use Template');
    fireEvent.click(useButtons[0]);
    
    expect(onSelect).toHaveBeenCalledWith(mockTemplates[0]);
  });

  it('calls onEdit with null when "New Template" is clicked', () => {
    const onEdit = vi.fn();
    render(<QuoteTemplateList onEdit={onEdit} />);
    
    const newButton = screen.getByText('New Template');
    fireEvent.click(newButton);
    
    expect(onEdit).toHaveBeenCalledWith(null);
  });

  it('shows empty state when no templates found', () => {
    (useQuoteTemplates as any).mockReturnValue({
      templates: [],
      isLoading: false
    });
    render(<QuoteTemplateList />);
    expect(screen.getByText('No templates found')).toBeInTheDocument();
  });
});
