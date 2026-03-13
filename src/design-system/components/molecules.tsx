import { forwardRef, useState } from 'react';
import type { HTMLAttributes, InputHTMLAttributes } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CRMButton, type CRMVariant, type CRMViewport } from './atoms';
import { cn } from '@/lib/utils';

const viewportClassMap: Record<CRMViewport, string> = {
  mobile: 'text-xs',
  tablet: 'text-sm',
  desktop: 'text-base'
};

export interface CRMFormFieldProps extends HTMLAttributes<HTMLDivElement> {
  id: string;
  label: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  variant?: CRMVariant;
  viewport?: CRMViewport;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
}

export const CRMFormField = forwardRef<HTMLDivElement, CRMFormFieldProps>(
  (
    { id, label, helperText, errorText, required = false, variant = 'primary', viewport = 'desktop', className, inputProps, ...props },
    ref
  ) => (
    <div ref={ref} className={cn('flex flex-col gap-1.5', viewportClassMap[viewport], className)} {...props}>
      <Label htmlFor={id} className="font-medium">
        {label}
      </Label>
      <Input
        id={id}
        aria-required={required}
        aria-invalid={Boolean(errorText)}
        aria-describedby={`${id}-helper ${id}-error`}
        className={cn(
          variant === 'danger' && 'border-destructive focus-visible:ring-destructive',
          variant === 'secondary' && 'border-muted-foreground/30'
        )}
        {...inputProps}
      />
      {helperText ? <p id={`${id}-helper`} className="text-muted-foreground">{helperText}</p> : null}
      {errorText ? <p id={`${id}-error`} className="text-destructive">{errorText}</p> : null}
    </div>
  )
);

CRMFormField.displayName = 'CRMFormField';

export interface CRMSearchBarProps extends HTMLAttributes<HTMLDivElement> {
  value?: string;
  placeholder?: string;
  variant?: CRMVariant;
  viewport?: CRMViewport;
  onValueChange?: (value: string) => void;
  onSearch?: (value: string) => void;
}

export const CRMSearchBar = forwardRef<HTMLDivElement, CRMSearchBarProps>(
  (
    { value = '', placeholder = 'Search', variant = 'primary', viewport = 'desktop', onValueChange, onSearch, className, ...props },
    ref
  ) => {
    const [internalValue, setInternalValue] = useState(value);
    const nextValue = onValueChange ? value : internalValue;
    return (
      <div
        ref={ref}
        role="search"
        className={cn(
          'flex items-center gap-2 rounded-md border px-3 py-2',
          variant === 'primary' && 'border-primary/30',
          variant === 'secondary' && 'border-muted-foreground/30',
          variant === 'danger' && 'border-destructive/40',
          viewportClassMap[viewport],
          className
        )}
        {...props}
      >
        <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input
          value={nextValue}
          onChange={(event) => {
            setInternalValue(event.target.value);
            onValueChange?.(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onSearch?.(nextValue);
            }
          }}
          aria-label="Search"
          placeholder={placeholder}
          className="border-0 p-0 focus-visible:ring-0"
        />
      </div>
    );
  }
);

CRMSearchBar.displayName = 'CRMSearchBar';

export interface CRMDatePickerProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: CRMVariant;
  viewport?: CRMViewport;
}

export const CRMDatePicker = forwardRef<HTMLInputElement, CRMDatePickerProps>(
  ({ variant = 'primary', viewport = 'desktop', className, ...props }, ref) => (
    <Input
      ref={ref}
      type="date"
      className={cn(
        variant === 'primary' && 'border-primary/30',
        variant === 'secondary' && 'border-muted-foreground/30',
        variant === 'danger' && 'border-destructive/40',
        viewportClassMap[viewport],
        className
      )}
      aria-label={props['aria-label'] || 'Select date'}
      {...props}
    />
  )
);

CRMDatePicker.displayName = 'CRMDatePicker';

export interface CRMToastProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  message: string;
  variant?: CRMVariant;
  viewport?: CRMViewport;
  onClose?: () => void;
}

export const CRMToast = forwardRef<HTMLDivElement, CRMToastProps>(
  ({ title, message, variant = 'primary', viewport = 'desktop', onClose, className, ...props }, ref) => (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      tabIndex={0}
      className={cn(
        'flex w-full max-w-md items-start justify-between gap-3 rounded-md border p-4 shadow-sm',
        variant === 'primary' && 'border-primary/30 bg-primary/5',
        variant === 'secondary' && 'border-muted-foreground/20 bg-muted/60',
        variant === 'danger' && 'border-destructive/40 bg-destructive/5',
        viewportClassMap[viewport],
        className
      )}
      {...props}
    >
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        <p className="text-muted-foreground">{message}</p>
      </div>
      <CRMButton
        variant="secondary"
        viewport={viewport}
        onClick={onClose}
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </CRMButton>
    </div>
  )
);

CRMToast.displayName = 'CRMToast';
