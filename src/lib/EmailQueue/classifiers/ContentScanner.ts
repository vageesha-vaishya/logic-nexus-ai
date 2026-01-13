import { IClassifier, EmailMetadata, ClassificationResult } from '../types';

export class ContentScanner implements IClassifier {
  name = 'ContentScanner';
  version = '1.0.0';

  private keywords: Record<string, string[]> = {
    'Spam': ['lottery', 'winner', 'inheritance', 'viagra', 'casino', 'bitcoin', 'cryptocurrency', 'limited time offer'],
    'Important': ['deadline', 'urgent', 'asap', 'invoice', 'contract', 'agreement', 'security alert'],
    'Archive': ['newsletter', 'subscription', 'receipt', 'confirmation', 'notification']
  };

  async classify(email: EmailMetadata): Promise<Partial<ClassificationResult>> {
    const text = (email.subject + ' ' + email.body).toLowerCase();
    const reasons: string[] = [];
    let bestCategory: ClassificationResult['category'] | undefined;
    let maxScore = 0;

    for (const [category, words] of Object.entries(this.keywords)) {
      let score = 0;
      const matches: string[] = [];

      for (const word of words) {
        if (text.includes(word)) {
          score += 1;
          matches.push(word);
        }
      }

      if (score > 0) {
        reasons.push(`Found keywords for ${category}: ${matches.join(', ')}`);
        // Simple heuristic: more matches = higher confidence
        const confidence = Math.min(0.5 + (score * 0.1), 0.9);
        
        if (confidence > maxScore) {
          maxScore = confidence;
          bestCategory = category as ClassificationResult['category'];
        }
      }
    }

    if (bestCategory) {
      return {
        category: bestCategory,
        confidence: maxScore,
        reasons,
        ruleApplied: 'ContentKeywordMatch'
      };
    }

    return {};
  }
}
