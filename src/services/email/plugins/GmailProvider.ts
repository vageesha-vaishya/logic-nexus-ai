import { IEmailProvider, EmailProviderConfigField } from './IEmailProvider';

export class GmailProvider implements IEmailProvider {
  readonly id = 'gmail';
  readonly name = 'Gmail / Google Workspace';
  readonly description = 'Connect using Google OAuth';
  readonly requiresOAuth = true;

  getConfigFields(): EmailProviderConfigField[] {
    return [
      {
        key: 'email_address',
        label: 'Email Address',
        type: 'text',
        required: true,
        placeholder: 'you@gmail.com'
      },
      {
        key: 'display_name',
        label: 'Display Name',
        type: 'text',
        required: true,
        placeholder: 'My Gmail Account'
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
