import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SharedCargoInput } from '../SharedCargoInput';
import { SharedCargoInputProps } from '../SharedCargoInput';

// Mock dependencies
vi.mock('@/hooks/useContainerRefs', () => ({
  useContainerRefs: () => ({
    containerTypes: [],
    containerSizes: [],
    formatSize: (size: any) => size,
    loading: false,
    error: null,
    retry: vi.fn()
  })
}));

vi.mock('@/components/logistics/SmartCargoInput', () => ({
  SmartCargoInput: () => <div data-testid="smart-cargo-input" />
}));

vi.mock('../HazmatWizard', () => ({
  HazmatWizard: () => <div data-testid="hazmat-wizard" />
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange }: any) => <div data-testid="select" onClick={() => onValueChange && onValueChange('test')}>{children}</div>,
  SelectTrigger: ({ children, className, 'aria-invalid': ariaInvalid }: any) => (
    <button className={className} aria-invalid={ariaInvalid}>{children}</button>
  ),
  SelectValue: () => <span>Value</span>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, className, id }: any) => (
    <input 
      type="checkbox" 
      id={id}
      checked={checked} 
      onChange={(e) => onCheckedChange(e.target.checked)} 
      className={className}
    />
  )
}));

describe('SharedCargoInput Validation', () => {
  const defaultProps: SharedCargoInputProps = {
    value: {
      commodity: 'Test Commodity',
      weight: { value: 100, unit: 'kg' },
      dimensions: { l: 10, w: 10, h: 10, unit: 'cm' },
      volume: 1,
      stackable: false,
      dangerousGoods: false,
      hazmat: {
        unNumber: '',
        class: '',
        packingGroup: 'I',
        flashPoint: { value: 0, unit: 'C' }
      }
    },
    onChange: vi.fn(),
    errors: {}
  };

  it('renders without errors initially', () => {
    render(<SharedCargoInput {...defaultProps} />);
    
    // Check inputs have aria-invalid="false"
    const inputs = screen.getAllByRole('textbox');
    inputs.forEach(input => {
      expect(input).toHaveAttribute('aria-invalid', 'false');
    });
  });

  it('applies aria-invalid to dimensions inputs when errors are present', () => {
    const propsWithErrors = {
      ...defaultProps,
      errors: {
        dimensions: {
          l: { message: 'Required' },
          w: { message: 'Required' },
          h: { message: 'Required' }
        }
      }
    };

    render(<SharedCargoInput {...propsWithErrors} />);
    
    const lengthInput = screen.getByPlaceholderText('L');
    const widthInput = screen.getByPlaceholderText('W');
    const heightInput = screen.getByPlaceholderText('H');

    expect(lengthInput).toHaveAttribute('aria-invalid', 'true');
    expect(widthInput).toHaveAttribute('aria-invalid', 'true');
    expect(heightInput).toHaveAttribute('aria-invalid', 'true');
  });

  it('applies aria-invalid to volume input when error is present', () => {
    const propsWithErrors = {
      ...defaultProps,
      errors: {
        volume: { message: 'Invalid volume' }
      }
    };

    render(<SharedCargoInput {...propsWithErrors} />);
    
    const volumeInput = screen.getByPlaceholderText('Total Volume');
    expect(volumeInput).toHaveAttribute('aria-invalid', 'true');
  });

  it('applies aria-invalid to weight input when error is present', () => {
    const propsWithErrors = {
      ...defaultProps,
      errors: {
        weight: { message: 'Invalid weight' }
      }
    };

    render(<SharedCargoInput {...propsWithErrors} />);
    
    const weightInput = screen.getByTestId('cargo-weight');
    expect(weightInput).toHaveAttribute('aria-invalid', 'true');
    expect(weightInput).toHaveAttribute('name', 'weight');
    expect(screen.getByText('Invalid weight')).toBeInTheDocument();
  });

  it('links weight input to inline error for accessible feedback', () => {
    const propsWithErrors = {
      ...defaultProps,
      errors: {
        weight: { message: 'Air freight requires a valid weight greater than 0' }
      }
    };

    render(<SharedCargoInput {...propsWithErrors} />);

    const weightInput = screen.getByTestId('cargo-weight');
    const error = screen.getByText('Air freight requires a valid weight greater than 0');

    expect(error).toHaveAttribute('role', 'alert');
    expect(weightInput).toHaveAttribute('aria-errormessage', error.getAttribute('id') || '');
    expect(weightInput).toHaveAttribute('aria-describedby', error.getAttribute('id') || '');
  });

  it('renders weight error highlight container when validation fails', () => {
    const propsWithErrors = {
      ...defaultProps,
      errors: {
        weight: { message: 'Invalid weight' }
      }
    };

    const { container } = render(<SharedCargoInput {...propsWithErrors} />);

    const weightWrapper = container.querySelector('[data-field-name="weight"]');
    expect(weightWrapper).toHaveAttribute('aria-invalid', 'true');
  });

  it('applies aria-invalid to hazmat inputs when errors are present', () => {
    const propsWithErrors = {
      ...defaultProps,
      value: {
        ...defaultProps.value,
        dangerousGoods: true // Enable hazmat section
      },
      errors: {
        hazmat: {
          unNumber: { message: 'Required' },
          class: { message: 'Required' },
          packingGroup: { message: 'Required' },
          flashPoint: { message: 'Required' }
        }
      }
    };

    render(<SharedCargoInput {...propsWithErrors} />);
    
    const unInput = screen.getByPlaceholderText('e.g. 1263');
    const classInput = screen.getByPlaceholderText('e.g. 3');
    const flashPointInput = screen.getByPlaceholderText('Temp');
    
    // For SelectTrigger (Packing Group), we mocked it to render a button
    // We need to find it. The placeholder is not directly on the button in the mock.
    // But we can find by class or just check all buttons.
    // In the real component, it's a SelectTrigger.
    
    expect(unInput).toHaveAttribute('aria-invalid', 'true');
    expect(classInput).toHaveAttribute('aria-invalid', 'true');
    expect(flashPointInput).toHaveAttribute('aria-invalid', 'true');
  });
});
