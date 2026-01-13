import { IClassifier, EmailMetadata, ClassificationResult } from '../types';

export class MetadataProcessor implements IClassifier {
  name = 'MetadataProcessor';
  version = '1.0.0';

  async classify(email: EmailMetadata): Promise<Partial<ClassificationResult>> {
    const reasons: string[] = [];

    // Process explicit flags
    if (email.flags.includes('SEEN') || email.flags.includes('READ')) {
        // Maybe Archive if it's old? Not necessarily.
    }

    if (email.flags.includes('FLAGGED') || email.flags.includes('STARRED')) {
      return {
        category: 'Important',
        confidence: 1.0, // Explicit user action is high confidence
        reasons: ['Email is flagged/starred'],
        ruleApplied: 'UserFlag'
      };
    }

    if (email.flags.includes('JUNK')) {
      return {
        category: 'Spam',
        confidence: 1.0,
        reasons: ['Email explicitly flagged as Junk'],
        ruleApplied: 'UserFlag'
      };
    }

    // Process custom headers that might indicate system processing
    if (email.headers['x-category']) {
      const cat = email.headers['x-category'];
      // Map x-category to our known categories if possible
      reasons.push(`Custom category header found: ${cat}`);
      return {
          category: 'Custom',
          subCategory: cat,
          confidence: 0.9,
          reasons,
          ruleApplied: 'CustomHeader'
      };
    }

    return {};
  }
}
