import { IEmailProvider, EmailProviderConfigField } from './IEmailProvider';

export class Office365Provider implements IEmailProvider {
  readonly id = 'office365';
  readonly name = 'Microsoft Office 365';
  readonly description = 'Connect using Microsoft Graph API';
  readonly requiresOAuth = true;

  getConfigFields(): EmailProviderConfigField[] {
    return [
      {
        key: 'email_address',
        label: 'Email Address',
        type: 'text',
        required: true,
        placeholder: 'you@company.com'
      },
      {
        key: 'display_name',
        label: 'Display Name',
        type: 'text',
        required: true,
        placeholder: 'My Office 365 Account'
      },
      {
        key: 'is_primary',
        label: 'Set as primary account',
        type: 'boolean',
        defaultValue: false
      }
    ];
  }

  async validateConfig(config: any): Promise<{ isValid: boolean; error?: string }> {
    return { isValid: true };
  }
}
