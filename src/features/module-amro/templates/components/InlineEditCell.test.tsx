/**
 * Unit Tests for InlineEditCell Component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InlineEditCell } from '../components/InlineEditCell';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Check: () => <span data-testid="check-icon" />,
  X: () => <span data-testid="x-icon" />,
  AlertCircle: () => <span data-testid="alert-icon" />,
}));

describe('InlineEditCell', () => {
  const mockOnStartEdit = vi.fn();
  const mockOnSave = vi.fn().mockResolvedValue(undefined);
  const mockOnCancel = vi.fn();

  const defaultProps = {
    field: 'template_name',
    value: 'Test Template',
    type: 'text' as const,
    isEditing: false,
    isSaving: false,
    hasConflict: false,
    onStartEdit: mockOnStartEdit,
    onSave: mockOnSave,
    onCancel: mockOnCancel,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Display Mode', () => {
    it('should render value in display mode', () => {
      render(<InlineEditCell {...defaultProps} />);
      
      expect(screen.getByText('Test Template')).toBeInTheDocument();
    });

    it('should render placeholder when value is empty', () => {
      render(<InlineEditCell {...defaultProps} value="" placeholder="Enter name" />);
      
      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('should call onStartEdit when clicked', async () => {
      const user = userEvent.setup();
      render(<InlineEditCell {...defaultProps} />);
      
      await user.click(screen.getByRole('button'));
      
      expect(mockOnStartEdit).toHaveBeenCalledTimes(1);
    });

    it('should call onStartEdit when Enter is pressed', async () => {
      const user = userEvent.setup();
      render(<InlineEditCell {...defaultProps} />);
      
      await user.keyboard('{Enter}');
      
      expect(mockOnStartEdit).toHaveBeenCalledTimes(1);
    });

    it('should use custom renderValue function', () => {
      const renderValue = vi.fn((value) => <span data-testid="custom-render">{value.toUpperCase()}</span>);
      
      render(<InlineEditCell {...defaultProps} renderValue={renderValue} />);
      
      expect(screen.getByTestId('custom-render')).toHaveTextContent('TEST TEMPLATE');
    });
  });

  describe('Edit Mode', () => {
    it('should render input field when editing', () => {
      render(<InlineEditCell {...defaultProps} isEditing />);
      
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should focus input on edit start', async () => {
      render(<InlineEditCell {...defaultProps} isEditing />);
      
      const input = screen.getByRole('textbox');
      await waitFor(() => expect(input).toHaveFocus());
    });

    it('should save on Enter key', async () => {
      const user = userEvent.setup();
      render(<InlineEditCell {...defaultProps} isEditing />);
      
      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.type(input, 'New Value');
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('New Value');
      });
    });

    it('should cancel on Escape key', async () => {
      const user = userEvent.setup();
      render(<InlineEditCell {...defaultProps} isEditing />);
      
      await user.keyboard('{Escape}');
      
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('should show validation error for required field', async () => {
      const user = userEvent.setup();
      render(<InlineEditCell {...defaultProps} isEditing required />);
      
      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/template_name is required/i)).toBeInTheDocument();
      });
    });

    it('should show character count for maxLength', () => {
      render(<InlineEditCell {...defaultProps} isEditing maxLength={100} value="Test" />);
      
      expect(screen.getByText('4/100')).toBeInTheDocument();
    });
  });

  describe('Select Type', () => {
    const selectProps = {
      ...defaultProps,
      type: 'select' as const,
      options: [
        { value: 'line', label: 'Line Maintenance' },
        { value: 'base', label: 'Base Maintenance' },
      ],
    };

    it('should render select dropdown', () => {
      render(<InlineEditCell {...selectProps} isEditing />);
      
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should show options when opened', async () => {
      const user = userEvent.setup();
      render(<InlineEditCell {...selectProps} isEditing />);
      
      const select = screen.getByRole('combobox');
      await user.click(select);
      
      expect(screen.getByText('Line Maintenance')).toBeInTheDocument();
      expect(screen.getByText('Base Maintenance')).toBeInTheDocument();
    });
  });

  describe('Saving State', () => {
    it('should show saving indicator', () => {
      render(<InlineEditCell {...defaultProps} isEditing isSaving />);
      
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('should disable buttons while saving', () => {
      render(<InlineEditCell {...defaultProps} isEditing isSaving />);
      
      expect(screen.getByLabelText('Save changes')).toBeDisabled();
      expect(screen.getByLabelText('Cancel editing')).toBeDisabled();
    });
  });

  describe('Conflict State', () => {
    it('should show conflict warning', () => {
      render(<InlineEditCell {...defaultProps} isEditing hasConflict />);
      
      expect(screen.getByText(/Conflict detected/i)).toBeInTheDocument();
    });
  });
});
