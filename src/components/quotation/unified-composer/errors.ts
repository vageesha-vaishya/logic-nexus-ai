// Pure error-parsing utilities extracted from UnifiedQuoteComposer.tsx
// (Slice C / quotation composer split). Behavior preserved 1:1 so the
// existing UnifiedQuoteComposer.save.test.tsx + .fallback / .crash /
// .repro suites keep passing.
//
// UnifiedQuoteComposer.tsx re-exports `getSaveErrorMessage` so callers
// that imported it from the composer file path continue to work.

export type ValidationIssue = {
  path: string;
  label: string;
  message: string;
};

export const FIELD_LABELS: Record<string, string> = {
  quote_number: 'Quote Number',
  title: 'Quote Title',
  account_id: 'Account',
  contact_id: 'Contact',
  opportunity_id: 'Opportunity',
  origin_port_id: 'Origin Port',
  destination_port_id: 'Destination Port',
  service_type_id: 'Service Type',
  service_id: 'Service',
  currency_id: 'Currency',
  carrier_id: 'Carrier',
  incoterm_id: 'Incoterm',
  pickup_date: 'Pickup Date',
  delivery_deadline: 'Delivery Deadline',
};

export function toFieldLabel(field: string): string {
  return FIELD_LABELS[field] || field.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function parseSaveFieldErrors(err: any): ValidationIssue[] {
  const message = String(err?.message || '');
  const details = String(err?.details || '');
  const hint = String(err?.hint || '');
  const combined = `${message} ${details} ${hint}`.trim();

  const uniqueMatch = combined.match(/Key\s+\(([^)]+)\)=\(([^)]*)\)\s+already exists/i);
  if (uniqueMatch) {
    const field = uniqueMatch[1].trim();
    const value = uniqueMatch[2].trim();
    return [{
      path: field,
      label: toFieldLabel(field),
      message: value ? `${toFieldLabel(field)} "${value}" already exists.` : `${toFieldLabel(field)} already exists.`,
    }];
  }

  const nullMatch = combined.match(/null value in column "([^"]+)"/i);
  if (nullMatch) {
    const field = nullMatch[1].trim();
    return [{
      path: field,
      label: toFieldLabel(field),
      message: `${toFieldLabel(field)} is required.`,
    }];
  }

  const fkMatch = combined.match(/Key\s+\(([^)]+)\)=\(([^)]*)\)\s+is not present in table "([^"]+)"/i);
  if (fkMatch) {
    const field = fkMatch[1].trim();
    return [{
      path: field,
      label: toFieldLabel(field),
      message: `${toFieldLabel(field)} is invalid or no longer exists.`,
    }];
  }

  if (/save_quote_atomic:\s*unknown charge basis code/i.test(combined)) {
    return [{ path: 'charges', label: 'Charges', message: 'One or more charge basis values are invalid.' }];
  }

  if (/save_quote_atomic:\s*no\s+sell-side\s+entry\s+found/i.test(combined)) {
    return [{ path: 'charges', label: 'Charges', message: 'Sell-side charge configuration is missing.' }];
  }

  if (/save_quote_atomic:\s*no\s+buy-side\s+entry\s+found/i.test(combined)) {
    return [{ path: 'charges', label: 'Charges', message: 'Buy-side charge configuration is missing.' }];
  }

  if (/quote_number/i.test(combined) && /(duplicate|already exists|unique)/i.test(combined)) {
    return [{
      path: 'quote_number',
      label: 'Quote Number',
      message: 'Quote Number already exists. Please use a different value.',
    }];
  }

  return [];
}

export function getSaveErrorMessage(err: any): { errorMessage: string; fieldErrors: ValidationIssue[] } {
  const fieldErrors = parseSaveFieldErrors(err);
  if (fieldErrors.length > 0) {
    return {
      errorMessage: `Please fix: ${fieldErrors.map((issue) => `${issue.label} - ${issue.message}`).join('; ')}`,
      fieldErrors,
    };
  }

  const message = String(err?.message || '');
  const code = String(err?.code || '');
  const isNetworkError = (
    err?.name === 'AbortError' ||
    message.includes('signal is aborted') ||
    message.includes('aborted') ||
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('fetch') ||
    code === 'NETWORK_ERROR' ||
    err?.status === 0 ||
    (err instanceof TypeError && message.includes('fetch'))
  );
  const isSupabaseError = (
    code.startsWith('PGRST') ||
    message.includes('supabase') ||
    message.includes('JWT') ||
    message.includes('permission')
  );

  if (isNetworkError) {
    return {
      errorMessage: 'Network connection issue. Please check your internet connection and try again.',
      fieldErrors,
    };
  }

  if (
    message.includes('relation "quotation_legs" does not exist') ||
    message.includes('relation "quotation_charges" does not exist')
  ) {
    return {
      errorMessage: 'Database migration missing. Please apply latest Supabase migrations for save_quote_atomic and try again.',
      fieldErrors,
    };
  }

  if (code === 'PGRST116') {
    return {
      errorMessage: 'Database error: The quotation could not be verified after saving.',
      fieldErrors,
    };
  }

  if (message.includes('permission') || message.includes('unauthorized') || code === '42501') {
    return {
      errorMessage: 'Permission denied. You may not have the required permissions to save quotes.',
      fieldErrors,
    };
  }

  if (message.includes('timeout')) {
    return {
      errorMessage: 'Request timeout. The save operation took too long. Please try again.',
      fieldErrors,
    };
  }

  if (isSupabaseError) {
    return {
      errorMessage: 'Database connection error. Please try again or contact support if the issue persists.',
      fieldErrors,
    };
  }

  return {
    errorMessage: message || 'An error occurred while saving the quotation.',
    fieldErrors,
  };
}
