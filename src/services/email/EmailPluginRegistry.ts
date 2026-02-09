import { IEmailProvider } from './plugins/IEmailProvider';
import { GmailProvider } from './plugins/GmailProvider';
import { Office365Provider } from './plugins/Office365Provider';
import { SmtpImapProvider } from './plugins/SmtpImapProvider';

class EmailPluginRegistry {
  private plugins: Map<string, IEmailProvider> = new Map();

  constructor() {
    this.register(new GmailProvider());
    this.register(new Office365Provider());
    this.register(new SmtpImapProvider());
  }

  register(plugin: IEmailProvider) {
    this.plugins.set(plugin.id, plugin);
  }

  getPlugin(id: string): IEmailProvider | undefined {
    return this.plugins.get(id);
  }

  getAllPlugins(): IEmailProvider[] {
    return Array.from(this.plugins.values());
  }
}

export const emailPluginRegistry = new EmailPluginRegistry();
