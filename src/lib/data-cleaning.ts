
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
    return { value: null, original, corrected: false, isValid: false, log: 'Empty email' };
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

  return {
    value: emailRegex.test(value) ? value : null,
    original,
    corrected,
    isValid: emailRegex.test(value),
    log: emailRegex.test(value) ? log : (log ? log + '; Invalid email format' : 'Invalid email format')
  };
};

export const cleanUrl = (url: string): CorrectionResult<string> => {
  const original = url;
  let value = url?.trim();

  if (!value) {
    return { value: null, original, corrected: false, isValid: false, log: 'Empty URL' };
  }

  let corrected = false;
  let log = '';

  // Add protocol if missing
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
    corrected = true;
    log = 'Added https:// protocol';
  }

  try {
    const urlObj = new URL(value);
    // Basic normalization
    // new URL() adds trailing slash for root paths, which might be why tests fail?
    // Let's strip trailing slash if it wasn't there in original... 
    // or just accept standard normalization.
    // The test expects 'https://example.com' but got 'https://example.com/'
    
    let newValue = urlObj.toString();
    if (newValue.endsWith('/') && !original.endsWith('/')) {
        newValue = newValue.slice(0, -1);
    }

    if (newValue !== value) {
        value = newValue;
        corrected = true; 
        // Logic above might double count correction if we just added protocol
    }
    return {
        value,
        original,
        corrected,
        isValid: true,
        log
    };
  } catch (e) {
    return {
        value: null,
        original,
        corrected: false,
        isValid: false,
        log: 'Invalid URL format'
    };
  }
};

export const cleanPhone = (phone: string): CorrectionResult<string> => {
  const original = phone;
  let value = phone?.trim();

  if (!value) {
    return { value: null, original, corrected: false, isValid: false, log: 'Empty phone' };
  }

  let corrected = false;
  let log = '';

  // Use libphonenumber-js if available, otherwise regex
  // Since I don't want to install new packages if not present, I'll check package.json first?
  // User asked for "robust", so I'll assume I can add it or use regex.
  // I'll stick to regex/basic logic for now to avoid dependency issues unless I see it used elsewhere.
  // Wait, I saw imports in other files? No.
  
  // Basic normalization: remove non-digit characters except +
  const cleaned = value.replace(/[^\d+]/g, '');
  
  if (cleaned !== value) {
      corrected = true;
      log = 'Removed non-standard characters';
      value = cleaned;
  }
  
  if (!value) {
     return { value: null, original, corrected: false, isValid: false, log: 'Invalid phone format' };
  }

  // Format check (E.164-ish or just digits)
  // If it is 10 digits (US standard), assume +1
  if (value.length === 10 && /^\d+$/.test(value)) {
     value = `+1${value}`;
     corrected = true;
     log = log ? `${log}; Added +1 prefix` : 'Added +1 prefix';
  }
  
  const isValid = value.length >= 7; // Minimal check

  return {
      value: isValid ? value : null,
      original,
      corrected,
      isValid,
      log: isValid ? log : 'Invalid phone format'
  };
};

export const cleanAddress = (address: string): CorrectionResult<string> => {
    // If address is a single string, try to normalize whitespace/capitalization
    const original = address;
    let value = address?.trim();

    if (!value) {
        return { value: null, original, corrected: false, isValid: false };
    }

    let corrected = false;
    let log = '';

    // Normalize whitespace
    if (/\s\s+/.test(value)) {
        value = value.replace(/\s\s+/g, ' ');
        corrected = true;
        log = 'Normalized whitespace';
    }

    // Capitalize first letter of words (Title Case) - simplistic
    // This is risky for things like "PO Box" or "McDonald", but generic Title Case is often better than ALL CAPS
    const isAllCaps = value === value.toUpperCase() && value !== value.toLowerCase();
    const isAllLower = value === value.toLowerCase() && value !== value.toUpperCase();

    if (isAllCaps || isAllLower) {
        value = value.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
        corrected = true;
        log = 'Converted to Title Case';
    }

    return {
        value,
        original,
        corrected,
        isValid: true,
        log
    };
};
