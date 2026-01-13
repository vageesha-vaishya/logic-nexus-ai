import { IClassifier, EmailMetadata, ClassificationResult, QueueRule } from '../types';

export class RuleEngine implements IClassifier {
  name = 'RuleEngine';
  version = '1.0.0';

  private rules: QueueRule[];

  constructor(rules: QueueRule[] = []) {
    // Sort rules by priority (descending)
    this.rules = rules.sort((a, b) => b.priority - a.priority);
  }

  async classify(email: EmailMetadata): Promise<Partial<ClassificationResult>> {
    for (const rule of this.rules) {
      try {
        if (rule.condition(email)) {
          const result = rule.action(email);
          return {
            ...result,
            ruleApplied: `UserRule:${rule.name}`,
            confidence: 1.0, // Rules are deterministic
            reasons: [`Matched user rule: ${rule.name}`]
          };
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.name}:`, error);
        // Continue to next rule
      }
    }
    return {};
  }
}
