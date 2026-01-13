import { IClassifier, EmailMetadata, ClassificationResult } from '../types';

export class HeaderInspector implements IClassifier {
  name = 'HeaderInspector';
  version = '1.0.0';

  async classify(email: EmailMetadata): Promise<Partial<ClassificationResult>> {
    const reasons: string[] = [];
    let confidence = 0;
    let category: ClassificationResult['category'] | undefined;

    // Check for high priority headers
    const priorityHeader = email.headers['x-priority'] || email.headers['priority'] || email.headers['importance'];
    if (priorityHeader) {
      if (['1', 'high', 'urgent'].includes(priorityHeader.toLowerCase())) {
        category = 'Important';
        confidence = 0.9;
        reasons.push(`High priority header detected: ${priorityHeader}`);
      }
    }

    // Check subject line markers
    const subject = email.subject.toUpperCase();
    if (subject.includes('URGENT') || subject.includes('IMPORTANT') || subject.startsWith('!')) {
      category = 'Important';
      confidence = Math.max(confidence, 0.85);
      reasons.push('Priority marker found in subject');
    }

    // Check for spam headers (often added by upstream MTAs)
    const spamStatus = email.headers['x-spam-status'];
    if (spamStatus && spamStatus.toLowerCase().startsWith('yes')) {
      category = 'Spam';
      confidence = 0.95;
      reasons.push('Upstream spam header detected');
    }

    if (category) {
      return {
        category,
        confidence,
        reasons,
        ruleApplied: 'HeaderInspection'
      };
    }

    return {};
  }
}
