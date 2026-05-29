import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuoteTemplateEditor } from '../QuoteTemplateEditor';
import { useQuoteTemplates } from '../useQuoteTemplates';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';

// Mock the hook
vi.mock('../useQuoteTemplates', () => ({
  useQuoteTemplates: vi.fn()
}));

// Mock UI components that might cause issues
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));

describe('QuoteTemplateEditor', () => {
  const mockCreateTemplate = {
    mutateAsync: vi.fn()
  };
  const mockUpdateTemplate = {
    mutateAsync: vi.fn()
  };

  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useQuoteTemplates as any).mockReturnValue({
      createTemplate: mockCreateTemplate,
      updateTemplate: mockUpdateTemplate
    });
  });

  it('renders create form when no template provided', () => {
    render(
      <QuoteTemplateEditor 
        template={null} 
        open={true} 
        onOpenChange={mockOnOpenChange} 
      />
    );

    expect(screen.getByText('Create Template')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('');
  });

  it('renders edit form when template provided', () => {
    const mockTemplate = {
      id: '123',
      name: 'Existing Template',
      description: 'Desc',
      category: 'Cat',
      content: { foo: 'bar' },
      version: 1,
      updated_at: '2024-01-01',
      created_at: '2024-01-01',
      tenant_id: 'tenant-1',
      is_active: true,
      created_by: 'user-1',
      updated_by: 'user-1'
    };

    render(
      <QuoteTemplateEditor 
        template={mockTemplate} 
        open={true} 
        onOpenChange={mockOnOpenChange} 
      />
    );

    expect(screen.getByText('Edit Template')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Existing Template');
    expect(screen.getByLabelText('Category')).toHaveValue('Cat');
    // JSON content might be stringified
    expect(screen.getByLabelText('Template Configuration (JSON)')).toHaveValue(JSON.stringify({ foo: 'bar' }, null, 2));
  });

  it('submits new template successfully', async () => {
    const user = userEvent.setup();
    render(
      <QuoteTemplateEditor 
        template={null} 
        open={true} 
        onOpenChange={mockOnOpenChange} 
      />
    );

    await user.type(screen.getByLabelText('Name'), 'New Template');
    await user.type(screen.getByLabelText('Category'), 'Test');
    
    const submitBtn = screen.getByRole('button', { name: 'Create Template' });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateTemplate.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
        name: 'New Template',
        category: 'Test',
        content: {}
      }));
    });
    
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('submits updated template successfully', async () => {
    const user = userEvent.setup();
    const mockTemplate = {
      id: '123',
      name: 'Old Name',
      description: '',
      category: '',
      content: {},
      version: 1,
      updated_at: '',
      created_at: '',
      tenant_id: '',
      is_active: true,
      created_by: '',
      updated_by: ''
    };

    render(
      <QuoteTemplateEditor 
        template={mockTemplate} 
        open={true} 
        onOpenChange={mockOnOpenChange} 
      />
    );

    const nameInput = screen.getByLabelText('Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Name');
    
    const submitBtn = screen.getByRole('button', { name: 'Update Template' });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockUpdateTemplate.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
        id: '123',
        updates: expect.objectContaining({
          name: 'Updated Name'
        })
      }));
    });
  });

  it('validates JSON content', async () => {
    const user = userEvent.setup();
    render(
      <QuoteTemplateEditor 
        template={null} 
        open={true} 
        onOpenChange={mockOnOpenChange} 
      />
    );

    await user.type(screen.getByLabelText('Name'), 'Bad JSON');
    const jsonInput = screen.getByLabelText('Template Configuration (JSON)');
    await user.clear(jsonInput);
    await user.type(jsonInput, '{ invalid json }');
    
    const submitBtn = screen.getByRole('button', { name: 'Create Template' });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Invalid JSON format')).toBeInTheDocument();
    });
    
    expect(mockCreateTemplate.mutateAsync).not.toHaveBeenCalled();
  });
});
