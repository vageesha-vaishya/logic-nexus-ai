import { IClassifier, EmailMetadata, ClassificationResult, QueueRule } from './types';
import { DomainAnalyzer } from './classifiers/DomainAnalyzer';
import { HeaderInspector } from './classifiers/HeaderInspector';
import { ContentScanner } from './classifiers/ContentScanner';
import { MetadataProcessor } from './classifiers/MetadataProcessor';
import { RuleEngine } from './classifiers/RuleEngine';

export class EmailCategorizer {
  private classifiers: IClassifier[] = [];

  constructor(
    whitelist: string[] = [],
    blacklist: string[] = [],
    rules: QueueRule[] = []
  ) {
    // Initialize classifiers in order of precedence/cost
    // 1. Rule Engine (User overrides everything)
    this.classifiers.push(new RuleEngine(rules));
    
    // 2. Metadata (Explicit flags)
    this.classifiers.push(new MetadataProcessor());
    
    // 3. Domain Analysis (Fast, high confidence)
    this.classifiers.push(new DomainAnalyzer(whitelist, blacklist));
    
    // 4. Header Inspection (Fast)
    this.classifiers.push(new HeaderInspector());
    
    // 5. Content Scanner (Slow, heuristic)
    this.classifiers.push(new ContentScanner());
  }

  public registerClassifier(classifier: IClassifier) {
    this.classifiers.push(classifier);
  }

  async categorize(email: EmailMetadata): Promise<ClassificationResult> {
    const startTime = Date.now();
    const allReasons: string[] = [];
    const classificationLog: any[] = [];

    let bestResult: Partial<ClassificationResult> | null = null;

    for (const classifier of this.classifiers) {
      try {
        const result = await classifier.classify(email);
        
        classificationLog.push({
          classifier: classifier.name,
          result
        });

        if (result.reasons) {
          allReasons.push(...result.reasons);
        }

        // If we have a high confidence match, we might stop early or weight it
        if (result.category && result.confidence) {
          if (!bestResult || (result.confidence > (bestResult.confidence || 0))) {
            bestResult = result;
            
            // If confidence is very high (e.g. whitelist or user rule), stop processing
            if (result.confidence >= 0.99) {
              break;
            }
          }
        }
      } catch (error) {
        console.error(`Error in classifier ${classifier.name}:`, error);
        allReasons.push(`Error in ${classifier.name}`);
      }
    }

    const processingTimeMs = Date.now() - startTime;

    // Default to Inbox if no category found
    const finalCategory = bestResult?.category || 'Inbox';
    const finalConfidence = bestResult?.confidence || 0;

    return {
      category: finalCategory,
      subCategory: bestResult?.subCategory,
      confidence: finalConfidence,
      ruleApplied: bestResult?.ruleApplied,
      reasons: allReasons,
      processingTimeMs,
      metadata: {
        log: classificationLog
      }
    };
  }
}
