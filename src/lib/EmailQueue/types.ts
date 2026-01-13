export interface EmailMetadata {
  id: string;
  subject: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  body: string;
  headers: Record<string, string>;
  receivedAt: Date;
  flags: string[];
}

export interface ClassificationResult {
  category: 'Inbox' | 'Spam' | 'Important' | 'Archive' | 'Custom';
  subCategory?: string;
  confidence: number;
  ruleApplied?: string;
  reasons: string[];
  processingTimeMs: number;
  metadata: Record<string, any>;
}

export interface IClassifier {
  name: string;
  version: string;
  classify(email: EmailMetadata): Promise<Partial<ClassificationResult>>;
}

export interface QueueRule {
  id: string;
  name: string;
  priority: number;
  condition: (email: EmailMetadata) => boolean;
  action: (email: EmailMetadata) => Partial<ClassificationResult>;
}
