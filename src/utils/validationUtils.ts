
/**
 * Validation utilities for network addresses and other form inputs.
 */

export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

/**
 * Validates a port number.
 * @param port The port to validate
 * @returns ValidationResult
 */
export const validatePort = (port: number | string): ValidationResult => {
  const p = typeof port === 'string' ? parseInt(port, 10) : port;
  
  if (isNaN(p)) {
    return { isValid: false, message: 'Port must be a number' };
  }
  
  if (p < 1 || p > 65535) {
    return { isValid: false, message: 'Port must be between 1 and 65535' };
  }
  
  return { isValid: true };
};

/**
 * Validates a hostname or IPv4 address.
 * @param host The hostname or IP to validate
 * @returns ValidationResult
 */
export const validateHostname = (host: string): ValidationResult => {
  if (!host) {
    return { isValid: false, message: 'Hostname is required' };
  }

  // Remove whitespace
  const trimmed = host.trim();
  
  // Check for spaces (invalid in hostnames)
  if (/\s/.test(trimmed)) {
    return { isValid: false, message: 'Hostname cannot contain spaces' };
  }

  // IPv4 Validation
  // Simple regex for format, then check ranges
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipv4Match = trimmed.match(ipv4Regex);
  
  if (ipv4Match) {
    // Check each octet
    const parts = ipv4Match.slice(1, 5).map(Number);
    const isValidIp = parts.every(part => part >= 0 && part <= 255);
    if (!isValidIp) {
      return { isValid: false, message: 'Invalid IP address: octets must be between 0 and 255' };
    }
    return { isValid: true };
  }

  // Hostname Validation
  // RFC 1123: Alphanumeric, hyphens, dots. 
  // Cannot start or end with hyphen.
  // Max length 253.
  if (trimmed.length > 253) {
    return { isValid: false, message: 'Hostname too long (max 253 characters)' };
  }

  // Allow localhost
  if (trimmed === 'localhost') return { isValid: true };

  // General hostname regex
  // Subdomains can contain letters, numbers, hyphens.
  // TLD must be letters (usually, but numbers technically allowed in some internal networks).
  // We'll use a relatively permissive regex to avoid blocking valid internal names.
  // ^(?=.{1,253}$)(?:(?!-)[a-zA-Z0-9-]{1,63}(?<!-)\.)+[a-zA-Z]{2,63}$ is strict.
  // Let's go with something simpler but robust enough for common errors.
  
  const validHostnameChars = /^[a-zA-Z0-9.-]+$/;
  if (!validHostnameChars.test(trimmed)) {
    return { isValid: false, message: 'Hostname contains invalid characters' };
  }

  if (trimmed.startsWith('-') || trimmed.endsWith('-')) {
    return { isValid: false, message: 'Hostname cannot start or end with a hyphen' };
  }
  
  if (trimmed.startsWith('.') || trimmed.endsWith('.')) {
     return { isValid: false, message: 'Hostname cannot start or end with a dot' };
  }

  return { isValid: true };
};

/**
 * Checks if a string contains a port definition (e.g. "host:port")
 * @param input The input string
 * @returns Object containing host and port if found
 */
export const parseHostPort = (input: string): { host: string, port?: number } | null => {
  // Check for host:port format
  // Note: IPv6 uses [host]:port, but we are focusing on IPv4/Hostname for now as per requirements.
  const parts = input.split(':');
  if (parts.length === 2) {
    const port = parseInt(parts[1], 10);
    if (!isNaN(port) && port >= 1 && port <= 65535) {
      return {
        host: parts[0],
        port: port
      };
    }
  }
  return null;
};
