# Email Queue Categorization System

## Overview
This module implements a multi-layered email classification algorithm designed to organize incoming emails into structured queues (Inbox, Spam, Important, Archive, Custom). It supports plugin-based classifiers, user-defined rules, and detailed logging.

## Folder Structure

```
src/lib/EmailQueue/
├── classifiers/        # Implementation of specific classification logic
│   ├── DomainAnalyzer.ts
│   ├── HeaderInspector.ts
│   ├── ContentScanner.ts
│   ├── MetadataProcessor.ts
│   └── RuleEngine.ts
├── Inbox/              # Folder for Inbox-specific handlers (future use)
├── Spam/               # Folder for Spam-specific handlers (future use)
├── Important/          # Folder for Important-specific handlers (future use)
├── Archive/            # Folder for Archive-specific handlers (future use)
├── Custom/             # Folder for Custom-specific handlers (future use)
├── types.ts            # Shared interfaces and types
├── EmailCategorizer.ts # Main orchestration engine
├── index.ts            # Public API export
└── tests/              # Unit tests
```

## Classification Algorithm Flow
The `EmailCategorizer` runs a sequence of classifiers. Each classifier inspects the email and returns a potential categorization result with a confidence score.

1.  **Rule Engine**: Checks user-defined rules. If a match is found, it returns with 100% confidence.
2.  **Metadata Processor**: Checks for explicit flags (e.g., SEEN, FLAGGED, JUNK).
3.  **Domain Analyzer**: Checks sender domain against Whitelist (Important) and Blacklist (Spam).
4.  **Header Inspection**: Checks headers for priority (e.g., `X-Priority: 1`) or spam scores.
5.  **Content Scanner**: Performs keyword matching on Subject and Body (NLP heuristics).

## Configuration & Usage

### Basic Setup
```typescript
import { EmailCategorizer } from 'src/lib/EmailQueue';

const categorizer = new EmailCategorizer(
  ['trusted.com'], // Whitelist
  ['spammer.com'], // Blacklist
  [
    // Custom Rules
    {
        id: '1',
        name: 'Urgent Support',
        priority: 100,
        condition: (email) => email.subject.includes('URGENT'),
        action: () => ({ category: 'Important' })
    }
  ]
);

const result = await categorizer.categorize(emailMetadata);
console.log(result.category); // 'Inbox', 'Spam', etc.
```

### Extension Points
You can add custom classifiers by implementing the `IClassifier` interface:

```typescript
import { IClassifier, EmailMetadata, ClassificationResult } from 'src/lib/EmailQueue/types';

class MyAIClassifier implements IClassifier {
  name = 'MyAI';
  version = '1.0';
  async classify(email: EmailMetadata) {
    // Call external AI API
    return { category: 'Custom', confidence: 0.8 };
  }
}

categorizer.registerClassifier(new MyAIClassifier());
```

## Logging
The classification result includes a `metadata.log` field containing the decision trail:

```json
{
  "category": "Important",
  "confidence": 0.8,
  "reasons": ["Sender domain trusted.com is whitelisted"],
  "metadata": {
    "log": [
      {
        "classifier": "DomainAnalyzer",
        "result": { "category": "Important", "confidence": 0.8 }
      }
    ]
  }
}
```

## Performance
- **Target**: Sub-100ms latency.
- **Optimization**: Classifiers are ordered by cost (Rules -> Metadata -> Domain -> Header -> Content). High confidence matches (>0.99) short-circuit the process.

