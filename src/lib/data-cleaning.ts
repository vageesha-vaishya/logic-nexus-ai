
export interface CorrectionResult<T> {
  value: T | null;
  original: any;
  corrected: boolean;
  log?: string;
  isValid: boolean;
}

export const cleanEmail = (email: string): CorrectionResult<string> => {
  const original = email;
  let value = email?.trim();

  if (!value) {
    return { value: null, original, corrected: false, isValid: true, log: '' };
  }

  // Basic cleanup
  value = value.toLowerCase();
  
  // Fix common typos
  const domainTypos: Record<string, string> = {
    'gamil.com': 'gmail.com',
    'gmial.com': 'gmail.com',
    'gmal.com': 'gmail.com',
    'gmil.com': 'gmail.com',
    'hotmial.com': 'hotmail.com',
    'yaho.com': 'yahoo.com',
    'outlok.com': 'outlook.com'
  };

  let corrected = false;
  let log = '';

  const parts = value.split('@');
  if (parts.length === 2) {
    const [local, domain] = parts;
    if (domainTypos[domain]) {
      value = `${local}@${domainTypos[domain]}`;
      corrected = true;
      log = `Corrected domain typo: ${domain} -> ${domainTypos[domain]}`;
    }
  }

  // Regex validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValid = emailRegex.test(value);

  if (!isValid && !corrected) {
    // Try to fix common issues like missing TLD? No, too risky.
    // Maybe fix spaces?
    if (value.includes(' ')) {
        const newValue = value.replace(/\s/g, '');
        if (emailRegex.test(newValue)) {
            value = newValue;
            corrected = true;
            log = 'Removed spaces';
        }
    }
  }
  
  // RFC 5322 regex approximation
  const rfcRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  const isRfcValid = rfcRegex.test(value);

  return {
    value: isRfcValid ? value : null,
    original,
    corrected,
    isValid: isRfcValid,
    log: isRfcValid ? log : (log ? log + '; Invalid email format' : 'Invalid email format')
  };
};

export const cleanUrl = (url: string): CorrectionResult<string> => {
  const original = url;
  let value = url?.trim();

  if (!value) {
    return { value: null, original, corrected: false, isValid: true, log: '' }; // Optional
  }

  let corrected = false;
  let log = '';

  // Add protocol if missing
  if (!/^https?:\/\//i.test(value)) {
    // Check if it looks like a domain first
    if (/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}/.test(value)) {
        value = `https://${value}`;
        corrected = true;
        log = 'Added https:// protocol';
    }
  }

  // Regex validation per spec: ^https?://[^\s/$.?#].[^\s]*$ 
  // We relax it slightly to allow valid URLs that might contain dots
  const urlRegex = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
  
  // Try to use URL object for parsing
  let isValid = false;
  try {
    const urlObj = new URL(value);
    isValid = true;
    
    // Normalize
    let newValue = urlObj.toString();
    if (newValue.endsWith('/') && !original.endsWith('/')) {
        newValue = newValue.slice(0, -1);
    }
    
    if (newValue !== value) {
        value = newValue;
        corrected = true;
        log = log ? log + '; Normalized URL' : 'Normalized URL';
    }
  } catch {
    isValid = false;
  }

  return {
    value: isValid ? value : null,
    original,
    corrected,
    isValid,
    log: isValid ? log : 'Invalid URL format'
  };
};

import { parsePhoneNumber, CountryCode } from 'libphonenumber-js';

export const cleanPhone = (phone: string, defaultCountry: CountryCode = 'US'): CorrectionResult<string> => {
    const original = phone;
    let value = phone?.trim();

    if (!value) {
         return { value: null, original, corrected: false, isValid: true, log: '' };
    }

    // Remove all non-numeric characters except +
    const numeric = value.replace(/[^\d+]/g, '');
    let corrected = numeric !== value.replace(/\s/g, ''); // Crude check if we stripped chars
    let log = '';

    try {
        const phoneNumber = parsePhoneNumber(value, defaultCountry);
        if (phoneNumber && phoneNumber.isValid()) {
            const formatted = phoneNumber.format('E.164');
            if (formatted !== value) {
                value = formatted;
                corrected = true;
                log = 'Formatted to E.164';
            }
            return { value, original, corrected, isValid: true, log };
        }
    } catch (e) {
        // Fallback or fail
    }

    return {
        value: null,
        original,
        corrected: false,
        isValid: false,
        log: 'Invalid phone number'
    };
};

export const cleanAddress = (address: string): CorrectionResult<string> => {
  const original = address;
  let value = address?.trim();
  
  if (!value) {
    return { value: null, original, corrected: false, isValid: true, log: '' };
  }

  // Basic cleanup: remove double spaces, fix capitalization?
  let corrected = false;
  let log = '';

  if (value.includes('  ')) {
      value = value.replace(/\s+/g, ' ');
      corrected = true;
      log = 'Normalized whitespace';
  }

  return {
    value,
    original,
    corrected,
    isValid: true,
    log
  };
};
