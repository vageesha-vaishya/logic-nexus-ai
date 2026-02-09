export interface EmailProviderConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'boolean' | 'select';
  options?: { label: string; value: string }[]; // For select
  required?: boolean;
  defaultValue?: any;
  placeholder?: string;
  helperText?: string;
}

export interface IEmailProvider {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly requiresOAuth: boolean;

  /**
   * Returns the configuration fields required for this provider.
   */
  getConfigFields(): EmailProviderConfigField[];

  /**
   * Validates the configuration.
   * For SMTP, checks connection.
   * For OAuth, might just verify the token format or readiness.
   */
  validateConfig(config: any): Promise<{ isValid: boolean; error?: string }>;
}
