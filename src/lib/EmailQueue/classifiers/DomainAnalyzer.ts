import { IClassifier, EmailMetadata, ClassificationResult } from '../types';

export class DomainAnalyzer implements IClassifier {
  name = 'DomainAnalyzer';
  version = '1.0.0';

  private whitelist: Set<string>;
  private blacklist: Set<string>;

  constructor(whitelist: string[] = [], blacklist: string[] = []) {
    this.whitelist = new Set(whitelist.map(d => d.toLowerCase()));
    this.blacklist = new Set(blacklist.map(d => d.toLowerCase()));
  }

  async classify(email: EmailMetadata): Promise<Partial<ClassificationResult>> {
    const domain = email.from.split('@')[1]?.toLowerCase();
    
    if (!domain) {
      return { reasons: ['Malformed sender address'] };
    }

    if (this.blacklist.has(domain)) {
      return {
        category: 'Spam',
        confidence: 1.0,
        reasons: [`Sender domain ${domain} is blacklisted`],
        ruleApplied: 'DomainBlacklist'
      };
    }

    if (this.whitelist.has(domain)) {
      return {
        category: 'Important',
        confidence: 0.8,
        reasons: [`Sender domain ${domain} is whitelisted`],
        ruleApplied: 'DomainWhitelist'
      };
    }

    return {};
  }
}
