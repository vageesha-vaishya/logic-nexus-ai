// Form error ARIA utilities for WCAG 2.1 AA compliance
// Addresses Issue AC-02: Missing Form Error Association

/**
 * Generate ARIA attributes for form fields with validation errors
 * 
 * Usage:
 * ```tsx
 * const errorId = getFieldErrorId('part-number');
 * const ariaProps = getFieldAriaProps('part-number', errors.partNumber);
 * 
 * <Input
 *   id="part-number"
 *   {...ariaProps}
 * />
 * {errors.partNumber && (
 *   <p id={errorId} role="alert" className="text-xs text-destructive">
 *     {errors.partNumber}
 *   </p>
 * )}
 * ```
 */

/**
 * Generate a consistent error ID for a field
 */
export function getFieldErrorId(fieldName: string): string {
  return `${fieldName}-error`;
}

/**
 * Generate ARIA attributes for form field with error state
 */
export function getFieldAriaProps(
  fieldName: string,
  error?: string | null
): {
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
} {
  return {
    'aria-invalid': !!error,
    'aria-describedby': error ? getFieldErrorId(fieldName) : undefined,
  };
}

/**
 * Generate ARIA attributes for required fields
 */
export function getRequiredAriaProps(required?: boolean): {
  'aria-required': boolean | undefined;
} {
  return {
    'aria-required': required ? true : undefined,
  };
}

/**
 * Combine all ARIA attributes for a form field
 */
export function getFormFieldAriaProps(
  fieldName: string,
  options?: {
    error?: string | null;
    required?: boolean;
  }
): {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
  'aria-required': boolean | undefined;
} {
  return {
    id: fieldName,
    ...getFieldAriaProps(fieldName, options?.error),
    ...getRequiredAriaProps(options?.required),
  };
}
