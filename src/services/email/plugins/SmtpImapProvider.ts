import { IEmailProvider, EmailProviderConfigField } from './IEmailProvider';

export class SmtpImapProvider implements IEmailProvider {
  readonly id = 'smtp_imap';
  readonly name = 'SMTP / IMAP';
  readonly description = 'Connect using standard SMTP and IMAP credentials';
  readonly requiresOAuth = false;

  getConfigFields(): EmailProviderConfigField[] {
    return [
      {
        key: 'display_name',
        label: 'Display Name',
        type: 'text',
        required: true,
        placeholder: 'My Work Email'
      },
      {
        key: 'email_address',
        label: 'Email Address',
        type: 'text',
        required: true,
        placeholder: 'user@example.com'
      },
      {
        key: 'is_primary',
        label: 'Set as primary account',
        type: 'boolean',
        defaultValue: false
      },
      // SMTP
      {
        key: 'smtp_host',
        label: 'SMTP Host',
        type: 'text',
        required: true,
        placeholder: 'smtp.example.com'
      },
      {
        key: 'smtp_port',
        label: 'SMTP Port',
        type: 'number',
        required: true,
        defaultValue: 587
      },
      {
        key: 'smtp_username',
        label: 'SMTP Username',
        type: 'text',
        required: true
      },
      {
        key: 'smtp_password',
        label: 'SMTP Password',
        type: 'password',
        required: true
      },
      {
        key: 'smtp_use_tls',
        label: 'Use TLS (SMTP)',
        type: 'boolean',
        defaultValue: true
      },
      // IMAP
      {
        key: 'imap_host',
        label: 'IMAP Host',
        type: 'text',
        required: true,
        placeholder: 'imap.example.com'
      },
      {
        key: 'imap_port',
        label: 'IMAP Port',
        type: 'number',
        required: true,
        defaultValue: 993
      },
      {
        key: 'imap_username',
        label: 'IMAP Username',
        type: 'text',
        required: true
      },
      {
        key: 'imap_password',
        label: 'IMAP Password',
        type: 'password',
        required: true
      },
      {
        key: 'imap_use_ssl',
        label: 'Use SSL (IMAP)',
        type: 'boolean',
        defaultValue: true
      }
    ];
  }

  async validateConfig(config: any): Promise<{ isValid: boolean; error?: string }> {
    // In a real implementation, we would call an edge function to test the connection
    // For now, just check required fields
    if (!config.email_address || !config.smtp_host) {
      return { isValid: false, error: 'Missing required fields' };
    }
    return { isValid: true };
  }
}
